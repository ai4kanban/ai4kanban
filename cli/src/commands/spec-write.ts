// ---- spec-write ------------------------------------------------------------
//
// The one door a spec agent writes a card through (#187).
//
// It is a move rather than an instruction because "write only your own section" has to be
// true, not asked for: this splices the agent's answer under its own heading and leaves
// every other byte of the card as it was. Run it again and the section is REPLACED, so a
// card that has been through the same agent twice carries one section, not two.

import fs from 'node:fs'
import path from 'node:path'

import { locate } from '../lib/cards'
import { parseFrontmatter, serializeFrontmatter } from '../lib/frontmatter'
import { say } from '../lib/io'
import { fixMockupBlocks } from '../lib/mockups'
import { writeAgentMemory } from '../lib/memory'
import { die, rel, TODO, warn } from '../lib/paths'
import { findSpecAgent, notAnAgent, specHeading, specAgentNames } from '../lib/agents'
import type { SpecAgent } from '../lib/agents'
import type { MoveResult } from '../lib/types'

// The sections a spec agent's own goes in FRONT of. They are the card's tail — what the
// agent decided, where the idea came from — and a spec belongs with the plan it answers,
// not after the footnotes. A card with neither takes it at the end.
const TAIL_HEADINGS = [/^##\s+Decided by the agent\s*$/i, /^##\s+Source\s*$/i]

// The line dividing a card's two halves (`akb guide writing`).
const MARKER = /^<!--\s*agent\s*-->$/

/** Which half the section goes in. A section holding a pick the user has to make is their
 *  reading, so it sits above the boundary; everything else is the builder's. */
const HALVES = ['human', 'agent'] as const
type Half = (typeof HALVES)[number]

/** `akb raw spec-write`, as its command declares it (lib/cli/board.ts). Told no `--half`,
 *  a new section goes in the agent half and a rewrite stays where it sits — a spec agent
 *  that says nothing about the reader has not asked for the card to be reshaped.
 *
 *  `--memory` is the other half of the same write (#421): an agent that declares one keeps
 *  its memory here too, so the run that answers the card and the run that learned something
 *  are one call and one place. */
export interface SpecWriteOptions {
  file?: string
  text?: string
  half?: Half
  memory?: string
}

// `agent` is the word a section carries now; `skill` is the word it carried between #403
// and #419. Both are matched so a card written by an older release is still found and
// rewritten in place rather than gaining a second section beside it.
const headingRe = (name: string): RegExp =>
  new RegExp('^##\\s+By\\s+`' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '`\\s+(skill|agent)\\s*$', 'i')

export function cmdSpecWrite(id: number, askedName: string, flags: SpecWriteOptions): MoveResult {
  const agent = findSpecAgent(askedName)
  if (!agent || agent.kind !== 'spec') die(notAnAgent(askedName), { kind: 'no-such-spec-agent', specAgent: askedName })
  const name = agent.name

  const section = readSection(flags.file, flags.text)
  // Both inputs are read before either is written, so a memory the move cannot read never
  // leaves the card written and the memory not.
  const memory = readMemory(agent, flags.memory)
  const half = flags.half ?? null
  const found = locate(id)
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`, { kind: 'card-not-found', id })
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) die(`${rel(file)} has no frontmatter — run \`migrate\` first`)

  const { body: next, replaced } = splice(body, name, section, half)
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n' + next)
  say(`${replaced ? 'rewrote' : 'wrote'} the \`${name}\` section on #${id} (${rel(file)})`)
  const kept = memory === null ? null : writeAgentMemory(name, memory)
  if (kept) say(`${kept.fresh ? 'started' : 'rewrote'} what \`${name}\` remembers (${rel(kept.file)})`)
  return { id, specAgent: name, replaced, file: rel(file), ...(kept ? { memory: rel(kept.file) } : {}) }
}

// The agent's curated memory, from the file `--memory` names. Null when the flag was not
// passed, which is the usual run: an agent that learned nothing this time writes nothing.
//
// The whole file every time, never an appended line — an agent is handed its memory and
// hands it back, so what it keeps is a choice it made rather than a pile it never revisits.
function readMemory(agent: SpecAgent, from: string | undefined): string | null {
  if (from === undefined) return null
  if (!agent.memory) {
    die(`the \`${agent.name}\` agent keeps no memory — add \`memory: project\` under \`akb:\` in its AGENT.md first`, {
      kind: 'agent-has-no-memory',
      specAgent: agent.name,
    })
  }
  let raw: string
  try {
    raw = fs.readFileSync(from, 'utf8')
  } catch {
    die(`can't read ${from} — write your memory to a file, then pass its path`)
  }
  const text = raw!.trim()
  if (!text) die('the memory is empty — leave `--memory` off rather than emptying what you remember')
  return text
}

// The agent's answer, from a file or straight off the command line. A file is what the
// flow asks for: a section is markdown, and a shell eats markdown.
function readSection(file: string | undefined, text: string | undefined): string {
  if (file !== undefined && text !== undefined) die('pass --file or --text, not both')
  let raw: string
  if (file !== undefined) {
    try {
      raw = fs.readFileSync(file, 'utf8')
    } catch {
      die(`can't read ${file} — write your section to a file, then pass its path`)
    }
  } else if (text !== undefined) {
    raw = text
  } else {
    die('the section has to come from somewhere: --file <path>, or --text "..." for a one-liner')
  }

  const lines = raw!.trim().split('\n')
  // A heading the agent wrote for itself is dropped rather than refused — the move owns
  // the heading, and two of them stacked would read as an empty section.
  if (lines.length && /^##\s+By\s+`.*`\s+(skill|agent)\s*$/i.test(lines[0]!.trim())) lines.shift()
  const section = lines.join('\n').trim()
  if (!section) {
    die('the section is empty — an agent with nothing to say writes no section at all, and says so in its last message')
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
  const headings = specAgentNames(name).map(headingRe)
  const at = lines.findIndex((l) => headings.some((heading) => heading.test(l.trim())))
  if (at < 0) return { body: place(lines, block, half ?? 'agent'), replaced: false }

  // From its heading to whatever comes next — that span is the agent's, and only that
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
