#!/usr/bin/env node
// The release checklist in PUBLISHING.md, as one command. Each step that used to be a silent
// trap is a check here: a failure stops with the step, the reason and what to re-run.
//
//   node scripts/publish.mjs 0.12.0            # tag, build, test — stops for the macOS check
//   node scripts/publish.mjs 0.12.0 --checked  # after it: push, release, deploy the site
//
// Re-running the same version continues from the step that stopped. What is done is recorded
// in the release clone, /tmp/rel-<version>/.git/publish-state.json.

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PROXIES = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']
const NPMJS = 'https://registry.npmjs.org/'
const SITE = 'https://wildcrane.ai/download'
const PACKAGE = 'wildcrane'
const DEPRECATED = 'ai4kanban is now wildcrane: npm uninstall -g ai4kanban && npm install -g wildcrane'

// What scripts/sync-version.mjs stamps, minus cli/dist/ (not in git).
const VERSION_FILES = [
  'VERSION',
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  'kanban-ui/package.json',
  'cli/package.json',
  'desktop/package.json',
  'cli/src/version.ts',
]

const args = process.argv.slice(2)
const version = args.find((a) => !a.startsWith('--'))
const checked = args.includes('--checked')
if (!version || !/^\d+\.\d+\.\d+([-.][0-9A-Za-z-]+)*$/.test(version)) {
  console.error('usage: node scripts/publish.mjs <version> [--checked]')
  process.exit(1)
}
const tag = `v${version}`
const CLONE = `/tmp/rel-${version}`
const STATE = path.join(CLONE, '.git', 'publish-state.json')
const DIST = path.join(CLONE, 'desktop', 'dist')

// Seven builds and the four feeds the in-app install reads. No blockmaps: nothing reads them.
const ASSETS = [
  `WildCrane-${version}-arm64.dmg`,
  `WildCrane-${version}.dmg`,
  `WildCrane-${version}-arm64-mac.zip`,
  `WildCrane-${version}-mac.zip`,
  `WildCrane-Setup-${version}.exe`,
  `WildCrane-${version}.AppImage`,
  `WildCrane-${version}-arm64.AppImage`,
  'latest.yml',
  'latest-mac.yml',
  'latest-linux.yml',
  'latest-linux-arm64.yml',
]

// Each unpacked build, and where its board server sits inside it.
const SERVERS = [
  'mac/WildCrane.app/Contents/Resources',
  'mac-arm64/WildCrane.app/Contents/Resources',
  'win-unpacked/resources',
  'win-arm64-unpacked/resources',
  'linux-unpacked/resources',
  'linux-arm64-unpacked/resources',
]

class StepError extends Error {
  constructor(reason, fix) {
    super(reason)
    this.fix = fix
  }
}

const without = (env, names) => Object.fromEntries(Object.entries(env).filter(([k]) => !names.includes(k)))
// NODE_ENV=production makes npm skip devDependencies — the build tools. A shell started from
// the board's own server carries its Next variables, and `next build` then dies with
// "generate is not a function".
const BUILD_ENV = without(process.env, [
  'NODE_ENV',
  'NEXT_DEPLOYMENT_ID',
  ...Object.keys(process.env).filter((k) => k.startsWith('__NEXT_PRIVATE_')),
])
const DIRECT_ENV = without(BUILD_ENV, PROXIES)

function run(cmd, cmdArgs, { cwd = CLONE, env = BUILD_ENV, capture = false } = {}) {
  console.log(`  $ ${[cmd, ...cmdArgs].join(' ')}${cwd === CLONE ? '' : `   (in ${cwd})`}`)
  const r = spawnSync(cmd, cmdArgs, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })
  if (r.error) throw new StepError(`${cmd}: ${r.error.message}`)
  if (r.status !== 0) {
    throw new StepError(`\`${[cmd, ...cmdArgs].join(' ')}\` exited ${r.status}${capture ? `\n${r.stderr.trim()}` : ''}`)
  }
  return capture ? r.stdout.trim() : ''
}

const git = (gitArgs, opts) => run('git', gitArgs, { capture: true, ...opts })

function tagExists() {
  return spawnSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], { cwd: ROOT }).status === 0
}

// What changed since the previous release decides which services redeploy.
let changedPaths
function changed(...dirs) {
  if (!changedPaths) {
    const prev = git(['describe', '--tags', '--abbrev=0', `${tag}^`])
    changedPaths = git(['diff', '--name-only', prev, tag]).split('\n')
  }
  return changedPaths.some((f) => dirs.some((d) => f === d || f.startsWith(`${d}/`)))
}
const cloudChanged = () => changed('cloud')
const cloudUiChanged = () => changed('cloud-ui', 'kanban-ui')
const telemetryChanged = () => changed('telemetry')

function readDotEnv(file) {
  if (!fs.existsSync(file)) return {}
  const out = {}
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return out
}

function findLinkedNodeModules(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git') continue
    const full = path.join(dir, entry.name)
    if (entry.name === 'node_modules') {
      if (entry.isSymbolicLink()) return full
      continue
    }
    if (entry.isDirectory()) {
      const hit = findLinkedNodeModules(full)
      if (hit) return hit
    }
  }
  return null
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

async function probeServer(resources) {
  const server = path.join(resources, 'server')
  if (!fs.existsSync(path.join(server, 'node_modules', 'next'))) {
    throw new StepError(`${path.relative(DIST, server)} has no node_modules/next — the app could not start its board`)
  }
  const port = await freePort()
  const board = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-board-'))
  const child = spawn(process.execPath, ['server.js'], {
    cwd: server,
    env: {
      ...without(process.env, PROXIES),
      NODE_ENV: 'production',
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      KANBAN_BOARD_DIR: board,
      AI4KANBAN_CLI: path.join(resources, 'cli', 'dist', 'kanban.mjs'),
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let stderr = ''
  child.stderr.on('data', (d) => (stderr += d))
  try {
    for (let i = 0; i < 60; i++) {
      if (child.exitCode !== null) break
      const status = await fetch(`http://127.0.0.1:${port}/`).then((r) => r.status, () => 0)
      if (status === 200) return console.log(`  ok  ${path.relative(DIST, server)}`)
      await new Promise((r) => setTimeout(r, 500))
    }
    throw new StepError(`${path.relative(DIST, server)} never answered 200\n${stderr.trim().slice(-2000)}`)
  } finally {
    child.kill()
    fs.rmSync(board, { recursive: true, force: true })
  }
}

// `npm_config_registry` from a pnpm shell would beat the npmrc and send a publish to a mirror.
const npmEnv = () => without(BUILD_ENV, ['npm_config_registry', 'NPM_CONFIG_REGISTRY'])

// The global ~/.npmrc points at a read-only mirror, so writes get a throwaway one with the token.
function withNpmToken(fn) {
  const token = process.env.NPM_TOKEN || readDotEnv(path.join(ROOT, '.env')).NPM_TOKEN
  if (!token) throw new StepError('no NPM_TOKEN', `put NPM_TOKEN=… in ${path.join(ROOT, '.env')}`)
  const rc = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rel-npmrc-')), '.npmrc')
  fs.writeFileSync(rc, `registry=${NPMJS}\n//registry.npmjs.org/:_authToken=${token}\n`, { mode: 0o600 })
  try {
    fn(rc)
  } finally {
    fs.rmSync(path.dirname(rc), { recursive: true, force: true })
  }
}

const MAC_CHECKLIST = `
Check the build on macOS before anything leaves this machine:

  1. Open ${DIST}/mac-arm64/WildCrane.app and run one task end to end.
  2. Keep a build of this code stamped a version lower than ${version}, outside dist/ —
     after publishing, it is the only proof the real feed installs (desktop/README.md,
     "Keeping a fixture for the published feed").

Then continue:  node scripts/publish.mjs ${version} --checked
`

const STEPS = [
  {
    name: 'preflight',
    skip: tagExists,
    run() {
      const branch = git(['branch', '--show-current'], { cwd: ROOT })
      if (branch !== 'main') throw new StepError(`the repo is on "${branch}", not main`, 'git checkout main')
      run('claude', ['plugin', 'validate', '.'], { cwd: ROOT })
      run('npm', ['run', 'lint'], { cwd: path.join(ROOT, 'cli') })
    },
  },
  {
    name: 'version and tag',
    skip: tagExists,
    run() {
      run(process.execPath, ['scripts/sync-version.mjs', version], { cwd: ROOT })
      // Commit only the stamped files: other sessions often have work in progress here.
      if (git(['status', '--porcelain', '--', ...VERSION_FILES], { cwd: ROOT })) {
        git(['commit', '-m', `Release ${version}`, '--', ...VERSION_FILES], { cwd: ROOT })
      }
      // Annotated: `git push --follow-tags` leaves a lightweight tag behind.
      git(['tag', '-a', tag, '-m', `Release ${version}`], { cwd: ROOT })
    },
  },
  {
    name: 'clone',
    run() {
      fs.rmSync(CLONE, { recursive: true, force: true })
      run('git', ['clone', '--local', '--quiet', ROOT, CLONE], { cwd: ROOT })
      git(['checkout', '--quiet', tag])
    },
  },
  {
    name: 'install',
    run() {
      const apps = ['cli', 'kanban-ui', 'desktop', 'web']
      if (cloudChanged()) apps.push('cloud')
      if (cloudUiChanged()) apps.push('cloud-ui')
      if (telemetryChanged()) apps.push('telemetry')
      for (const app of apps) {
        run('npm', ['ci'], { cwd: path.join(CLONE, app) })
        // Deploy credentials are not in git.
        for (const file of ['.env', '.dev.vars']) {
          const from = path.join(ROOT, app, file)
          if (fs.existsSync(from)) fs.copyFileSync(from, path.join(CLONE, app, file))
        }
      }
      // A linked node_modules ships the main checkout's state, or a server that only runs here.
      const link = findLinkedNodeModules(CLONE)
      if (link) throw new StepError(`${link} is a link, not an install`, `rm ${link}, then re-run`)
    },
  },
  {
    name: 'deploy cloud',
    skip: () => !cloudChanged(),
    run() {
      run('npm', ['run', 'migrate'], { cwd: path.join(CLONE, 'cloud') })
      run('npm', ['run', 'deploy'], { cwd: path.join(CLONE, 'cloud') })
    },
  },
  {
    name: 'deploy cloud-ui',
    skip: () => !cloudUiChanged(),
    run: () => run('npm', ['run', 'deploy'], { cwd: path.join(CLONE, 'cloud-ui') }),
  },
  {
    // Before the site: it drops event names it does not know.
    name: 'deploy telemetry',
    skip: () => !telemetryChanged(),
    run: () => run('npm', ['run', 'deploy'], { cwd: path.join(CLONE, 'telemetry') }),
  },
  {
    name: 'publish cli',
    run() {
      const env = npmEnv()
      const published = spawnSync('npm', ['view', `${PACKAGE}@${version}`, 'version', `--registry=${NPMJS}`], {
        env,
        encoding: 'utf8',
      })
      if (published.stdout.trim() === version) return console.log(`  ${PACKAGE}@${version} is already on npm`)
      withNpmToken((rc) => run('npm', ['publish', `--registry=${NPMJS}`], {
        cwd: path.join(CLONE, 'cli'),
        env: { ...env, NPM_CONFIG_USERCONFIG: rc },
      }))
    },
  },
  {
    // The old package name: every version points at the new one. Re-running it is harmless.
    name: 'deprecate ai4kanban',
    run: () => withNpmToken((rc) => run('npm', ['deprecate', 'ai4kanban', DEPRECATED, `--registry=${NPMJS}`], {
      env: { ...npmEnv(), NPM_CONFIG_USERCONFIG: rc },
    })),
  },
  {
    name: 'smoke-test cli',
    run() {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-smoke-'))
      try {
        git(['init', '--quiet'], { cwd: dir })
        run('npx', ['--yes', `${PACKAGE}@${version}`, 'install'], {
          cwd: dir,
          env: { ...without(BUILD_ENV, ['npm_config_registry']), NPM_CONFIG_REGISTRY: NPMJS },
        })
        if (!fs.existsSync(path.join(dir, 'docs', 'kanban'))) {
          throw new StepError(`\`npx ${PACKAGE}@${version} install\` made no docs/kanban/`)
        }
      } finally {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    },
  },
  {
    // Keeps the proxies: electron-builder downloads Electron for each system.
    name: 'build the app',
    run: () => run('npm', ['run', 'dist'], { cwd: path.join(CLONE, 'desktop') }),
  },
  {
    name: 'start each packaged board',
    async run() {
      for (const resources of SERVERS) {
        const dir = path.join(DIST, resources)
        if (!fs.existsSync(dir)) throw new StepError(`no unpacked build at ${path.relative(DIST, dir)}`)
        await probeServer(dir)
      }
      const missing = ASSETS.filter((f) => !fs.existsSync(path.join(DIST, f)))
      if (missing.length) throw new StepError(`desktop/dist/ is missing ${missing.join(', ')}`)
    },
  },
  {
    name: 'check on macOS',
    run() {
      if (checked) return
      console.log(MAC_CHECKLIST)
      process.exit(0)
    },
  },
  {
    name: 'push',
    run() {
      // Through the proxy the push can reset mid-transfer.
      run('git', ['push', 'origin', 'main', `refs/tags/${tag}`], { cwd: ROOT, env: DIRECT_ENV })
      if (!git(['ls-remote', '--tags', 'origin', `refs/tags/${tag}`], { cwd: ROOT, env: DIRECT_ENV })) {
        throw new StepError(`${tag} is not on origin after the push`, `git push origin ${tag}`)
      }
    },
  },
  {
    name: 'github release',
    run() {
      const gh = (ghArgs, capture = false) => run('gh', ghArgs, { cwd: ROOT, env: DIRECT_ENV, capture })
      const exists = spawnSync('gh', ['release', 'view', tag], { cwd: ROOT, env: DIRECT_ENV }).status === 0
      if (!exists) gh(['release', 'create', tag, '--verify-tag', '--draft', '--title', tag, '--generate-notes'])
      // `gh` exits 0 even when an upload broke off, so count what actually landed.
      gh(['release', 'upload', tag, '--clobber', ...ASSETS.map((f) => path.join(DIST, f))])
      const names = gh(['release', 'view', tag, '--json', 'assets', '-q', '.assets[].name'], true).split('\n')
      const missing = ASSETS.filter((f) => !names.includes(f))
      if (missing.length || names.length !== ASSETS.length) {
        throw new StepError(
          `the release has ${names.length} files, want these ${ASSETS.length}: missing ${missing.join(', ') || 'none'}`,
          `delete the extra files on the draft with \`gh release delete-asset ${tag} <name>\``,
        )
      }
      gh(['release', 'edit', tag, '--draft=false', '--latest'])
    },
  },
  {
    name: 'deploy the site',
    async run() {
      const web = path.join(CLONE, 'web')
      run('npm', ['run', 'build'], { cwd: web })
      // A tag checkout is a detached HEAD; without --branch, Pages files it as a preview.
      run('npx', ['--yes', 'wrangler', 'pages', 'deploy', '--branch', 'main', '--commit-dirty=true'], { cwd: web, env: DIRECT_ENV })
      const want = `releases/download/${tag}/`
      for (let i = 0; i < 12; i++) {
        const page = await fetch(`${SITE}?release=${Date.now()}`).then((r) => r.text(), () => '')
        if (page.includes(want)) return console.log(`  ok  ${SITE} links ${tag}`)
        await new Promise((r) => setTimeout(r, 5000))
      }
      throw new StepError(
        `${SITE} does not link ${tag} yet`,
        '`wrangler pages deployment list --project-name kanban-skill` should show it as Production',
      )
    },
  },
]

function readState() {
  try {
    return new Set(JSON.parse(fs.readFileSync(STATE, 'utf8')))
  } catch {
    return new Set()
  }
}

const done = fs.existsSync(STATE) ? readState() : new Set()
for (const step of STEPS) {
  if (done.has(step.name)) continue
  if (step.skip?.()) {
    console.log(`- ${step.name}: skipped`)
  } else {
    console.log(`\n▶ ${step.name}`)
    try {
      await step.run()
    } catch (error) {
      console.error(`\npublish: "${step.name}" failed: ${error.message}`)
      if (error.fix) console.error(`  fix: ${error.fix}`)
      console.error(`  then: node scripts/publish.mjs ${version}${checked ? ' --checked' : ''}`)
      process.exit(1)
    }
  }
  if (fs.existsSync(path.dirname(STATE))) {
    done.add(step.name)
    fs.writeFileSync(STATE, JSON.stringify([...done], null, 2) + '\n')
  }
}
console.log(`\n${tag} is out.`)
