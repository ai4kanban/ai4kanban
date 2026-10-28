// Read and validate an agent’s frontmatter and instructions. No file access, and imports keep
// their `.ts`: the Cloud Worker reads agents with this file too (#2040).

import { parseYamlBlock, splitFrontmatter } from './yaml.ts'
import type { YamlValue } from './yaml.ts'

/** One spec agent, read. `body` is its instructions; `file` reads anything else inside its
 *  folder, so a bundled agent and a project one are used the same way. */
export interface SpecAgent {
  name: string
  /** What it does, in one sentence. */
  description: string
  /** When planning requests it as a preview, exceptions included — `akb.when`. Absent: every
   *  card on its workflow requests it. */
  when?: string
  /** The previews whose approval it waits on when a card requests them too (#2154) —
   *  `akb.after`. ../agent/workflows.ts drops a name outside its workflow or one that closes a loop. */
  after: string[]
  /** What its user-facing lines say in another language, by language tag (#334). Only
   *  ever DRAWN: every run is given the English pair above, so a translation can never
   *  change what an agent is asked to do, and the block never reaches a prompt. */
  i18n: Record<string, AgentLines>
  /** The new input it runs on as a scheduled agent (#1475) — `akb.reads`. Absent: it runs on
   *  its cadence alone. */
  reads?: ScheduleReads
  /** It runs as a preview in a session of its own (#1824, #2152) — `akb.session: new`. Absent:
   *  planning runs it in the card's planning session. */
  session?: 'new'
  /** The global memories it keeps (#1575) — `akb.memory`, by name. A name no memory has is
   *  kept here and skipped where the run is written. */
  memory: string[]
  /** Its own memory files that hold in every project of the user's (#2078) —
   *  `akb.memoryFiles.workspace`, relative to `memory/agents/<name>/`; a path ending in `/` is
   *  a folder. Only the cloud sync reads it; the rest are this project's. */
  memoryFiles: { workspace: string[] }
  /** Everything else in its folder, by agent-relative path (#860) — named in every run and
   *  read on demand, so `AGENT.md` can point at long material instead of carrying it. */
  files: string[]
  /** Its `AGENT.md` instructions, without the frontmatter. */
  body: string
  /** Where it was read from, for a message a person has to act on. */
  from: string
  /** Whether the board ships it, as opposed to the project adding it. */
  builtIn: boolean
  /** One of its own files, by agent-relative path. Null when it isn't there. */
  file(relative: string): string | null
  /** A project agent's folder, absolute, and the whole of its `AGENT.md` — filled in by
   *  ../agents/catalog.ts. Absent on a bundled agent: its file ships inside the command,
   *  so there is nothing on disk to point at or write back. */
  dir?: string
  text?: string
}

/** An agent's user-facing words, as one language says them. */
export interface AgentLines {
  /** What it is CALLED here. Its `name` is an id — the folder, the rule file, the word a
   *  run is asked for by — and stays English everywhere; this is only ever drawn. */
  title?: string
  description?: string
  when?: string
}

/** The `akb.*` keys from before #2152, when an agent declared its own role. Its workflow
 *  lists it now. */
const OLD_ROLE_KEYS = ['lead', 'hook', 'stage', 'kind']

/** What an agent may be called: lower-case words joined by "-". It is the folder's name too,
 *  and the word every flow asks for it by. */
export const AGENT_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Every documented `akb.*` key read below. Change it with the parser: test/agent-key-docs.test.ts
 *  holds the written key table to it. */
export const AGENT_KEYS = ['when', 'after', 'session', 'reads', 'memory', 'memoryFiles', 'i18n'] as const

/** What `akb.reads` names (#1475): the new input whose arrival makes a scheduled agent due. */
export const SCHEDULE_READS = ['archived-cards', 'chats', 'dismissals'] as const
export type ScheduleReads = (typeof SCHEDULE_READS)[number]
export const isScheduleReads = (value: string): value is ScheduleReads => (SCHEDULE_READS as readonly string[]).includes(value)

/** Why one `AGENT.md` can't be used: the line, and what a caller needs to say it its own way. */
export interface AgentProblem {
  problem: string
  /** What the file calls itself, when it reads that far. */
  name?: string
  /** The keys from before #2152 it still declares. */
  old?: { keys: string[] }
}

/** Read one `AGENT.md`. Either the agent, or the one line saying why it can't be used. */
export function parseSpecAgent(
  text: string,
  from: string,
  file: (relative: string) => string | null,
  builtIn = false,
  list: () => string[] = () => [],
): { agent: SpecAgent } | AgentProblem {
  let named = ''
  const bad = (why: string, old?: AgentProblem['old']): AgentProblem => ({
    problem: `${from}: ${why}`,
    ...(named ? { name: named } : {}),
    ...(old ? { old } : {}),
  })
  const { meta, body } = splitFrontmatter(text)
  if (meta === null) return bad('no `---` frontmatter, so it declares no name or description')
  const front = parseYamlBlock(meta)

  const name = str(front.name)
  if (!name) return bad('its frontmatter has no `name`')
  if (!AGENT_NAME.test(name)) return bad(`"${name}" is not a usable agent name — use lower-case words joined by "-"`)
  named = name
  const description = str(front.description)
  if (!description) return bad(`\`${name}\` has no \`description\`, which says what it does`)

  const akb = map(front.akb) ?? {}
  const old = OLD_ROLE_KEYS.filter((key) => akb[key] !== undefined)
  if (old.length) {
    return bad(
      `\`${name}\` declares ${old.map((key) => `\`akb.${key}\``).join(', ')}, which the board no longer reads — remove ` +
        `${old.length > 1 ? 'them' : 'it'}, and list the agent in its workflow's \`WORKFLOW.md\` under \`previews\`, \`land\` ` +
        'or `scheduled` (`akb guide write-agent`), or ask the Workflow builder to rewrite it',
      { keys: old },
    )
  }

  // `commits` was retired so no schedule depends on git: what it stood for is finished cards.
  const declaredReads = str(akb.reads) === 'commits' ? 'archived-cards' : str(akb.reads)
  if (declaredReads && !isScheduleReads(declaredReads)) {
    return bad(`\`${name}\` declares \`akb.reads: ${declaredReads}\` — it is \`${SCHEDULE_READS.join('` or `')}\``)
  }
  const when = str(akb.when)
  const after = names(akb.after)
  const declaredSession = str(akb.session)
  if (declaredSession && declaredSession !== 'new') {
    return bad(`\`${name}\` declares \`akb.session: ${declaredSession}\` — it is \`new\`, or left out to run in the planning session`)
  }

  const workspace = memoryPaths(akb.memoryFiles)
  if (typeof workspace === 'string') return bad(`\`${name}\` declares ${workspace}`)

  const instructions = body.trim()
  if (!instructions) return bad(`\`${name}\` has frontmatter but no instructions under it`)

  // `akb.settings` and `akb.output` are read by nothing (#1003, #1574). A file that still
  // declares one is left on the board rather than refused: the key does nothing, and taking
  // the agent away over a dead line would cost more than it says.

  return {
    agent: {
      name,
      description,
      ...(when ? { when } : {}),
      after,
      i18n: readTranslations(akb.i18n),
      ...(declaredReads ? { reads: declaredReads as ScheduleReads } : {}),
      ...(declaredSession ? { session: 'new' as const } : {}),
      memory: names(akb.memory),
      memoryFiles: { workspace },
      files: list(),
      body: instructions,
      from,
      builtIn,
      file,
    },
  }
}

// The `akb.i18n` block: one entry per language tag, each saying its title, description or when. A
// tag with nothing readable under it is dropped rather than refused — a translation is
// drawn, so a typo in one is never a reason to take an agent off the board.
function readTranslations(raw: YamlValue | undefined): Record<string, AgentLines> {
  const block = map(raw)
  if (!block) return {}
  const out: Record<string, AgentLines> = {}
  for (const [tag, value] of Object.entries(block)) {
    const said = map(value)
    if (!said) continue
    const lines: AgentLines = {
      ...(str(said.title) ? { title: str(said.title) } : {}),
      ...(str(said.description) ? { description: str(said.description) } : {}),
      ...(str(said.when) ? { when: str(said.when) } : {}),
    }
    if (Object.keys(lines).length) out[tag] = lines
  }
  return out
}

// `akb.memoryFiles.workspace`: paths inside the agent's memory folder, or why the value is
// not one. `*` matches within one name, so `format-*.md` covers every format file.
function memoryPaths(raw: YamlValue | undefined): string[] | string {
  if (raw === undefined) return []
  const block = map(raw)
  const extra = block ? Object.keys(block).filter((key) => key !== 'workspace') : []
  if (!block || extra.length) return `\`akb.memoryFiles\` with ${block ? `\`${extra.join('`, `')}\`` : 'no `workspace:` list'} — it holds only \`workspace: [<path>, ...]\``
  const list = block.workspace
  if (list === undefined) return []
  if (!Array.isArray(list) || list.some((v) => typeof v !== 'string' || !v.trim())) {
    return '`akb.memoryFiles.workspace` that is not a list of paths — write `workspace: [style.md]`'
  }
  const paths = [...new Set(list.map((v) => (v as string).trim()))]
  const outside = paths.find((p) => p.startsWith('/') || p.includes('\\') || p.split('/').some((part) => part === '..' || part === '.'))
  if (outside) return `\`akb.memoryFiles.workspace: ${outside}\`, which is outside its memory folder — use a path inside \`memory/agents/<name>/\``
  return paths
}

// A list of names, or one name written bare.
const names = (value: YamlValue | undefined): string[] =>
  [...new Set((Array.isArray(value) ? value : [value]).map((v) => str(v as YamlValue)).filter(Boolean))]

const str = (value: YamlValue | undefined): string => (typeof value === 'string' ? value.trim() : '')

const map = (value: YamlValue | undefined): Record<string, YamlValue> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : null
