// Read and validate an agent’s frontmatter and instructions.

import { isSpecOutput, SPEC_OUTPUTS, type SpecAgentChoice, type SpecAgentSetting, type SpecOutput } from '../agent/types'
import { solution } from '../solution'
import { parseYamlBlock, splitFrontmatter } from './yaml'
import type { YamlValue } from './yaml'

/** One spec agent, read. `body` is its instructions; `file` reads anything else inside its
 *  folder, so a bundled agent and a project one are used the same way. */
export interface SpecAgent {
  name: string
  /** When the calling flow must request this agent. */
  description: string
  /** The part of a card's spec it owns. */
  owns: string
  /** What its two user-facing lines say in another language, by language tag (#334). Only
   *  ever DRAWN: every run is given the English pair above, so a translation can never
   *  change what an agent is asked to do, and the block never reaches a prompt. */
  i18n: Record<string, AgentLines>
  /** The hook it plugs into. */
  kind: AgentKind
  /** The scope it remembers in, or null when it declares none and starts every run fresh. */
  memory: AgentMemory | null
  /** Where its section lands on a card until somebody sets it otherwise (#445) — the value
   *  the board's own `output` setting starts at. `agent` unless `akb.output` says so. */
  output: SpecOutput
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
  owns?: string
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

/** The hooks an agent may plug into: `spec` fills one part of a card's spec, `write` joins
 *  the board's writer. Only the marketing board has a writer, so a `write` agent anywhere
 *  else is refused rather than registered as something that could never run. */
export const AGENT_KINDS = ['spec', 'write'] as const
export type AgentKind = (typeof AGENT_KINDS)[number]

/** The scopes an agent may remember in. One: the board it runs on, in a file its team
 *  shares. A memory of the machine or of the person reading it would be a memory nobody
 *  else could see, which is the opposite of what an agent on a board is for. */
export const AGENT_MEMORIES = ['project'] as const
export type AgentMemory = (typeof AGENT_MEMORIES)[number]

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
  const declaredKind = str(akb.kind)
  if (!isKind(declaredKind)) {
    return bad(
      `\`${name}\` declares \`akb.kind: ${declaredKind || '(none)'}\` — an agent is \`${AGENT_KINDS.join('\` or \`')}\``,
    )
  }
  if (declaredKind === 'write' && solution() !== 'marketing') {
    return bad(`\`${name}\` is a \`write\` agent, and only a marketing board has a writer to join`)
  }
  const owns = str(akb.owns)
  if (!owns) return bad(`\`${name}\` has no \`akb.owns\`, which is the part of the spec it answers for`)

  // Declaring nothing is the common case: an agent without a memory starts every run fresh,
  // which is what all of them did before this existed.
  const declaredMemory = str(akb.memory)
  if (declaredMemory && !isMemory(declaredMemory)) {
    return bad(`\`${name}\` declares \`akb.memory: ${declaredMemory}\` — \`${AGENT_MEMORIES.join('` or `')}\` is the only scope`)
  }
  const memory = isMemory(declaredMemory) ? declaredMemory : null

  // Who its output is for, to start with. The setting itself is the board's — every spec
  // agent has it, declared or not — so a file that says nothing gets `agent`, which is where
  // a section has always gone.
  const declaredOutput = str(akb.output)
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

  return {
    agent: {
      name,
      description,
      owns,
      i18n: readTranslations(akb.i18n),
      kind: declaredKind,
      memory,
      output,
      settings,
      body: instructions,
      from,
      builtIn,
      file,
    },
  }
}

// The `akb.i18n` block: one entry per language tag, each saying either of the two lines. A
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
      ...(str(said.owns) ? { owns: str(said.owns) } : {}),
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

const isMemory = (value: string): value is AgentMemory => (AGENT_MEMORIES as readonly string[]).includes(value)

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
