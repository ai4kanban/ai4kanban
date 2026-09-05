// The spec agents — what the board can put on a card, and what each one is set to.
//
// A spec agent owns one part of a card's spec — the screen a card draws, the library it
// picks — and it fills that part in a run of its own: it starts clean, gets the card and a
// short note, writes one section of that card, and touches nothing else. What one is asked
// to do beyond its own instructions is `akb guide spec-agent`.
//
// Nothing about an agent is written in TypeScript. Its name, the line it is picked by, the
// part of the spec it owns and the settings it declares all come out of its own `AGENT.md`
// (./parse.ts), whether the command ships it or the project added it (./catalog.ts). This
// file is the board's side: which agents may run, what each one is set to, and the text one
// run is finally handed.

import { runtimeFor } from '../agent/runtime'
import { runtimeHarness } from '../agent/resolve'
import { specAgentEntries, setSpecAgentSwitch, setSpecAgentValue } from '../agent/settings'
import type { SpecAgentEntry } from '../agent/settings'
import type { SpecAgentView } from '../agent/types'
import { agentMemoryFile, readAgentMemory } from '../memory'
import { rel } from '../paths'
import { canonicalSpecAgent, specAgentNames } from '../spec-agent-names'
import { specAgentCatalog } from './catalog'
import type { SpecAgent } from './parse'

export { specAgentCatalog } from './catalog'
export { specAgentNames } from '../spec-agent-names'
export type { SpecAgent } from './parse'

/** Every agent on this board, in the board's order. */
export const specAgents = (): SpecAgent[] => specAgentCatalog().agents

/** Everything wrong with the agents on this board — a malformed `AGENT.md`, a name already
 *  taken, a folder still in the place agents used to live. Shown wherever the agents are
 *  listed, and put in a run's log before it starts. */
export const specAgentProblems = (): string[] => specAgentCatalog().problems

/** The names this board answers to, for a message that has to say what there is. */
export const specAgentNamesOnBoard = (): string[] => specAgents().map((a) => a.name)

export const findSpecAgent = (name: string): SpecAgent | null => {
  const wanted = canonicalSpecAgent(name)
  return specAgents().find((a) => a.name === wanted) ?? null
}

/** The heading a spec agent's section carries on a card. Its name is in it, so a reader can
 *  see who is answerable for that part of the spec and a rerun knows what to replace. */
export const specHeading = (name: string): string => '## By `' + specAgentNames(name)[0] + '` agent'

// ---- switched on, switched off, and set (#191, #255) ------------------------
//
// Every spec agent is on until someone switches it off in the board UI, under
// Configuration → Agents. An agent that declares settings is set there too. Both are saved
// with the board, so they are the same for everyone working on it and the same wherever the
// board works — a flow run from a terminal reads them too.
//
// They are read as a run is about to start, never remembered from earlier, so the last
// change is the one that counts. What the file holds is still keyed `specAgents`, which is
// what it was keyed before the word changed and after it changed back (#403, #419).

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
 *  dropped between releases would otherwise reach a run as a word its agent has no reference
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

/** Everything one spec run is handed of its agent: the `AGENT.md` instructions, and the one
 *  reference each picked choice names — never the others. The board resolves and loads them
 *  here, as the run starts, so the agent has nothing to go and find: a reference it had to
 *  fetch is a reference it can skip, and the ones it must not read would be a folder away.
 *
 *  A reference that has gone missing is reported rather than passed over. The setting said
 *  which way to work, and a run that quietly worked the other way is the failure this
 *  reports its way out of. */
export function specAgentInstructions(
  agent: SpecAgent,
  entries = specAgentEntries(),
): { instructions: string; references: { title: string; text: string }[]; notes: string[] } {
  const { values, notes } = specAgentSettings(agent, entries)
  const references: { title: string; text: string }[] = []
  for (const setting of agent.settings) {
    const choice = setting.choices.find((c) => c.value === values[setting.key])
    if (!choice) continue
    const text = agent.file(choice.reference)
    if (text === null) {
      notes.push(
        `the \`${agent.name}\` agent's ${setting.label} is "${choice.label}", whose ${choice.reference} ` +
          'is missing — the run goes ahead without it.',
      )
      continue
    }
    references.push({ title: `${setting.label}: ${choice.label}`, text: text.trim() })
  }
  return { instructions: agent.body.trim(), references, notes }
}

/** What an agent that remembers is handed of its own file (#421) — read as the run starts,
 *  like everything else it is given, so it has nothing to go and find.
 *
 *  An agent that has written nothing down yet is still handed the block. A memory it is
 *  never shown is a memory it never starts: the empty file is the invitation.
 *
 *  Empty for an agent that declares no memory, which is every agent that did not ask for
 *  one — those start each run fresh, as they always have. */
export function agentMemoryBlock(agent: SpecAgent): string {
  if (!agent.memory) return ''
  return [
    'What you learned on this board, in your own words from earlier runs — the taste you were corrected on and the product facts you needed. Follow it here:',
    readAgentMemory(agent.name) || '_(empty — nothing has been written down yet.)_',
  ].join('\n\n')
}

/** The agents on the `spec` hook — the ones `akb spec` runs. An agent on another hook is
 *  still on this board and still drawn in its pane; it is just not something a card's spec
 *  is filled by. */
export const specHookAgents = (): SpecAgent[] => specAgents().filter((a) => a.kind === 'spec')

/** The agents a flow may ask for — the ones on the `spec` hook that are on, in the board's
 *  own order. */
export const enabledSpecAgents = (): SpecAgent[] => {
  const entries = specAgentEntries()
  return specHookAgents().filter((a) => specAgentEnabled(a.name, entries))
}

/** The catalog a planning run is shown, so it can decide for itself which — if any — a card
 *  needs (#403). One entry each: the name it is asked for by, the line it is picked by, and
 *  the part of the spec it owns. Nothing of an agent's instructions is in here; a selector
 *  handed an agent's body would start following it.
 *
 *  It is a catalog, not an instruction: a flow reads `owns` against the card in front of it,
 *  and asking for none is the common answer. Switched-off agents are left out, so a board
 *  that turned one off is never offered it.
 *
 *  Empty when every agent is off — a heading over an empty list reads as a list that failed
 *  to load. */
export function specAgentSelector(id: number | string): string {
  const on = enabledSpecAgents()
  if (!on.length) return ''
  return [
    // Tagged, because this block is a list of other agents' work sitting under an
    // instruction about the card. Without a boundary a run reads "ui-design" as part of its
    // own job.
    '<spec-agents>',
    "Specialist agents this board has, each filling one part of a card's spec in a run of its own:",
    ...on.flatMap((a) => [
      `- \`${a.name}\``,
      `  owns ${a.owns}`,
      `  ${a.description}`,
      // Which of them remember, and where (#421). These flows are the ones that hear the
      // user's answer about an agent's section, and the line they append goes in this file.
      ...(a.memory ? [`  remembers ${rel(agentMemoryFile(a.name))}`] : []),
    ]),
    `Review this list once. Ask for an agent only where the card would otherwise be planned by guess in the part that agent owns, and only when that section is missing: \`akb spec <agent> ${id} <short note>\`.`,
    'Asking for none is the usual answer. Do not ask for an agent to review, repeat or check work, and do not wait for one — the board starts it when this run ends.',
    '</spec-agents>',
  ].join('\n')
}

/** Every spec agent as a screen reads it: both its lines, whether it is on, the settings it
 *  declares and what each one is set to. The reference a choice loads is left out — it is
 *  the run's business, not a dialog's. */
export function readSpecAgents(): SpecAgentView[] {
  const entries = specAgentEntries()
  return specAgents().map((agent) => ({
    name: agent.name,
    owns: agent.owns,
    description: agent.description,
    enabled: specAgentEnabled(agent.name, entries),
    // Which runtime this agent runs on, and what that is here (#343) — so the list a screen
    // draws is the same answer a run would get, and no UI works one out.
    ...specAgentRun(agent.name, entries),
    settings: agent.settings.map((setting) => ({
      key: setting.key,
      label: setting.label,
      ...(setting.help ? { help: setting.help } : {}),
      choices: setting.choices.map((c) => ({ value: c.value, label: c.label, cost: c.cost })),
      default: setting.default,
    })),
    values: specAgentSettings(agent, entries).values,
  }))
}

/** What one spec agent runs on: the runtime it names — the board's global one when it names
 *  none — and what that runtime runs as. */
export function specAgentRun(
  name: string,
  entries = specAgentEntries(),
): { runtime: string; harness: string } {
  const runtime = runtimeFor({ action: 'spec', specAgent: name }, undefined, entries)
  return { runtime, harness: runtimeHarness(runtime).name }
}

/** Switch one agent on or off. The name is checked against the agents this board has, so
 *  nothing writes a switch for an agent that doesn't exist. What that agent is set to
 *  survives the flip either way: losing a pick by switching an agent off and on would be a
 *  surprise. */
export function setSpecAgentEnabled(name: string, on: boolean): { ok: boolean; error?: string } {
  const agent = findSpecAgent(name)
  if (!agent) return { ok: false, error: notAnAgent(name) }
  return setSpecAgentSwitch(agent.name, on, specAgentNames(agent.name).slice(1))
}

/** Save one of the settings an agent declares. The agent, the key and the value are all
 *  checked against what this board has, so nothing writes a setting no agent has or a choice
 *  no setting offers. A value that IS the setting's default is dropped rather than written
 *  down — the file records what somebody changed. */
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

export const notAnAgent = (name: string): string => {
  const there = specHookAgents().map((a) => a.name)
  return there.length
    ? `"${name}" is not a spec agent on this board. It has: ${there.join(', ')}.`
    : `"${name}" is not a spec agent on this board, and this board has none.`
}

/** Where a switched-off agent goes back on. One place, named the same way everywhere. */
export const SPEC_SWITCH_HOME = 'the board UI, under Configuration → Agents'

/** Where a project puts an agent of its own. */
export const SPEC_AGENT_HOME = 'docs/kanban/agents/<name>/AGENT.md'

/** The list of spec agents, one entry each — what `akb spec` with no agent named prints.
 *
 *  A switched-off agent is left out of the list a flow picks from. Typed by a person it is
 *  still named, in one closing line: an agent that vanished with no explanation is a feature
 *  the user thinks broke. */
export function specAgentList(program: string, forPerson = false): string {
  const entries = specAgentEntries()
  const { problems } = specAgentCatalog()
  const agents = specHookAgents()
  const on = agents.filter((a) => specAgentEnabled(a.name, entries))
  const off = agents.filter((a) => !specAgentEnabled(a.name, entries))
  return [
    `${program} spec <agent> <id> [note] — put a spec agent on a card.`,
    '',
    "A spec agent fills one part of a card's spec. It runs on its own, in its own context:",
    'it is given the card and your note, it writes one section of that card, and it changes',
    'nothing else. Ask for one when the card would otherwise be planned by guess.',
    '',
    'Agents',
    ...(on.length
      ? on.flatMap((a) => [
          '',
          `  ${a.name}`,
          `    owns ${a.owns}`,
          `    ${a.description}`,
          ...runtimeLine(a, entries, forPerson),
          ...settingLines(a, entries),
        ])
      : ['', 'Every spec agent on this board is switched off. Ask for none.']),
    '',
    `The flow one follows is \`${program} guide spec-agent\`.`,
    ...(forPerson
      ? [`This project adds its own in \`${SPEC_AGENT_HOME}\`.`]
      : []),
    ...(forPerson && off.length
      ? [
          '',
          `Switched off, so don't ask for ${off.length === 1 ? 'it' : 'them'}: ${off.map((a) => a.name).join(', ')}. ` +
            `Switch ${off.length === 1 ? 'it' : 'them'} back on in ${SPEC_SWITCH_HOME}.`,
        ]
      : []),
    ...(problems.length ? ['', 'Problems on this board:', ...problems.map((p) => `  ${p}`)] : []),
  ].join('\n')
}

// What one agent is set to, under the two lines it is listed by. One line per setting: what
// it is called, the choice in effect, and what that choice costs. An agent that declares none
// adds nothing, so the list reads exactly as it did before settings existed.
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

// Which runtime this agent runs on, and what that is here (#343) — the same answer the board
// UI's Agents section draws, so a terminal never says something else.
//
// Only for a person. A run reading this list is picking which agents a card needs, and what
// tool each one spawns as is nothing it can act on.
function runtimeLine(agent: SpecAgent, entries: Record<string, SpecAgentEntry>, forPerson: boolean): string[] {
  if (!forPerson) return []
  const { runtime, harness } = specAgentRun(agent.name, entries)
  return [`    Runtime: ${runtime} — ${harness} here`]
}
