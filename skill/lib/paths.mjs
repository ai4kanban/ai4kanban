// Where everything lives, plus the tiny helpers every module needs (die/warn/rel,
// next-id read/write). Imported by every other module; imports none of them.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The skill folder — this file sits in lib/, one level down, so the folder holding
// SKILL.md and the config.md template is our parent.
export const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// The board lives at <repo>/docs/kanban. Every command runs from the repo root (SKILL.md
// says so), so the working directory IS the repo root — this holds whether the script is a
// copy under .claude/skills/kanban/ or read-only in a plugin cache. Deriving the root from
// cwd (not from where this file sits) is what lets `/plugin install` + `kanban init` work
// with nothing copied into the project.
export const REPO_ROOT = process.cwd()
export const KANBAN = path.join(REPO_ROOT, 'docs', 'kanban')
export const TODO = path.join(KANBAN, 'todo')
export const ARCHIVE = path.join(KANBAN, '.archive')
export const NEXT_ID = path.join(KANBAN, 'next-id')
export const README = path.join(TODO, 'README.md')
export const METRICS = path.join(KANBAN, 'metrics.csv')
export const MODULES_MD = path.join(KANBAN, 'modules.md')
export const CONFIG = path.join(KANBAN, 'config.md')
// Setup's own checklist. Its presence is the flag: it exists while setup is unfinished,
// and the tick that closes the last box deletes it. A board with no file is a board that
// is set up — which is why boards made before this file existed stay quiet.
export const SETUP_CHECKLIST = path.join(KANBAN, 'setup-checklist.md')
// All memory lives under docs/kanban/memory/: the project-wide set sits in this folder
// itself, each module's set in a subfolder named after the module.
export const MEMORY = path.join(KANBAN, 'memory')
// The one goal file — board root only, never per module (see PROJECT_MEMORY_SET).
export const GOAL = path.join(MEMORY, 'goal.md')

export function die(msg) {
  console.error(`kanban: ${msg}`)
  process.exit(1)
}

// Warnings go to stderr so a command's stdout (e.g. `create`'s id) stays clean for callers.
export function warn(msg) {
  console.error(`kanban: warning — ${msg}`)
}

export const rel = (p) => path.relative(REPO_ROOT, p) || p

export function readNextId() {
  if (!fs.existsSync(NEXT_ID)) die(`missing ${rel(NEXT_ID)}`)
  const value = fs.readFileSync(NEXT_ID, 'utf8').trim()
  if (!/^\d+$/.test(value)) die(`${rel(NEXT_ID)} is not a plain number: "${value}"`)
  return Number(value)
}

export function writeNextId(value) {
  fs.writeFileSync(NEXT_ID, `${value}\n`)
}
