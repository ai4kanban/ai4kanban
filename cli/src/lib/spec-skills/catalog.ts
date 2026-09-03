// Every spec skill this board can run, from wherever it comes.
//
// Two sources, one list:
//   - the skills the command ships, inlined into the built file (./bundled.ts),
//   - the skills the project adds, under `docs/kanban/skills/<name>/SKILL.md`.
//
// Built-ins come first, so a board reads the same list whether or not it has added any of
// its own. A project skill taking a built-in's name is refused rather than allowed to
// shadow it: a card would otherwise be planned by instructions nobody at the board could
// see, and the name in the log would say the built-in ran.
//
// Whatever cannot be used is reported, never dropped in silence — a skill nobody can see
// failing is a specialist that quietly stops being asked for.

import fs from 'node:fs'
import path from 'node:path'

import { rel, SKILLS } from '../paths'
import { BUNDLED_SKILL_FILES } from './bundled'
import { parseSpecSkill } from './parse'
import type { SpecSkill } from './parse'

/** The board's skills, and every reason one is missing from them. */
export interface SpecSkillCatalog {
  skills: SpecSkill[]
  /** One line per skill that could not be used, saying which and why. */
  problems: string[]
}

/** Read the catalog. Nothing is cached: a skill added, edited or switched off between two
 *  runs takes effect on the next one, the same way the board's settings do. */
export function specSkillCatalog(): SpecSkillCatalog {
  const skills: SpecSkill[] = []
  const problems: string[] = []
  const take = (read: { skill: SpecSkill } | { problem: string }, folder: string): void => {
    if ('problem' in read) return void problems.push(read.problem)
    const clash = skills.find((s) => s.name === read.skill.name)
    if (clash) {
      problems.push(
        `${read.skill.from}: a skill named \`${read.skill.name}\` is already on this board ` +
          `(${clash.from}), so this one is not used. Rename one of them.`,
      )
      return
    }
    if (read.skill.name !== folder) {
      problems.push(
        `${read.skill.from}: its folder is \`${folder}\` but it calls itself \`${read.skill.name}\`. ` +
          'A skill is asked for by its folder name — make the two match.',
      )
      return
    }
    skills.push(read.skill)
  }

  for (const folder of bundledFolders()) take(readBundled(folder), folder)
  for (const folder of projectFolders()) take(readProject(folder), folder)
  return { skills, problems }
}

// ---- the skills the command ships ------------------------------------------

const bundledFolders = (): string[] =>
  [...new Set(Object.keys(BUNDLED_SKILL_FILES).map((key) => key.split('/')[0]!))].sort()

function readBundled(folder: string): { skill: SpecSkill } | { problem: string } {
  const file = (relative: string): string | null => BUNDLED_SKILL_FILES[`${folder}/${relative}`] ?? null
  const text = file('SKILL.md')
  if (text === null) return { problem: `the built-in \`${folder}\` skill has no SKILL.md` }
  return parseSpecSkill(text, `the built-in \`${folder}\` skill`, file, true)
}

// ---- the skills the project adds -------------------------------------------

function projectFolders(): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(SKILLS, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort()
}

function readProject(folder: string): { skill: SpecSkill } | { problem: string } {
  const dir = path.join(SKILLS, folder)
  // Read through the skill's own folder only. A reference is skill-relative by contract
  // (./parse.ts refuses an absolute or climbing one); this is the second lock on it, so a
  // path that slipped through still cannot reach the rest of the repo.
  const file = (relative: string): string | null => {
    const target = path.resolve(dir, relative)
    if (target !== dir && !target.startsWith(dir + path.sep)) return null
    try {
      return fs.readFileSync(target, 'utf8')
    } catch {
      return null
    }
  }
  const text = file('SKILL.md')
  if (text === null) return { problem: `${rel(path.join(dir, 'SKILL.md'))} is missing` }
  return parseSpecSkill(text, rel(path.join(dir, 'SKILL.md')), file)
}
