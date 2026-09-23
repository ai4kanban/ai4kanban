// Read and validate an agent’s frontmatter and instructions.

import { isSpecOutput, SPEC_OUTPUTS, type SpecOutput } from '../agent/types'
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
  /** The hook it plugs into. */
  kind: AgentKind
  /** Whether it may lead its stage of a workflow (#846): every `lead` agent, and a `spec`
   *  agent whose file says `akb.lead: true`. Everything else only helps, and these never do (#858). */
  canLead: boolean
  /** The workflow stage it may be assigned to (#715), or null when it declares none and
   *  belongs to no workflow. `akb.stage` says it; a file written before that key reads as
   *  the stage its `kind` always served — `spec` fills a card's spec, so it is `plan`. */
  stage: WorkflowStage | null
  /** Where its section lands on a card until somebody sets it otherwise (#445) — the value
   *  the board's own `output` setting starts at, and a lead's for good. `agent` unless `akb.output` says so. */
  output: SpecOutput
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

/** One setting's user-facing words in another language, keyed by each choice's own `value` —
 *  anything left out falls back to the English the setting declares. Every setting is the
 *  board's own (#1003), so these live beside it (../agents/output.ts) rather than in an
 *  `AGENT.md`. */
export interface SettingLines {
  label?: string
  help?: string
  choices?: Record<string, { label?: string; cost?: string }>
}

/** The hooks an agent may plug into: `spec` fills one part of a card's spec; `lead` runs a
 *  workflow's plan or execute stage, its body printed after the shared flow (#822). `write`
 *  joined the retired marketing board's writer (#718) — a file still declaring it is listed
 *  as a problem rather than registered as something nothing can call. */
export const AGENT_KINDS = ['spec', 'lead'] as const
export type AgentKind = (typeof AGENT_KINDS)[number]

/** What a `kind` means as a stage, for a file written before `akb.stage` existed. A `spec`
 *  agent fills part of a card's spec while it is being planned, which is the plan stage. */
const STAGE_OF_KIND: Record<AgentKind, WorkflowStage | null> = { spec: 'plan', lead: null }

/** What an agent may be called: lower-case words joined by "-". It is the folder's name too,
 *  and the word every flow asks for it by. */
export const AGENT_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Read one `AGENT.md`. Either the agent, or the one line saying why it can't be used. */
export function parseSpecAgent(
  text: string,
  from: string,
  file: (relative: string) => string | null,
  builtIn = false,
  list: () => string[] = () => [],
): { agent: SpecAgent } | { problem: string } {
  const bad = (why: string) => ({ problem: `${from}: ${why}` })
  const { meta, body } = splitFrontmatter(text)
  if (meta === null) return bad('no `---` frontmatter, so it declares no name or description')
  const front = parseYamlBlock(meta)

  const name = str(front.name)
  if (!name) return bad('its frontmatter has no `name`')
  if (!AGENT_NAME.test(name)) return bad(`"${name}" is not a usable agent name — use lower-case words joined by "-"`)
  const description = str(front.description)
  if (!description) return bad(`\`${name}\` has no \`description\`, which tells the caller when to request it`)

  const akb = map(front.akb)
  if (!akb) return bad(`\`${name}\` has no \`akb:\` block, so the board can't tell what kind of agent it is`)
  // Where it is used: `akb.stage` is what an agent written for a workflow declares (#715),
  // `akb.kind` what every agent written before workflows existed declares, and each stands
  // in for the other — so a new agent says one thing and no file already on a board has to
  // be edited.
  const declaredStage = str(akb.stage)
  if (declaredStage && !isStage(declaredStage)) {
    return bad(`\`${name}\` declares \`akb.stage: ${declaredStage}\` — a stage is \`${WORKFLOW_STAGES.join('` or `')}\``)
  }
  const declaredKind = str(akb.kind)
  if (declaredKind === 'write') {
    return bad(`\`${name}\` is a \`write\` agent, and the marketing board it wrote for is retired — give it an \`akb.stage\` instead`)
  }
  if (declaredKind && !isKind(declaredKind)) {
    return bad(
      `\`${name}\` declares \`akb.kind: ${declaredKind}\` — an agent is \`${AGENT_KINDS.join('\` or \`')}\``,
    )
  }
  if (!declaredKind && !declaredStage) {
    return bad(`\`${name}\` declares neither \`akb.stage\` nor \`akb.kind\`, so the board can't tell where it is used`)
  }
  const kind: AgentKind = isKind(declaredKind) ? declaredKind : 'spec'
  const stage = isStage(declaredStage) ? declaredStage : STAGE_OF_KIND[kind]
  if (kind === 'lead' && stage !== 'plan' && stage !== 'execute') {
    return bad(`\`${name}\` is a \`lead\` agent — give it \`akb.stage: plan\` or \`akb.stage: execute\``)
  }
  const declaredLead = str(akb.lead)
  if (declaredLead && declaredLead !== 'true' && declaredLead !== 'false') {
    return bad(`\`${name}\` declares \`akb.lead: ${declaredLead}\` — it is \`true\` or \`false\``)
  }
  if (declaredLead === 'true' && stage !== 'plan' && stage !== 'execute') {
    return bad(`\`${name}\` declares \`akb.lead: true\` — only a plan or execute agent can lead`)
  }

  // Who its output is for, to start with. A spec agent's is the board's setting from here on;
  // a lead's stays what its file says (#868). Saying nothing gets `agent`, which is where a
  // section has always gone.
  const declaredOutput = str(akb.output)
  if (declaredOutput && !isSpecOutput(declaredOutput)) {
    return bad(`\`${name}\` declares \`akb.output: ${declaredOutput}\` — it is \`${SPEC_OUTPUTS.join('` or `')}\``)
  }
  const output = isSpecOutput(declaredOutput) ? declaredOutput : 'agent'

  const instructions = body.trim()
  if (!instructions) return bad(`\`${name}\` has frontmatter but no instructions under it`)

  // `akb.settings` is read by nothing (#1003). A file on a board that still declares one is
  // left on the board rather than refused: the key does nothing, and taking the agent away
  // over a dead line would cost more than it says.

  return {
    agent: {
      name,
      description,
      i18n: readTranslations(akb.i18n),
      kind,
      canLead: kind === 'lead' || declaredLead === 'true',
      stage,
      output,
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

const isKind = (value: string): value is AgentKind => (AGENT_KINDS as readonly string[]).includes(value)

const isStage = (value: string): value is WorkflowStage => (WORKFLOW_STAGES as readonly string[]).includes(value)

const str = (value: YamlValue | undefined): string => (typeof value === 'string' ? value.trim() : '')

const map = (value: YamlValue | undefined): Record<string, YamlValue> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : null
