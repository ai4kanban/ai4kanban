#!/usr/bin/env node
// Build the launcher and the Runner into dist/, one dependency-free file each. The Runner
// pulls in the CLI's harness, session and Realtime code from ../cli/src, and carries the CLI
// itself as dist/akb/ — the loader, its rules and the package.json it reads (#2020). The Claude
// Code and Codex plugins' component is the same Runner behind an MCP server, built with its own
// akb into each plugin's server/dist/ (#2161, #2160).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as esbuild from 'esbuild'

import { REQUIRE_SHIM } from '../../cli/scripts/shim.mjs'
import { settingsClientPlugin } from './settings-client.mjs'

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VERSION = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8')).version
const CLI_DIR = path.join(PKG_DIR, '..', 'cli')
const { version: CLI_VERSION, akbContract: AKB_CONTRACT } = JSON.parse(fs.readFileSync(path.join(CLI_DIR, 'package.json'), 'utf8'))
/** `.json` is text to the Runner's own imports; a package's (the MCP SDK's schemas) stays JSON. */
const PACKAGE_JSON = {
  name: 'package-json',
  setup(build) {
    build.onLoad({ filter: /[\\/]node_modules[\\/].*\.json$/ }, (args) => ({ contents: fs.readFileSync(args.path, 'utf8'), loader: 'json' }))
  },
}
const PLUGIN_DISTS = ['claude-code', 'codex'].map((host) => path.join(PKG_DIR, '..', 'plugins', host, 'server', 'dist'))

// 插件与 Runner 共用薄技能；指南仍从当次选定的 akb 读取。
for (const host of ['claude-code', 'codex']) {
  const dir = path.join(PKG_DIR, '..', 'plugins', host, 'skills', 'kanban')
  fs.mkdirSync(dir, { recursive: true })
  fs.copyFileSync(path.join(PKG_DIR, '..', 'skill', 'SKILL.md'), path.join(dir, 'SKILL.md'))
}

for (const [entry, outfile] of [
  ['launcher-main.ts', path.join(PKG_DIR, 'dist', 'launcher.mjs')],
  ['main.ts', path.join(PKG_DIR, 'dist', 'runner.mjs')],
  ['settings-main.ts', path.join(PKG_DIR, 'dist', 'settings.mjs')],
  ...PLUGIN_DISTS.map((dir) => ['main.ts', path.join(dir, 'runner.mjs')]),
  ...PLUGIN_DISTS.map((dir) => ['plugin-main.ts', path.join(dir, 'index.mjs')]),
  ...[path.join(PKG_DIR, 'dist'), ...PLUGIN_DISTS].map((dir) => ['akb-proxy.ts', path.join(dir, 'akb-proxy.mjs')]),
]) {
  await esbuild.build({
    entryPoints: [path.join(PKG_DIR, 'src', entry)],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    loader: { '.html': 'text', '.txt': 'text', '.md': 'text', '.tsx': 'text', '.json': 'text' },
    banner: { js: `// wildcrane-runner ${VERSION} — built by runner/scripts/build.mjs. Do not edit.\n${REQUIRE_SHIM}` },
    define: { __RUNNER_VERSION__: JSON.stringify(VERSION), __AKB_VERSION__: JSON.stringify(CLI_VERSION), __AKB_CONTRACT__: String(AKB_CONTRACT) },
    legalComments: 'none',
    plugins: [PACKAGE_JSON, settingsClientPlugin],
  })
  process.stdout.write(`build: wrote ${path.relative(PKG_DIR, outfile)} — ${(fs.statSync(outfile).size / 1024).toFixed(1)} kB\n`)
}

for (const dir of [path.join(PKG_DIR, 'dist'), ...PLUGIN_DISTS]) await buildAkb(path.join(dir, 'akb'))

async function buildAkb(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
  await esbuild.build({
    entryPoints: [path.join(CLI_DIR, 'src', 'kanban.ts')],
    outfile: path.join(dir, 'dist', 'kanban.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    loader: { '.html': 'text', '.txt': 'text', '.md': 'text', '.tsx': 'text', '.json': 'text' },
    // 保持 CLI 构建标记格式。
    banner: { js: `#!/usr/bin/env node\n// ai4kanban ${CLI_VERSION} — built by runner/scripts/build.mjs. Do not edit.\n${REQUIRE_SHIM}` },
    define: { __AKB_BUILT__: 'true' },
    legalComments: 'none',
  })
  fs.mkdirSync(path.join(dir, 'bin'), { recursive: true })
  fs.copyFileSync(path.join(CLI_DIR, 'bin', 'ai4kanban.mjs'), path.join(dir, 'bin', 'ai4kanban.mjs'))
  fs.writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify({ name: 'wildcrane', version: CLI_VERSION, akbContract: AKB_CONTRACT, type: 'module', private: true })}\n`)
  process.stdout.write(`build: wrote ${path.relative(PKG_DIR, dir)}/ — akb ${CLI_VERSION}\n`)
}
