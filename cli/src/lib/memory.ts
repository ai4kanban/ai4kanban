// ---- the board's memory ----------------------------------------------------
//
// Memory belongs to whoever reads and writes it (#805). `docs/kanban/memory/` itself holds
// the board's own RECORD — `readme.md`, what shipped, and `project.md`, what the project is
// today. Neither is anybody's taste, so neither is an agent's. Everything a run LEARNED is
// an agent's, under `memory/agents/<agent>/`: the planner's `decisions.md`, `rejected.md`
// and `redesign.md`, and whatever a spec agent's own prompt says to keep. A module's planning
// notes sit in its own folder, `planner/<module>/`, under the same file names (#1484); the
// planner's root files keep what spans modules.

import fs from 'node:fs'
import path from 'node:path'

import { rel, warn, AGENT_MEMORY, MEMORY } from './paths'
import { specAgentNames } from './spec-agent-names'
import { moduleNames } from './validate'
import { BUNDLED_MEMORY_FILES } from '../memories/bundled'

// Read here rather than from ./memories.ts, which imports this file.
const isGlobalMemory = (name: string): boolean =>
  name in BUNDLED_MEMORY_FILES || fs.existsSync(path.join(MEMORY, name, 'MEMORY.md'))

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

/** The planner's files, in the order a roster lists them. `rejected.md` is written only by
 *  the rejection review (#929, #1497). */
export const PLANNER_MEMORY_FILES = ['decisions.md', 'rejected.md', 'redesign.md'] as const

/** The proposer's one file: kinds of follow-up it missed, written only by the memory review. */
export const PROPOSER = 'proposer'
export const PROPOSER_MISSED = 'missed.md'
export const proposerMissedFile = (): string => rel(agentMemoryFile(PROPOSER, PROPOSER_MISSED))

/** The board's own record — what it did, and what the project is. Not an agent's. */
export const BOARD_MEMORY_FILES = ['readme.md', 'project.md'] as const

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
  // Only a header: `describe-project` writes the body, and runs while there is none (#1268).
  'project.md': `# Project

What the project is today, from its users' side. Rewritten whole by \`akb describe-project\`;
edits here do not last.
`,
}

/** Whether a memory file says nothing beyond the header it was seeded with. */
export const onlyStarter = (name: string, text: string): boolean => !text.trim() || text.trim() === STARTERS[name]?.trim()

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
    if (FOLDED_UNDER[was]) foldMemory(was, agent, FOLDED_UNDER[was])
    else moveMemory(agentMemoryDir(was), agentMemoryDir(agent))
    moveMemory(legacyAgentMemoryFile(was), legacyAgentMemoryFile(agent))
  }
}

// An agent folded into another (#1582) adds its notes to the other's same-named file, under
// one heading, and only what is not already there.
const FOLDED_UNDER: Record<string, string> = { 'user-docs': '## Docs' }

function foldMemory(was: string, agent: string, heading: string): void {
  for (const name of writtenMemoryNames(was)) {
    const from = agentMemoryFile(was, name)
    try {
      const carried = fs.readFileSync(from, 'utf8').trim()
      const into = agentMemoryFile(agent, name)
      const kept = fs.existsSync(into) ? fs.readFileSync(into, 'utf8').trim() : ''
      if (carried && !kept.includes(carried)) {
        fs.mkdirSync(agentMemoryDir(agent), { recursive: true })
        fs.writeFileSync(into, `${[kept, `${heading}\n\n${carried}`].filter(Boolean).join('\n\n')}\n`)
      }
      fs.rmSync(from, { force: true })
    } catch {
      warn(`couldn't fold ${from} into ${agentMemoryDir(agent)}/ — reading what is there`)
    }
  }
  try {
    fs.rmdirSync(agentMemoryDir(was))
  } catch {
    // Not empty, or not there: either way nothing of it is lost.
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

// ---- a module's planning memory (#1484) -------------------------------------

/** Names a module may not take: a folder of that name beside the planner's file is what was
 *  split out of it (#959), not a module. */
export const RESERVED_MODULE_NAMES: readonly string[] = PLANNER_MEMORY_FILES.map((name) => name.replace(/\.md$/, ''))

const isModule = (name: string): boolean => !!name && !RESERVED_MODULE_NAMES.includes(name)

/** One module's copy of a planner file. */
export const moduleMemoryFile = (module: string, name: string): string => path.join(agentMemoryDir(PLANNER), module, name)

/** The module folders the planner holds, in `modules.md` order, then any other by name. */
export function plannerModules(): string[] {
  let dirs: string[]
  try {
    dirs = fs
      .readdirSync(agentMemoryDir(PLANNER), { withFileTypes: true })
      .filter((e) => e.isDirectory() && isModule(e.name))
      .map((e) => e.name)
  } catch {
    return []
  }
  const order = moduleNames() ?? []
  return [...order.filter((m) => dirs.includes(m)), ...dirs.filter((d) => !order.includes(d)).sort()]
}

/** One planner file and every module's copy of it that exists — what a run judging for the
 *  whole board reads. */
export const plannerCopies = (name: string): string[] => [
  agentMemoryFile(PLANNER, name),
  ...plannerModules()
    .map((m) => moduleMemoryFile(m, name))
    .filter((file) => fs.existsSync(file)),
]

// ---- where a note goes ------------------------------------------------------

/** The file one memory name lives in — the board's own record in `memory/`, the planner's in
 *  its folder, or the module's copy when a module is named. */
export const memoryFile = (name: string, module = ''): string =>
  (BOARD_MEMORY_FILES as readonly string[]).includes(name)
    ? path.join(MEMORY, name)
    : isModule(module)
      ? moduleMemoryFile(module, name)
      : agentMemoryFile(PLANNER, name)

/** Where a card's note belongs, with the `## ` topics already in that file — a hint for
 *  picking a section without opening the file blind. The note itself is written by hand,
 *  because where a line goes, and whether it merges into one already there, is a judgment
 *  call. Scaffolds first, so the file is there to open. */
export function memoryTarget(name: string, module = ''): MemoryTarget {
  migrateMemory()
  scaffoldProjectMemory()
  const file = memoryFile(name, module)
  scaffoldFile(file, name)
  return { file, topics: readTopics(file) }
}

function scaffoldFile(file: string, name: string): void {
  if (fs.existsSync(file) || !STARTERS[name]) return
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, STARTERS[name])
}

/** The planner's `decisions.md` and `rejected.md` and every module's, board-relative — what a
 *  run standing back on the whole board is given (#493, #534): a reflection judges for the
 *  whole board rather than writes one card. Read-only, so nothing is scaffolded. */
export const planningMemoryFiles = (): string[] => ['decisions.md', 'rejected.md'].flatMap(plannerCopies).map(rel)

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
// move by OWNERSHIP: the board's planning files merge into the planner's, a module's into the
// planner's folder for that module (#1484), and each module's `readme.md` merges into the
// board's one under a `## <module>` topic. A `## <module>` topic left in a planner file by the
// release that kept modules as topics (#805) moves into that module's folder too.
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
const promote = (body: string): string => body.replace(/^#(#{2,5})(\s)/gm, '$1$2')

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
  if (body && !topic && !fs.existsSync(into)) {
    fs.mkdirSync(path.dirname(into), { recursive: true })
    fs.renameSync(from, into)
    return true
  }
  if (body) mergeInto(into, topic ? `## ${topic}\n\n${demote(body)}` : body)
  fs.rmSync(from, { force: true })
  return true
}

/** Move a module's `## <module>` topic out of one planner file into that module's copy.
 *  Entries the topic holds above its own sub-headings go above the copy's topics, where
 *  ungrouped notes sit; the sub-headings, promoted a level, go at its end. */
function liftModuleTopics(name: string, modules: string[]): string[] {
  const file = agentMemoryFile(PLANNER, name)
  if (!fs.existsSync(file)) return []
  const kept: string[] = []
  const topics = new Map<string, string[]>()
  let into: string[] | null = null
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const heading = line.match(/^##\s+(.+?)\s*$/)
    if (heading) into = modules.includes(heading[1]!) ? (topics.get(heading[1]!) ?? []) : null
    if (heading && into) topics.set(heading[1]!, into)
    else (into ?? kept).push(line)
  }
  if (!topics.size) return []
  for (const [module, lines] of topics) {
    const body = promote(lines.join('\n').trim())
    if (!body) continue
    const target = moduleMemoryFile(module, name)
    scaffoldFile(target, name)
    const at = body.search(/^## /m)
    const loose = (at < 0 ? body : body.slice(0, at)).trim()
    const headed = at < 0 ? '' : body.slice(at).trim()
    if (loose) {
      const text = fs.readFileSync(target, 'utf8')
      const first = text.search(/^## /m)
      const head = (first < 0 ? text : text.slice(0, first)).replace(/\s+$/, '')
      const rest = first < 0 ? '' : `\n${text.slice(first)}`
      fs.writeFileSync(target, `${head ? `${head}\n\n` : ''}${loose}\n${rest}`)
    }
    if (headed) mergeInto(target, headed)
  }
  fs.writeFileSync(file, `${kept.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '')}\n`)
  return [...topics.keys()].map((module) => `${rel(file)} ## ${module}`)
}

/** The module folders an older board kept memory in — everything under `memory/` but the
 *  agents' own and the global memories (#1575). */
function legacyModuleDirs(): string[] {
  try {
    return fs
      .readdirSync(MEMORY, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== RESERVED_MEMORY_DIR && !isGlobalMemory(e.name))
      .map((e) => e.name)
  } catch {
    return []
  }
}

// `product.md` became `project.md` (#1391). A description already under the new name is the
// one kept, and an old file still holding only its starter carries nothing.

const PRODUCT_STARTER = STARTERS['project.md']!.replaceAll('Project', 'Product').replaceAll('project', 'product')

/** Rename `memory/product.md` to `project.md`. Answers what it did, for `init` to report;
 *  null when there was no old file. */
export function renameProductFile(): string | null {
  const from = path.join(MEMORY, 'product.md')
  const to = path.join(MEMORY, 'project.md')
  if (!fs.existsSync(from)) return null
  try {
    const was = fs.readFileSync(from, 'utf8').trim()
    const written = fs.existsSync(to) && !onlyStarter('project.md', fs.readFileSync(to, 'utf8'))
    if (written || !was || was === PRODUCT_STARTER.trim()) {
      fs.rmSync(from, { force: true })
      return `removed ${rel(from)} — the file is ${rel(to)} now`
    }
    fs.renameSync(from, to)
    return `renamed ${rel(from)} to ${rel(to)}`
  } catch {
    return null
  }
}

/** What it moved, board-relative — empty on a board that is already there. */
export function migrateMemory(): string[] {
  renameProductFile()
  const roots = PLANNER_MEMORY_FILES.filter((name) => fs.existsSync(path.join(MEMORY, name)))
  const modules = legacyModuleDirs()
  const moved: string[] = []
  try {
    if (roots.length || modules.length) {
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
          const readme = name === 'readme.md'
          const into = readme ? path.join(MEMORY, name) : isModule(module) ? moduleMemoryFile(module, name) : agentMemoryFile(PLANNER, name)
          if (liftMemoryFile(from, into, readme || !isModule(module) ? module : '')) moved.push(rel(from))
        }
        dropIfEmpty(dir)
      }
    }
    const known = (moduleNames() ?? []).filter(isModule)
    if (known.length) for (const name of PLANNER_MEMORY_FILES) moved.push(...liftModuleTopics(name, known))
    moved.push(...mergeDismissed())
  } catch {
    // Part-way is a state the next read carries on from, so a failure is not worth failing
    // the read it happened under.
  }
  return moved
}

// `dismissed.md` folded into `rejected.md` beside it (#1497): both say what the user does not want.
function mergeDismissed(): string[] {
  const root = agentMemoryDir(PLANNER)
  let dirs: string[]
  try {
    dirs = [root, ...fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => path.join(root, e.name))]
  } catch {
    return []
  }
  return dirs.flatMap((dir) => {
    const from = path.join(dir, 'dismissed.md')
    if (!fs.existsSync(from)) return []
    const into = path.join(dir, 'rejected.md')
    scaffoldFile(into, 'rejected.md')
    return liftMemoryFile(from, into, '') ? [rel(from)] : []
  })
}

function dropIfEmpty(dir: string): void {
  try {
    if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir)
  } catch {
    // Something else is in there — a file nothing on the board writes. Leave it alone.
  }
}

// ---- retiring the goal (#1268) ----------------------------------------------
//
// `memory/goal.md` was the user's own direction. `project.md` replaced it, and a flow no
// longer reads it, so what the user wrote there moves to the top of the planner's
// `decisions.md` — above every topic, where cross-module calls already sit — and the file
// goes. A goal holding nothing but its `reviewed:` field or text an older version seeded is
// just deleted.

// Paragraphs older versions seeded into a fresh goal. Not the user's words wherever they sit.
const SEEDED_GOAL_PARAGRAPHS = new Set(
  [
    '# Goal',
    "Where this is headed, in the user's own words: the long-term goal, the horizon it aims at, and the roadmap of what comes next, roughly in order. Not this week's work — that's the cards on the board. The user owns this file; the agent seeds it but does not invent the goal.",
    "The direction, in the user's own words — where this is headed. One short statement. The user owns this file; the agent seeds it but does not invent the goal.",
    '_(not filled in yet — the user writes this.)_',
  ].map((p) => p.replace(/\s+/g, ' ')),
)

/** What the user wrote in a goal file: the frontmatter and seeded paragraphs dropped. */
export function goalWords(text: string): string {
  return text
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    .split(/\r?\n\s*\r?\n/)
    .filter((p) => !SEEDED_GOAL_PARAGRAPHS.has(p.trim().replace(/\s+/g, ' ')))
    .join('\n\n')
    .trim()
}

/** Move `memory/goal.md` into the planner's `decisions.md` and delete it. Answers what it
 *  did, for `init` to report; null when there was no goal file. */
export function retireGoal(): string | null {
  const goal = path.join(MEMORY, 'goal.md')
  if (!fs.existsSync(goal)) return null
  const words = goalWords(fs.readFileSync(goal, 'utf8'))
  if (words) {
    scaffoldProjectMemory()
    const file = agentMemoryFile(PLANNER, 'decisions.md')
    const text = fs.readFileSync(file, 'utf8')
    const at = text.search(/^## /m)
    const head = (at < 0 ? text : text.slice(0, at)).replace(/\s+$/, '')
    const rest = at < 0 ? '' : `\n${text.slice(at)}`
    fs.writeFileSync(file, `${head ? `${head}\n\n` : ''}${words}\n${rest}`)
  }
  fs.rmSync(goal, { force: true })
  return words ? `moved the goal to the top of ${rel(agentMemoryFile(PLANNER, 'decisions.md'))}` : 'removed the empty goal'
}
