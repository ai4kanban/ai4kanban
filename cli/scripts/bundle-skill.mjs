#!/usr/bin/env node
// Copy the repo's `skill/` into this package as `cli/skill/`, so the published tarball
// carries the skill and `npx ai4kanban install` needs nothing fetched.
//
// npm can only pack files inside the package folder, so the copy has to exist at publish
// time. It's gitignored — `prepublishOnly` makes it fresh on every publish, and running
// the CLI from a source checkout falls back to the repo's `skill/` directly.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = path.join(PKG_DIR, '..', 'skill')
const DEST = path.join(PKG_DIR, 'skill')

if (!fs.existsSync(path.join(SOURCE, 'SKILL.md'))) {
  process.stderr.write(`bundle-skill: no skill at ${SOURCE}\n`)
  process.exit(1)
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(from, to)
    else fs.copyFileSync(from, to)
  }
}

fs.rmSync(DEST, { recursive: true, force: true })
copyDir(SOURCE, DEST)

let files = 0
const count = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) count(path.join(dir, e.name))
    else files++
  }
}
count(DEST)
process.stdout.write(`bundle-skill: copied ${files} file(s) into cli/skill/\n`)
