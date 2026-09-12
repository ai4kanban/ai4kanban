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

/**
 * Where a piece of feedback is posted (#603). Its own route on the same service, never
 * `/v1/batch`: a batch stores no free text at all, and the two are kept apart the whole way
 * down — own tables, own size limit, own retention, and out of the daily archive.
 */
export const FEEDBACK_ENDPOINT = {
  production: 'https://t.ai4kanban.dev/v1/feedback',
  development: 'https://t-dev.ai4kanban.dev/v1/feedback',
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
  /** One posted piece of feedback (#603), body and attachments together. Far larger than a
   *  batch, because a conversation on its own is 10-20 kB — and still small enough that one
   *  submission is a handful of D1 rows. */
  feedbackBytes: 1024 * 1024,
  /** What one attachment may carry. The sender cuts a longer one off rather than dropping
   *  it, and says in the preview that it did. */
  feedbackPartBytes: 256 * 1024,
  /** Characters of the feedback the user actually wrote. */
  feedbackTextChars: 4_000,
  /** One posted case (#628), traces and project files together. Far larger than a piece of
   *  feedback, because one refine's raw traces alone run to megabytes — and a whole number
   *  of them, because the refusal is the WHOLE pack: nothing here is truncated behind the
   *  user's back, and a pack over this is answered 413 with the question description still
   *  offered on its own. */
  caseBytes: 24 * 1024 * 1024,
  /** What one collected project file may carry. A file longer than this is left out and
   *  named as a gap rather than sent as a half of itself. */
  caseFileBytes: 512 * 1024,
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

// ---- feedback (#603) --------------------------------------------------------
//
// The one thing this service takes that a person wrote. It is not an event and shares
// nothing with the tables above: the body is kept indefinitely, its attachments are swept
// on the same 90 days a raw event gets, and neither is written into the daily archive.

/** What a diagnostic attachment holds. The four are listed on screen with their sizes
 *  before anything is sent, each one previewable and each one removable on its own. */
export const FEEDBACK_PARTS = ['card', 'chat', 'trace', 'environment'] as const

export type FeedbackPart = (typeof FEEDBACK_PARTS)[number]

/** Where the feedback was written. `task` is the block on New task; `board` is the Feedback
 *  button, which takes feedback about anything at all. */
export const FEEDBACK_SOURCES = ['task', 'board'] as const

export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number]

/** One attachment, as the sender posts it. */
export interface SentFeedbackPart {
  part: string
  text: string
}

/**
 * One piece of feedback, as a sender posts it.
 *
 * `install` is this machine's EXISTING id and is absent when usage reporting is off — the
 * sender never makes one to send feedback. `card` is the archived card the feedback is
 * about, as its number on that board, and is absent when none was linked.
 */
export interface SentFeedback {
  v: number
  install?: string
  id: string
  day: string
  source: string
  surface: string
  version: string
  card?: number
  text: string
  parts?: SentFeedbackPart[]
}

// ---- a partner's refine case (#628) -----------------------------------------
//
// The third thing this service takes, and the only one that carries project files. A piece
// of feedback is a sentence and four small attachments; a case is everything needed to
// REPRODUCE one refine going wrong — the raw traces of that refine's runs and the project
// files those runs read. It shares nothing with the two above: its own route, its own size
// limit, its own private bucket, and its own deletion key.
//
// The key is the SUBMISSION id, not an install id. A machine with usage reporting off still
// gets one, so the deletion request works from any machine — and the same id posted twice is
// the same object, which is what makes a retry safe.

/** Where one case is posted. Its own route, never `/v1/feedback`: that one is a handful of
 *  D1 rows and this is an object in a bucket nothing else writes. */
export const CASE_ENDPOINT = {
  production: 'https://t.ai4kanban.dev/v1/case',
  development: 'https://t-dev.ai4kanban.dev/v1/case',
} as const

/** The one address a deletion request goes to. Written on the consent page and beside every
 *  submitted id, and nowhere is a second one offered. */
export const CASE_EMAIL = 'support@ai4kanban.dev'

/** A submission id as the sender mints it and the user reads it back: `fb_` and eight
 *  characters of an alphabet with no pair anyone misreads. It is the delete key, so it has
 *  to survive being copied out of a screen and typed into an email. */
export const CASE_ID = /^fb_[0-9abcdefghjkmnpqrstvwxyz]{8}$/

/** The alphabet that id is drawn from: the digits and the letters, less `i`, `l`, `o` and
 *  `u` — the four nobody reads back off a screen reliably. Thirty-two, so one character is
 *  five bits and an id is forty. */
export const CASE_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'

/** One run of the refine the case is about, as the sender posts it. `trace` is the agent's
 *  own raw transcript of that run, which is the only place the prompt it was given survives
 *  — the board deletes a run's prompt file when the run ends. */
export interface SentCaseRun {
  action: string
  startedAt: number
  harness: string
  runtime?: string
  sessionId: string
  resumeId?: string
  cwd?: string
  argv?: string[]
  /** The akb version the run went on, recorded when it started. Absent on a run older than
   *  that record, which the pack then names as a gap. */
  version?: string
  /** What the user typed for it, as the run recorded it. */
  input?: string
  /** The raw trace, as the agent read it back off that harness's own store. */
  trace?: string
}

/** One project file the refine read, collected after the agent named it. */
export interface SentCaseFile {
  path: string
  bytes: number
  text: string
  /** `read` is the version the refine saw; `current` is this checkout's copy standing in for
   *  it, and `missing` is a file that is no longer there. Marked rather than passed off. */
  version: 'read' | 'current' | 'missing'
  /** Why the agent says this file was read — the line of the trace it found it on. */
  evidence?: string
}

/** One case, as a sender posts it. `install` is absent throughout: the submission id is the
 *  key, so a machine with usage reporting off is not a machine we cannot delete for. */
export interface SentCase {
  v: number
  id: string
  day: string
  submittedAt: string
  surface: string
  version: string
  /** The card the user linked, by its number on their board. */
  card: number
  /** The refine the agent settled on, by the board's own flow id. */
  flowId?: string
  /** What the user wrote in the discussion. */
  text: string
  /** The agent's reading of where the spec and the user's expectation came apart. */
  analysis?: string
  /** Everything the pack could not establish — a trace that is gone, a read it could not
   *  confirm, a run with no version recorded. Never silently dropped. */
  gaps?: string[]
  runs?: SentCaseRun[]
  files?: SentCaseFile[]
}
