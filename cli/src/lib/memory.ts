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

// ---- an agent's own memory (#421, #473) -------------------------------------
//
// An agent that declares `memory: project` keeps a folder of what it learned, one file per
// topic: `redesign.md` for the mistakes it was corrected on, `decisions.md` for the choices
// the user made. It sits beside the memory set rather than in it: the set is the board's
// memory, keyed by module, and this is one agent's, keyed by its name.
//
// Two files and no third. How the product looks is read from the app's own design docs, not
// copied here, and a product fact worth keeping rides on the lesson or the decision it
// supports. Both files are read into every run that agent starts and written back whole, so
// an agent curates what it kept rather than appending to a file it cannot see the end of.

/** The one folder name a module may not take: it is where agent memories live. */
export const RESERVED_MEMORY_DIR = 'agents'

/** The two files an agent's memory folder holds, in the order a run is handed them. */
export const AGENT_MEMORY_FILES = ['redesign.md', 'decisions.md'] as const

export type AgentMemoryName = (typeof AGENT_MEMORY_FILES)[number]

/** One of those files: where it is, the heading the board owns, and the lines under it. */
export interface AgentMemory {
  name: AgentMemoryName
  file: string
  heading: string
  text: string
}

export const agentMemoryDir = (agent: string): string => path.join(AGENT_MEMORY, agent)

export const agentMemoryFile = (agent: string, name: AgentMemoryName): string => path.join(agentMemoryDir(agent), name)

/** Both files an agent owns, written or not — what a roster lists and a delete removes. */
export const agentMemoryFiles = (agent: string): string[] => AGENT_MEMORY_FILES.map((name) => agentMemoryFile(agent, name))

/** The single file a board written before the split kept for that agent. */
export const legacyAgentMemoryFile = (agent: string): string => path.join(AGENT_MEMORY, `${agent}.md`)

const HEADINGS: Record<AgentMemoryName, (agent: string) => string> = {
  'redesign.md': (agent) => `# What \`${agent}\` was corrected on`,
  'decisions.md': (agent) => `# What the user chose for \`${agent}\``,
}

export const agentMemoryHeading = (agent: string, name: AgentMemoryName): string => HEADINGS[name](agent)

// A heading the agent wrote for itself, matched by its shape rather than its exact words —
// the way `spec-write` matches the one it owns, so a near-miss is dropped instead of stacked
// under the board's own. `learned` is the heading the one-file memory carried.
const HEADING_RE = /^#\s+What\s+(the user chose for\s+.+|.+\s+(was corrected on|learned))\s*$/i

const stripHeading = (text: string): string => {
  const lines = text.trim().split('\n')
  if (HEADING_RE.test(lines[0]?.trim() ?? '')) lines.shift()
  return lines.join('\n').trim()
}

/** What one agent remembers: both files in order, each with its heading and whatever is
 *  under it. A file nobody has written yet comes back with empty `text` rather than being
 *  left out — the run is still shown it, because the empty file is the invitation. */
export function readAgentMemory(agent: string): AgentMemory[] {
  adoptOneFileMemory(agent)
  return AGENT_MEMORY_FILES.map((name) => {
    const file = agentMemoryFile(agent, name)
    let text = ''
    try {
      text = stripHeading(fs.readFileSync(file, 'utf8'))
    } catch {
      // Nothing written under that heading yet.
    }
    return { name, file, heading: agentMemoryHeading(agent, name), text }
  })
}

/** Replace one of the two files whole. The heading is the board's, written every time and
 *  never twice: an agent handed its file back rewrites the lines under it, and a heading it
 *  wrote for itself is dropped the way `spec-write` drops one. */
export function writeAgentMemory(agent: string, name: AgentMemoryName, text: string): { file: string; fresh: boolean } {
  const file = agentMemoryFile(agent, name)
  const fresh = !fs.existsSync(file)
  fs.mkdirSync(agentMemoryDir(agent), { recursive: true })
  fs.writeFileSync(file, `${agentMemoryHeading(agent, name)}\n\n${stripHeading(text)}\n`)
  return { file, fresh }
}

// A board written before the split kept everything in `memory/agents/<agent>.md`. The first
// read of that agent's memory moves it into the folder as `redesign.md` — the file it most
// resembles — and the run that was just handed it lifts out what belongs in `decisions.md`.
// Nothing is lost and nobody moves a file by hand.
//
// Never fatal: a board that cannot be written to still gets its memory read, which is what
// the caller asked for.
function adoptOneFileMemory(agent: string): void {
  const legacy = legacyAgentMemoryFile(agent)
  try {
    if (!fs.existsSync(legacy)) return
    const carried = stripHeading(fs.readFileSync(legacy, 'utf8'))
    const into = agentMemoryFile(agent, 'redesign.md')
    const kept = fs.existsSync(into) ? stripHeading(fs.readFileSync(into, 'utf8')) : ''
    writeAgentMemory(agent, 'redesign.md', [kept, carried].filter(Boolean).join('\n\n'))
    fs.rmSync(legacy, { force: true })
  } catch {
    warn(`couldn't move ${legacy} into ${agentMemoryDir(agent)}/ — reading what is there`)
  }
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
