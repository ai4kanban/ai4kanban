// Read and validate an agent’s frontmatter and instructions.

import { isSpecOutput, SPEC_OUTPUTS, type SpecAgentChoice, type SpecAgentSetting, type SpecOutput } from '../agent/types'
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
   *  the board's own `output` setting starts at. `agent` unless `akb.output` says so. */
  output: SpecOutput
  /** Everything else in its folder, by agent-relative path (#860) — named in every run and
   *  read on demand, so `AGENT.md` can point at long material instead of carrying it. A file
   *  a setting's `reference` names is not here: that one is sent whole when its choice is
   *  picked. */
  files: string[]
  settings: SpecAgentSetting[]
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
  /** What its settings say here, by setting key. */
  settings?: Record<string, SettingLines>
}

/** One setting's user-facing words in another language. Keyed by the setting's own `key` and
 *  each choice's own `value`, so a translation never restates the shape — anything it leaves
 *  out falls back to the English the setting declares. */
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
const RESERVED_KEYS = ['enabled', 'runtime', 'output']

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

  // Who its output is for, to start with. The setting itself is the board's — every spec
  // agent has it, declared or not — so a file that says nothing gets `agent`, which is where
  // a section has always gone.
  const declaredOutput = kind === 'lead' ? '' : str(akb.output)
  if (declaredOutput && !isSpecOutput(declaredOutput)) {
    return bad(`\`${name}\` declares \`akb.output: ${declaredOutput}\` — it is \`${SPEC_OUTPUTS.join('` or `')}\``)
  }
  const output = isSpecOutput(declaredOutput) ? declaredOutput : 'agent'

  const settings: SpecAgentSetting[] = []
  const declared = akb.settings === undefined || akb.settings === '' ? [] : akb.settings
  if (!Array.isArray(declared)) return bad(`\`${name}\`: \`akb.settings\` has to be a list`)
  for (const raw of declared) {
    const setting = readSetting(raw, name, file)
    if ('problem' in setting) return bad(setting.problem)
    if (settings.some((s) => s.key === setting.setting.key)) {
      return bad(`\`${name}\` declares the setting \`${setting.setting.key}\` twice`)
    }
    settings.push(setting.setting)
  }

  const instructions = body.trim()
  if (!instructions) return bad(`\`${name}\` has frontmatter but no instructions under it`)

  // A file a choice names is the setting's to send, whole, when that choice is picked — so it
  // is never also offered as something to go and read.
  const references = new Set(settings.flatMap((s) => s.choices.map((c) => c.reference)))

  return {
    agent: {
      name,
      description,
      i18n: readTranslations(akb.i18n),
      kind,
      canLead: kind === 'lead' || declaredLead === 'true',
      stage,
      output,
      files: list().filter((p) => !references.has(p)),
      settings,
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
    const settings = readSettingTranslations(said.settings)
    const lines: AgentLines = {
      ...(str(said.title) ? { title: str(said.title) } : {}),
      ...(str(said.description) ? { description: str(said.description) } : {}),
      ...(Object.keys(settings).length ? { settings } : {}),
    }
    if (Object.keys(lines).length) out[tag] = lines
  }
  return out
}

// The `settings` block under one language: `<key>: { label, help, choices: { <value>: {…} } }`.
// Dropped rather than refused, like the lines above — a translation is only ever drawn.
function readSettingTranslations(raw: YamlValue | undefined): Record<string, SettingLines> {
  const block = map(raw)
  if (!block) return {}
  const out: Record<string, SettingLines> = {}
  for (const [key, value] of Object.entries(block)) {
    const said = map(value)
    if (!said) continue
    const choices: Record<string, { label?: string; cost?: string }> = {}
    for (const [choice, words] of Object.entries(map(said.choices) ?? {})) {
      const spoken = map(words)
      if (!spoken) continue
      const lines = {
        ...(str(spoken.label) ? { label: str(spoken.label) } : {}),
        ...(str(spoken.cost) ? { cost: str(spoken.cost) } : {}),
      }
      if (Object.keys(lines).length) choices[choice] = lines
    }
    const setting: SettingLines = {
      ...(str(said.label) ? { label: str(said.label) } : {}),
      ...(str(said.help) ? { help: str(said.help) } : {}),
      ...(Object.keys(choices).length ? { choices } : {}),
    }
    if (Object.keys(setting).length) out[key] = setting
  }
  return out
}

const isKind = (value: string): value is AgentKind => (AGENT_KINDS as readonly string[]).includes(value)

const isStage = (value: string): value is WorkflowStage => (WORKFLOW_STAGES as readonly string[]).includes(value)

function readSetting(
  raw: YamlValue,
  agent: string,
  file: (relative: string) => string | null,
): { setting: SpecAgentSetting } | { problem: string } {
  const bad = (why: string) => ({ problem: `\`${agent}\`: ${why}` })
  const entry = map(raw)
  if (!entry) return bad('each entry under `akb.settings` has to be a block with a `key`')
  const key = str(entry.key)
  if (!key) return bad('a setting has no `key`')
  if (RESERVED_KEYS.includes(key)) return bad(`\`${key}\` is the board's own key and cannot be a setting`)
  const label = str(entry.label)
  if (!label) return bad(`the \`${key}\` setting has no \`label\``)

  const rawChoices = entry.choices
  if (!Array.isArray(rawChoices) || !rawChoices.length) {
    return bad(`the \`${key}\` setting offers no \`choices\``)
  }
  const choices: SpecAgentChoice[] = []
  for (const rawChoice of rawChoices) {
    const choice = map(rawChoice)
    if (!choice) return bad(`a choice under \`${key}\` is not a block`)
    const value = str(choice.value)
    const choiceLabel = str(choice.label)
    const cost = str(choice.cost)
    const reference = str(choice.reference)
    if (!value) return bad(`a choice under \`${key}\` has no \`value\``)
    if (choices.some((c) => c.value === value)) return bad(`\`${key}\` offers the choice "${value}" twice`)
    if (!choiceLabel) return bad(`the "${value}" choice under \`${key}\` has no \`label\``)
    if (!cost) return bad(`the "${value}" choice under \`${key}\` has no \`cost\``)
    if (!reference) return bad(`the "${value}" choice under \`${key}\` names no \`reference\``)
    if (reference.startsWith('/') || reference.split('/').includes('..')) {
      return bad(`the "${value}" choice under \`${key}\` points outside the agent: ${reference}`)
    }
    if (file(reference) === null) return bad(`the "${value}" choice under \`${key}\` points at a missing ${reference}`)
    choices.push({ value, label: choiceLabel, cost, reference })
  }

  const fallback = str(entry.default)
  if (!fallback) return bad(`the \`${key}\` setting has no \`default\``)
  if (!choices.some((c) => c.value === fallback)) {
    return bad(`the \`${key}\` setting defaults to "${fallback}", which is not one of its choices`)
  }
  const help = str(entry.help)
  return { setting: { key, label, ...(help ? { help } : {}), choices, default: fallback } }
}

const str = (value: YamlValue | undefined): string => (typeof value === 'string' ? value.trim() : '')

const map = (value: YamlValue | undefined): Record<string, YamlValue> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : null
