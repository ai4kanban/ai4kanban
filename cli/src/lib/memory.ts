// ---- the memory set --------------------------------------------------------
//
// Scaffolding memory paths under docs/kanban/memory/ and resolving which copy of a
// memory file a card's note belongs in.

import fs from 'node:fs'
import path from 'node:path'

import { warn, AGENT_MEMORY, MEMORY } from './paths'
import { solution } from './solution'
import { MODULE_NAME_RE } from './validate'

// What a scaffold made: the path, the files it wrote, and whether the folder itself is new.
export interface Scaffolded {
  dir: string
  made: string[]
  fresh: boolean
}

// One `## ` heading of a memory file, with how many entries sit under it.
export interface Topic {
  name: string
  entries: number
}

// Where a note belongs: the file, and the topics already in it.
export interface MemoryTarget {
  file: string
  topics: Topic[]
}

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

// The marketing solution's set (#406, #407). The kernel's two files are `decisions.md` and
// `rejected.md`; everything else is the solution's, declared here rather than assumed. No
// `goal.md` — positioning is a decision, and the product board's goal is a planning source —
// and no `redesign.md`: a lesson from an edited draft is a writing rule.
const KERNEL_SET = {
  'decisions.md': MEMORY_SET['decisions.md'],
  'rejected.md': MEMORY_SET['rejected.md'],
}

const MARKETING_PROJECT_SET = {
  ...KERNEL_SET,
  'writing.md': `# Writing

The voice every piece shares — one line per rule, in your own words, as
\`- ❌ <what not to do> → ✅ <what to do instead>\`.

Every rule here was learned from an edit you made to a draft. Nothing is invented.
`,
  'published.md': `# Published

One line per published piece: date, channel, URL, and what it did. What proposing reads to
avoid a repeat and to see what worked.

_(nothing published yet.)_
`,
}

// `goal.md` is the board root's alone. The project has one direction, and every flow
// judges a card against that one file — a per-module copy would only split it. So the
// project-wide path gets these five files; a module path gets the four above.
//
// It starts with the `reviewed: weak` line and nothing else: the file is the user's own
// words, and anything seeded above them is text they have to delete first. What belongs
// in a goal is said where the user is asked for it — the setup step and the local UI's
// goal box — not in the file.
const PROJECT_MEMORY_SET = {
  ...MEMORY_SET,
  'goal.md': `---
reviewed: weak
---
`,
}

// Scaffold one module's memory path with the four-file set — no `goal.md`, that one is
// the board root's alone. Idempotent: creates only what's missing, so it's safe to call
// whenever a module's name is known — `init` calls it for the whole map, and a flow about
// to write a note calls it first. Keyed by the module's bolded name in modules.md, passed
// verbatim as the folder name. Returns what it created so callers can report; `null`
// means the path was already complete.
export function scaffoldMemoryPath(module: string): Scaffolded | null {
  return scaffoldMemoryDir(path.join(MEMORY, module), MEMORY_SET)
}

// The same scaffold, one level up: the project-wide set in `memory/` itself — the four
// files plus `goal.md`.
export function scaffoldProjectMemory(): Scaffolded | null {
  return scaffoldMemoryDir(MEMORY, solution() === 'marketing' ? MARKETING_PROJECT_SET : PROJECT_MEMORY_SET)
}

/** A marketing pillar's own set: the kernel's two files and nothing else. */
export function scaffoldPillarMemory(pillar: string): Scaffolded | null {
  return scaffoldMemoryDir(path.join(MEMORY, pillar), KERNEL_SET)
}

function scaffoldMemoryDir(dir: string, set: Record<string, string>): Scaffolded | null {
  const existed = fs.existsSync(dir)
  fs.mkdirSync(dir, { recursive: true })
  const made: string[] = []
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

// ---- an agent's own memory (#421) ------------------------------------------
//
// An agent that declares `memory: project` keeps one file of what it learned — the taste it
// was corrected on and the product facts it needs next time. It sits beside the memory set
// rather than in it: the set is the board's memory, keyed by module, and this is one
// agent's, keyed by its name.
//
// The file is the whole memory. It is read into every run that agent starts and written
// back whole, so an agent curates what it kept rather than appending to a file it cannot
// see the end of.

/** The one folder name a module may not take: it is where agent memories live. */
export const RESERVED_MEMORY_DIR = 'agents'

export const agentMemoryFile = (agent: string): string => path.join(AGENT_MEMORY, `${agent}.md`)

export const agentMemoryHeading = (agent: string): string => `# What \`${agent}\` learned`

// A heading the agent wrote for itself, matched by its shape rather than its exact words —
// the way `spec-write` matches the one it owns, so a near-miss is dropped instead of stacked
// under the board's own.
const HEADING_RE = /^#\s+What\s+.+\s+learned\s*$/i

/** What one agent remembers, or empty when it has written nothing down yet. */
export function readAgentMemory(agent: string): string {
  try {
    return fs.readFileSync(agentMemoryFile(agent), 'utf8').trim()
  } catch {
    return ''
  }
}

/** Replace what one agent remembers. The heading is the board's, added on the first write
 *  and never twice: an agent handed its file back rewrites the lines under it, and a
 *  heading it wrote for itself is dropped the way `spec-write` drops one. */
export function writeAgentMemory(agent: string, text: string): { file: string; fresh: boolean } {
  const file = agentMemoryFile(agent)
  const fresh = !fs.existsSync(file)
  const heading = agentMemoryHeading(agent)
  const lines = text.trim().split('\n')
  if (HEADING_RE.test(lines[0]?.trim() ?? '')) lines.shift()
  fs.mkdirSync(AGENT_MEMORY, { recursive: true })
  fs.writeFileSync(file, `${heading}\n\n${lines.join('\n').trim()}\n`)
  return { file, fresh }
}

// Which copy of a memory file a card's note belongs in — "The memory set" in `akb guide board`
// in code, so a flow about to write a note stops re-deriving it: the named module's copy,
// both when the card names two, the project-wide one when it names none. Never a module
// copy AND the project-wide one — that copy is the whole project's memory, not a mirror.
//
// Scaffolds each path first (the same guarantee `memory-init` gives) so the file is there
// to open, then reads back its `## ` topics. The topics are a hint for picking a section
// without opening the file blind; the note itself is written by hand, because where a line
// goes — and whether it merges into one already there — is a judgment call.
export function memoryTargets(modules: string[], fileName: string): MemoryTarget[] {
  const named = modules.filter((m: string) => {
    if (m === RESERVED_MEMORY_DIR) {
      warn(`card names module "${m}", which is where agent memories live — skipping its memory path`)
      return false
    }
    if (MODULE_NAME_RE.test(m)) return true
    warn(`card names module "${m}", which isn't a usable folder name — skipping its memory path`)
    return false
  })
  const dirs: Array<string | null> = named.length ? named.map((m) => path.join(MEMORY, m)) : [null]
  return dirs.map((dir) => {
    if (dir === null) scaffoldProjectMemory()
    else scaffoldMemoryPath(path.basename(dir))
    const file = path.join(dir ?? MEMORY, fileName)
    return { file, topics: readTopics(file) }
  })
}

// The `## ` headings of a memory file, each with how many entries sit under it — enough
// to name a section in the receipt without printing the file.
function readTopics(file: string): Topic[] {
  if (!fs.existsSync(file)) return []
  const topics: Topic[] = []
  let current: Topic | null = null
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const heading = line.match(/^##\s+(.+?)\s*$/)
    if (heading) {
      current = { name: heading[1]!, entries: 0 }
      topics.push(current)
    } else if (current && /^\s*[-*] /.test(line)) {
      current.entries++
    }
  }
  return topics
}
