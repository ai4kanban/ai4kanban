// Which tasks a board raises an event about, and what that event carries (#319).
//
// Three rules and one filter, in one place, so the publisher, the reconciliation at start
// and the retirement test are the same judgment rather than three that agree until they
// don't:
//
//   • a task the board's watch covers — every card, or one release's, and
//   • either at `ready`, or carrying questions only the user can answer, and
//   • nothing in its way: no run working it, and no open card it waits on.
//
// Narrowed to one release, a task in another — or promised to none — is not what the user
// asked to be told about. A task that is BOTH `ready` and asking raises the question:
// answering it rewrites the card and moves its revision, so an approval granted first would
// bind a revision about to change.
//
// The last rule is what makes a raised card mean something. An agent rewrites a card over
// several board writes, so a card mid-run says `ready` in moments it is not done being
// worked on; and a card behind an open blocker cannot be built whatever the user decides.
// A card goes quiet while something is in its way and comes back when nothing is — which is
// the whole of what an interruption is for.

import crypto from 'node:crypto'

import { parseQuestion } from '../view/rules'
import type { Card } from '../view/types'
import { ALL_RELEASES, type CloudBoard } from './boards'
import { decisionFor, type CloudEventKind, type CloudEventQuestion } from './events'

/** How much of the card's own words an event carries.
 *
 *  Bounded rather than whole: a message is reviewed from this, not from the card, and a
 *  long card must cost one stored snapshot rather than its whole body. The reader is one
 *  screen away from all of it through the card link. */
const SUMMARY_LIMIT = 1500
const NOTES_LIMIT = 2500

/** The event one card would raise, as it goes to the Worker. `boardId` names the board;
 *  nothing here says where that board is. */
export interface EventSnapshot {
  boardId: string
  boardName: string
  taskId: number
  taskTitle: string
  release: string
  revision: string
  kind: CloudEventKind
  decision: 'implement' | 'answer'
  questions: CloudEventQuestion[]
  /** The card's opening paragraph (#320), so a message can be reviewed while the machine
   *  that raised it is off. Empty on a card that opens with nothing. */
  summary: string
  /** The card's `## Worth noting` and `## Worth noting after implementation` — the review
   *  notes, which is what approving a build off a title alone is missing. */
  notes: string
  /** What makes two snapshots of one task the same piece of work: the revision it binds and
   *  the questions it carries. A snapshot whose fingerprint has not moved needs no write. */
  fingerprint: string
}

/** The user-owned questions on this card, with the board's own tag taken off. */
export function userQuestions(card: Card): CloudEventQuestion[] {
  const out: CloudEventQuestion[] = []
  for (const q of card.questions) {
    const { tag, text } = parseQuestion(q.text)
    if (tag !== 'user') continue
    const options = Array.isArray(q.options) ? q.options.filter(Boolean) : []
    out.push(
      options.length > 0
        ? { text, mode: q.mode ?? 'single', options, recommend: q.recommend ?? [] }
        : { text },
    )
  }
  return out
}

/** Is this a card the board raises an event about right now? `atWork` is what the board is
 *  working on (agent/store.ts) — a card in it is nobody's decision yet. */
export function actionableKind(
  card: Card,
  board: CloudBoard,
  atWork?: ReadonlySet<number>,
): CloudEventKind | null {
  if (!board.release) return null
  if (board.release !== ALL_RELEASES && card.release !== board.release) return null
  if (card.recurring) return null
  if (atWork?.has(card.id)) return null
  if (card.openBlockers?.length) return null
  if (userQuestions(card).length > 0) return 'question'
  return card.status === 'ready' ? 'ready_for_review' : null
}

/** The snapshot for a card the board raises an event about, or null when it raises none. */
export function snapshotFor(
  card: Card,
  board: CloudBoard,
  atWork?: ReadonlySet<number>,
): EventSnapshot | null {
  const kind = actionableKind(card, board, atWork)
  if (!kind) return null
  const questions = kind === 'question' ? userQuestions(card) : []
  const snapshot: Omit<EventSnapshot, 'fingerprint'> = {
    boardId: board.id,
    boardName: board.name,
    taskId: card.id,
    taskTitle: card.title,
    release: card.release,
    revision: card.revision,
    kind,
    decision: decisionFor(kind),
    questions,
    summary: bound(openingParagraph(card.body), SUMMARY_LIMIT),
    notes: bound(reviewNotes(card.body), NOTES_LIMIT),
  }
  return { ...snapshot, fingerprint: fingerprint(snapshot) }
}

/** What a task at this revision, asking this, comes down to. Used to tell a refresh from a
 *  no-op: a card rewritten in a way an event cannot see is not news. */
function fingerprint(snapshot: Omit<EventSnapshot, 'fingerprint'>): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify([
        snapshot.revision,
        snapshot.kind,
        snapshot.taskTitle,
        snapshot.release,
        snapshot.questions,
        snapshot.summary,
        snapshot.notes,
      ]),
    )
    .digest('hex')
    .slice(0, 16)
}

// ---- the card's own words ----------------------------------------------------
// The two parts of a card a reviewer needs and a title cannot give: what it is for, and
// what was flagged about building it. Read off the body rather than from anything stored
// apart from it, so a card rewritten by hand reads the same way every other reader reads it.

/** Everything above the first `##` heading. The `<!-- agent -->` boundary is a marker
 *  rather than content, so it never travels. */
export function openingParagraph(body: string): string {
  const out: string[] = []
  for (const line of (body ?? '').split('\n')) {
    if (/^##(?!#)\s/.test(line)) break
    if (line.trim().startsWith('<!--')) continue
    out.push(line)
  }
  return out.join('\n').trim()
}

const NOTE_HEADINGS = [/^##\s+Worth noting\s*$/i, /^##\s+Worth noting after implementation\s*$/i]

/** `## Worth noting` and `## Worth noting after implementation`, headings kept, in the order
 *  the card writes them — a reader has to know which of the two they are reading. */
export function reviewNotes(body: string): string {
  const sections: string[][] = []
  let keeping: string[] | null = null
  for (const line of (body ?? '').split('\n')) {
    if (/^##(?!#)\s/.test(line)) {
      keeping = NOTE_HEADINGS.some((re) => re.test(line)) ? [line] : null
      if (keeping) sections.push(keeping)
      continue
    }
    // The `<!-- agent -->` boundary is a marker rather than content, and it sits inside
    // whichever section it happens to fall in.
    if (keeping && !line.trim().startsWith('<!--')) keeping.push(line)
  }
  return sections.map((section) => section.join('\n').trim()).join('\n\n')
}

/** Cut at the last boundary a reader would recognise — a blank line, or the line before a
 *  bullet — so what is carried ends where a person would have stopped. */
export function bound(text: string, limit: number): string {
  if (text.length <= limit) return text
  const head = text.slice(0, limit)
  const at = Math.max(head.lastIndexOf('\n\n'), head.lastIndexOf('\n- '), head.lastIndexOf('\n* '))
  return (at > limit / 3 ? head.slice(0, at) : head).trimEnd()
}
