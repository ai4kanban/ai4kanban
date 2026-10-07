// Read and validate an agent’s frontmatter and instructions.

import { WORKFLOW_STAGES, type WorkflowStage } from '../agent/workflows'
import { parseYamlBlock, splitFrontmatter } from './yaml'
import type { YamlValue } from './yaml'

/** One spec agent, read. `body` is its instructions; `file` reads anything else inside its
 *  folder, so a bundled agent and a project one are used the same way. */
export interface SpecAgent {
  name: string
  /** When the calling flow must request this agent. */
  description: string
  /** What its user-facing lines say in another language, by language tag (#334). Only
   *  ever DRAWN: every run is given the English pair above, so a translation can never
   *  change what an agent is asked to do, and the block never reaches a prompt. */
  i18n: Record<string, AgentLines>
  /** Its role: `akb.lead` reads as `lead`, `akb.hook` as `spec`. */
  kind: AgentKind
  /** Whether it may lead its stage of a workflow (#846): a `lead` agent. A hook only helps,
   *  and a lead never does (#858). */
  canLead: boolean
  /** The workflow stage it may be assigned to (#715) — the value of its `akb.lead` or
   *  `akb.hook`. */
  stage: WorkflowStage | null
  /** Whether it runs by itself on its workflow's cadence (#1401) — `akb.hook: schedule`. It
   *  joins no stage, so `stage` is null. */
  schedule: boolean
  /** The new input a scheduled agent runs on (#1475) — `akb.reads`. Absent: it runs on its
   *  cadence alone. */
  reads?: ScheduleReads
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
}

/** What an agent is: `spec` is a hook — it fills one part of a card's spec, or runs on a
 *  schedule; `lead` runs a workflow's plan or execute stage, its body printed
 *  after the shared flow (#822). */
export type AgentKind = 'spec' | 'lead'

/** The `akb.*` key naming each role (#1341). A file declares exactly one, valued with its stage. */
const ROLE_KEYS = { lead: 'lead', hook: 'spec' } as const satisfies Record<string, AgentKind>
/** The one `akb.hook` value that is no stage (#1401): the agent runs on a cadence. */
export const SCHEDULE_HOOK = 'schedule'
const ROLE_LINES = [...WORKFLOW_STAGES.map((stage) => `\`lead: ${stage}\``), '`hook: plan`', `\`hook: ${SCHEDULE_HOOK}\``]

/** What an agent may be called: lower-case words joined by "-". It is the folder's name too,
 *  and the word every flow asks for it by. */
export const AGENT_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Every `akb.*` key read below. Change it with the parser: test/agent-key-docs.test.ts holds
 *  the written key table to it. */
export const AGENT_KEYS = ['lead', 'hook', 'reads', 'i18n'] as const

/** What `akb.reads` names (#1475): the new input whose arrival makes a scheduled agent due. */
export const SCHEDULE_READS = ['archived-cards', 'chats', 'dismissals'] as const
export type ScheduleReads = (typeof SCHEDULE_READS)[number]
export const isScheduleReads = (value: string): value is ScheduleReads => (SCHEDULE_READS as readonly string[]).includes(value)

/** Why one `AGENT.md` can't be used: the line, and what a caller needs to say it its own way. */
export interface AgentProblem {
  problem: string
  /** What the file calls itself, when it reads that far. */
  name?: string
  /** The keys from before #1341 it still declares, and the one line that replaces them. */
  old?: { keys: string[]; line: string | null }
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
  if (!description) return bad(`\`${name}\` has no \`description\`, which tells the caller when to request it`)

  const akb = map(front.akb)
  if (!akb) return bad(`\`${name}\` has no \`akb:\` block, so the board can't tell what kind of agent it is`)
  const declaredStage = str(akb.stage)
  if (declaredStage === 'review') {
    return bad(`\`${name}\` declares \`akb.stage: review\`, and builds are no longer reviewed — delete this agent, or replace its role with one of ${ROLE_LINES.join(', ')}`)
  }
  const declaredKind = str(akb.kind)
  if (declaredKind === 'write') {
    return bad(`\`${name}\` is a \`write\` agent, and the marketing board it wrote for is retired — replace its role with one of ${ROLE_LINES.join(', ')}`)
  }
  const declaredLead = str(akb.lead)
  const declaredHook = str(akb.hook)
  // The keys before #1341. Refused outright, naming the one line that says the same thing.
  const oldLead = declaredLead === 'true' || declaredLead === 'false'
  const oldKeys = [
    ...(akb.stage !== undefined ? [['stage', declaredStage]] : []),
    ...(akb.kind !== undefined ? [['kind', declaredKind]] : []),
    ...(oldLead ? [['lead', declaredLead]] : []),
  ]
  if (oldKeys.length) {
    const old = oldKeys.map(([key, value]) => `\`${key}: ${value}\``)
    const line = replacementLine(declaredStage, declaredKind, declaredLead)
    return bad(
      `\`${name}\` declares ${old.join(', ')} under \`akb:\`, which the board no longer reads — replace ${old.length > 1 ? 'them' : 'it'} with ${line ? `\`${line}\`` : `one of ${ROLE_LINES.join(', ')}`}`,
      { keys: oldKeys.map(([key]) => key!), line },
    )
  }
  if (declaredLead && declaredHook) {
    return bad(`\`${name}\` declares both \`akb.lead\` and \`akb.hook\` — keep one: \`lead\` runs a whole stage, \`hook\` joins one`)
  }
  if (!declaredLead && !declaredHook) {
    return bad(`\`${name}\` declares neither \`akb.lead\` nor \`akb.hook\`, so the board can't tell where it is used — add one of ${ROLE_LINES.join(', ')}`)
  }
  const role = declaredLead ? 'lead' : 'hook'
  const declared = declaredLead || declaredHook
  const schedule = role === 'hook' && declared === SCHEDULE_HOOK
  if (!schedule && !isStage(declared)) {
    const allowed = role === 'hook' ? ['plan', SCHEDULE_HOOK] : WORKFLOW_STAGES
    return bad(`\`${name}\` declares \`akb.${role}: ${declared}\` — it is \`${allowed.join('` or `')}\``)
  }
  if (role === 'hook' && declared === 'execute') {
    return bad(`\`${name}\` declares \`akb.hook: execute\`, and nothing runs after a build any more — make it \`hook: ${SCHEDULE_HOOK}\` with \`reads: archived-cards\` to check finished work`)
  }
  const stage = schedule ? null : (declared as WorkflowStage)
  const kind = ROLE_KEYS[role]

  // `commits` was retired so no schedule depends on git: what it stood for is finished cards.
  const declaredReads = str(akb.reads) === 'commits' ? 'archived-cards' : str(akb.reads)
  if (declaredReads && !schedule) {
    return bad(`\`${name}\` declares \`akb.reads\`, which only a \`hook: ${SCHEDULE_HOOK}\` agent reads — remove it`)
  }
  if (declaredReads && !isScheduleReads(declaredReads)) {
    return bad(`\`${name}\` declares \`akb.reads: ${declaredReads}\` — it is \`${SCHEDULE_READS.join('` or `')}\``)
  }

  const instructions = body.trim()
  if (!instructions) return bad(`\`${name}\` has frontmatter but no instructions under it`)

  // `akb.settings` and `akb.output` are read by nothing (#1003, #1574). A file that still
  // declares one is left on the board rather than refused: the key does nothing, and taking
  // the agent away over a dead line would cost more than it says.

  return {
    agent: {
      name,
      description,
      i18n: readTranslations(akb.i18n),
      kind,
      canLead: kind === 'lead',
      stage,
      schedule,
      ...(declaredReads ? { reads: declaredReads as ScheduleReads } : {}),
      files: list(),
      body: instructions,
      from,
      builtIn,
      file,
    },
  }
}

// The `akb.i18n` block: one entry per language tag, each saying its title or description. A
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
    }
    if (Object.keys(lines).length) out[tag] = lines
  }
  return out
}

// The one line an old file's `stage`, `kind` and `lead: true|false` come to, or null when
// they never named a usable agent.
function replacementLine(stage: string, kind: string, lead: string): string | null {
  if ((stage && !isStage(stage)) || (kind && kind !== 'spec' && kind !== 'lead')) return null
  if (lead && lead !== 'true' && lead !== 'false') return null
  if (kind === 'lead' || lead === 'true') return stage ? `lead: ${stage}` : null
  return (stage || kind) && stage !== 'execute' ? 'hook: plan' : null
}

const isStage = (value: string): value is WorkflowStage => (WORKFLOW_STAGES as readonly string[]).includes(value)

const str = (value: YamlValue | undefined): string => (typeof value === 'string' ? value.trim() : '')

const map = (value: YamlValue | undefined): Record<string, YamlValue> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : null
