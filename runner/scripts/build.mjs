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

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VERSION = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8')).version
const CLI_DIR = path.join(PKG_DIR, '..', 'cli')
const CLI_VERSION = JSON.parse(fs.readFileSync(path.join(CLI_DIR, 'package.json'), 'utf8')).version
/** `.json` is text to the Runner's own imports; a package's (the MCP SDK's schemas) stays JSON. */
const PACKAGE_JSON = {
  name: 'package-json',
  setup(build) {
    build.onLoad({ filter: /[\\/]node_modules[\\/].*\.json$/ }, (args) => ({ contents: fs.readFileSync(args.path, 'utf8'), loader: 'json' }))
  },
}
const PLUGIN_DISTS = ['claude-code', 'codex'].map((host) => path.join(PKG_DIR, '..', 'plugins', host, 'server', 'dist'))

for (const [entry, outfile] of [
  ['launcher-main.ts', path.join(PKG_DIR, 'dist', 'launcher.mjs')],
  ['main.ts', path.join(PKG_DIR, 'dist', 'runner.mjs')],
  ...PLUGIN_DISTS.map((dir) => ['plugin-main.ts', path.join(dir, 'index.mjs')]),
]) {
  await esbuild.build({
    entryPoints: [path.join(PKG_DIR, 'src', entry)],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    loader: { '.md': 'text', '.tsx': 'text', '.json': 'text' },
    banner: { js: `// wildcrane-runner ${VERSION} — built by runner/scripts/build.mjs. Do not edit.\n${REQUIRE_SHIM}` },
    define: { __RUNNER_VERSION__: JSON.stringify(VERSION) },
    legalComments: 'none',
    plugins: [PACKAGE_JSON],
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
    loader: { '.md': 'text', '.tsx': 'text', '.json': 'text' },
    // The version line's shape is the CLI's own stamp (BUILT_STAMP in cli/src/lib/skill/install.ts).
    banner: { js: `#!/usr/bin/env node\n// ai4kanban ${CLI_VERSION} — built by runner/scripts/build.mjs. Do not edit.\n${REQUIRE_SHIM}` },
    define: { __AKB_BUILT__: 'true' },
    legalComments: 'none',
  })
  fs.mkdirSync(path.join(dir, 'bin'), { recursive: true })
  fs.copyFileSync(path.join(CLI_DIR, 'bin', 'ai4kanban.mjs'), path.join(dir, 'bin', 'ai4kanban.mjs'))
  fs.writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify({ name: 'wildcrane', version: CLI_VERSION, type: 'module', private: true })}\n`)
  process.stdout.write(`build: wrote ${path.relative(PKG_DIR, dir)}/ — akb ${CLI_VERSION}\n`)
}
