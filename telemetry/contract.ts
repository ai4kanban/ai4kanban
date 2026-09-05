/**
 * The one place a sender and the server agree: where a batch goes, what an event is called,
 * and which fields it may carry. The app and the command (#295), the board's own numbers
 * (#296), the site (#297) and this service all read this file rather than keeping a copy of
 * it — a field renamed on one side alone would lose a number silently.
 *
 * A name and a field listed here are stored. Anything else a sender puts in a batch is
 * dropped without a word back, so it is never retried. Deploy the service before shipping a
 * sender that emits a new name or a new field (see README.md).
 */

/** Where a batch is posted. A build made for development must use the development copy. */
export const ENDPOINT = {
  production: 'https://t.ai4kanban.dev/v1/batch',
  development: 'https://t-dev.ai4kanban.dev/v1/batch',
} as const

export type Copy = keyof typeof ENDPOINT

export const LIMITS = {
  /** A batch larger than this is refused unread. */
  batchBytes: 16 * 1024,
  /** Events in one batch. */
  batchEvents: 200,
  /** How old an event may be. Older is dropped rather than counted on the wrong day. */
  backfillDays: 7,
  /** How far a sender's clock may run ahead of the server's own date. One day covers every
   *  time zone, so only a wrong clock is refused. */
  aheadDays: 1,
  /** What one address may send in an hour, counted per hour and thrown away with it. */
  requestsPerHour: 600,
  /** Batches one app install may send in a day, at a time of day it picks for itself, so a
   *  release day arrives spread out rather than all at once. The server cannot check this —
   *  an install id is a value the sender makes up — so `requestsPerHour` is what it enforces
   *  and this is what #295's sender obeys. */
  appBatchesPerDay: 1,
  /** How long a raw event is kept. #293's privacy page states the same number. */
  retentionDays: 90,
} as const

/**
 * What a field may hold. A `token` has no spaces and is cut at 64 characters, a `count` is a
 * whole number, a `flag` is true or false, and an `id` is a random v4 UUID the sender made,
 * so no sentence fits in one. A token still allows `/` and `.`, because a page is
 * `/zh/download` — what keeps a card title, a file path, a repository name, a goal or an
 * email out is the fixed field list below, which names no field a sender writes text into.
 */
export type FieldKind = 'token' | 'count' | 'flag' | 'id'

export interface EventShape {
  /** `app` events carry an install id and an id of their own; `site` events carry neither. */
  from: 'app' | 'site'
  fields: Readonly<Record<string, FieldKind>>
}

/** What the app and the command put on every event they send. */
const APP = { surface: 'token', version: 'token' } as const

export const EVENTS = {
  /** The app or the command started (#295). `first_run` is what #400 counts real installs by. */
  app_open: { from: 'app', fields: { ...APP, os: 'token', arch: 'token', first_run: 'flag' } },
  /** Sent at most once a day, so returning use is counted without an event per click. */
  app_day: { from: 'app', fields: { ...APP } },
  run_started: { from: 'app', fields: { ...APP, harness: 'token' } },
  run_finished: { from: 'app', fields: { ...APP, harness: 'token' } },
  run_failed: { from: 'app', fields: { ...APP, harness: 'token' } },
  chat_message: { from: 'app', fields: { ...APP } },
  /** One board's own counts since its last report (#296). `board` says which board they came
   *  from and nothing about the project behind it. */
  board_numbers: {
    from: 'app',
    fields: {
      ...APP,
      board: 'id',
      cards_created: 'count',
      cards_created_asked: 'count',
      cards_created_proposed: 'count',
      cards_completed: 'count',
      cards_rejected: 'count',
      questions_closed: 'count',
      questions_closed_board: 'count',
      questions_closed_user: 'count',
      questions_closed_verify: 'count',
      decisions_stood: 'count',
      decisions_overruled: 'count',
      releases_closed: 'count',
    },
  },
  /** A page of the site was loaded (#297). No identifier, so it is never de-duplicated. */
  page_view: { from: 'site', fields: { page: 'token', language: 'token' } },
  /** A download button was pressed (#297). `place` is which button on the page, because
   *  `page` is the path and the landing page carries two of them. */
  download_press: {
    from: 'site',
    fields: {
      page: 'token',
      language: 'token',
      place: 'token',
      os: 'token',
      arch: 'token',
      version: 'token',
    },
  },
} as const satisfies Record<string, EventShape>

export type EventName = keyof typeof EVENTS

export const EVENT_NAMES = Object.keys(EVENTS) as EventName[]

/** Where an app event came from. A site event's surface is always `site`. */
export const SURFACES = ['app', 'command'] as const

/** A field value that is not a count or a flag. No spaces, so no sentence fits. */
export const TOKEN = /^[A-Za-z0-9._/-]{1,64}$/

/** The install id (#293) and a board's own id (#296): a random v4 UUID and nothing derived
 *  from the machine, so turning reporting off really does end it. */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** The calendar date an event happened, as the sending machine's own clock and time zone
 *  saw it — never the time the batch arrived. */
export const DAY = /^\d{4}-\d{2}-\d{2}$/

/** One event as a sender writes it. `id` is the sender's own id for it, on app events only:
 *  a batch that stored and then timed out is sent again, and the id is what stops the second
 *  copy being counted. */
export interface SentEvent {
  name: string
  day: string
  id?: string
  [field: string]: unknown
}

/** What a sender posts. `install` is present on an app batch and absent on a site batch. */
export interface SentBatch {
  v: number
  install?: string
  events: SentEvent[]
}

/** The contract's own version, sent as `v`. A batch that names another is refused. */
export const VERSION = 1
