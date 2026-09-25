// ---- the board's memory ----------------------------------------------------
//
// Memory belongs to whoever reads and writes it (#805). `docs/kanban/memory/` itself holds
// the board's own RECORD — `readme.md`, what shipped, and `goal.md`, where the project is
// going. Neither is anybody's taste, so neither is an agent's. Everything a run LEARNED is
// an agent's, under `memory/agents/<agent>/`: the planner's `decisions.md`, `rejected.md`
// and `redesign.md`, and whatever a spec agent's own prompt says to keep. Modules are a
// `## <module>` topic inside a file, never a folder.

import fs from 'node:fs'
import path from 'node:path'

import { rel, warn, AGENT_MEMORY, MEMORY } from './paths'
import { specAgentNames } from './spec-agent-names'

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

/** The agent every planning memory belongs to. Its flows are the ones that write them. */
export const PLANNER = 'planner'

/** The planner's files, in the order a roster lists them. `dismissed.md` is written only by
 *  the dismissal review (#929). */
export const PLANNER_MEMORY_FILES = ['decisions.md', 'rejected.md', 'redesign.md', 'dismissed.md'] as const

/** The board's own record — what it did, and where it is going. Not an agent's. */
export const BOARD_MEMORY_FILES = ['readme.md', 'goal.md'] as const

// Each starter is a short header telling the next reader what the file is for; the flows
// fill in the rest over time. Plain language, to match the skill.
const STARTERS: Record<string, string> = {
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
  'dismissed.md': `# Triage preferences

What the user's dismissal reasons say about which triage items are worth a card, grouped
by module. One line each, ending in the source ids it rests on. Written by the dismissal
review; a line with no source id is the user's own.
`,
  // The goal starts with the `reviewed:` line and nothing else: the file is the user's own
  // words, and anything seeded above them is text they have to delete first. What belongs in
  // a goal is said where the user is asked for it — the setup step and the local UI's goal
  // box — not in the file.
  'goal.md': `---
reviewed: weak
---
`,
}

const setOf = (names: readonly string[]): Record<string, string> =>
  Object.fromEntries(names.map((name) => [name, STARTERS[name]!]))

/** The board's record in `memory/` itself, and the planner's folder beside it. Idempotent:
 *  creates only what is missing, so a flow about to write a note can call it first. */
export function scaffoldProjectMemory(): Scaffolded | null {
  const board = scaffoldMemoryDir(MEMORY, setOf(BOARD_MEMORY_FILES))
  const planner = scaffoldMemoryDir(agentMemoryDir(PLANNER), setOf(PLANNER_MEMORY_FILES))
  return board ?? planner
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

// ---- an agent's own memory (#421, #473, #805, #833) -------------------------
//
// An agent keeps a folder of what it learned. The planner keeps `decisions.md`,
// `rejected.md` and `redesign.md` — the three the board's planning runs write. A spec
// agent's own AGENT.md says which files it keeps and what each holds; the board only hands
// every `.md` in the folder to each of its runs.

/** The one folder name a module may not take: it is where agent memories live. */
export const RESERVED_MEMORY_DIR = 'agents'

// The two files a spec agent kept before its prompt said what to keep — only the migration
// from the one-file memory writes them now.
const LEGACY_AGENT_MEMORY_FILES = ['redesign.md', 'decisions.md'] as const

type LegacyAgentMemoryName = (typeof LEGACY_AGENT_MEMORY_FILES)[number]

/** One file in an agent's folder: its name, where it is, and what it says. */
export interface AgentMemory {
  name: string
  file: string
  text: string
}

// An agent renamed between releases takes its memory with it (`adoptRenamedMemory`), except
// where the folder holds notes a board has been writing for releases and the name it was
// written under is the one to keep: planning memory is the board's whoever leads it (#858),
// and the video asset catalogue is a list of files on this machine (#945, #1057).
const KEPT_MEMORY_FOLDERS: Record<string, string> = { 'hyperframes-editor': 'video-assets' }

export const agentMemoryDir = (agent: string): string =>
  path.join(AGENT_MEMORY, KEPT_MEMORY_FOLDERS[agent] ?? agent)

export const agentMemoryFile = (agent: string, name: string): string => path.join(agentMemoryDir(agent), name)

// The `.md` files actually in one agent's folder, sorted.
const writtenMemoryNames = (agent: string): string[] => {
  try {
    return fs
      .readdirSync(agentMemoryDir(agent), { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name)
      .sort()
  } catch {
    return []
  }
}

/** The files an agent owns, by name — the planner's three, or what a spec agent has written. */
export const memoryNamesOf = (agent: string): readonly string[] =>
  agent === PLANNER ? PLANNER_MEMORY_FILES : writtenMemoryNames(agent)

/** Those files' paths — what a roster lists and a delete removes. */
export const agentMemoryFiles = (agent: string): string[] =>
  memoryNamesOf(agent).map((name) => agentMemoryFile(agent, name))

/** The single file a board written before the split kept for that agent. */
export const legacyAgentMemoryFile = (agent: string): string => path.join(AGENT_MEMORY, `${agent}.md`)

const HEADINGS: Record<LegacyAgentMemoryName, (agent: string) => string> = {
  'redesign.md': (agent) => `# What \`${agent}\` was corrected on`,
  'decisions.md': (agent) => `# What the user chose for \`${agent}\``,
}

// The heading the one-file memory carried, or the board's own, dropped before a merge.
const HEADING_RE = /^#\s+What\s+(the user chose for\s+.+|.+\s+(was corrected on|learned))\s*$/i

const stripHeading = (text: string): string => {
  const lines = text.trim().split('\n')
  if (HEADING_RE.test(lines[0]?.trim() ?? '')) lines.shift()
  return lines.join('\n').trim()
}

/** What one spec agent remembers: every `.md` in its folder, as written. */
export function readAgentMemory(agent: string): AgentMemory[] {
  adoptRenamedMemory(agent)
  adoptOneFileMemory(agent)
  return writtenMemoryNames(agent).flatMap((name) => {
    const file = agentMemoryFile(agent, name)
    try {
      return [{ name, file, text: fs.readFileSync(file, 'utf8').trim() }]
    } catch {
      return []
    }
  })
}

function writeLegacyAgentMemory(agent: string, name: LegacyAgentMemoryName, text: string): void {
  fs.mkdirSync(agentMemoryDir(agent), { recursive: true })
  fs.writeFileSync(agentMemoryFile(agent, name), `${HEADINGS[name](agent)}\n\n${stripHeading(text)}\n`)
}

// An agent's memory is kept under its name, so an agent renamed between releases would
// leave it behind. Move the folder — and the one file a board written before the split kept
// — onto the new name, once, and only when nothing is there yet: what is under the current
// name is what the agent has been writing since.
//
// Never fatal: the read goes on with whatever is under the current name.
function adoptRenamedMemory(agent: string): void {
  // Planning memory is the board's, whoever leads planning (#858). A folder in
  // `KEPT_MEMORY_FOLDERS` needs no filter here: both names resolve to the same folder.
  for (const was of specAgentNames(agent).slice(1).filter((name) => name !== PLANNER)) {
    moveMemory(agentMemoryDir(was), agentMemoryDir(agent))
    moveMemory(legacyAgentMemoryFile(was), legacyAgentMemoryFile(agent))
  }
}

const moveMemory = (from: string, into: string): void => {
  try {
    if (!fs.existsSync(from) || fs.existsSync(into)) return
    fs.mkdirSync(path.dirname(into), { recursive: true })
    fs.renameSync(from, into)
  } catch {
    warn(`couldn't move ${from} to ${into} — reading what is there`)
  }
}

// A board written before the split kept everything in `memory/agents/<agent>.md`. The first
// read of that agent's memory moves it into the folder as `redesign.md`.
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
    writeLegacyAgentMemory(agent, 'redesign.md', [kept, carried].filter(Boolean).join('\n\n'))
    fs.rmSync(legacy, { force: true })
  } catch {
    warn(`couldn't move ${legacy} into ${agentMemoryDir(agent)}/ — reading what is there`)
  }
}

// ---- where a note goes ------------------------------------------------------

/** The file one memory name lives in — the board's own record in `memory/`, the planner's
 *  three in its folder. Modules do not come into it: a module is a `## <module>` topic
 *  inside the file (#805). */
export const memoryFile = (name: string): string =>
  (BOARD_MEMORY_FILES as readonly string[]).includes(name) ? path.join(MEMORY, name) : agentMemoryFile(PLANNER, name)

/** Where a card's note belongs, with the `## ` topics already in that file — a hint for
 *  picking a section without opening the file blind. The note itself is written by hand,
 *  because where a line goes, and whether it merges into one already there, is a judgment
 *  call. Scaffolds first, so the file is there to open. */
export function memoryTarget(name: string): MemoryTarget {
  migrateMemory()
  scaffoldProjectMemory()
  const file = memoryFile(name)
  return { file, topics: readTopics(file) }
}

/** The planner's `decisions.md` and `rejected.md`, board-relative — what a run standing in
 *  for the user is given (#493): the gater and the decider judge for the whole board rather
 *  than write one card. Read-only, so nothing is scaffolded. */
export const planningMemoryFiles = (): string[] =>
  ['decisions.md', 'rejected.md'].map((name) => rel(agentMemoryFile(PLANNER, name)))

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

// ---- bringing an older board over (#805) ------------------------------------
//
// Before this, the same four files sat at the board root and again under every module. They
// move by OWNERSHIP: the three planning files — the board's copy and every module's — merge
// into the planner's, and each module's `readme.md` merges into the board's one. A module's
// entries land under a `## <module>` topic, with its own headings pushed a level down, so
// nothing is lost and a module's notes stay findable as a group. The board's own copy keeps
// the topics it already had.
//
// Merged, never overwritten, and done once: the source file is removed as it lands, so a
// second upgrade finds nothing to move. Never fatal — a migration that cannot finish leaves
// the board readable and is tried again on the next read.

// A memory file's ENTRIES: its `## ` topics and the lines under them, with the starter's own
// title and explanation dropped. Every file being merged into carries that explanation
// already, so carrying a second copy over would be the only thing the move added.
const ENTRY_RE = /^\s*([-*]|#{2,6})\s/

const entriesOf = (text: string): string => {
  const lines = text.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n')
  const first = lines.findIndex((line) => ENTRY_RE.test(line))
  return first < 0 ? '' : lines.slice(first).join('\n').trim()
}

const demote = (body: string): string => body.replace(/^(#{2,5})(\s)/gm, '#$1$2')

function mergeInto(file: string, block: string): void {
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\s+$/, '') : ''
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${before ? `${before}\n\n` : ''}${block}\n`)
}

/** Move one legacy file's entries into its new home, then delete it. Answers whether there
 *  was one, so the receipt can say what moved. */
function liftMemoryFile(from: string, into: string, topic: string): boolean {
  if (!fs.existsSync(from)) return false
  const body = entriesOf(fs.readFileSync(from, 'utf8'))
  if (body) mergeInto(into, topic ? `## ${topic}\n\n${demote(body)}` : body)
  fs.rmSync(from, { force: true })
  return true
}

/** The module folders an older board kept memory in — everything under `memory/` but the
 *  agents' own. */
function legacyModuleDirs(): string[] {
  try {
    return fs
      .readdirSync(MEMORY, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== RESERVED_MEMORY_DIR)
      .map((e) => e.name)
  } catch {
    return []
  }
}

/** What it moved, board-relative — empty on a board that is already there. */
export function migrateMemory(): string[] {
  const roots = PLANNER_MEMORY_FILES.filter((name) => fs.existsSync(path.join(MEMORY, name)))
  const modules = legacyModuleDirs()
  if (!roots.length && !modules.length) return []
  const moved: string[] = []
  try {
    // First, so every entry lands UNDER the starter header that says what the file is for
    // rather than in a file the merge itself created headerless.
    scaffoldProjectMemory()
    for (const name of PLANNER_MEMORY_FILES) {
      const from = path.join(MEMORY, name)
      if (liftMemoryFile(from, agentMemoryFile(PLANNER, name), '')) moved.push(rel(from))
    }
    for (const module of modules) {
      const dir = path.join(MEMORY, module)
      for (const name of [...PLANNER_MEMORY_FILES, 'readme.md']) {
        const from = path.join(dir, name)
        const into = name === 'readme.md' ? path.join(MEMORY, name) : agentMemoryFile(PLANNER, name)
        if (liftMemoryFile(from, into, module)) moved.push(rel(from))
      }
      dropIfEmpty(dir)
    }
  } catch {
    // Part-way is a state the next read carries on from, so a failure is not worth failing
    // the read it happened under.
  }
  return moved
}

function dropIfEmpty(dir: string): void {
  try {
    if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir)
  } catch {
    // Something else is in there — a file nothing on the board writes. Leave it alone.
  }
}
