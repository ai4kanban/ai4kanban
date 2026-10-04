// Where a delivery has got to, and what it is waiting for (#307).
//
// A delivery pauses in a few places, and every one of them is already written down
// somewhere else: the card's open questions, the delivery's own stop and landing records,
// and its commit mode. So nothing here is stored — it is worked out on each
// read, and a state can never go stale against the thing it describes.
//
// One answer, read three ways: the card page's pill and the line under it, the sentence a
// refused board move gives, and the hold that lets Resolve through while a delivery waits.

import { boardCommand } from './command'
import type { DeliveryRecord } from './types'

/** Where a delivery stands. Three of these are pauses: nothing moves until the user acts. */
export type DeliveryStage =
  /** Building — the board's own work is in flight. */
  | 'working'
  /** The delivery stopped on something only the user can clear: work nobody could commit,
   *  files outside the board, or a question a review asked before #1203. */
  | 'stopped'
  /** Built; landing waits until the card's open questions are answered. */
  | 'held'
  /** Manual commit mode: the delivery's own work is finished, and the commit is the user's
   *  to make. */
  | 'commit'
  /** Queued, and landing refused it — a dirty checkout, a target branch that
   *  is gone. The refusal already says what clears it, and the next pass tries again. */
  | 'refused'
  /** An agent is resolving a conflict with the target branch, in the delivery's own
   *  worktree (#595). Nothing is asked of the user. */
  | 'conflict'
  /** The board is waiting before the next landing attempt — a `conflict` run that could not
   *  resolve it (#595), or a target branch that moved under the landing (#665). It holds no
   *  landing slot while it waits, so another delivery lands. */
  | 'retry'
  /** Queued behind the card that holds the landing slot. Nothing is asked of
   *  the user: it moves the moment the one in front of it lands. */
  | 'queued'
  /** Its commit is on the target branch, and the board is completing the card. */
  | 'landed'

/** Which sentence `line` is (#1377). A screen words each in its own language; the kinds
 *  that end in git's or the system's own words carry them in `raw`. */
export type DeliveryLineKind =
  | 'landed'
  | 'landed-nothing'
  | 'uncommitted'
  | 'stopped'
  | 'commit'
  | 'questions'
  | 'conflict-wait'
  | 'conflict'
  | 'target-moved'
  | 'queued'
  | 'worktree-gone'
  | 'no-base'
  | 'target-gone'
  | 'worktree-dirty'
  | 'interrupted'
  | 'refused'
  | 'building'
  | 'building-typed'

/** One delivery's state, as every screen and every refusal words it. */
export interface DeliveryState {
  stage: DeliveryStage
  /** The pill beside the card's title. */
  label: string
  /** The line under it: what the delivery waits on, and what answers it. One short sentence
   *  or two. Files, branches, commits and controls are wrapped in backticks — the card page
   *  draws those as marks, and the terminal has always spelled a command that way. Nothing
   *  else is markdown: the rest is drawn as plain text wherever it is shown. */
  line: string
  /** True while it waits on the user. There is nothing to press — what continues it is the
   *  answer, the commit, or the resolve. */
  paused: boolean
  /** Which sentence `line` is, with the values it names below (#1377). `label` and `line`
   *  stay the terminal's English. Absent when the record does not say which — a stop or a
   *  queue written before the kind was kept — and the screen shows `line` as it is. */
  kind?: DeliveryLineKind
  /** The target branch, where the sentence names one. */
  branch?: string
  /** The landed commit, short. */
  commit?: string
  questions?: number
  /** Conflicted files, or the ones a worktree still holds. */
  files?: string[]
  /** The landing attempt running, or the one the wait opens. */
  attempt?: number
  /** Seconds until that attempt, as of this read. */
  retryIn?: number
  /** What holds the landing slot, as the queue names it. */
  behind?: string
  worktree?: string
  /** The command that is the way out, spelled for this board. */
  command?: string
  /** The reason in git's or the system's own words — never translated. */
  raw?: string
}

/** The fixed opening words landing writes on the question hold (`landing.ts`). They are
 *  what keeps a stale `landing.why` from being read back as a refusal. */
export const HELD_ON_QUESTIONS = 'held on an open question'

/** The fixed opening words on a delivery queued behind the one holding the landing slot.
 *  Same trick as the one above: it tells a wait from a refusal without a field of its own,
 *  which is what keeps a queued card from wearing the refusal of an earlier pass. */
export const IN_LINE = 'in line behind'

const count = (n: number): string => `${n} open question${n === 1 ? '' : 's'}`

// The conflicted files, the way landing names them: one is worth naming, more are counted.
const some = (files: string[]): string => (files.length === 1 ? `\`${files[0]}\`` : `${files.length} files`)

const upper = (text: string): string => (text ? text[0]!.toUpperCase() + text.slice(1) : text)

// Landing's refusals are sentences in their own right, and some already end in one.
const end = (text: string): string => (/[.!?)]$/.test(text) ? text : `${text}.`)

const isHold = (why: string): boolean => why.startsWith(HELD_ON_QUESTIONS)

// The command that ends a stopped build with no card (#428). A carded delivery says the card
// page's controls instead; this one has no page to say them on.
const cancelCommand = (delivery: DeliveryRecord): string => `${boardCommand()} delivery cancel ${delivery.deliveryId}`

const backInMotion = (delivery: DeliveryRecord): string => `\`${cancelCommand(delivery)}\` ends it and leaves the branch.`

/** Where this delivery stands, given how many open questions its card carries.
 *
 *  The questions are passed in rather than read here: this file is asked from inside the
 *  record's lock as well as from a card read, and reading a card file is the caller's job. */
export function deliveryState(delivery: DeliveryRecord, questions: number): DeliveryState {
  const landing = delivery.landing
  if (landing?.status === 'landed') {
    const commit = landing.commit?.slice(0, 7)
    const where = delivery.targetBranch ?? 'your branch'
    return {
      stage: 'landed',
      label: commit ? `Landed as ${commit}` : 'Landed — nothing to commit',
      line: commit
        ? `On \`${where}\` as \`${commit}\`. The board is completing the card.`
        : `It changed nothing, so nothing was committed. The board is completing the card.`,
      paused: false,
      kind: commit ? 'landed' : 'landed-nothing',
      branch: delivery.targetBranch,
      commit,
    }
  }
  const stopped = delivery.review?.stopped
  if (stopped) {
    return {
      stage: 'stopped',
      label: 'Waiting on you',
      // With no card there is no page to build again from, so the line names the command
      // that is the way out (#428).
      line: delivery.cardId === null
        ? `${upper(end(stopped.why))} ${backInMotion(delivery)}`
        : `${upper(end(stopped.why))} Fix it, then \`Build again\`.`,
      paused: true,
      kind: stopped.reason === 'uncommitted' ? 'uncommitted' : 'stopped',
      command: delivery.cardId === null ? cancelCommand(delivery) : undefined,
      raw: upper(end(stopped.why)),
    }
  }
  if (delivery.commitMode !== 'auto' && delivery.commitMode !== 'files') {
    if (delivery.reviewed) {
      return {
        stage: 'commit',
        label: 'Waiting for your commit',
        line: 'The build is done — commit these changes yourself, and the delivery carries on.',
        paused: true,
        kind: 'commit',
      }
    }
  }
  // A delivery only holds at landing once it has one: the build is done and it has queued.
  // Before that the questions are a warning the user already answered for.
  if (questions > 0 && landing) {
    return {
      stage: 'held',
      label: 'Held at landing',
      line: `Landing waits on this card's ${count(questions)} — answer ${questions === 1 ? 'it' : 'them'} and it carries on.`,
      paused: true,
      kind: 'questions',
      questions,
    }
  }
  // The board resolving a landing conflict by itself (#595) — the run working on it, and
  // the wait between one that failed and the next. Neither is a pause: the retries are
  // unbounded, so there is nothing for the user to answer and nothing to press. Before the
  // queue and the refusal below, both of which would otherwise claim these `why`s.
  if (landing?.conflictFiles?.length) {
    const files = landing.conflictFiles
    const attempt = (landing.conflictFails ?? 0) + 1
    const where = `${some(files)} against \`${delivery.targetBranch ?? 'the target branch'}\``
    if (landing.status === 'waiting' && landing.conflictAt) {
      const left = Math.max(0, Math.round((landing.conflictAt - Date.now()) / 1_000))
      return {
        stage: 'retry',
        label: 'Waiting to retry',
        line:
          `Attempt ${attempt - 1} left ${where} conflicted. It gave the landing slot up and opens attempt ` +
          `${attempt} ${left ? `in ${left}s` : 'now'} — another delivery can land while it waits.`,
        paused: false,
        kind: 'conflict-wait',
        files,
        branch: delivery.targetBranch,
        attempt,
        retryIn: left,
      }
    }
    if (landing.status === 'landing') {
      return {
        stage: 'conflict',
        label: 'Resolving a conflict',
        line: `Attempt ${attempt}: resolving ${where}. It lands by itself once the conflict is out — nothing is asked of you.`,
        paused: false,
        kind: 'conflict',
        files,
        branch: delivery.targetBranch,
        attempt,
      }
    }
  }
  // The target branch moved under a landing (#665). The board gave its slot up and replays
  // onto the new tip by itself, without limit and without asking — so this is not a pause
  // either. Before the queue and the refusal below, both of which would claim this `why`.
  if (landing?.status === 'waiting' && landing.retryAt) {
    const left = Math.max(0, Math.round((landing.retryAt - Date.now()) / 1_000))
    const attempt = landing.attempts + 1
    return {
      stage: 'retry',
      label: 'Waiting to retry',
      line:
        `${delivery.targetBranch ? `\`${delivery.targetBranch}\`` : 'The target branch'} moved on while this was landing. ` +
        `It gave the landing slot up and starts attempt ${attempt} ${left ? `in ${left}s` : 'now'} — ` +
        `another delivery can land while it waits.`,
      paused: false,
      kind: 'target-moved',
      branch: delivery.targetBranch,
      attempt,
      retryIn: left,
    }
  }
  // Queued behind whichever card holds the landing slot. Before the refusal below, because
  // a waiter the queue never reached still carries the `why` of the last pass that did look
  // at it — and that one asks the user for something the queue is not waiting on.
  if (landing?.status === 'waiting' && landing.why?.startsWith(IN_LINE)) {
    const behind = landing.reason?.kind === 'queued' ? landing.reason.behind : undefined
    return {
      stage: 'queued',
      label: 'In line to land',
      line: upper(end(landing.why)),
      paused: false,
      ...(behind ? { kind: 'queued' as const, behind } : {}),
    }
  }
  // Landing looked at it and put it back, saying why (`landing.ts`). That sentence names
  // the one thing that clears it, so it is the state — without this the delivery falls
  // through to "In progress" and the page shows a build that nothing is building.
  //
  // The two holds above are left out: they are worded there, and their `why` outlives the
  // hold until the next pass clears it — a question answered a second ago would otherwise
  // read back here as a refusal.
  if (landing?.status === 'waiting' && landing.why && !isHold(landing.why)) {
    const line = upper(end(landing.why))
    const reason = landing.reason?.kind === 'queued' ? undefined : landing.reason
    return {
      stage: 'refused',
      label: "Can't land yet",
      line,
      paused: true,
      ...(reason
        ? { kind: reason.kind, files: reason.files, branch: delivery.targetBranch, worktree: delivery.worktree }
        : { kind: 'refused' as const, raw: line }),
    }
  }
  const branch = delivery.commitMode === 'auto' ? delivery.targetBranch : undefined
  const where = branch ? `, to land on \`${branch}\`` : ''
  return {
    stage: 'working',
    label: 'In progress',
    // A build with no card has no card to have been approved: what it is building is the
    // sentence it was given, which cannot move under it (#428).
    line:
      delivery.cardId === null
        ? `Building what you typed${where}.`
        : `Building this card as it was approved when work started${where}.`,
    paused: false,
    kind: delivery.cardId === null ? 'building-typed' : 'building',
    branch,
  }
}
