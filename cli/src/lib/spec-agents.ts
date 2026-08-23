// The spec agents, shipped with the command.
//
// A spec agent is a name, a prompt, and the settings it declares. It owns one part of a
// card's spec — the screen a card draws, the library it picks — and it fills that part in a
// run of its own: it starts clean, gets the card and a short note, writes one section of
// that card, and touches nothing else. What one is asked to do beyond its own prompt is
// `akb guide spec-agent`.
//
// Each one carries two lines a reader is shown: what it fills in, and the kind of card the
// board calls it for. They are the board's own words — `akb spec` prints them and the
// board UI's Agents section draws them, so neither keeps a copy that could say something
// else (#191).
//
// A setting is a pick from named choices, each choice carrying its own block of prompt
// text (#255). The picked blocks are appended to the agent's prompt, so a setting means
// whatever its text says and no board code has to know what any of them do.
//
// The prompts are markdown under src/spec/, inlined into the one built file the same way
// the flows are (`loader: {'.md': 'text'}` in cli/scripts/build.mjs). Edit the `.md`.

import { specAgentEntries, setSpecAgentSwitch, setSpecAgentValue } from './agent/settings'
import type { SpecAgentEntry } from './agent/settings'
import type { SpecAgentSetting, SpecAgentView } from './agent/types'
import technologySelection from '../spec/technology-selection.md'
import uiDesign from '../spec/ui-design.md'
import uiDesignAscii from '../spec/ui-design-ascii.md'
import uiDesignFull from '../spec/ui-design-full.md'

const LEGACY_SPEC_AGENT_NAMES: Record<string, string> = {
  'recommend-tech-stack': 'technology-selection',
}

/** One spec agent: the name it is run by, the part of a spec it owns, and its prompt. */
export interface SpecAgent {
  name: string
  /** The part of a card's spec it owns, in one line. This is what a flow reads to decide
   *  whether a card needs it at all. */
  owns: string
  /** The kind of card the board calls it for, in one line. Written to stand on its own,
   *  under `owns`, wherever the two are shown. */
  calledOn: string
  /** Its prompt, in full. What a run is handed is this plus the block of text each picked
   *  setting carries — `specAgentPrompt` below. */
  prompt: string
  /** The settings it declares, in the order a dialog draws them (#255). Empty for an agent
   *  that works one way and takes no direction. */
  settings: SpecAgentSetting[]
}

/** How `ui-design` draws a layout option (#256). Both styles answer the same way — two or
 *  three options, one line each, one recommended — and differ only in what one option's file
 *  is: a screen the board renders, or a drawing that reads as itself wherever it is opened.
 *
 *  It is board-wide, so a card is drawn in one style and never a mix, and it defaults to
 *  `full`: a board that never opens the setting draws what it drew before this existed. */
const MOCKUP_STYLE: SpecAgentSetting = {
  key: 'mockupStyle',
  label: 'Mockup style',
  help: 'What one layout option is: a screen the board renders, or a drawing in plain text.',
  choices: [
    {
      value: 'full',
      label: 'Rendered screen',
      cost: 'a `.tsx` or `.html` file per option, styled like the product — a long run, and the board draws it',
      prompt: uiDesignFull,
    },
    {
      value: 'ascii',
      label: 'ASCII drawing',
      cost: 'a `.txt` file per option, readable wherever it is opened — a short run, and no product styling',
      prompt: uiDesignAscii,
    },
  ],
  default: 'full',
}

export const SPEC_AGENTS: SpecAgent[] = [
  {
    name: 'ui-design',
    owns: 'the screen a card changes — the layout drawn as options, one of them recommended',
    calledOn: 'called on a card that changes or adds a screen the user sees',
    prompt: uiDesign,
    settings: [MOCKUP_STYLE],
  },
  {
    name: 'technology-selection',
    owns: 'the library, tool, or service a card leans on — the candidates weighed, one recommended',
    calledOn: 'called on a card that leans on an outside library, tool or service',
    prompt: technologySelection,
    settings: [],
  },
]

export const SPEC_AGENT_NAMES = SPEC_AGENTS.map((a) => a.name)

export const findSpecAgent = (name: string): SpecAgent | null => {
  const asked = name.trim()
  const canonical = LEGACY_SPEC_AGENT_NAMES[asked] ?? asked
  return SPEC_AGENTS.find((a) => a.name === canonical) ?? null
}

/** The current name first, followed by names accepted for backward compatibility. */
export const specAgentNames = (name: string): string[] => {
  const canonical = findSpecAgent(name)?.name ?? name.trim()
  return [
    canonical,
    ...Object.entries(LEGACY_SPEC_AGENT_NAMES)
      .filter(([, current]) => current === canonical)
      .map(([legacy]) => legacy),
  ]
}

/** The heading a spec agent's section carries on a card. Its name is in it, so a reader
 *  can see who is answerable for that part of the spec and a rerun knows what to replace. */
export const specHeading = (name: string): string => '## By `' + specAgentNames(name)[0] + '` agent'

// ---- switched on, switched off, and set (#191, #255) ------------------------
//
// Every spec agent is on until someone switches it off in the board UI, under
// Configuration → Agents. An agent that declares settings is set there too. Both are saved
// with the board, so they are the same for everyone working on it and the same wherever the
// board works — a flow run from a terminal reads them too.
//
// They are read as an agent is about to start, never remembered from earlier, so the last
// change is the one that counts.

/** Is this agent switched on? A name with nothing saved for it is on, so a board set up
 *  before the switches existed has every agent on. */
export const specAgentEnabled = (name: string, entries = specAgentEntries()): boolean =>
  specAgentNames(name).every((candidate) => entries[candidate]?.enabled !== false)

// What the file holds for one agent, under its current name or a name it used to have.
const savedEntry = (name: string, entries: Record<string, SpecAgentEntry>): SpecAgentEntry | null => {
  for (const candidate of specAgentNames(name)) {
    const entry = entries[candidate]
    if (entry) return entry
  }
  return null
}

/** What one agent is set to: every setting it declares, carrying the saved value or its own
 *  default. `notes` holds a line for each value that had to fall back — a choice renamed or
 *  dropped between releases would otherwise reach a run as a word its prompt has no text
 *  for, and silently getting a different answer than last time is worse than being told. */
export function specAgentSettings(
  agent: SpecAgent,
  entries = specAgentEntries(),
): { values: Record<string, string>; notes: string[] } {
  const saved = savedEntry(agent.name, entries)?.values ?? {}
  const values: Record<string, string> = {}
  const notes: string[] = []
  for (const setting of agent.settings) {
    const picked = saved[setting.key]
    if (picked !== undefined && setting.choices.some((c) => c.value === picked)) {
      values[setting.key] = picked
      continue
    }
    if (picked !== undefined) {
      notes.push(
        `the \`${agent.name}\` agent's ${setting.label} is saved as "${picked}", which it no longer offers — ` +
          `running it at its default, "${setting.default}".`,
      )
    }
    values[setting.key] = setting.default
  }
  return { values, notes }
}

/** The prompt one spec run is handed: the agent's own prompt, then the block of text each
 *  picked choice carries, in the order the settings are declared. An agent that declares no
 *  settings gets its prompt exactly as it stands. */
export function specAgentPrompt(
  agent: SpecAgent,
  entries = specAgentEntries(),
): { prompt: string; notes: string[] } {
  const { values, notes } = specAgentSettings(agent, entries)
  const blocks = agent.settings
    .map((setting) => setting.choices.find((c) => c.value === values[setting.key])?.prompt.trim())
    .filter((text): text is string => !!text)
  return { prompt: [agent.prompt.trim(), ...blocks].join('\n\n'), notes }
}

/** The agents a flow may ask for — the ones that are on, in the board's own order. */
export function enabledSpecAgents(): SpecAgent[] {
  const entries = specAgentEntries()
  return SPEC_AGENTS.filter((a) => specAgentEnabled(a.name, entries))
}

/** The spec agents a planning run is shown, so it can decide for itself which — if any —
 *  a card needs. One entry each, in the board's own two lines, and the ask spelled out with
 *  the card's id in it.
 *
 *  It is a roster, not an instruction: a flow reads `owns` against the card in front of it,
 *  and asking for none is the common answer. Switched-off agents are left out, so a board
 *  that turned one off is never offered it.
 *
 *  Empty when every agent is off — a heading over an empty list reads as a list that failed
 *  to load. */
export function specAgentRoster(id: number | string): string {
  const on = enabledSpecAgents()
  if (!on.length) return ''
  return [
    // Tagged, because this block is a list of other agents sitting under an instruction
    // about the card. Without a boundary a run reads "ui-design" as part of its own job.
    '<spec-agents>',
    'Agents this board has, each filling one part of a card\'s spec in a run of its own:',
    ...on.flatMap((a) => [`- \`${a.name}\``, `  owns ${a.owns}`, `  ${a.calledOn}`]),
    `Ask for the ones this card would otherwise be planned without, with \`akb spec <agent> ${id} <short note>\`.`,
    'Asking for none is the usual answer — judge it against the card in front of you.',
    '</spec-agents>',
  ].join('\n')
}

/** Every spec agent as a screen reads it: both its lines, whether it is on, the settings it
 *  declares and what each one is set to. The prompt text a choice carries is left out — it
 *  is the run's business, not a dialog's. */
export function readSpecAgents(): SpecAgentView[] {
  const entries = specAgentEntries()
  return SPEC_AGENTS.map((a) => ({
    name: a.name,
    owns: a.owns,
    calledOn: a.calledOn,
    enabled: specAgentEnabled(a.name, entries),
    settings: a.settings.map((setting) => ({
      key: setting.key,
      label: setting.label,
      ...(setting.help ? { help: setting.help } : {}),
      choices: setting.choices.map((c) => ({ value: c.value, label: c.label, cost: c.cost })),
      default: setting.default,
    })),
    values: specAgentSettings(a, entries).values,
  }))
}

/** Switch one agent on or off. The name is checked against the agents this board ships,
 *  so nothing writes a switch for an agent that doesn't exist. What that agent is set to
 *  survives the flip either way: losing a pick by switching an agent off and on would be a
 *  surprise. */
export function setSpecAgentEnabled(name: string, on: boolean): { ok: boolean; error?: string } {
  const agent = findSpecAgent(name)
  if (!agent) return { ok: false, error: notAnAgent(name) }
  return setSpecAgentSwitch(agent.name, on, specAgentNames(agent.name).slice(1))
}

/** Save one of the settings an agent declares. The agent, the key and the value are all
 *  checked against what this board ships, so nothing writes a setting no agent has or a
 *  choice no setting offers. A value that IS the setting's default is dropped rather than
 *  written down — the file records what somebody changed. */
export function setSpecAgentSetting(name: string, key: string, value: string): { ok: boolean; error?: string } {
  const agent = findSpecAgent(name)
  if (!agent) return { ok: false, error: notAnAgent(name) }
  const setting = agent.settings.find((s) => s.key === key)
  if (!setting) {
    const takes = agent.settings.length
      ? `It takes: ${agent.settings.map((s) => s.key).join(', ')}.`
      : 'It takes none.'
    return { ok: false, error: `"${key}" is not a setting the \`${agent.name}\` spec agent takes. ${takes}` }
  }
  const picked = value.trim()
  if (picked && !setting.choices.some((c) => c.value === picked)) {
    return {
      ok: false,
      error: `"${picked}" is not one of the choices for ${setting.label}: ${setting.choices.map((c) => c.value).join(', ')}.`,
    }
  }
  // An empty value means "back to the default", and so does the default itself — both drop
  // the key, so the file never records a pick nobody made.
  const save = !picked || picked === setting.default ? '' : picked
  return setSpecAgentValue(agent.name, setting.key, save, specAgentNames(agent.name).slice(1))
}

const notAnAgent = (name: string): string =>
  `"${name}" is not a spec agent on this board. It ships: ${SPEC_AGENT_NAMES.join(', ')}.`

/** Where a switched-off agent goes back on. One place, named the same way everywhere. */
export const SPEC_SWITCH_HOME = 'the board UI, under Configuration → Agents'

/** The list of spec agents, one entry each — what `akb spec` with no agent named prints.
 *
 *  A switched-off agent is left out of the list a flow picks from. Typed by a person it is
 *  still named, in one closing line: an agent that vanished with no explanation is a
 *  feature the user thinks broke. */
export function specAgentList(program: string, forPerson = false): string {
  const entries = specAgentEntries()
  const on = SPEC_AGENTS.filter((a) => specAgentEnabled(a.name, entries))
  const off = SPEC_AGENTS.filter((a) => !specAgentEnabled(a.name, entries))
  return [
    `${program} spec <agent> <id> [note] — put a spec agent on a card.`,
    '',
    'A spec agent fills one part of a card\'s spec. It runs on its own, in its own context:',
    'it is given the card and your note, it writes one section of that card, and it changes',
    'nothing else. Ask for one when the card would otherwise be planned by guess.',
    '',
    'Agents',
    ...(on.length
      ? on.flatMap((a) => ['', `  ${a.name}`, `    ${a.owns}`, `    ${a.calledOn}`, ...settingLines(a, entries)])
      : ['', '  Every spec agent on this board is switched off. Ask for none.']),
    '',
    `The flow one follows is \`${program} guide spec-agent\`.`,
    ...(forPerson && off.length
      ? [
          '',
          `Switched off, so don't ask for ${off.length === 1 ? 'it' : 'them'}: ${off.map((a) => a.name).join(', ')}. ` +
            `Switch ${off.length === 1 ? 'it' : 'them'} back on in ${SPEC_SWITCH_HOME}.`,
        ]
      : []),
  ].join('\n')
}

// What one agent is set to, under the two lines it is listed by. One line per setting: what
// it is called, the choice in effect, and what that choice costs. An agent that declares
// none adds nothing, so the list reads exactly as it did before settings existed.
//
// The choices not in effect are left out on purpose: a setting is picked in the board UI,
// never here, so a terminal listing that spelled out every option would be a menu with
// nothing to press.
function settingLines(agent: SpecAgent, entries: Record<string, SpecAgentEntry>): string[] {
  if (!agent.settings.length) return []
  const { values } = specAgentSettings(agent, entries)
  return agent.settings.map((setting) => {
    const choice = setting.choices.find((c) => c.value === values[setting.key])
    return `    ${setting.label}: ${choice ? `${choice.label} — ${choice.cost}` : values[setting.key]}`
  })
}
