// ---- the project goal ------------------------------------------------------
//
// `docs/kanban/memory/goal.md` is the direction in the user's own words. The file starts
// empty — the ask lives in whatever box or flow reaches for it, not in the file — and its
// frontmatter carries one machine-readable field:
//
//   reviewed: strong | good | pending | weak
//
// how clear the goal is to plan from. `strong`, `good` and `weak` are the agent's judgment,
// and only the agent writes them. `pending` is not a judgment: it says a goal is written
// and nobody has judged it yet, and it is what a save seeds. Everything but `weak` means
// "don't ask the user for a goal" — nagging someone for work they just did is the one thing
// this field must never do.
//
// Reading and writing the goal lives here rather than in whoever asks, so `init`'s repair,
// a board UI's goal box and a flow that wants to know whether to ask all read one file the
// same way.

import fs from 'node:fs'
import path from 'node:path'

import { GOAL } from '../paths'
import { unquote } from '../yaml'

/** The values the field may hold. Anything else reads as no field at all. */
export const GOAL_REVIEW_VALUES = ['strong', 'good', 'pending', 'weak']

export type GoalReview = 'strong' | 'good' | 'pending' | 'weak'

// The body older versions seeded into a fresh `goal.md` — the script's wording, then the
// local UI's. A goal that still holds one of these, whitespace aside, is a goal nobody has
// written: it reads as empty everywhere, and `init`'s repair clears it for good.
const SEEDED_GOAL_BODIES = [
  `# Goal

Where this is headed, in the user's own words: the long-term goal, the horizon it aims
at, and the roadmap of what comes next, roughly in order. Not this week's work — that's
the cards on the board. The user owns this file; the agent seeds it but does not invent
the goal.

_(not filled in yet — the user writes this.)_`,
  `# Goal

The direction, in the user's own words — where this is headed. One short statement. The
user owns this file; the agent seeds it but does not invent the goal.

_(not filled in yet — the user writes this.)_`,
]

/** The value as written, or null when the file has no valid field — a repair reads null as
 *  "the field needs writing"; everyone else reads it as weak on an empty goal and as
 *  unjudged on a written one. */
export function readGoalReviewFrom(text: string): string | null {
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const line = fm && fm[1]!.match(/^reviewed:[ \t]*(.+?)[ \t]*$/m)
  const v = line && unquote(line[1]!)
  return v && GOAL_REVIEW_VALUES.includes(v) ? v : null
}

/** Set the field without disturbing the rest of the file: replace the `reviewed:` line in
 *  place, add it to a frontmatter block that lacks it, or open a new block on a file that
 *  has none. The goal text itself is never touched — the block is free-form and nothing in
 *  it but this line is ours. */
export function writeGoalReviewInto(text: string, value: string): string {
  const fm = text.match(/^---\r?\n([\s\S]*?\r?\n)---/)
  if (!fm) return `---\nreviewed: ${value}\n---\n\n${text}`
  const inner = /^reviewed:.*$/m.test(fm[1]!)
    ? fm[1]!.replace(/^reviewed:.*$/m, () => `reviewed: ${value}`)
    : `reviewed: ${value}\n${fm[1]}`
  return `---\n${inner}---${text.slice(fm[0]!.length)}`
}

/** The goal file as it stands: its body below the frontmatter, and whether that body is the
 *  user's own words. A body that is empty — or still one of the seeded blocks older
 *  versions wrote — is nobody's goal. */
export function readGoalBody(text: string): { body: string; seeded: boolean; written: boolean } {
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
  const flat = (s: string): string => s.trim().replace(/\s+/g, ' ')
  const seeded = SEEDED_GOAL_BODIES.some((s) => flat(s) === flat(body))
  return { body, seeded, written: !seeded && body.trim() !== '' }
}

function goalFile(): { text: string } | null {
  try {
    return { text: fs.readFileSync(GOAL, 'utf8') }
  } catch {
    return null
  }
}

/** How clear the goal is, as the field says. A missing file or field reads `pending`;
 *  whether to ask for a goal is `goalNeedsWork`, which looks at the text itself. */
export function goalReviewed(): GoalReview {
  const file = goalFile()
  const v = file && readGoalReviewFrom(file.text)
  return v === 'strong' || v === 'good' || v === 'weak' ? v : 'pending'
}

/** Is there a goal to read? True once the file holds the user's own words. A mechanical
 *  test on the text, not the agent's judgment: a user who writes their goal can open it
 *  straight away, not after the next agent run. */
export function goalWritten(): boolean {
  const file = goalFile()
  return file ? readGoalBody(file.text).written : false
}

/** Should anything ask for a goal? Only when there is nothing written, or when the agent
 *  judged what is written too vague to plan from. The board never grades the goal itself —
 *  it can see an empty file, and that takes no judgment. */
export function goalNeedsWork(): boolean {
  return !goalWritten() || goalReviewed() === 'weak'
}

/** The goal text for an editor: everything below the frontmatter — the user's words,
 *  without the agent's field. A missing file, or one still holding a seeded block, opens an
 *  empty box. */
export function readGoalText(): string {
  const file = goalFile()
  if (!file) return ''
  const { body, seeded } = readGoalBody(file.text)
  return seeded ? '' : body.replace(/^\n+/, '')
}

/** Save the user's words back, keeping whatever frontmatter the file already has and
 *  setting `reviewed: pending` — the goal is written, and nobody has judged this version of
 *  it yet. That is what stops the board asking for a goal the moment it is written: no
 *  agent runs on a save, so waiting for a judgment here would nag the user for work they
 *  just did. The next propose run judges it. */
export function writeGoalText(text: string): void {
  const before = goalFile()
  const kept = before ? before.text.slice(0, before.text.length - readGoalBody(before.text).body.length) : ''
  const body = text.replace(/^\n+/, '').replace(/\s+$/, '')
  fs.mkdirSync(path.dirname(GOAL), { recursive: true })
  fs.writeFileSync(GOAL, writeGoalReviewInto(`${kept}${body}\n`, 'pending'))
}
