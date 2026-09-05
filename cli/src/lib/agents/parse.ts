// Reading one `AGENT.md` into a spec agent.
//
// An agent is one folder under a name of its own: `AGENT.md` with `name`, `description` and
// instructions, and optional `references/` beside it. AKB's own additions live in the same
// frontmatter, under `akb:`, so an agent is one file to write and one file to read:
//
//   ---
//   name: ui-design
//   description: Use when a card changes or adds a screen the user sees.
//   akb:
//     kind: spec
//     owns: the screen a card changes
//     memory: project       # optional; the only scope there is
//     settings:
//       - key: mockupStyle
//         label: Mockup style
//         help: ...
//         default: full
//         choices:
//           - value: full
//             label: Rendered screen
//             cost: ...
//             reference: references/rendered-screen.md
//   ---
//
// Everything is checked here rather than where it is used. An agent that does not parse is
// reported by name and left out of the catalog — a half-read agent reaching a run is a run
// given instructions nobody wrote.

import type { SpecAgentChoice, SpecAgentSetting } from '../agent/types'
import { solution } from '../solution'
import { parseYamlBlock, splitFrontmatter } from './yaml'
import type { YamlValue } from './yaml'

/** One spec agent, read. `body` is its instructions; `file` reads anything else inside its
 *  folder, so a bundled agent and a project one are used the same way. */
export interface SpecAgent {
  name: string
  description: string
  /** The part of a card's spec it owns, in one line. A flow reads this against the card in
   *  front of it to decide whether the card needs the agent at all. */
  owns: string
  /** The hook it plugs into. */
  kind: AgentKind
  /** The scope it remembers in, or null when it declares none and starts every run fresh. */
  memory: AgentMemory | null
  settings: SpecAgentSetting[]
  /** Its `AGENT.md` instructions, without the frontmatter. */
  body: string
  /** Where it was read from, for a message a person has to act on. */
  from: string
  /** Whether the board ships it, as opposed to the project adding it. */
  builtIn: boolean
  /** One of its own files, by agent-relative path. Null when it isn't there. */
  file(relative: string): string | null
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

const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/
const RESERVED_KEYS = ['enabled', 'runtime']

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
  if (!NAME.test(name)) return bad(`"${name}" is not a usable agent name — use lower-case words joined by "-"`)
  const description = str(front.description)
  if (!description) return bad(`\`${name}\` has no \`description\`, which is the line a flow picks it by`)

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
    agent: { name, description, owns, kind: declaredKind, memory, settings, body: instructions, from, builtIn, file },
  }
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
