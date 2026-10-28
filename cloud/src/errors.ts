import { SUPPORT_EMAIL } from './config.ts'

/**
 * Every refusal the service can return. A client matches on `code`; `message` is written
 * to be shown to a user as it stands.
 */
export type RefusalCode =
  | 'bad_request'
  | 'unauthenticated'
  | 'not_admitted'
  | 'no_verified_address'
  | 'not_yours'
  | 'owner_only'
  | 'last_owner'
  | 'stale_revision'
  | 'operation_reused'
  | 'already_acted'
  | 'server_elsewhere'
  | 'runner_elsewhere'
  | 'runner_outdated'
  | 'folder_taken'
  | 'slack_unavailable'
  | 'slack_not_connected'
  | 'lark_unavailable'
  | 'lark_not_connected'
  | 'training_slot_taken'
  | 'training_too_many_attempts'
  | 'contact_too_many_attempts'
  | 'speech_unavailable'
  | 'speech_failed'
  | 'image_unavailable'
  | 'image_failed'
  | 'music_unavailable'
  | 'music_failed'
  | 'judge_unavailable'
  | 'judge_failed'
  | 'pro_required'
  | 'template_exists'
  | 'templates_unavailable'
  | 'credits_used_up'
  | 'trial_used'
  | 'billing_unavailable'
  | 'billing_failed'
  | 'conflict'
  | 'version_conflict'
  | 'read_only'
  | 'payload_too_large'
  | 'idempotency_key_reused'
  | 'idempotency_in_progress'
  | 'artifacts_unavailable'
  | 'session_required'
  | 'review_outdated'
  | 'card_missing'
  | 'task_running'
  | 'link_invalid'
  | 'link_expired'
  | 'link_revoked'
  | 'sign_in_required'
  | 'not_invited'
  | 'view_only'
  | 'chat_busy'
  | 'runner_offline'
  | 'runner_removed'
  | 'machine_offline'
  | 'commit_gone'
  | 'runtime_unavailable'
  | 'not_found'
  | 'method_not_allowed'
  | 'daily_write_budget_reached'
  | 'storage_limit_reached'
  | 'quota_exceeded'
  | 'service_unavailable'

export class Refusal extends Error {
  readonly code: RefusalCode
  readonly status: number
  /** Seconds a client should wait before retrying, when there is a useful answer. */
  readonly retryAfterSeconds?: number
  /** Which plan quota a `quota_exceeded` hit, and its limit (#2017). */
  quota?: Quota
  limit?: number
  /** The project already holding a folder, on `folder_taken` (#2022). */
  project?: string
  /** The connector and why it cannot run, on `runtime_unavailable` (#2083). */
  connector?: string
  reason?: string

  constructor(
    code: RefusalCode,
    status: number,
    message: string,
    retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'Refusal'
    this.code = code
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export const badRequest = (message: string) => new Refusal('bad_request', 400, message)

export const unauthenticated = (message = 'Sign in to reach this workspace.') =>
  new Refusal('unauthenticated', 401, message)

/**
 * Signed in, and not in the preview. Its own code, so a client never answers it with
 * "sign in again" — signing in again lands on the same refusal. The message is the whole of
 * what a refused person is given, so it names the one way in (#350) and no position on any
 * screen: a terminal reads the same sentence.
 */
export const notAdmitted = () =>
  new Refusal(
    'not_admitted',
    403,
    'WildCrane Cloud is an invite-only preview and this account is not in it yet. ' +
      'Ask us for an invite and we will email you when you are in.',
  )

/** Asking for an invite types nothing, so an account the provider attests no address for
 *  leaves us nowhere to answer. */
export const noVerifiedAddress = () =>
  new Refusal(
    'no_verified_address',
    403,
    'GitHub returned no verified email address for this account, so there is nowhere to ' +
      'answer you. Write to support@ai4kanban.dev.',
  )

/** The request named a row belonging to another account. Whatever the row is. */
export const notYours = () =>
  new Refusal('not_yours', 403, 'That belongs to another account.')

/** In the workspace, without the role the move needs. */
export const ownerOnly = (message?: string) =>
  new Refusal('owner_only', 403, message || 'An owner of this workspace has to do that.')

/** The change would leave the workspace with no owner. */
export const lastOwner = (message?: string) =>
  new Refusal(
    'last_owner',
    409,
    message || 'A workspace always keeps an owner. Make somebody else an owner first.',
  )

/**
 * The two an action on a Cloud event can be refused with (#319), each with its own code
 * because they ask the reader for different things: look again, or stop pressing.
 *
 * Cloud may reject a revision it already knows is stale; the local check is still the final
 * one, so this is an optimisation rather than the guarantee.
 */
export const staleRevision = () =>
  new Refusal(
    'stale_revision',
    409,
    'That task has changed since this was asked. Open the card and look again.',
  )

/** Exactly one durable action per event, whichever surface took it. */
export const alreadyActed = () =>
  new Refusal('already_acted', 409, 'That event has already been answered.')

/**
 * A board attaches exactly one server (#318), and another machine already holds this one.
 *
 * The database's own sentence is carried through rather than replaced, because it names the
 * machine — a refusal that said only "another machine" would leave the user with nothing to
 * act on, and the move that takes the board over is the whole point of naming it.
 */
export const serverElsewhere = (message?: string) =>
  new Refusal(
    'server_elsewhere',
    409,
    message || 'This board already runs its work on another machine.',
  )

/** The account's Runner is connected on another computer (#2001). The database's sentence
 *  names it. */
export const runnerElsewhere = (message?: string) =>
  new Refusal(
    'runner_elsewhere',
    409,
    message || 'Your WildCrane Runner is already connected on another computer.',
  )

/** The folder already belongs to another project on this computer. */
export function folderTaken(project: string): Refusal {
  const refusal = new Refusal('folder_taken', 409, `That folder already belongs to ${project}.`)
  refusal.project = project
  return refusal
}

/** A chat's connector is not installed or signed out on the computer running the task. */
export function runtimeUnavailable(connector: string, reason: string): Refusal {
  const refusal = new Refusal('runtime_unavailable', 409, `${connector} is not ready on the computer running this task.`)
  refusal.connector = connector
  refusal.reason = reason
  return refusal
}

/** The Runner speaks a protocol older than this service takes. A restart updates it. */
export const runnerOutdated = () =>
  new Refusal('runner_outdated', 426, 'This WildCrane Runner is out of date. Restart it to update.')

/**
 * The two Slack refusals a pane acts on (#320), each with its own code because they ask the
 * reader for different things: use a build that carries the app, or connect one.
 */
export const slackUnavailable = () =>
  new Refusal(
    'slack_unavailable',
    503,
    'This WildCrane Cloud service carries no Slack app to connect to.',
  )

export const slackNotConnected = () =>
  new Refusal(
    'slack_not_connected',
    404,
    'This account has no Slack connection. Connect one in Configuration → Notifications.',
  )

/**
 * The two Lark refusals a pane acts on (#351), matching Slack's: use a build that carries the
 * app for that cloud, or connect one. The third state a store app has — the app is listed and
 * the person's own tenant has not installed it — is not a refusal: the pane says so beside
 * Connect, before an authorization that cannot finish is ever started.
 */
export const larkUnavailable = (cloud: string) =>
  new Refusal(
    'lark_unavailable',
    503,
    `This WildCrane Cloud service carries no ${cloud} app to connect to.`,
  )

export const larkNotConnected = () =>
  new Refusal(
    'lark_not_connected',
    404,
    'This account has no Lark connection. Connect one in Configuration → Notifications.',
  )

/** One operation id, two different changes. #312 mints one per attempt, so this is a client
 *  reusing an id rather than retrying — answering it with the first result would report work
 *  that never happened. */
export const operationReused = () =>
  new Refusal(
    'operation_reused',
    409,
    'That change was already recorded under this attempt. Make it again as a new one.',
  )

/**
 * Somebody else took the hour while this visitor was filling the form (#683). Its own code,
 * because it is the one refusal on that page that is not a failure: the answer is to pick
 * another hour, and what was typed is kept.
 */
export const trainingSlotTaken = () =>
  new Refusal(
    'training_slot_taken',
    409,
    'That hour was just booked by someone else. Pick another one — what you typed is kept.',
  )

/** Too many submits from one caller in a row. Deliberately vague about the limit. */
export const trainingTooManyAttempts = () =>
  new Refusal(
    'training_too_many_attempts',
    429,
    'Too many booking attempts from here. Wait a few minutes and try again.',
    TRAINING_RETRY_AFTER_SECONDS,
  )

/** Too many contact submits from one address or for one email (#784). Its own code, so the
 *  page can offer the support address instead. */
export const contactTooManyAttempts = () =>
  new Refusal(
    'contact_too_many_attempts',
    429,
    `Too many messages from here. Try again later, or email us at ${SUPPORT_EMAIL}.`,
    CONTACT_RETRY_AFTER_SECONDS,
  )

/** Hosted narration (#1054): this build carries no key for it, or the provider failed. The
 *  voice script never falls back to another voice on either. */
export const speechUnavailable = () =>
  new Refusal('speech_unavailable', 503, 'Hosted voices are not available right now.')

export const speechFailed = () =>
  new Refusal('speech_failed', 502, 'The narration could not be generated. Try again shortly.')

/** Image generation (#1114): no key in this build, or the provider failed. */
export const imageUnavailable = () =>
  new Refusal('image_unavailable', 503, 'Image generation is not available right now.')

export const imageFailed = () =>
  new Refusal('image_failed', 502, 'The image could not be generated. Try again shortly.')

/** Hosted music (#1822): no key in this build, or the provider failed. Names neither. */
export const musicUnavailable = () =>
  new Refusal('music_unavailable', 503, 'Hosted music is not available right now.')

export const musicFailed = () =>
  new Refusal('music_failed', 502, 'The music could not be generated. Try again shortly.')

/** Judging a triage item (#1221): no key in this build, or the provider failed. */
export const judgeUnavailable = () =>
  new Refusal('judge_unavailable', 503, 'Judging triage items is not available right now.')

export const judgeFailed = () =>
  new Refusal('judge_failed', 502, 'The item could not be judged. Try again shortly.')

/** Hosted narration, images and music are Pro's (#1062), spending its monthly AI credits (#1113). */
export const proRequired = () => new Refusal('pro_required', 403, 'This needs Pro.')

/** The shared template catalog (#1708). */
export const templateExists = (message = 'A template with this name already exists.') =>
  new Refusal('template_exists', 409, message)

export const templatesUnavailable = () =>
  new Refusal('templates_unavailable', 503, 'Templates are not available right now.')

export const creditsUsedUp = (now = Date.now()) =>
  new Refusal(
    'credits_used_up',
    429,
    'This month’s AI credits are used up. They reset on the 1st (UTC).',
    secondsUntilNextUtcMonth(now),
  )

export const trialCreditsUsedUp = () =>
  new Refusal('credits_used_up', 429, 'The trial’s AI credits are used up. Get Pro once the trial ends.')

/** The 7-day trial (#1932) is had once, and never after a subscription or a seed grant. */
export const trialUsed = () => new Refusal('trial_used', 409, 'This account has already had Pro.')

/** Pro billing (#1037): this build carries no Creem store, or Creem did not answer. */
export const billingUnavailable = () =>
  new Refusal('billing_unavailable', 503, 'Billing is not available right now.')

export const billingFailed = () =>
  new Refusal('billing_failed', 502, 'Billing could not be reached. Try again shortly.')

const CONTACT_RETRY_AFTER_SECONDS = 30 * 60

/** What the rate refusal tells a caller to wait. Kept here beside the message it rides on. */
const TRAINING_RETRY_AFTER_SECONDS = 5 * 60

export const notFound = (message = 'No such endpoint.') => new Refusal('not_found', 404, message)

/** The public API's (#2000). `conflict` is a state rule: a review not yet submitted, a finished task. */
export const conflict = (message: string) => new Refusal('conflict', 409, message)

/** The card or a memory changed since it was read (#2037): read it again and redo the change. */
export const versionConflict = (message: string) => new Refusal('version_conflict', 409, message)

export const readOnly = (message = 'Built-in workflows cannot be changed.') =>
  new Refusal('read_only', 403, message)

export const payloadTooLarge = (message: string) => new Refusal('payload_too_large', 413, message)

export const idempotencyKeyReused = () =>
  new Refusal('idempotency_key_reused', 422, 'This Idempotency-Key was already used for a different request.')

export const idempotencyInProgress = () =>
  new Refusal('idempotency_in_progress', 409, 'A request with this Idempotency-Key is still running. Retry shortly.', 5)

export const sessionRequired = () =>
  new Refusal('session_required', 403, 'Sign in to manage API keys. An API key cannot create or revoke keys.')

/** A share link's refusals (#2019), and a task's that carry their own code. Each `detail` the schema
 *  raises is one of these. */
const SHARED_REFUSALS: Record<string, Refusal> = {
  invalid: new Refusal('link_invalid', 404, 'This link is not valid.'),
  expired: new Refusal('link_expired', 410, 'This link has expired.'),
  revoked: new Refusal('link_revoked', 410, 'This link has been revoked.'),
  sign_in_required: new Refusal('sign_in_required', 401, 'Sign in to open this review.'),
  not_invited: new Refusal('not_invited', 403, 'This email is not invited to this review.'),
  view_only: new Refusal('view_only', 403, 'This link is view only.'),
  owner_only: new Refusal('owner_only', 403, 'Only the workspace’s members can do this.'),
  chat_busy: new Refusal('chat_busy', 409, 'A reply is still on its way.'),
  runner_offline: new Refusal('runner_offline', 409, 'The Runner this task runs on is not connected.'),
  runner_removed: new Refusal('runner_removed', 409, "This runtime's Runner was removed from this workspace. Pick another runtime."),
  runner_outdated: new Refusal('runner_outdated', 409, 'This Runner is out of date. Update it to keep keys there.'),
  review_outdated: new Refusal('review_outdated', 409, 'This task has changed since it was opened. Reload it and review again.'),
  card_missing: new Refusal('card_missing', 409, 'This task has no full card to review yet.'),
  task_running: new Refusal('task_running', 409, 'A running task cannot be cancelled.'),
}

export const sharedRefusal = (detail: string | undefined) => {
  const held = SHARED_REFUSALS[detail ?? '']
  return held ? new Refusal(held.code, held.status, held.message) : serviceUnavailable()
}

export const artifactsUnavailable = () =>
  new Refusal('artifacts_unavailable', 503, 'File storage is not available right now.')

export const methodNotAllowed = () =>
  new Refusal('method_not_allowed', 405, 'That endpoint does not take this method.')

/** A landed commit's diff (#2109): the computer holding it is not answering, or no longer has it. */
export const machineOffline = () => new Refusal('machine_offline', 503, 'The computer this task landed on is offline.')
export const commitGone = () => new Refusal('commit_gone', 404, 'The computer this task landed on no longer has its commit.')

export const serviceUnavailable = () =>
  new Refusal('service_unavailable', 503, 'Cloud is not answering right now. Try again shortly.')

/**
 * The two free-tier refusals. Both say plainly that the change was not saved, so a client
 * can show the message without turning it into a conflict or a generic failure (#316).
 */
export function dailyWriteBudgetReached(): Refusal {
  return new Refusal(
    'daily_write_budget_reached',
    429,
    'Cloud has used up today’s free-tier writes. Your change was not saved — save it again after 00:00 UTC.',
    secondsUntilNextUtcDay(),
  )
}

export function storageLimitReached(): Refusal {
  return new Refusal(
    'storage_limit_reached',
    507,
    'Cloud has run out of free-tier storage and is read-only. Your change was not saved until an owner frees space.',
  )
}

export type Quota = 'tasks' | 'storage' | 'file_size'

const QUOTA_MESSAGES: Record<Quota, (limit: number) => string> = {
  tasks: (n) => `Your plan runs ${n} tasks at once. Finish or cancel one, or upgrade, to start another.`,
  storage: (n) => `Your plan holds ${sizeOf(n)} of files, and this would go over. Free up space, or upgrade.`,
  file_size: (n) => `Your plan takes files up to ${sizeOf(n)}.`,
}

const sizeOf = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${+(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`

/** A plan quota used up. The answer names the quota and its limit, so a client can say which. */
export function quotaExceeded(quota: Quota, limit: number): Refusal {
  const refusal = new Refusal('quota_exceeded', quota === 'file_size' ? 413 : 403, QUOTA_MESSAGES[quota](limit))
  refusal.quota = quota
  refusal.limit = limit
  return refusal
}

export function secondsUntilNextUtcDay(now = Date.now()): number {
  const day = 24 * 60 * 60 * 1000
  return Math.ceil((day - (now % day)) / 1000)
}

export function secondsUntilNextUtcMonth(now = Date.now()): number {
  const at = new Date(now)
  return Math.ceil((Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1) - now) / 1000)
}
