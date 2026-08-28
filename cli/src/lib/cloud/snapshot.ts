// Which tasks a board raises an event about, and what that event carries (#319).
//
// Two rules and one filter, in one place, so the publisher, the reconciliation at start and
// the retirement test are the same judgment rather than three that agree until they don't:
//
//   • a task the board's watch covers — every card, or one release's, and
//   • either at `ready`, or carrying questions only the user can answer.
//
// Narrowed to one release, a task in another — or promised to none — is not what the user
// asked to be told about. A task that is BOTH `ready` and asking raises the question:
// answering it rewrites the card and moves its revision, so an approval granted first would
// bind a revision about to change.

import crypto from 'node:crypto'

import { parseQuestion } from '../view/rules'
import type { Card } from '../view/types'
import { ALL_RELEASES, type CloudBoard } from './boards'
import { decisionFor, type CloudEventKind, type CloudEventQuestion } from './events'

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

/** Is this a card the board raises an event about right now? */
export function actionableKind(card: Card, board: CloudBoard): CloudEventKind | null {
  if (!board.release) return null
  if (board.release !== ALL_RELEASES && card.release !== board.release) return null
  if (card.recurring) return null
  if (userQuestions(card).length > 0) return 'question'
  return card.status === 'ready' ? 'ready_for_review' : null
}

/** The snapshot for a card the board raises an event about, or null when it raises none. */
export function snapshotFor(card: Card, board: CloudBoard): EventSnapshot | null {
  const kind = actionableKind(card, board)
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
      ]),
    )
    .digest('hex')
    .slice(0, 16)
}
