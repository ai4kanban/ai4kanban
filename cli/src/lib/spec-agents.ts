// The spec agents, shipped with the command.
//
// A spec agent is a name and a prompt. It owns one part of a card's spec — the screen a
// card draws, the library it picks — and it fills that part in a run of its own: it starts
// clean, gets the card and a short note, writes one section of that card, and touches
// nothing else. What one is asked to do beyond its own prompt is `akb guide spec-agent`.
//
// Each one carries two lines a reader is shown: what it fills in, and the kind of card the
// board calls it for. They are the board's own words — `akb spec` prints them and the
// board UI's Agents section draws them, so neither keeps a copy that could say something
// else (#191).
//
// The prompts are markdown under src/spec/, inlined into the one built file the same way
// the flows are (`loader: {'.md': 'text'}` in cli/scripts/build.mjs). Edit the `.md`.

import { specAgentSwitches, setSpecAgentSwitch } from './agent/settings'
import type { SpecAgentView } from './agent/types'
import technologySelection from '../spec/technology-selection.md'
import uiDesign from '../spec/ui-design.md'

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
  /** Its prompt, in full — handed to the run as it stands. */
  prompt: string
}

export const SPEC_AGENTS: SpecAgent[] = [
  {
    name: 'ui-design',
    owns: 'the screen a card changes — the layout drawn as options, one of them recommended',
    calledOn: 'called on a card that changes or adds a screen the user sees',
    prompt: uiDesign,
  },
  {
    name: 'technology-selection',
    owns: 'the library, tool, or service a card leans on — the candidates weighed, one recommended',
    calledOn: 'called on a card that leans on an outside library, tool or service',
    prompt: technologySelection,
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

// ---- switched on, switched off (#191) --------------------------------------
//
// Every spec agent is on until someone switches it off in the board UI, under
// Configuration → Agents. The switch is saved with the board, so it is the same switch for
// everyone working on it and the same one wherever the board works — a flow run from a
// terminal reads it too.
//
// It is read as an agent is about to start, never remembered from earlier, so the last
// flip is the one that counts.

/** Is this agent switched on? A name with nothing saved for it is on, so a board set up
 *  before the switches existed has every agent on. */
export const specAgentEnabled = (name: string, switches = specAgentSwitches()): boolean =>
  specAgentNames(name).every((candidate) => switches[candidate] !== false)

/** The agents a flow may ask for — the ones that are on, in the board's own order. */
export function enabledSpecAgents(): SpecAgent[] {
  const switches = specAgentSwitches()
  return SPEC_AGENTS.filter((a) => specAgentEnabled(a.name, switches))
}

/** Every spec agent as a screen reads it: both its lines, and whether it is on. */
export function readSpecAgents(): SpecAgentView[] {
  const switches = specAgentSwitches()
  return SPEC_AGENTS.map((a) => ({
    name: a.name,
    owns: a.owns,
    calledOn: a.calledOn,
    enabled: specAgentEnabled(a.name, switches),
  }))
}

/** Switch one agent on or off. The name is checked against the agents this board ships,
 *  so nothing writes a switch for an agent that doesn't exist. */
export function setSpecAgentEnabled(name: string, on: boolean): { ok: boolean; error?: string } {
  const agent = findSpecAgent(name)
  if (!agent) {
    return { ok: false, error: `"${name}" is not a spec agent on this board. It ships: ${SPEC_AGENT_NAMES.join(', ')}.` }
  }
  return setSpecAgentSwitch(agent.name, on, specAgentNames(agent.name).slice(1))
}

/** Where a switched-off agent goes back on. One place, named the same way everywhere. */
export const SPEC_SWITCH_HOME = 'the board UI, under Configuration → Agents'

/** The list of spec agents, one entry each — what `akb spec` with no agent named prints.
 *
 *  A switched-off agent is left out of the list a flow picks from. Typed by a person it is
 *  still named, in one closing line: an agent that vanished with no explanation is a
 *  feature the user thinks broke. */
export function specAgentList(program: string, forPerson = false): string {
  const switches = specAgentSwitches()
  const on = SPEC_AGENTS.filter((a) => specAgentEnabled(a.name, switches))
  const off = SPEC_AGENTS.filter((a) => !specAgentEnabled(a.name, switches))
  return [
    `${program} spec <agent> <id> [note] — put a spec agent on a card.`,
    '',
    'A spec agent fills one part of a card\'s spec. It runs on its own, in its own context:',
    'it is given the card and your note, it writes one section of that card, and it changes',
    'nothing else. Ask for one when the card would otherwise be planned by guess.',
    '',
    'Agents',
    ...(on.length
      ? on.flatMap((a) => ['', `  ${a.name}`, `    ${a.owns}`, `    ${a.calledOn}`])
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
