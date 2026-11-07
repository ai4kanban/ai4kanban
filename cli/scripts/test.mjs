#!/usr/bin/env node
// 按文件名选择测试，--test-name-pattern 继续筛选用例；无参数时跑全量。

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import * as esbuild from 'esbuild'

import { REQUIRE_SHIM } from './shim.mjs'
import { selectTests } from './test-options.mjs'

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TEST_DIR = path.join(PKG_DIR, 'test')
const OUT_DIR = path.join(PKG_DIR, '.test-build')

const { tests, nodeArgs } = selectTests(
  fs.existsSync(TEST_DIR) ? fs.readdirSync(TEST_DIR).filter((f) => f.endsWith('.test.ts')) : [],
  process.argv.slice(2),
)
if (!tests.length) {
  process.stdout.write('test: no test/*.test.ts files\n')
  process.exit(0)
}

fs.rmSync(OUT_DIR, { recursive: true, force: true })
await esbuild.build({
  entryPoints: tests.map((f) => path.join(TEST_DIR, f)),
  outdir: OUT_DIR,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  outExtension: { '.js': '.mjs' },
  loader: { '.md': 'text', '.tsx': 'text', '.json': 'text' },
  legalComments: 'none',
  // Same reason as the build's: an ESM bundle holding a CommonJS dependency needs a
  // `require` in scope (scripts/build.mjs).
  banner: { js: REQUIRE_SHIM },
})

const bundles = tests.map((f) => path.join(OUT_DIR, f.replace(/\.ts$/, '.mjs')))
// A board's run record, its logs, its chats and its drawings live under the machine home
// (src/lib/machine/project.ts), so the run gets a throwaway one. Nothing else carries over
// from whoever started it: an inherited `AI4KANBAN_BOARD` beats a test's own folder and
// once pointed a test at the real board (#93). A test that wants a variable sets it itself.
// `DO_NOT_TRACK` keeps every command from posting usage (#96). The official workflows are read
// from official/, unpublished (#409).
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-test-home-'))
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(AI4KANBAN_|KANBAN_|WILDCRANE_)/.test(k)))
const run = spawnSync(process.execPath, ['--test', ...nodeArgs, ...bundles], {
  stdio: 'inherit',
  env: { ...env, AI4KANBAN_HOME: HOME, AI4KANBAN_WORKFLOWS: path.join(PKG_DIR, '..', 'official'), AI4KANBAN_PATH_ONLY: '1', DO_NOT_TRACK: '1', CLAUDE_CODE_SESSION_ID: '', CODEX_THREAD_ID: '' },
})
fs.rmSync(OUT_DIR, { recursive: true, force: true })
fs.rmSync(HOME, { recursive: true, force: true })
process.exit(run.status ?? 1)
