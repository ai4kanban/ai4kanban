// The spec agents — what the board can put on a card, and what each one is set to.
//
// A spec agent fills one section, in-session or in a separate run.

// Nothing about an agent is written in TypeScript. Its name, the line it is picked by, the
// part of the spec it owns and the settings it declares all come out of its own `AGENT.md`
// (./parse.ts), whether the command ships it or the project added it (./catalog.ts). This
// file is the board's side: which agents may run, what each one is set to, and the text one
// run is finally handed.

import { agentRun } from '../agent/resolve'
import { setSpecAgentOutput, specAgentEntries, setSpecAgentSwitch, setSpecAgentValue, setSwitch } from '../agent/settings'
import { roleNamed } from '../agent/roles'
import type { SpecAgentEntry } from '../agent/settings'
import { isSpecOutput, type SpecAgentSettingView, type SpecAgentView, type SpecOutput } from '../agent/types'
import { readLanguage } from '../machine/settings'
import type { Language } from '../machine/types'
import { readAgentMemory } from '../memory'
import { canonicalSpecAgent, specAgentNames } from '../spec-agent-names'
import { specAgentCatalog } from './catalog'
import { agentSettings, outputLines, OUTPUT_KEY } from './output'
import type { AgentKind, SpecAgent } from './parse'

export { specAgentCatalog } from './catalog'
export { agentSettings, OUTPUT_KEY } from './output'
export { specAgentNames } from '../spec-agent-names'
export type { AgentKind, SpecAgent } from './parse'

/** Every agent on this board, in the board's order. */
export const specAgents = (): SpecAgent[] => specAgentCatalog().agents

/** An agent's two user-facing lines in the language this machine reads (#334), falling back
 *  to the English its file declares. Only ever DRAWN — every run is handed the English pair,
 *  so a board reads in one language and its agents are asked in another. */
export function agentLines(agent: SpecAgent, language: Language = readLanguage()): { description: string; owns: string } {
  const said = agent.i18n[language]
  return { description: said?.description || agent.description, owns: said?.owns || agent.owns }
}

/** The settings an agent declares, as a screen reads them: the words in the language this
 *  machine reads (#334), and never the reference a choice loads — that is the run's business.
 *
 *  Drawn only, like the two lines above. A run is handed the English, so the reference it
 *  loads is picked by the choice's `value`, which no translation touches. */
export function agentSettingsView(
  agent: SpecAgent,
  language: Language = readLanguage(),
): SpecAgentSettingView[] {
  const said = agent.i18n[language]?.settings ?? {}
  return agentSettings(agent).map((setting) => {
    // The board's own row is not the agent's to translate, so its words come from beside it.
    const spoken = setting.key === OUTPUT_KEY ? outputLines(language) : said[setting.key]
    const help = spoken?.help || setting.help
    return {
      key: setting.key,
      label: spoken?.label || setting.label,
      ...(help ? { help } : {}),
      choices: setting.choices.map((c) => {
        const words = spoken?.choices?.[c.value]
        return { value: c.value, label: words?.label || c.label, cost: words?.cost || c.cost }
      }),
      default: setting.default,
    }
  })
}

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
  const entry = savedEntry(agent.name, entries)
  const saved = entry?.values ?? {}
  const values: Record<string, string> = {}
  const notes: string[] = []
  for (const setting of agentSettings(agent)) {
    const picked = setting.key === OUTPUT_KEY ? entry?.output : saved[setting.key]
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

/** Who this agent's output is for (#445): the word somebody saved, or the one its own file
 *  starts it at. Read as a run starts, like everything else it is set to, so the last change
 *  is the one that counts — and it decides nothing about the cards already written. */
export const specAgentOutput = (agent: SpecAgent, entries = specAgentEntries()): SpecOutput => {
  const saved = savedEntry(agent.name, entries)?.output
  return isSpecOutput(saved) ? saved : agent.output
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
    if (!choice?.reference) continue
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

/** What an agent that remembers is handed of its own files (#421, #473) — read as the run
 *  starts, like everything else it is given, so it has nothing to go and find. Both files,
 *  each under its own heading, so the agent writes back to the one a line belongs in.
 *
 *  An agent that has written nothing down yet is still handed the block. A memory it is
 *  never shown is a memory it never starts: the empty file is the invitation.
 *
 *  Empty for an agent that declares no memory, which is every agent that did not ask for
 *  one — those start each run fresh, as they always have. */
export function agentMemoryBlock(agent: SpecAgent): string {
  if (!agent.memory) return ''
  return [
    'What you learned on this board, in your own words from earlier runs — the mistakes you were corrected on, and the choices the user made. Follow it here:',
    ...readAgentMemory(agent.name).map(
      (file) => `${file.heading}\n\n${file.text || '_(empty — nothing has been written down yet.)_'}`,
    ),
  ].join('\n\n')
}

/** The agents on the `spec` hook — the ones `akb spec` runs. An agent on another hook is
 *  still on this board and still drawn in its pane; it is just not something a card's spec
 *  is filled by. */
export const specHookAgents = (): SpecAgent[] => hookAgents('spec')

/** The agents on the `write` hook — the ones `akb write` runs (#424). Empty on a product
 *  board by itself: `kind: write` does not parse there (../agents/parse.ts), so nothing here
 *  needs to ask which solution this is. */
export const writeHookAgents = (): SpecAgent[] => hookAgents('write')

const hookAgents = (kind: AgentKind): SpecAgent[] => specAgents().filter((a) => a.kind === kind)

/** The agents a flow may ask for — the ones on that hook that are on, in the board's own
 *  order. */
export const enabledSpecAgents = (): SpecAgent[] => enabledHookAgents('spec')

/** The same, for the `write` hook. */
export const enabledWriteAgents = (): SpecAgent[] => enabledHookAgents('write')

function enabledHookAgents(kind: AgentKind): SpecAgent[] {
  const entries = specAgentEntries()
  return hookAgents(kind).filter((a) => specAgentEnabled(a.name, entries))
}

/** One agent on the `write` hook, by name. An agent on another hook is on this board but is
 *  not something the writer can call in, so it is turned away by the same door as a name
 *  nobody has. */
export const findWriteAgent = (name: string): SpecAgent | null => {
  const agent = findSpecAgent(name)
  return agent?.kind === 'write' ? agent : null
}

/** Enabled agents and their triggers, without their execution instructions. */
export const specAgentSelector = (id: number | string): string =>
  selector(enabledSpecAgents(), {
    tag: 'spec-agents',
    lead: "Specialist agents this board has, each filling one part of a card's spec:",
    ask: `Command: \`akb spec <agent> ${id} <short note> [--print]\`.`,
  })

/** The same catalog, for the agents the writer can call in (#424) — the specialists a draft
 *  needs a file from, such as an image for a post. Worded as the `spec` one is, and empty
 *  the same way: on a product board there are no `write` agents to list.
 *
 *  One ask per agent per card, so the note names every file the writer wants. */
export const writeAgentSelector = (id: number | string): string =>
  selector(enabledWriteAgents(), {
    tag: 'write-agents',
    lead: "Specialist agents this board has, each writing part of a topic's draft folder in a run of its own:",
    ask: `Use each agent’s description as its trigger. Check it against the current draft. Request each matching agent whose required output is missing or outdated, naming every file you want in the one note: \`akb write <agent> ${id} <short note>\`.`,
  })

function selector(on: SpecAgent[], words: { tag: string; lead: string; ask: string }): string {
  if (!on.length) return ''
  return [
    // Tagged, because this block is a list of other agents' work sitting under an
    // instruction about the card. Without a boundary a run reads "ui-designer" as part of its
    // own job.
    `<${words.tag}>`,
    words.lead,
    ...on.flatMap((a) => [
      `- \`${a.name}\``,
      `  owns ${a.owns}`,
      `  ${a.description}`,
      // Which of them remember (#421). These flows are the ones that hear the user's answer
      // about an agent's section, and the line they append goes in that agent's memory
      // file. The mark alone: only some agents declare a memory, and that is not derivable,
      // while WHERE the file is always is — `akb guide update-questions` states it once
      // rather than this block repeating a path per agent in every run.
      ...(a.memory ? ['  remembers'] : []),
    ]),
    words.ask,
    `</${words.tag}>`,
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
    // Which connector this agent runs here (#443) — so the list a screen draws is the same
    // answer a run would get, and no UI works one out.
    harness: agentRun(agent.name).harness,
    settings: agentSettingsView(agent),
    values: specAgentSettings(agent, entries).values,
  }))
}

/** Switch one agent on or off. The name is checked against the agents this board has, so
 *  nothing writes a switch for an agent that doesn't exist. What that agent is set to
 *  survives the flip either way: losing a pick by switching an agent off and on would be a
 *  surprise. */
export function setSpecAgentEnabled(name: string, on: boolean): { ok: boolean; error?: string } {
  // A switchable ROLE keeps its answer in the board's own settings rather than in
  // `specAgents` (#447) — it is not a file this project added, so there is no entry to write.
  // Each has a key of its own (#493, #509), so the gater, the decider and the reviewer are
  // switched separately.
  const role = roleNamed(name)
  if (role) {
    if (!role.switch) return { ok: false, error: `\`${name}\` is one of the roles the board runs on, so it can't be switched off.` }
    return setSwitch(role.switch, on)
  }
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
  const takeable = agentSettings(agent)
  const setting = takeable.find((s) => s.key === key)
  if (!setting) {
    const takes = takeable.length ? `It takes: ${takeable.map((s) => s.key).join(', ')}.` : 'It takes none.'
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
  const legacy = specAgentNames(agent.name).slice(1)
  // The board's own row is the entry's own key, beside `enabled`, so it is
  // never written among the values the agent declares.
  if (setting.key === OUTPUT_KEY) return setSpecAgentOutput(agent.name, save, legacy)
  return setSpecAgentValue(agent.name, setting.key, save, legacy)
}

export const notAnAgent = (name: string): string => notOnHook(name, 'spec')

/** The same for the `write` hook (#424). */
export const notAWriteAgent = (name: string): string => notOnHook(name, 'write')

const notOnHook = (name: string, kind: AgentKind): string => {
  const there = hookAgents(kind).map((a) => a.name)
  return there.length
    ? `"${name}" is not a ${kind} agent on this board. It has: ${there.join(', ')}.`
    : `"${name}" is not a ${kind} agent on this board, and this board has none.`
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
export const specAgentList = (program: string, forPerson = false): string =>
  agentList('spec', program, forPerson, {
    lead: `${program} spec <agent> <id> [note] — put a spec agent on a card.`,
    blurb: [
      "A spec agent fills one part of a card's spec from the card, your note and its instructions.",
    ],
    guide: 'spec-agent',
  })

/** The same for the `write` hook — what `akb write` with no agent named prints (#424). */
export const writeAgentList = (program: string, forPerson = false): string =>
  agentList('write', program, forPerson, {
    lead: `${program} write <agent> <id> [note] — call a write agent in on a topic.`,
    blurb: [
      "A write agent writes part of a topic's draft folder. It runs on its own, in its own",
      'context: it is given the card and your note, it writes the files that note names, and',
      'it changes nothing else. Request each agent when its description matches the draft.',
    ],
    guide: 'repurpose',
  })

function agentList(
  kind: AgentKind,
  program: string,
  forPerson: boolean,
  words: { lead: string; blurb: string[]; guide: string },
): string {
  const entries = specAgentEntries()
  const { problems } = specAgentCatalog()
  const agents = hookAgents(kind)
  const on = agents.filter((a) => specAgentEnabled(a.name, entries))
  const off = agents.filter((a) => !specAgentEnabled(a.name, entries))
  return [
    words.lead,
    '',
    ...words.blurb,
    '',
    'Agents',
    ...(on.length
      ? on.flatMap((a) => [
          '',
          `  ${a.name}`,
          `    owns ${a.owns}`,
          `    ${a.description}`,
          ...harnessLine(a, forPerson),
          ...settingLines(a, entries),
        ])
      : ['', agents.length
          ? `Every ${kind} agent on this board is switched off. Ask for none.`
          : `This board has no ${kind} agent. Ask for none.`]),
    '',
    `The flow one follows is \`${program} guide ${words.guide}\`.`,
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
  const settings = agentSettings(agent)
  if (!settings.length) return []
  const { values } = specAgentSettings(agent, entries)
  return settings.map((setting) => {
    const choice = setting.choices.find((c) => c.value === values[setting.key])
    return `    ${setting.label}: ${choice ? `${choice.label} — ${choice.cost}` : values[setting.key]}`
  })
}

// Which connector this agent runs here (#443) — the same answer the board UI's Agents section
// draws, so a terminal never says something else.
//
// Only for a person. A run reading this list is picking which agents a card needs, and what
// tool each one spawns as is nothing it can act on.
function harnessLine(agent: SpecAgent, forPerson: boolean): string[] {
  if (!forPerson) return []
  return [`    Runs on: ${agentRun(agent.name).harness}`]
}
