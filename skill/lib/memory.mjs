// ---- the memory set --------------------------------------------------------
//
// Scaffolding memory paths under docs/kanban/memory/ and resolving which copy of a
// memory file a card's note belongs in.

import fs from 'node:fs'
import path from 'node:path'

import { warn, MEMORY } from './paths.mjs'
import { MODULE_NAME_RE } from './validate.mjs'

// The memory file set — the same four files fill a memory path at either level:
// `memory/` itself (the project-wide memory, covering the whole project) and each
// module's own path at `memory/<module>/`. Each starter is a short header that tells the
// next reader what the file is for; the flows fill in the rest over time. Plain language,
// to match the skill.
const MEMORY_SET = {
  'readme.md': `# Shipped

User-facing work that has shipped, one line each — a link to the published doc that
covers it, or a plain-words note.

_(nothing recorded yet — the first finished task fills it in.)_
`,
  'decisions.md': `# Decisions

Settled answers to cards' open questions, grouped by topic. Keep only **user-facing**
calls that guide future planning — what a user can see, do, or would care about.
Internal detail stays on the card.
`,
  'redesign.md': `# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. Read before writing or reviewing a card.
`,
  'rejected.md': `# Rejected

Ideas we turned down, grouped by topic. One line each: the idea, and why we said no. Read
before proposing so you don't re-suggest them.
`,
}

// `goal.md` is the board root's alone. The project has one direction, and every flow
// judges a card against that one file — a per-module copy would only split it. So the
// project-wide path gets these five files; a module path gets the four above.
// It seeds `reviewed: weak` — a fresh template is not a goal to plan from.
const PROJECT_MEMORY_SET = {
  ...MEMORY_SET,
  'goal.md': `---
reviewed: weak
---

# Goal

Where this is headed, in the user's own words: the long-term goal, the horizon it aims
at, and the roadmap of what comes next, roughly in order. Not this week's work — that's
the cards on the board. The user owns this file; the agent seeds it but does not invent
the goal.

_(not filled in yet — the user writes this.)_
`,
}

// Scaffold one module's memory path with the four-file set — no `goal.md`, that one is
// the board root's alone. Idempotent: creates only what's missing, so it's safe to call
// whenever a module's name is known — `init` calls it for the whole map, and a flow about
// to write a note calls it first. Keyed by the module's bolded name in modules.md, passed
// verbatim as the folder name. Returns what it created so callers can report; `null`
// means the path was already complete.
export function scaffoldMemoryPath(module) {
  return scaffoldMemoryDir(path.join(MEMORY, module), MEMORY_SET)
}

// The same scaffold, one level up: the project-wide set in `memory/` itself — the four
// files plus `goal.md`.
export function scaffoldProjectMemory() {
  return scaffoldMemoryDir(MEMORY, PROJECT_MEMORY_SET)
}

function scaffoldMemoryDir(dir, set) {
  const existed = fs.existsSync(dir)
  fs.mkdirSync(dir, { recursive: true })
  const made = []
  for (const [name, body] of Object.entries(set)) {
    const file = path.join(dir, name)
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, body)
      made.push(name)
    }
  }
  if (!existed) return { dir, made, fresh: true }
  return made.length ? { dir, made, fresh: false } : null
}

// Which copy of a memory file a card's note belongs in — SKILL.md's "The memory set" rule
// in code, so a flow about to write a note stops re-deriving it: the named module's copy,
// both when the card names two, the project-wide one when it names none. Never a module
// copy AND the project-wide one — that copy is the whole project's memory, not a mirror.
//
// Scaffolds each path first (the same guarantee `memory-init` gives) so the file is there
// to open, then reads back its `## ` topics. The topics are a hint for picking a section
// without opening the file blind; the note itself is written by hand, because where a line
// goes — and whether it merges into one already there — is a judgment call.
export function memoryTargets(modules, fileName) {
  const named = modules.filter((m) => {
    if (MODULE_NAME_RE.test(m)) return true
    warn(`card names module "${m}", which isn't a usable folder name — skipping its memory path`)
    return false
  })
  const dirs = named.length ? named.map((m) => path.join(MEMORY, m)) : [null]
  return dirs.map((dir) => {
    if (dir === null) scaffoldProjectMemory()
    else scaffoldMemoryPath(path.basename(dir))
    const file = path.join(dir ?? MEMORY, fileName)
    return { file, topics: readTopics(file) }
  })
}

// The `## ` headings of a memory file, each with how many entries sit under it — enough
// to name a section in the receipt without printing the file.
function readTopics(file) {
  if (!fs.existsSync(file)) return []
  const topics = []
  let current = null
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const heading = line.match(/^##\s+(.+?)\s*$/)
    if (heading) {
      current = { name: heading[1], entries: 0 }
      topics.push(current)
    } else if (current && /^\s*[-*] /.test(line)) {
      current.entries++
    }
  }
  return topics
}
