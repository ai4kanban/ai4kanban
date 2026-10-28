/**
 * What the command sends to the telemetry service (t.ai4kanban.dev, its source on the
 * `legacy` branch): where a batch goes, what an event is called, and which fields it may
 * carry. A name or field the service does not list is dropped silently.
 */

/** Where a batch is posted. A build made for development must use the development copy. */
export const ENDPOINT = {
  production: 'https://t.ai4kanban.dev/v1/batch',
  development: 'https://t-dev.ai4kanban.dev/v1/batch',
} as const

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
  /** The first day the archive holds — the day #489 published the archive and its indefinite
   *  limit on #293's privacy page. A day before it was taken under wording that promised
   *  deletion, so the sweep takes it unwritten. */
  archiveFrom: '2026-09-08',
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

const RUN_END = { harness: 'token', custom_agent: 'flag', model: 'token', cost_micros: 'count' } as const

export const EVENTS = {
  /** The app or the command started (#295). `first_run` is what #400 counts real installs by. */
  app_open: { from: 'app', fields: { ...APP, os: 'token', arch: 'token', first_run: 'flag' } },
  /** Sent at most once a day, so returning use is counted without an event per click. */
  app_day: { from: 'app', fields: { ...APP } },
  /** `custom_agent`: the run was by an agent the project added, not one the board ships. */
  run_started: { from: 'app', fields: { ...APP, harness: 'token', custom_agent: 'flag' } },
  /** `model` is a public model's name, or `custom` (#1474). `cost_micros` is the run's
   *  estimated cost in millionths of a US dollar, sent only when the agent gave one. */
  run_finished: { from: 'app', fields: { ...APP, ...RUN_END } },
  run_failed: { from: 'app', fields: { ...APP, ...RUN_END } },
  /** Sent once the reply has ended (#1495), with the model and cost of that one turn. */
  chat_message: { from: 'app', fields: { ...APP, model: 'token', cost_micros: 'count' } },
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
      /** How many of the project's own agents are switched on right now — a level, not a
       *  count since the last report. */
      custom_agents_on: 'count',
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

/** A field value that is not a count or a flag. No spaces, so no sentence fits. */
export const TOKEN = /^[A-Za-z0-9._/-]{1,64}$/

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
