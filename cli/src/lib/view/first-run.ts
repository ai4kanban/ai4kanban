// ---- setup's own answer ----------------------------------------------------
//
// What the project is. It lives in `docs/kanban/config.md`, and it is the one thing only
// the user knows — the repo can suggest a name, nothing can suggest what the project is
// for. So a guided first run asks, and this reads and writes the bullet it asks about.
// Every other bullet in that file is left exactly as found, placeholders included: the rest
// of the config is read from the repo by an agent, on setup's own `config` step.

import fs from 'node:fs'
import path from 'node:path'

import { die, CONFIG, MODULES_MD, REPO_ROOT } from '../paths'
import { readGoalText } from './goal'
import type { SaveProjectResult, SetupDraft } from './types'

// ---- reading ---------------------------------------------------------------

function readConfig(): string {
  try {
    return fs.readFileSync(CONFIG, 'utf8')
  } catch {
    return ''
  }
}

// A config value that is still `{{PLACEHOLDER}}` has never been answered — the template's
// own text, not the user's.
const unanswered = (value: string): boolean => !value || /\{\{[A-Z_]+\}\}/.test(value)

// One top-level bullet and everything indented under it: `- **Project** — …` plus its
// default note. The block ends at the next line that starts in column one, so a bullet can
// be replaced whole without disturbing what follows.
function bulletBlock(lines: string[], label: string): { start: number; end: number } | null {
  const start = lines.findIndex((l) => l.startsWith(`- **${label}**`))
  if (start === -1) return null
  let end = start + 1
  while (end < lines.length && /^\s+\S/.test(lines[end]!)) end++
  return { start, end }
}

/** The project's name and what it is, from the config. An unfilled bullet gives the repo's
 *  folder name and an empty line — the name is a fair guess, what it is for is not. */
export function readProject(): { name: string; description: string } {
  const fallback = { name: path.basename(REPO_ROOT), description: '' }
  const lines = readConfig().split('\n')
  const block = bulletBlock(lines, 'Project')
  if (!block) return fallback
  const value = lines[block.start]!.replace(/^- \*\*Project\*\*[ \t]*—[ \t]*/, '').trim()
  if (unanswered(value)) return fallback
  const at = value.indexOf(':')
  if (at === -1) return { name: value, description: '' }
  return { name: value.slice(0, at).trim(), description: value.slice(at + 1).trim() }
}

/** Everything a guided first run opens with, in one read. */
export function readSetupDraft(): SetupDraft {
  return { project: readProject(), goal: readGoalText() }
}

/** The module names from `docs/kanban/modules.md` — the bolded name at the front of each
 *  `- **name** — …` line. That is what `--modules` takes and what a propose run focuses on.
 *  A missing or empty map reads as no modules. */
export function readModules(): string[] {
  let text: string
  try {
    text = fs.readFileSync(MODULES_MD, 'utf8')
  } catch {
    return []
  }
  const names: string[] = []
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*-\s+\*\*(.+?)\*\*/)
    if (m) names.push(m[1]!.trim())
  }
  return names
}

// ---- writing ---------------------------------------------------------------

/** Save the project — setup's `project` step, in full. The one config bullet is rewritten
 *  and nothing else in that file is touched. */
export function saveProject(name: string, description: string): SaveProjectResult {
  const project = name.trim()
  if (!project) die('the project needs a name')
  writeConfigBullets(project, description.trim())
  return { ok: true }
}

// A config written from nothing — only reached on a board whose config.md is missing, which
// `init` never leaves behind. It carries the bullet this module owns and says where the
// rest comes from, rather than inventing the whole template the skill ships.
const CONFIG_HEADER = `# Configuration

This file adapts ai4kanban to your project. The board app writes the project; the rest is
filled in from your repo on setup's \`config\` step.

`

// The bullet, written over whatever was in its place — the template's `{{PLACEHOLDER}}` on
// a fresh board, the last answer on a second pass. A config missing the bullet gains it at
// the end rather than failing: the file is the user's and may have been rewritten by hand.
//
// A `- **Tracks**` bullet left by a board older than the flat `todo/` is dropped here, so a
// config stops naming a setting the board no longer has.
function writeConfigBullets(name: string, description: string): void {
  const existing = fs.existsSync(CONFIG) ? fs.readFileSync(CONFIG, 'utf8') : CONFIG_HEADER
  let lines = existing.split('\n')
  lines = replaceBullet(lines, 'Project', [`- **Project** — ${description ? `${name}: ${description}` : name}`])
  lines = replaceBullet(lines, 'Tracks', [])
  fs.mkdirSync(path.dirname(CONFIG), { recursive: true })
  fs.writeFileSync(CONFIG, lines.join('\n'))
}

function replaceBullet(lines: string[], label: string, replacement: string[]): string[] {
  const block = bulletBlock(lines, label)
  const out = [...lines]
  if (!block) {
    if (replacement.length === 0) return out
    while (out.length && out[out.length - 1]!.trim() === '') out.pop()
    out.push(...replacement, '')
    return out
  }
  out.splice(block.start, block.end - block.start, ...replacement)
  return out
}
