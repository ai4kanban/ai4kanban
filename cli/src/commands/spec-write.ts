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
import { die, rel, TODO } from '../lib/paths'
import { findSpecAgent, specAgentNames, specHeading, SPEC_AGENT_NAMES } from '../lib/spec-agents'
import type { MoveResult } from '../lib/types'
import { parseFlags } from '../lib/validate'

// The sections a spec agent's own goes in FRONT of. They are the card's tail — what the
// agent decided, where the idea came from — and a spec belongs with the plan it answers,
// not after the footnotes. A card with neither takes it at the end.
const TAIL_HEADINGS = [/^##\s+Decided by the agent\s*$/i, /^##\s+Source\s*$/i]

const headingRe = (name: string): RegExp =>
  new RegExp('^##\\s+By\\s+`' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '`\\s+agent\\s*$', 'i')

export function cmdSpecWrite(args: string[]): MoveResult {
  const { flags, positional } = parseFlags(args, ['file', 'text'])
  const id = Number(positional[0])
  if (!Number.isInteger(id)) die('need a numeric task id: spec-write <id> <agent> --file <path>')
  const askedName = String(positional[1] ?? '').trim()
  if (!askedName) die(`name the spec agent whose section this is: spec-write ${id} <agent> --file <path>`)
  const agent = findSpecAgent(askedName)
  if (!agent) {
    die(`"${askedName}" is not a spec agent on this board. It ships: ${SPEC_AGENT_NAMES.join(', ')}.`, {
      kind: 'no-such-spec-agent',
      specAgent: askedName,
    })
  }
  const name = agent.name

  const section = readSection(flags.file, flags.text)
  const found = locate(id)
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`, { kind: 'card-not-found', id })
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) die(`${rel(file)} has no frontmatter — run \`migrate\` first`)

  const { body: next, replaced } = splice(body, name, section)
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
  // A heading the agent wrote for itself is dropped rather than refused — the move owns
  // the heading, and two of them stacked would read as an empty section.
  if (lines.length && /^##\s+By\s+`.*`\s+agent\s*$/i.test(lines[0]!.trim())) lines.shift()
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
  return section
}

// Put the section on the card: over the one already there, or in front of the card's tail,
// or at the end. Everything else in the body is untouched — this is a splice, never a
// rewrite.
function splice(body: string, name: string, section: string): { body: string; replaced: boolean } {
  const lines = body.split('\n')
  const block = [specHeading(name), '', section, '']
  const headings = specAgentNames(name).map(headingRe)
  const at = lines.findIndex((l) => headings.some((heading) => heading.test(l.trim())))

  if (at >= 0) {
    // From its heading to whatever heading comes next — that span is the agent's, and only
    // that span.
    let end = at + 1
    while (end < lines.length && !/^##\s/.test(lines[end]!)) end++
    return { body: [...lines.slice(0, at), ...block, ...lines.slice(end)].join('\n'), replaced: true }
  }

  const tail = lines.findIndex((l) => TAIL_HEADINGS.some((re) => re.test(l.trim())))
  if (tail >= 0) {
    return { body: [...lines.slice(0, tail), ...block, ...lines.slice(tail)].join('\n'), replaced: false }
  }
  return { body: `${body.trimEnd()}\n\n${block.join('\n').trimEnd()}\n`, replaced: false }
}
