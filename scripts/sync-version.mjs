#!/usr/bin/env node
// One version number for the whole repo.
//
// The canonical version lives in the root `VERSION` file. Every other place that
// must carry a version (plugin manifest, marketplace catalog, the skill script that
// runs inside installed projects, the two npm packages, and the desktop app) is
// DERIVED — this script stamps them all from `VERSION` so you only ever edit one
// number.
//
// Why copies exist at all: each is read by a different tool in its own format, and
// `skill/kanban.mjs` gets physically copied into installed projects (`.claude/skills/`)
// away from the manifests, so its version has to travel baked in. See PUBLISHING.md.
//
//   node scripts/sync-version.mjs           # write VERSION into all targets
//   node scripts/sync-version.mjs --check    # verify all match VERSION; exit 1 if not
//   node scripts/sync-version.mjs 0.1.2      # set VERSION to 0.1.2, then stamp all
//
// Run from anywhere — paths resolve relative to the repo root, not the cwd.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VERSION_FILE = path.join(ROOT, 'VERSION')

// Each target: the file, a regex that captures the version, and the group layout so we
// can rewrite just that token (keeps diffs to a single line, no JSON reserialization).
const TARGETS = [
  {
    file: '.claude-plugin/plugin.json',
    // top-level "version": "x.y.z"
    re: /("version"\s*:\s*")(\d+\.\d+\.\d+[^"]*)(")/,
    label: 'plugin.json',
  },
  {
    file: '.claude-plugin/marketplace.json',
    // metadata.version — the only "version" key in this file
    re: /("version"\s*:\s*")(\d+\.\d+\.\d+[^"]*)(")/,
    label: 'marketplace.json',
  },
  {
    file: 'kanban-ui/package.json',
    // first "version" key is the package version (deps use ^ ranges, not this shape)
    re: /("version"\s*:\s*")(\d+\.\d+\.\d+[^"]*)(")/,
    label: 'kanban-ui/package.json',
  },
  {
    file: 'cli/package.json',
    // the `ai4kanban` setup command — `npx ai4kanban update` prints this as the version
    // it moved the user to, so it has to match what the skill it ships says
    re: /("version"\s*:\s*")(\d+\.\d+\.\d+[^"]*)(")/,
    label: 'cli/package.json',
  },
  {
    file: 'desktop/package.json',
    // the desktop app — what the window's About box shows, and what it compares
    // against the newest GitHub release to say a newer one is out
    re: /("version"\s*:\s*")(\d+\.\d+\.\d+[^"]*)(")/,
    label: 'desktop/package.json',
  },
  {
    file: 'skill/kanban.mjs',
    re: /(const SKILL_VERSION = ')(\d+\.\d+\.\d+[^']*)(')/,
    label: 'skill/kanban.mjs (SKILL_VERSION)',
  },
]

function fail(msg) {
  process.stderr.write(`sync-version: ${msg}\n`)
  process.exit(1)
}

const args = process.argv.slice(2)
const check = args.includes('--check')
const setArg = args.find((a) => !a.startsWith('--'))

if (setArg) {
  if (!/^\d+\.\d+\.\d+([-.][0-9A-Za-z-]+)*$/.test(setArg)) fail(`not a version: "${setArg}"`)
  fs.writeFileSync(VERSION_FILE, setArg + '\n')
}

if (!fs.existsSync(VERSION_FILE)) fail(`no VERSION file at ${VERSION_FILE}`)
const version = fs.readFileSync(VERSION_FILE, 'utf8').trim()
if (!/^\d+\.\d+\.\d+([-.][0-9A-Za-z-]+)*$/.test(version)) fail(`VERSION is not a version: "${version}"`)

let mismatches = 0
let changed = 0
for (const t of TARGETS) {
  const abs = path.join(ROOT, t.file)
  const src = fs.readFileSync(abs, 'utf8')
  const m = src.match(t.re)
  if (!m) fail(`could not find a version to stamp in ${t.file}`)
  const current = m[2]
  if (current === version) {
    process.stdout.write(`  ok    ${t.label} = ${current}\n`)
    continue
  }
  if (check) {
    process.stdout.write(`  DRIFT ${t.label} = ${current} (want ${version})\n`)
    mismatches++
    continue
  }
  fs.writeFileSync(abs, src.replace(t.re, `$1${version}$3`))
  process.stdout.write(`  set   ${t.label}: ${current} -> ${version}\n`)
  changed++
}

if (check && mismatches) fail(`${mismatches} file(s) out of sync with VERSION (${version})`)
process.stdout.write(
  check
    ? `\nall in sync at ${version}\n`
    : `\nversion ${version} — ${changed} file(s) updated, ${TARGETS.length - changed} already current\n`,
)
