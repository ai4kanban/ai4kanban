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
export type DeliveryStage = 'working' | 'stopped' | 'held' | 'landed'
export type DeliveryLineKind = 'landed' | 'landed-nothing' | 'uncommitted' | 'stopped' | 'questions' | 'building' | 'building-typed'

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

const count = (n: number): string => `${n} open question${n === 1 ? '' : 's'}`

const upper = (text: string): string => (text ? text[0]!.toUpperCase() + text.slice(1) : text)

// Landing's refusals are sentences in their own right, and some already end in one.
const end = (text: string): string => (/[.!?)]$/.test(text) ? text : `${text}.`)


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
  if (questions > 0) return {
    stage: 'held', label: 'Waiting for answers', line: `${count(questions)} must be answered before completion.`,
    paused: true, kind: 'questions', questions,
  }
  const branch = delivery.targetBranch
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
