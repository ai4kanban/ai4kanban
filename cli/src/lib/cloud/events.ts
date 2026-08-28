// What a Cloud event IS (#319) — the contract the desktop bell, the Worker and #320's
// Slack message all render one row from.
//
// The nine state names are fixed here because this card stores them first. A name invented
// in one surface would show the user two words for one outcome, so every surface reads
// these and none of them writes its own.
//
// Pure types and plain functions, no imports — so the board UI takes a copy
// (scripts/sync-format.mjs) and names the same shapes the command does.

/** The nine states an event moves through. In order of the life it has:
 *
 *   • `actionable`         waiting for a person
 *   • `accepted`           a person acted on THIS machine — the delivery follows
 *   • `waiting for server` a person acted somewhere else and the board's server has not
 *                          claimed it yet (#318 is the first to produce one)
 *   • `running`            the delivery is going
 *   • `completed` `failed` `interrupted` `cancelled`  how it ended
 *   • `stale`              its task stopped being one this board raises events for, and
 *                          nobody ever acted on it
 */
export const CLOUD_EVENT_STATES = [
  'actionable',
  'accepted',
  'waiting_for_server',
  'running',
  'completed',
  'failed',
  'stale',
  'cancelled',
  'interrupted',
] as const

export type CloudEventState = (typeof CLOUD_EVENT_STATES)[number]

/** The five a 30-day deletion applies to. An event still actionable, accepted, waiting for
 *  a server or running is live work and is kept however old it is. */
export const FINAL_EVENT_STATES: CloudEventState[] = [
  'completed',
  'failed',
  'stale',
  'cancelled',
  'interrupted',
]

export const isFinalEventState = (state: CloudEventState): boolean =>
  FINAL_EVENT_STATES.includes(state)

/** The two things a board raises an event about. A task that is both raises the question:
 *  answering it rewrites the card and moves its revision, so an approval granted first
 *  would bind a revision about to change. */
export type CloudEventKind = 'ready_for_review' | 'question'

/** What the event asks the person to decide. One per kind, named apart from the kind so a
 *  surface draws a button from the decision and a heading from the kind. */
export type CloudEventDecision = 'implement' | 'answer'

export const decisionFor = (kind: CloudEventKind): CloudEventDecision =>
  kind === 'question' ? 'answer' : 'implement'

/** One user-owned question, as an event carries it. The board's internal `[user]` tag is
 *  stripped before it gets here — Cloud never sees the board's own vocabulary. */
export interface CloudEventQuestion {
  /** The question, tag-free. */
  text: string
  /** Absent on a plain question the user answers in a box. */
  mode?: 'single' | 'multi'
  options?: string[]
  /** 1-based positions into `options` the board recommends. */
  recommend?: number[]
}

/** One answer to one of an event's questions. The board's own rule holds here too: a ticked
 *  option or the user's own words, never both, and neither is allowed — an unanswered
 *  question means the agent researches that one. */
export interface CloudEventAnswer {
  /** 1-based positions into that question's `options`. Empty when the user typed instead. */
  picked: number[]
  /** What the user typed. Empty when they ticked instead, or answered nothing. */
  text: string
}

/** An event as any surface draws it. Everything here came off the card; nothing else did. */
export interface CloudEvent {
  id: string
  /** The board's opaque Cloud ID. It means nothing outside Cloud — the mapping to a local
   *  path is held on the machine alone. */
  boardId: string
  /** What that board is called, so one bell can carry several. */
  boardName: string
  taskId: number
  taskTitle: string
  release: string
  /** The card revision this event binds. An action against a revision that has moved is
   *  refused. */
  revision: string
  kind: CloudEventKind
  decision: CloudEventDecision
  state: CloudEventState
  /** The questions the event carries. Empty on a ready-for-review event, which asks for the
   *  revision itself and carries no other part of the card. */
  questions: CloudEventQuestion[]
  createdAt: string
  /** The event's newest change, which is what the rail orders rows by. */
  changedAt: string
  /** An action is on record against this event, so no surface may offer a second. */
  acted: boolean
}

/** The row's second line, and the words a system notification says. One wording per event,
 *  because a second one is a second thing to keep true. */
export function eventLabel(event: Pick<CloudEvent, 'kind' | 'state'>): string {
  switch (event.state) {
    case 'actionable':
      return event.kind === 'question' ? 'Question waiting' : 'Ready for review'
    case 'accepted':
      return 'Accepted'
    case 'waiting_for_server':
      return 'Waiting for server'
    case 'running':
      return 'Delivery running'
    case 'completed':
      return 'Delivery completed'
    case 'failed':
      return 'Delivery failed'
    case 'cancelled':
      return 'Delivery cancelled'
    case 'interrupted':
      return 'Delivery interrupted'
    case 'stale':
      return 'No longer waiting'
  }
}

/** The four states no local mark has words for — what the card page's title band may show
 *  when nothing of the board's own already holds that slot. */
export const CARD_BAND_STATES: CloudEventState[] = [
  'actionable',
  'accepted',
  'waiting_for_server',
  'stale',
]

/** The band's one word for each of them. Short, because it takes the slot a status pill
 *  would hold. */
export function bandLabel(state: CloudEventState): string {
  switch (state) {
    case 'actionable':
      return 'Actionable'
    case 'accepted':
      return 'Accepted'
    case 'waiting_for_server':
      return 'Waiting for server'
    case 'stale':
      return 'No longer waiting'
    default:
      return ''
  }
}

/** How a delivery ended, as the second notification says it. `cancelled` is deliberately
 *  absent: only the user can cancel a delivery in this release, and interrupting somebody
 *  to report the thing they just did is an interruption this card refuses to charge them. */
export type CloudOutcome = 'completed' | 'failed' | 'interrupted'

export const OUTCOME_STATES: CloudOutcome[] = ['completed', 'failed', 'interrupted']

export function isOutcome(state: CloudEventState): state is CloudOutcome {
  return (OUTCOME_STATES as CloudEventState[]).includes(state)
}
