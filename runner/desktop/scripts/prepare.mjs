#!/usr/bin/env node
// Everything `tauri dev` and `tauri build` bundle: the Runner (../dist), the windows
// (ui/dist) and a Node for the target (src-tauri/binaries/node-<triple>). Node is fetched
// from nodejs.org once per target and checked against its published SHA-256.
//
//   node scripts/prepare.mjs                  for this computer
//   node scripts/prepare.mjs --target <triple>  for another (CI builds each)

import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as esbuild from 'esbuild'

const NODE_VERSION = '24.22.1'
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const NODE_BUILDS = {
  'aarch64-apple-darwin': { file: `node-v${NODE_VERSION}-darwin-arm64.tar.gz`, binary: 'bin/node' },
  'x86_64-apple-darwin': { file: `node-v${NODE_VERSION}-darwin-x64.tar.gz`, binary: 'bin/node' },
  'x86_64-pc-windows-msvc': { file: `node-v${NODE_VERSION}-win-x64.zip`, binary: 'node.exe' },
  'aarch64-pc-windows-msvc': { file: `node-v${NODE_VERSION}-win-arm64.zip`, binary: 'node.exe' },
}

const fail = (message) => {
  console.error(`prepare: ${message}`)
  process.exit(1)
}

const run = (command, args, cwd) => {
  if (spawnSync(command, args, { cwd, stdio: 'inherit' }).status !== 0) fail(`${command} ${args.join(' ')} failed`)
}

function hostTriple() {
  const rustc = spawnSync('rustc', ['-vV'], { encoding: 'utf8' })
  const host = /host: (\S+)/.exec(rustc.stdout ?? '')?.[1]
  if (!host) fail('rustc is not on PATH; install Rust from https://rustup.rs')
  return host
}

async function fetchNode(triple) {
  const build = NODE_BUILDS[triple] ?? fail(`no Node build is known for ${triple}`)
  const out = path.join(DIR, 'src-tauri', 'binaries', `node-${triple}${triple.includes('windows') ? '.exe' : ''}`)
  if (fs.existsSync(out)) return
  const base = `https://nodejs.org/dist/v${NODE_VERSION}`
  const sums = await (await fetch(`${base}/SHASUMS256.txt`)).text()
  const expected = sums.split('\n').find((line) => line.endsWith(`  ${build.file}`))?.split(' ')[0]
  if (!expected) fail(`${build.file} is not in Node's SHASUMS256.txt`)
  const archive = Buffer.from(await (await fetch(`${base}/${build.file}`)).arrayBuffer())
  if (crypto.createHash('sha256').update(archive).digest('hex') !== expected) fail(`${build.file} does not match its SHA-256`)

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wildcrane-node-'))
  const file = path.join(tmp, build.file)
  fs.writeFileSync(file, archive)
  run('tar', ['-xf', file, '-C', tmp], tmp)
  const top = build.file.replace(/\.(tar\.gz|zip)$/, '')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.copyFileSync(path.join(tmp, top, build.binary), out)
  fs.chmodSync(out, 0o755)
  fs.rmSync(tmp, { recursive: true, force: true })
  console.log(`prepare: Node ${NODE_VERSION} for ${triple}`)
}

async function buildUi() {
  const dist = path.join(DIR, 'ui', 'dist')
  fs.rmSync(dist, { recursive: true, force: true })
  fs.mkdirSync(dist, { recursive: true })
  await esbuild.build({
    entryPoints: [path.join(DIR, 'ui', 'src', 'app.ts')],
    outfile: path.join(dist, 'app.js'),
    bundle: true,
    format: 'esm',
    target: ['safari15', 'edge110'],
    legalComments: 'none',
  })
  for (const file of ['index.html', 'style.css']) fs.copyFileSync(path.join(DIR, 'ui', file), path.join(dist, file))
}

const at = process.argv.indexOf('--target')
const triple = at > 0 ? process.argv[at + 1] : process.env.TAURI_ENV_TARGET_TRIPLE || hostTriple()

run(process.execPath, [path.join(DIR, '..', 'scripts', 'build.mjs')], path.join(DIR, '..'))
await buildUi()
await fetchNode(triple)
