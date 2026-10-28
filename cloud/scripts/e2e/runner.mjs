// A Runner on this machine with its own WILDCRANE_HOME, signed in as the test account.
// `stable` installs what npm names latest and runs its launcher, which then takes the version
// Cloud names — what a user gets. `source` builds this checkout's runner/ and runs it as is.

import { execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { git } from '../commit.mjs'
import { SUPABASE_URL } from './prod.mjs'

const NPM = 'https://registry.npmjs.org'
const BUILD_DIRS = ['runner', 'cli', 'review', 'artifact-sdk', 'skill', 'cloud/src']

const sh = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: '' }, maxBuffer: 64 << 20 }).toString()

/** The launcher to run and the version it is: npm's latest, or a build of HEAD. */
export async function prepareRunner(kind, work) {
  if (kind === 'stable') {
    const dir = join(work, 'npm')
    await mkdir(dir, { recursive: true })
    sh('npm', ['install', '--no-save', '--prefix', dir, '--registry', NPM, 'wildcrane-runner@latest'], dir)
    const pkg = join(dir, 'node_modules', 'wildcrane-runner')
    const { version } = JSON.parse(await readFile(join(pkg, 'package.json'), 'utf8'))
    return { entry: join(pkg, 'bin', 'wildcrane-runner.mjs'), version, kind }
  }
  const sha = git('rev-parse', '--short', 'HEAD')
  const dir = join('/tmp', `wc-e2e-runner-${sha}`)
  const entry = join(dir, 'runner', 'dist', 'runner.mjs')
  if (!existsSync(entry)) {
    await mkdir(dir, { recursive: true })
    execFileSync('sh', ['-c', `git archive HEAD ${BUILD_DIRS.join(' ')} | tar -x -C ${dir}`], { cwd: git('rev-parse', '--show-toplevel') })
    for (const app of ['cli', 'runner']) sh('npm', ['install', '--include=dev', '--ignore-scripts', '--registry', NPM], join(dir, app))
    sh('npm', ['run', 'build'], join(dir, 'cli'))
    sh('node', ['scripts/build.mjs'], join(dir, 'runner'))
  }
  const { version } = JSON.parse(await readFile(join(dir, 'runner', 'package.json'), 'utf8'))
  return { entry, version: `${version} (${sha})`, kind }
}

/** Writes the files the desktop app would: the session, a machine id and the project list. */
export async function seedHome(home, session, projectDir) {
  await mkdir(home, { recursive: true })
  const machineId = randomUUID()
  await writeFile(join(home, 'machine.json'), JSON.stringify({ id: machineId }))
  await writeFile(join(home, 'projects.json'), JSON.stringify({ projects: [projectDir] }))
  await writeFile(join(home, 'session.json'), JSON.stringify({
    version: 1,
    supabaseUrl: SUPABASE_URL,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
    subject: JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url')).sub,
    email: session.email,
  }), { mode: 0o600 })
  return machineId
}

/** Starts the Runner; its output is added to `log`. Stop kills its whole process group. */
export function startRunner(runner, home, log) {
  const out = createWriteStream(log, { flags: 'a' })
  // A user's Runner inherits nothing from a board run or desktop shell this script may sit in.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(KANBAN_|AI4KANBAN_|WILDCRANE_|ELECTRON_|NODE_ENV$)/.test(k)))
  const child = spawn(process.execPath, [runner.entry], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...env, WILDCRANE_HOME: home, WILDCRANE_POLL_MS: '5000' },
  })
  child.stdout.pipe(out)
  child.stderr.pipe(out)
  let exited = null
  child.on('exit', (code) => (exited = code ?? -1))
  return {
    pid: child.pid,
    exited: () => exited,
    async stop() {
      if (exited !== null) return
      try {
        process.kill(-child.pid, 'SIGTERM')
      } catch {}
      for (let i = 0; i < 20 && exited === null; i++) await new Promise((r) => setTimeout(r, 500))
      try {
        process.kill(-child.pid, 'SIGKILL')
      } catch {}
    },
  }
}
