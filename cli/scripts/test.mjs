#!/usr/bin/env node
// Run the CLI's tests.
//
//   node scripts/test.mjs            # bundle test/*.test.ts, then node --test
//
// The sources import each other without file extensions, which the bundler resolves and
// node does not — so each test file goes through the same esbuild the build uses, into
// `.test-build/`, and node runs the bundles. Nothing in that folder is kept.

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import * as esbuild from 'esbuild'

import { REQUIRE_SHIM } from './shim.mjs'

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TEST_DIR = path.join(PKG_DIR, 'test')
const OUT_DIR = path.join(PKG_DIR, '.test-build')

const tests = fs.existsSync(TEST_DIR) ? fs.readdirSync(TEST_DIR).filter((f) => f.endsWith('.test.ts')) : []
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
  loader: { '.md': 'text' },
  legalComments: 'none',
  // Same reason as the build's: an ESM bundle holding a CommonJS dependency needs a
  // `require` in scope (scripts/build.mjs).
  banner: { js: REQUIRE_SHIM },
})

const bundles = tests.map((f) => path.join(OUT_DIR, f.replace(/\.ts$/, '.mjs')))
const run = spawnSync(process.execPath, ['--test', ...bundles], { stdio: 'inherit' })
fs.rmSync(OUT_DIR, { recursive: true, force: true })
process.exit(run.status ?? 1)
