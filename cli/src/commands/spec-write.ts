// ---- spec-write ------------------------------------------------------------
//
// The one door a spec skill writes a card through (#187).
//
// It is a move rather than an instruction because "write only your own section" has to be
// true, not asked for: this splices the skill's answer under its own heading and leaves
// every other byte of the card as it was. Run it again and the section is REPLACED, so a
// card that has been through the same skill twice carries one section, not two.

import fs from 'node:fs'
import path from 'node:path'

import { locate } from '../lib/cards'
import { parseFrontmatter, serializeFrontmatter } from '../lib/frontmatter'
import { say } from '../lib/io'
import { fixMockupBlocks } from '../lib/mockups'
import { die, rel, TODO, warn } from '../lib/paths'
import { findSpecSkill, notASkill, specHeading, specSkillNames } from '../lib/spec-skills'
import type { FlagValue, MoveResult } from '../lib/types'
import { parseFlags } from '../lib/validate'

// The sections a spec skill's own goes in FRONT of. They are the card's tail — what the
// agent decided, where the idea came from — and a spec belongs with the plan it answers,
// not after the footnotes. A card with neither takes it at the end.
const TAIL_HEADINGS = [/^##\s+Decided by the agent\s*$/i, /^##\s+Source\s*$/i]

// The line dividing a card's two halves (`akb guide writing`).
const MARKER = /^<!--\s*agent\s*-->$/

/** Which half the section goes in. A section holding a pick the user has to make is their
 *  reading, so it sits above the boundary; everything else is the builder's. */
const HALVES = ['human', 'agent'] as const
type Half = (typeof HALVES)[number]

// Told nothing, a new section goes in the agent half and a rewrite stays where it sits — a
// spec skill that says nothing about the reader has not asked for the card to be reshaped.
function readHalf(raw: FlagValue | undefined): Half | null {
  if (raw === undefined) return null
  if (raw === true) die(`--half needs a value: ${HALVES.join(' or ')}`)
  const value = String(raw).trim().toLowerCase()
  if (!(HALVES as readonly string[]).includes(value)) die(`--half takes ${HALVES.join(' or ')} (got "${String(raw)}")`)
  return value as Half
}

// `skill` is the word a section carries now; `agent` is the word it carried before #403.
// Both are matched so a card written by an older release is still found and rewritten in
// place rather than gaining a second section beside it.
const headingRe = (name: string): RegExp =>
  new RegExp('^##\\s+By\\s+`' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '`\\s+(skill|agent)\\s*$', 'i')

export function cmdSpecWrite(args: string[]): MoveResult {
  const { flags, positional } = parseFlags(args, ['file', 'text', 'half'])
  const id = Number(positional[0])
  if (!Number.isInteger(id)) die('need a numeric task id: spec-write <id> <skill> --file <path>')
  const askedName = String(positional[1] ?? '').trim()
  if (!askedName) die(`name the spec skill whose section this is: spec-write ${id} <skill> --file <path>`)
  const skill = findSpecSkill(askedName)
  if (!skill) die(notASkill(askedName), { kind: 'no-such-spec-agent', specAgent: askedName })
  const name = skill.name

  const section = readSection(flags.file, flags.text)
  const half = readHalf(flags.half)
  const found = locate(id)
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`, { kind: 'card-not-found', id })
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) die(`${rel(file)} has no frontmatter — run \`migrate\` first`)

  const { body: next, replaced } = splice(body, name, section, half)
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n' + next)
  say(`${replaced ? 'rewrote' : 'wrote'} the \`${name}\` section on #${id} (${rel(file)})`)
  return { id, specAgent: name, replaced, file: rel(file) }
}

// The agent's answer, from a file or straight off the command line. A file is what the
// flow asks for: a section is markdown, and a shell eats markdown.
function readSection(file: unknown, text: unknown): string {
  if (file !== undefined && text !== undefined) die('pass --file or --text, not both')
  let raw: string
  if (file !== undefined) {
    if (file === true) die('--file needs a path after it')
    try {
      raw = fs.readFileSync(String(file), 'utf8')
    } catch {
      die(`can't read ${String(file)} — write your section to a file, then pass its path`)
    }
  } else if (text !== undefined) {
    raw = text === true ? '' : String(text)
  } else {
    die('the section has to come from somewhere: --file <path>, or --text "..." for a one-liner')
  }

  const lines = raw!.trim().split('\n')
  // A heading the skill wrote for itself is dropped rather than refused — the move owns
  // the heading, and two of them stacked would read as an empty section.
  if (lines.length && /^##\s+By\s+`.*`\s+(skill|agent)\s*$/i.test(lines[0]!.trim())) lines.shift()
  const section = lines.join('\n').trim()
  if (!section) {
    die('the section is empty — a skill with nothing to say writes no section at all, and says so in its last message')
  }
  // A `##` inside the answer would end the section, so the next run would replace only
  // half of it. `###` is a heading inside a section and is left alone.
  const broken = section.split('\n').findIndex((l) => /^##(?!#)\s/.test(l))
  if (broken >= 0) {
    die(
      `line ${broken + 1} of the section starts a new \`##\` heading, which would end your section: "${section.split('\n')[broken]!.trim()}". Use \`###\` for a heading inside it.`,
    )
  }
  // A tag the board would print as text is repaired rather than refused: the drawing is
  // the answer, and the spacing around it is not something to send an agent back for.
  const spaced = fixMockupBlocks(section)
  if (spaced !== section) warn('a `<Mockup>` tag needs a paragraph of its own — moved the text off its line.')
  return spaced
}

// Put the section on the card: over the one already there, or in the half it belongs to.
// Everything else in the body is untouched — this is a splice, never a rewrite.
function splice(
  body: string,
  name: string,
  section: string,
  half: Half | null,
): { body: string; replaced: boolean } {
  const lines = body.split('\n')
  const block = [specHeading(name), '', section, '']
  const headings = specSkillNames(name).map(headingRe)
  const at = lines.findIndex((l) => headings.some((heading) => heading.test(l.trim())))
  if (at < 0) return { body: place(lines, block, half ?? 'agent'), replaced: false }

  // From its heading to whatever comes next — that span is the skill's, and only that
  // span. The boundary marker ends it too: it divides the card, so a section sitting
  // directly above it must not take it away on the next rewrite.
  let end = at + 1
  while (end < lines.length && !/^##\s/.test(lines[end]!) && !MARKER.test(lines[end]!.trim())) end++
  const cut = [...lines.slice(0, at), ...lines.slice(end)]
  // No half asked for: a rewrite stays where the section already sits.
  const next = half ? place(cut, block, half) : [...lines.slice(0, at), ...block, ...lines.slice(end)].join('\n')
  return { body: next, replaced: true }
}

// Where a section goes when it is not replacing one in place: above the boundary for the
// human half, and otherwise in front of the card's tail below it, or at the end. A card
// with no boundary yet takes it where it has always gone — its next refine places it.
function place(lines: string[], block: string[], half: Half): string {
  const marker = lines.findIndex((l) => MARKER.test(l.trim()))
  if (half === 'human' && marker >= 0) {
    return [...lines.slice(0, marker), ...block, ...lines.slice(marker)].join('\n')
  }
  const tail = lines.findIndex((l, i) => i > marker && TAIL_HEADINGS.some((re) => re.test(l.trim())))
  if (tail >= 0) return [...lines.slice(0, tail), ...block, ...lines.slice(tail)].join('\n')
  return `${lines.join('\n').trimEnd()}\n\n${block.join('\n').trimEnd()}\n`
}
