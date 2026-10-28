// The spec agents — what the board can put on a card, and what each one is set to.
//
// A spec agent fills one section, in-session or in a separate run.

// Nothing about an agent is written in TypeScript. Its name, the line it is picked by and the
// part of the spec it owns all come out of its own `AGENT.md` (./parse.ts), whether the
// command ships it or the project added it (./catalog.ts). This file is the board's side:
// which agents may run, what each one is set to, and the text one run is finally handed.

import path from 'node:path'

import { rawMove } from '../agent/command'
import { agentRun } from '../agent/resolve'
import { specAgentEntries } from '../agent/settings'
import { stageContractProblems, type AgentRole } from '../agent/roles'
import type { SpecAgentEntry } from '../agent/settings'
import type { SpecAgentSetting } from '../agent/types'
import { readLanguage } from '../machine/settings'
import type { Language } from '../machine/types'
import { agentMemoryDir, readAgentMemory } from '../memory'
import { rel } from '../paths'
import { canonicalSpecAgent, specAgentNames } from '../spec-agent-names'
import { specAgentCatalog } from './catalog'
import { agentAfter, agentKeyProblems, cardStage, cardStages, previewAgents, workflowFor, workflowFileProblems } from '../agent/workflows'
import type { SpecAgent } from './parse'
import type { Meta } from '../types'

export { specAgentCatalog } from './catalog'
export { specAgentNames } from '../spec-agent-names'
export type { SpecAgent } from './parse'

/** Every agent on this board, in the board's order. */
export const specAgents = (): SpecAgent[] => specAgentCatalog().agents

/** An agent's user-facing words in the language this machine reads (#334), falling back to
 *  the English its file declares. Only ever DRAWN — every run is handed the English, so a
 *  board reads in one language and its agents are asked in another.
 *
 *  `title` falls back to the English one, then to empty: a screen with no title spells the
 *  agent's own name out. */
export function agentLines(
  agent: SpecAgent,
  language: Language = readLanguage(),
): { title: string; description: string } {
  const said = agent.i18n[language]
  return {
    title: said?.title || agent.i18n.en?.title || '',
    description: said?.description || agent.description,
  }
}

/** Everything wrong with the agents on this board — a malformed `AGENT.md` or `WORKFLOW.md`, a
 *  name already taken, a folder still in the place agents used to live, a key its place in a
 *  workflow does not read (#2152), or a stage contract that names somebody this board does not
 *  have (#714). Shown wherever the agents are listed, and put in a run's log before it starts. */
export const specAgentProblems = (): string[] => [
  ...specAgentCatalog().problems,
  ...workflowFileProblems(),
  ...agentKeyProblems(),
  ...stageContractProblems(),
]

/** The names this board answers to, for a message that has to say what there is. */
export const specAgentNamesOnBoard = (): string[] => specAgents().map((a) => a.name)

export const findSpecAgent = (name: string): SpecAgent | null => {
  const wanted = canonicalSpecAgent(name)
  return specAgents().find((a) => a.name === wanted) ?? null
}

/** The heading a spec agent's section carries on a card. Its name is in it, so a reader can
 *  see who is answerable for that part of the spec and a rerun knows what to replace. */
export const specHeading = (name: string): string => '## By `' + specAgentNames(name)[0] + '` agent'

/** Matches the heading of one agent's section. `skill` is the word a section carried between
 *  #403 and #419, so a card written then is still found. */
export const specHeadingRe = (name: string): RegExp =>
  new RegExp('^##\\s+By\\s+`' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '`\\s+(skill|agent)\\s*$', 'i')

// ---- set (#191, #255) ----------------------------------------------------------
//
// An agent is set in the board UI, and what it is set to is saved with the board, so it is
// the same for everyone working on it. Whether it runs is its workflow's answer (#749).
// They are read as a run is about to start, never remembered from earlier, so the last
// change is the one that counts. What the file holds is keyed `specAgents` (#403, #419).

// What the file holds for one agent, under its current name or a name it used to have.
const savedEntry = (name: string, entries: Record<string, SpecAgentEntry>): SpecAgentEntry | null => {
  for (const candidate of specAgentNames(name)) {
    const entry = entries[candidate]
    if (entry) return entry
  }
  return null
}

/** What one of the board's roles is set to (#1469): every setting on its page, carrying the
 *  saved value or its own default. `notes` holds a line for each value that had to fall back —
 *  a choice renamed or dropped between releases is worse to meet silently than to be told. */
export const roleSettings = (
  role: AgentRole,
  entries = specAgentEntries(),
): { values: Record<string, string>; notes: string[] } => settingValues(role.name, role.settings ?? [], entries)

function settingValues(
  name: string,
  settings: SpecAgentSetting[],
  entries: Record<string, SpecAgentEntry>,
): { values: Record<string, string>; notes: string[] } {
  const entry = savedEntry(name, entries)
  const values: Record<string, string> = {}
  const notes: string[] = []
  for (const setting of settings) {
    const raw = entry?.extra[setting.key]
    const picked = typeof raw === 'string' ? raw : undefined
    if (picked !== undefined && setting.choices.some((c) => c.value === picked)) {
      values[setting.key] = picked
      continue
    }
    if (picked !== undefined) {
      notes.push(
        `the \`${name}\` agent's ${setting.label} is saved as "${picked}", which it no longer offers — ` +
          `running it at its default, "${setting.default}".`,
      )
    }
    values[setting.key] = setting.default
  }
  return { values, notes }
}

/** What a role's run is told by the settings it is set to (#1469): the `prompt` of each
 *  picked choice that has one. Empty when none does. */
export function roleSettingsBlock(role: AgentRole, entries = specAgentEntries()): string {
  const { values } = roleSettings(role, entries)
  const lines = (role.settings ?? [])
    .map((setting) => setting.choices.find((c) => c.value === values[setting.key])?.prompt)
    .filter((line): line is string => Boolean(line))
  return lines.length ? ['Your settings on this board:', ...lines.map((line) => `- ${line}`)].join('\n') : ''
}

// What a board still holds for a setting an agent used to declare (#1003), and the one line
// its run log gets for it. Only for a setting whose removal CHANGED what the agent produces:
// somebody who never opens the agent's page would otherwise get a different answer than last
// time with nothing said.
const RETIRED_SETTINGS: { agent: string; key: string; note: string }[] = [
  {
    agent: 'ui-designer',
    key: 'mockupStyle',
    note:
      "the `ui-designer` agent's Mockup style is saved on this board, and it is no longer a setting — " +
      'ASCII drawings are retired, so this run draws a rendered screen.',
  },
]

const retiredNotes = (agent: SpecAgent, entries: Record<string, SpecAgentEntry>): string[] => {
  const entry = savedEntry(agent.name, entries)
  if (!entry) return []
  return RETIRED_SETTINGS.filter((r) => r.agent === agent.name && r.key in entry.extra).map((r) => r.note)
}

/** Everything one spec run is handed of its agent: its `AGENT.md` instructions and the paths
 *  of the files beside them. `notes` is what the board owes that run's log before the agent
 *  says a word. */
export function specAgentInstructions(
  agent: SpecAgent,
  entries = specAgentEntries(),
): { instructions: string; files: string; notes: string[] } {
  return {
    instructions: agent.body.trim(),
    files: agentFilesBlock(agent),
    notes: retiredNotes(agent, entries),
  }
}

/** The files beside an agent's `AGENT.md` (#860), as paths and nothing more — the run opens
 *  one when the work calls for it. Nothing is pasted in: that is what keeps `AGENT.md` short
 *  and keeps material nobody needs out of the prompt.
 *
 *  A project agent's files are on disk, so they are named by their path in the project. A
 *  built-in's ship inside the command, where there is no path to open, so the board prints
 *  them instead. Empty when the agent has none. */
export function agentFilesBlock(agent: SpecAgent): string {
  if (!agent.files.length) return ''
  const dir = agent.dir
  return [
    'Read one only when the work calls for it:',
    '',
    ...agent.files.map((f) =>
      dir ? `- \`${rel(path.join(dir, f))}\`` : `- \`${f}\` — \`${rawMove(`agent-file ${agent.name} ${f}`)}\``,
    ),
  ].join('\n')
}

/** An agent's memory folder, and every file in it (#421, #833) — read as the run starts. Its
 *  own instructions say what those files are for; an empty folder is only named. */
export function agentMemoryBlock(agent: SpecAgent): string {
  const dir = rel(agentMemoryDir(agent.name))
  const files = readAgentMemory(agent.name)
  if (!files.length) return `Your memory folder is \`${dir}/\`. Nothing is in it yet.`
  return [
    `Your memory, from \`${dir}/\` — what you kept on this board in earlier runs. Follow it here:`,
    ...files.map((file) => `### \`${file.name}\`\n\n${file.text || '_(empty)_'}`),
  ].join('\n\n')
}

const agentsOf = (names: string[]): SpecAgent[] => {
  const all = specAgents()
  return names.map((name) => all.find((a) => a.name === name)).filter((a): a is SpecAgent => !!a)
}

/** Whether one workflow runs this agent as a preview — the one gate `akb spec`
 *  and every ask written mid-run are checked against (#749). */
export const specAgentAssigned = (name: string, workflow?: string): boolean => {
  const flow = workflowFor(workflow)
  const wanted = canonicalSpecAgent(name)
  return !!flow && previewAgents(flow).some((h) => h.agent === wanted)
}

/** The previews a card may run, and their triggers, without their instructions (#2154): every
 *  one of its workflow until it has chosen, then those of its current stage. */
export function specAgentSelector(id: number | string, workflow: string | undefined, meta: Pick<Meta, 'previews' | 'phase'> | null): string {
  const flow = workflowFor(workflow)
  const chosen = !!meta?.previews
  const names = !flow ? [] : chosen ? cardStages(meta, flow)[cardStage(meta, flow) - 1]! : previewAgents(flow).map((h) => h.agent)
  const agents = agentsOf(names)
  if (!agents.length) return ''
  return [
    // Tagged, because this block is a list of other agents' work sitting under an
    // instruction about the card. Without a boundary a run reads "ui-designer" as part of its
    // own job.
    '<spec-agents>',
    chosen
      ? "The preview agents of this card's current stage, each writing one part of the card."
      : "The preview agents of this card's workflow, each writing one part of the card; choose and run them as `akb guide refine` says.",
    ...agents.flatMap((a) => {
      const after = agentAfter(a.name)
      return [
        `- \`${a.name}\` — ${a.description}`,
        `  When: ${a.when ?? 'always'}${!chosen && after.length ? ` · After: ${after.join(', ')}` : ''}${a.session ? ' · runs in a session of its own: leave out `--print`' : ''}`,
      ]
    }),
    `Command: \`akb spec <agent> ${id} <short note>\` — add \`--print\` to run it in this session, as \`akb guide refine\` says.`,
    '</spec-agents>',
  ].join('\n')
}

export const notAnAgent = (name: string): string => {
  const there = specAgents().map((a) => a.name)
  return there.length
    ? `"${name}" is not an agent on this board. It has: ${there.join(', ')}.`
    : `"${name}" is not an agent on this board, and this board has none.`
}

/** Where a workflow agent is switched on or off — the one answer to whether it runs (#749). */
export const SPEC_ASSIGN_HOME =
  'it is switched on in its workflow, in the board UI under Configuration → Workflows'

/** Where a project puts an agent of its own. */
export const SPEC_AGENT_HOME = 'docs/kanban/agents/<name>/AGENT.md'

/** The list of agents, one entry each — what `akb spec` with no agent named prints. Every one
 *  on the board: this is typed with no card in hand, and which of them a card may ask for is
 *  its own workflow's answer (`specAgentSelector`). */
export function specAgentList(program: string, forPerson = false): string {
  const problems = specAgentProblems()
  const agents = specAgents()
  return [
    `${program} spec <agent> <id> [note] — put a preview agent on a card.`,
    '',
    "A preview agent writes one part of a card from the card, your note and its instructions.",
    '',
    'Agents',
    ...(agents.length
      ? agents.flatMap((a) => ['', `  ${a.name}`, `    ${a.description}`, ...harnessLine(a, forPerson)])
      : ['', 'This board has no spec agent. Ask for none.']),
    '',
    `The flow one follows is \`${program} guide spec-agent\`.`,
    ...(forPerson ? [`This project adds its own in \`${SPEC_AGENT_HOME}\`.`] : []),
    ...(problems.length ? ['', 'Problems on this board:', ...problems.map((p) => `  ${p}`)] : []),
  ].join('\n')
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
