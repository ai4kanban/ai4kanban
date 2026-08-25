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
  /** Its commit is on the target branch, and the board is completing the card. */
  | 'landed'

/** One delivery's state, as every screen and every refusal words it. */
export interface DeliveryState {
  stage: DeliveryStage
  /** The pill beside the card's title. */
  label: string
  /** The line under it: what the delivery waits on, and what answers it. */
  line: string
  /** True while it waits on the user. There is nothing to press — what continues it is the
   *  answer, the commit, or the resolve. */
  paused: boolean
}

const count = (n: number): string => `${n} open question${n === 1 ? '' : 's'}`

const upper = (text: string): string => (text ? text[0]!.toUpperCase() + text.slice(1) : text)

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
        ? `On ${where} as ${commit}. The board is completing the card, which takes it off the board.`
        : `It passed review having changed nothing, so nothing was committed. The board is completing the card, which takes it off the board.`,
      paused: false,
    }
  }
  const stopped = delivery.review?.stopped
  if (stopped) {
    return {
      stage: 'stopped',
      label: 'Waiting on you',
      line: `${upper(stopped.why)}. Answer the question it left on this card, then Review again judges the same work.`,
      paused: true,
    }
  }
  if (delivery.commitMode !== 'auto') {
    if (delivery.reviewed) {
      return {
        stage: 'commit',
        label: 'Waiting for your commit',
        line: 'Review passed. Commit these changes in your editor or terminal, then return here — the delivery carries on by itself.',
        paused: true,
      }
    }
    if (delivery.next === 'review' && delivery.review?.rounds.length) {
      return {
        stage: 'rereview',
        label: 'Code changed after review',
        line: 'Your commit is not the tree that was reviewed, so the whole candidate is being reviewed again before anything else happens.',
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
      line:
        `Built and reviewed. It holds outside the landing queue until this card's ${count(questions)} ` +
        `${questions === 1 ? 'is' : 'are'} answered — answering carries this same delivery on, with no second click.`,
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
      // Plain words: this line is drawn as text wherever it is shown, so markdown in it
      // reads as asterisks.
      line:
        `Built and reviewed. It holds outside the landing queue until you approve the tree it would land — ` +
        `read it on the Diff tab, then Approve this tree.` +
        (again ? ` The tree moved after the last approval, so that one was cancelled.` : ''),
      paused: true,
    }
  }
  const where = delivery.commitMode === 'auto' && delivery.targetBranch ? `, to land on ${delivery.targetBranch}` : ''
  return {
    stage: 'working',
    label: 'In progress',
    line: `Building this card as it was approved when work started${where}.`,
    paused: false,
  }
}
