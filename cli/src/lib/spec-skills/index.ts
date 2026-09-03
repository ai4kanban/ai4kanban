// The spec skills — what the board can put on a card, and what each one is set to.
//
// A spec skill owns one part of a card's spec — the screen a card draws, the library it
// picks — and it fills that part in a run of its own: it starts clean, gets the card and a
// short note, writes one section of that card, and touches nothing else. What one is asked
// to do beyond its own instructions is `akb guide spec-skill`.
//
// Nothing about a skill is written in TypeScript. Its name, the line it is picked by, the
// part of the spec it owns and the settings it declares all come out of its own `SKILL.md`
// (./parse.ts), whether the command ships it or the project added it (./catalog.ts). This
// file is the board's side: which skills may run, what each one is set to, and the text one
// run is finally handed.

import { runtimeFor } from '../agent/runtime'
import { runtimeHarness } from '../agent/resolve'
import { specAgentEntries, setSpecAgentSwitch, setSpecAgentValue } from '../agent/settings'
import type { SpecAgentEntry } from '../agent/settings'
import type { SpecSkillView } from '../agent/types'
import { canonicalSpecSkill, specSkillNames } from '../spec-skill-names'
import { specSkillCatalog } from './catalog'
import type { SpecSkill } from './parse'

export { specSkillCatalog } from './catalog'
export { specSkillNames } from '../spec-skill-names'
export type { SpecSkill } from './parse'

/** Every skill on this board, in the board's order. */
export const specSkills = (): SpecSkill[] => specSkillCatalog().skills

/** Every reason a skill on this board can't be used — a malformed `SKILL.md`, a name already
 *  taken. Shown wherever the skills are listed, and put in a run's log before it starts. */
export const specSkillProblems = (): string[] => specSkillCatalog().problems

/** The names this board answers to, for a message that has to say what there is. */
export const specSkillNamesOnBoard = (): string[] => specSkills().map((s) => s.name)

export const findSpecSkill = (name: string): SpecSkill | null => {
  const wanted = canonicalSpecSkill(name)
  return specSkills().find((s) => s.name === wanted) ?? null
}

/** The heading a spec skill's section carries on a card. Its name is in it, so a reader can
 *  see who is answerable for that part of the spec and a rerun knows what to replace. */
export const specHeading = (name: string): string => '## By `' + specSkillNames(name)[0] + '` skill'

// ---- switched on, switched off, and set (#191, #255) ------------------------
//
// Every spec skill is on until someone switches it off in the board UI, under
// Configuration → Agents. A skill that declares settings is set there too. Both are saved
// with the board, so they are the same for everyone working on it and the same wherever the
// board works — a flow run from a terminal reads them too.
//
// They are read as a run is about to start, never remembered from earlier, so the last
// change is the one that counts. What the file holds is still keyed `specAgents`: the word
// changed, the boards did not, and a rename that lost everyone's settings would be a rename
// that cost something (#403).

/** Is this skill switched on? A name with nothing saved for it is on, so a board set up
 *  before the switches existed has every skill on. */
export const specSkillEnabled = (name: string, entries = specAgentEntries()): boolean =>
  specSkillNames(name).every((candidate) => entries[candidate]?.enabled !== false)

// What the file holds for one skill, under its current name or a name it used to have.
const savedEntry = (name: string, entries: Record<string, SpecAgentEntry>): SpecAgentEntry | null => {
  for (const candidate of specSkillNames(name)) {
    const entry = entries[candidate]
    if (entry) return entry
  }
  return null
}

/** What one skill is set to: every setting it declares, carrying the saved value or its own
 *  default. `notes` holds a line for each value that had to fall back — a choice renamed or
 *  dropped between releases would otherwise reach a run as a word its skill has no reference
 *  for, and silently getting a different answer than last time is worse than being told. */
export function specSkillSettings(
  skill: SpecSkill,
  entries = specAgentEntries(),
): { values: Record<string, string>; notes: string[] } {
  const saved = savedEntry(skill.name, entries)?.values ?? {}
  const values: Record<string, string> = {}
  const notes: string[] = []
  for (const setting of skill.settings) {
    const picked = saved[setting.key]
    if (picked !== undefined && setting.choices.some((c) => c.value === picked)) {
      values[setting.key] = picked
      continue
    }
    if (picked !== undefined) {
      notes.push(
        `the \`${skill.name}\` skill's ${setting.label} is saved as "${picked}", which it no longer offers — ` +
          `running it at its default, "${setting.default}".`,
      )
    }
    values[setting.key] = setting.default
  }
  return { values, notes }
}

/** Everything one spec run is handed of its skill: the `SKILL.md` instructions, and the one
 *  reference each picked choice names — never the others. The board resolves and loads them
 *  here, as the run starts, so the agent has nothing to go and find: a reference it had to
 *  fetch is a reference it can skip, and the ones it must not read would be a folder away.
 *
 *  A reference that has gone missing is reported rather than passed over. The setting said
 *  which way to work, and a run that quietly worked the other way is the failure this
 *  reports its way out of. */
export function specSkillInstructions(
  skill: SpecSkill,
  entries = specAgentEntries(),
): { instructions: string; references: { title: string; text: string }[]; notes: string[] } {
  const { values, notes } = specSkillSettings(skill, entries)
  const references: { title: string; text: string }[] = []
  for (const setting of skill.settings) {
    const choice = setting.choices.find((c) => c.value === values[setting.key])
    if (!choice) continue
    const text = skill.file(choice.reference)
    if (text === null) {
      notes.push(
        `the \`${skill.name}\` skill's ${setting.label} is "${choice.label}", whose ${choice.reference} ` +
          'is missing — the run goes ahead without it.',
      )
      continue
    }
    references.push({ title: `${setting.label}: ${choice.label}`, text: text.trim() })
  }
  return { instructions: skill.body.trim(), references, notes }
}

/** The skills a flow may ask for — the ones that are on, in the board's own order. */
export const enabledSpecSkills = (): SpecSkill[] => {
  const entries = specAgentEntries()
  return specSkills().filter((s) => specSkillEnabled(s.name, entries))
}

/** The catalog a planning run is shown, so it can decide for itself which — if any — a card
 *  needs (#403). One entry each: the name it is asked for by, the line it is picked by, and
 *  the part of the spec it owns. Nothing of a skill's instructions is in here; a selector
 *  handed a skill's body would start following it.
 *
 *  It is a catalog, not an instruction: a flow reads `owns` against the card in front of it,
 *  and asking for none is the common answer. Switched-off skills are left out, so a board
 *  that turned one off is never offered it.
 *
 *  Empty when every skill is off — a heading over an empty list reads as a list that failed
 *  to load. */
export function specSkillSelector(id: number | string): string {
  const on = enabledSpecSkills()
  if (!on.length) return ''
  return [
    // Tagged, because this block is a list of other agents' work sitting under an
    // instruction about the card. Without a boundary a run reads "ui-design" as part of its
    // own job.
    '<spec-skills>',
    "Specialist skills this board has, each filling one part of a card's spec in a run of its own:",
    ...on.flatMap((s) => [`- \`${s.name}\``, `  owns ${s.owns}`, `  ${s.description}`]),
    `Review this list once. Ask for a skill only where the card would otherwise be planned by guess in the part that skill owns, and only when that section is missing: \`akb spec <skill> ${id} <short note>\`.`,
    'Asking for none is the usual answer. Do not ask for a skill to review, repeat or check work, and do not wait for one — the board starts it when this run ends.',
    '</spec-skills>',
  ].join('\n')
}

/** Every spec skill as a screen reads it: both its lines, whether it is on, the settings it
 *  declares and what each one is set to. The reference a choice loads is left out — it is
 *  the run's business, not a dialog's. */
export function readSpecSkills(): SpecSkillView[] {
  const entries = specAgentEntries()
  return specSkills().map((skill) => ({
    name: skill.name,
    owns: skill.owns,
    description: skill.description,
    enabled: specSkillEnabled(skill.name, entries),
    // Which runtime this skill runs on, and what that is here (#343) — so the list a screen
    // draws is the same answer a run would get, and no UI works one out.
    ...specSkillRun(skill.name, entries),
    settings: skill.settings.map((setting) => ({
      key: setting.key,
      label: setting.label,
      ...(setting.help ? { help: setting.help } : {}),
      choices: setting.choices.map((c) => ({ value: c.value, label: c.label, cost: c.cost })),
      default: setting.default,
    })),
    values: specSkillSettings(skill, entries).values,
  }))
}

/** What one spec skill runs on: the runtime it names — the board's global one when it names
 *  none — and what that runtime runs as. */
export function specSkillRun(
  name: string,
  entries = specAgentEntries(),
): { runtime: string; harness: string } {
  const runtime = runtimeFor({ action: 'spec', specAgent: name }, undefined, entries)
  return { runtime, harness: runtimeHarness(runtime).name }
}

/** Switch one skill on or off. The name is checked against the skills this board has, so
 *  nothing writes a switch for a skill that doesn't exist. What that skill is set to
 *  survives the flip either way: losing a pick by switching a skill off and on would be a
 *  surprise. */
export function setSpecSkillEnabled(name: string, on: boolean): { ok: boolean; error?: string } {
  const skill = findSpecSkill(name)
  if (!skill) return { ok: false, error: notASkill(name) }
  return setSpecAgentSwitch(skill.name, on, specSkillNames(skill.name).slice(1))
}

/** Save one of the settings a skill declares. The skill, the key and the value are all
 *  checked against what this board has, so nothing writes a setting no skill has or a choice
 *  no setting offers. A value that IS the setting's default is dropped rather than written
 *  down — the file records what somebody changed. */
export function setSpecSkillSetting(name: string, key: string, value: string): { ok: boolean; error?: string } {
  const skill = findSpecSkill(name)
  if (!skill) return { ok: false, error: notASkill(name) }
  const setting = skill.settings.find((s) => s.key === key)
  if (!setting) {
    const takes = skill.settings.length
      ? `It takes: ${skill.settings.map((s) => s.key).join(', ')}.`
      : 'It takes none.'
    return { ok: false, error: `"${key}" is not a setting the \`${skill.name}\` spec skill takes. ${takes}` }
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
  return setSpecAgentValue(skill.name, setting.key, save, specSkillNames(skill.name).slice(1))
}

export const notASkill = (name: string): string => {
  const there = specSkillNamesOnBoard()
  return there.length
    ? `"${name}" is not a spec skill on this board. It has: ${there.join(', ')}.`
    : `"${name}" is not a spec skill on this board, and this board has none.`
}

/** Where a switched-off skill goes back on. One place, named the same way everywhere. */
export const SPEC_SWITCH_HOME = 'the board UI, under Configuration → Agents'

/** Where a project puts a skill of its own. */
export const SPEC_SKILL_HOME = 'docs/kanban/skills/<name>/SKILL.md'

/** The list of spec skills, one entry each — what `akb spec` with no skill named prints.
 *
 *  A switched-off skill is left out of the list a flow picks from. Typed by a person it is
 *  still named, in one closing line: a skill that vanished with no explanation is a feature
 *  the user thinks broke. */
export function specSkillList(program: string, forPerson = false): string {
  const entries = specAgentEntries()
  const { skills, problems } = specSkillCatalog()
  const on = skills.filter((s) => specSkillEnabled(s.name, entries))
  const off = skills.filter((s) => !specSkillEnabled(s.name, entries))
  return [
    `${program} spec <skill> <id> [note] — put a spec skill on a card.`,
    '',
    "A spec skill fills one part of a card's spec. It runs on its own, in its own context:",
    'it is given the card and your note, it writes one section of that card, and it changes',
    'nothing else. Ask for one when the card would otherwise be planned by guess.',
    '',
    'Skills',
    ...(on.length
      ? on.flatMap((s) => [
          '',
          `  ${s.name}`,
          `    owns ${s.owns}`,
          `    ${s.description}`,
          ...runtimeLine(s, entries, forPerson),
          ...settingLines(s, entries),
        ])
      : ['', 'Every spec skill on this board is switched off. Ask for none.']),
    '',
    `The flow one follows is \`${program} guide spec-skill\`.`,
    ...(forPerson
      ? [`This project adds its own in \`${SPEC_SKILL_HOME}\`.`]
      : []),
    ...(forPerson && off.length
      ? [
          '',
          `Switched off, so don't ask for ${off.length === 1 ? 'it' : 'them'}: ${off.map((s) => s.name).join(', ')}. ` +
            `Switch ${off.length === 1 ? 'it' : 'them'} back on in ${SPEC_SWITCH_HOME}.`,
        ]
      : []),
    ...(problems.length ? ['', `Not usable, so not on the list above:`, ...problems.map((p) => `  ${p}`)] : []),
  ].join('\n')
}

// What one skill is set to, under the two lines it is listed by. One line per setting: what
// it is called, the choice in effect, and what that choice costs. A skill that declares none
// adds nothing, so the list reads exactly as it did before settings existed.
//
// The choices not in effect are left out on purpose: a setting is picked in the board UI,
// never here, so a terminal listing that spelled out every option would be a menu with
// nothing to press.
function settingLines(skill: SpecSkill, entries: Record<string, SpecAgentEntry>): string[] {
  if (!skill.settings.length) return []
  const { values } = specSkillSettings(skill, entries)
  return skill.settings.map((setting) => {
    const choice = setting.choices.find((c) => c.value === values[setting.key])
    return `    ${setting.label}: ${choice ? `${choice.label} — ${choice.cost}` : values[setting.key]}`
  })
}

// Which runtime this skill runs on, and what that is here (#343) — the same answer the board
// UI's Agents section draws, so a terminal never says something else.
//
// Only for a person. A run reading this list is picking which skills a card needs, and what
// tool each one spawns as is nothing it can act on.
function runtimeLine(skill: SpecSkill, entries: Record<string, SpecAgentEntry>, forPerson: boolean): string[] {
  if (!forPerson) return []
  const { runtime, harness } = specSkillRun(skill.name, entries)
  return [`    Runtime: ${runtime} — ${harness} here`]
}
