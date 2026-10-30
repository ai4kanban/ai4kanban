#!/usr/bin/env node
// Bundle test/*.test.ts and run them with node --test, like cli/scripts/test.mjs. Builds
// dist/ first: the launcher tests run the real built Runner.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import * as esbuild from 'esbuild'

import { REQUIRE_SHIM } from '../../cli/scripts/shim.mjs'

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(PKG_DIR, '.test-build')

if (spawnSync(process.execPath, [path.join(PKG_DIR, 'scripts', 'build.mjs')], { stdio: 'inherit' }).status !== 0) process.exit(1)

const tests = fs.readdirSync(path.join(PKG_DIR, 'test')).filter((f) => f.endsWith('.test.ts'))
fs.rmSync(OUT_DIR, { recursive: true, force: true })
await esbuild.build({
  entryPoints: tests.map((f) => path.join(PKG_DIR, 'test', f)),
  outdir: OUT_DIR,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outExtension: { '.js': '.mjs' },
  loader: { '.md': 'text', '.tsx': 'text', '.json': 'text' },
  define: { __RUNNER_VERSION__: '"0.0.0-test"' },
  legalComments: 'none',
  banner: { js: REQUIRE_SHIM },
})

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'wildcrane-test-home-'))
const run = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...tests.map((f) => path.join(OUT_DIR, f.replace(/\.ts$/, '.mjs')))], {
  stdio: 'inherit',
  env: { ...process.env, WILDCRANE_HOME: home, AI4KANBAN_HOME: home, AI4KANBAN_PATH_ONLY: '1', KANBAN_RUN: '', RUNNER_DIST: path.join(PKG_DIR, 'dist') },
})
fs.rmSync(OUT_DIR, { recursive: true, force: true })
fs.rmSync(home, { recursive: true, force: true })
process.exit(run.status ?? 1)
