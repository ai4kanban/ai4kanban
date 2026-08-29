// Where a delivery has got to, and what it is waiting for (#307).
//
// A delivery pauses in a few places, and every one of them is already written down
// somewhere else: the card's open questions, the delivery's own review and landing
// records, and its commit mode. So nothing here is stored — it is worked out on each
// read, and a state can never go stale against the thing it describes.
//
// One answer, read three ways: the card page's pill and the line under it, the sentence a
// refused board move gives, and the hold that lets Resolve through while a delivery waits.

import type { DeliveryRecord } from './types'

/** Where a delivery stands. Three of these are pauses: nothing moves until the user acts. */
export type DeliveryStage =
  /** Building, reviewing or correcting — the board's own work is in flight. */
  | 'working'
  /** Review stopped and put a question on the card (#302). */
  | 'stopped'
  /** Built and reviewed; landing waits until the card's open questions are answered. */
  | 'held'
  /** Built and reviewed; landing waits until the user approves the tree it would land
   *  (#308). Only on a board with **Require diff approval before landing** on. */
  | 'approval'
  /** Manual commit mode: review passed, and the commit is the user's to make. */
  | 'commit'
  /** Manual commit mode: they committed something else, so the whole candidate goes back
   *  through review before anything else happens. */
  | 'rereview'
  /** Reviewed and queued, and landing refused it — a dirty checkout, a target branch that
   *  is gone. The refusal already says what clears it, and the next pass tries again. */
  | 'refused'
  /** Its commit is on the target branch, and the board is completing the card. */
  | 'landed'

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
}

/** The fixed opening words landing writes on the two holds this file also words itself
 *  (`landing.ts`). They tell one hold from the other without a field of their own, and they
 *  are what keeps a stale `landing.why` from being read back as a refusal. */
export const HELD_ON_QUESTIONS = 'held on an open question'
export const HELD_ON_APPROVAL = 'held on your approval'

const count = (n: number): string => `${n} open question${n === 1 ? '' : 's'}`

const upper = (text: string): string => (text ? text[0]!.toUpperCase() + text.slice(1) : text)

// Landing's refusals are sentences in their own right, and some already end in one.
const end = (text: string): string => (/[.!?)]$/.test(text) ? text : `${text}.`)

const isHold = (why: string): boolean => why.startsWith(HELD_ON_QUESTIONS) || why.startsWith(HELD_ON_APPROVAL)

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
    }
  }
  const stopped = delivery.review?.stopped
  if (stopped) {
    return {
      stage: 'stopped',
      label: 'Waiting on you',
      line: questions
        ? `${upper(end(stopped.why))} Answer it on this card, then \`Review again\`.`
        : `${upper(end(stopped.why))} Resolve it, then \`Review again\`.`,
      paused: true,
    }
  }
  if (delivery.commitMode !== 'auto') {
    if (delivery.reviewed) {
      return {
        stage: 'commit',
        label: 'Waiting for your commit',
        line: 'Review passed — commit these changes yourself, and the delivery carries on.',
        paused: true,
      }
    }
    if (delivery.next === 'review' && delivery.review?.rounds.length) {
      return {
        stage: 'rereview',
        label: 'Code changed after review',
        line: 'Your commit is not the tree that was reviewed, so the whole candidate goes back through review.',
        paused: false,
      }
    }
  }
  // A delivery only holds at landing once it has one: review has passed it and it has
  // queued. Before that the questions are a warning the user already answered for.
  if (questions > 0 && landing) {
    return {
      stage: 'held',
      label: 'Held at landing',
      line: `Landing waits on this card's ${count(questions)} — answer ${questions === 1 ? 'it' : 'them'} and it carries on.`,
      paused: true,
    }
  }
  // Last of the holds, and read from the record rather than from git (#308): the approval
  // is dropped the moment landing finds it no longer covers the tree, so a delivery that
  // needs one and has none is exactly a delivery waiting on the user.
  if (landing && delivery.approval?.required && !delivery.approval.granted) {
    const again = delivery.approval.events.some((e) => e.kind === 'cancelled')
    return {
      stage: 'approval',
      label: 'Waiting for your approval',
      line:
        `Landing waits for your approval — read the tree on \`Diff\`, then \`Approve this tree\`.` +
        (again ? ` The tree moved, so the last approval was cancelled.` : ''),
      paused: true,
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
    return {
      stage: 'refused',
      label: "Can't land yet",
      line: upper(end(landing.why)),
      paused: true,
    }
  }
  const where = delivery.commitMode === 'auto' && delivery.targetBranch ? `, to land on \`${delivery.targetBranch}\`` : ''
  return {
    stage: 'working',
    label: 'In progress',
    line: `Building this card as it was approved when work started${where}.`,
    paused: false,
  }
}
