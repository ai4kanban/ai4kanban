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
  | 'stale_revision'
  | 'revision_conflict'
  | 'operation_reused'
  | 'node_removed'
  | 'already_acted'
  | 'server_elsewhere'
  | 'slack_unavailable'
  | 'slack_not_connected'
  | 'lark_unavailable'
  | 'lark_not_connected'
  | 'not_found'
  | 'method_not_allowed'
  | 'daily_write_budget_reached'
  | 'storage_limit_reached'
  | 'service_unavailable'

export class Refusal extends Error {
  readonly code: RefusalCode
  readonly status: number
  /** Seconds a client should wait before retrying, when there is a useful answer. */
  readonly retryAfterSeconds?: number
  /** The revision the resource holds now, on a conflict. Carried in the refusal itself so a
   *  client re-reads that one card rather than the whole board (#314). */
  readonly current?: string

  constructor(
    code: RefusalCode,
    status: number,
    message: string,
    retryAfterSeconds?: number,
    current?: string,
  ) {
    super(message)
    this.name = 'Refusal'
    this.code = code
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
    this.current = current
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
    'AI4Kanban Cloud is an invite-only preview and this account is not in it yet. ' +
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

/**
 * The two Slack refusals a pane acts on (#320), each with its own code because they ask the
 * reader for different things: use a build that carries the app, or connect one.
 */
export const slackUnavailable = () =>
  new Refusal(
    'slack_unavailable',
    503,
    'This AI4Kanban Cloud service carries no Slack app to connect to.',
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
    `This AI4Kanban Cloud service carries no ${cloud} app to connect to.`,
  )

export const larkNotConnected = () =>
  new Refusal(
    'lark_not_connected',
    404,
    'This account has no Lark connection. Connect one in Configuration → Notifications.',
  )

/**
 * A workspace write against a revision that has moved (#314). Its own code rather than
 * `stale_revision`, because it carries the revision the resource holds NOW: the caller
 * re-reads that one card and writes again, which is what #312's conflict result is for.
 */
export const revisionConflict = (current = '') =>
  new Refusal(
    'revision_conflict',
    409,
    'That changed since you read it. Open it again and make the change on what it says now.',
    undefined,
    current,
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

/** The machine a call was made from is not one this workspace runs its work on any more. */
export const nodeRemoved = () =>
  new Refusal(
    'node_removed',
    403,
    'This machine no longer runs this workspace’s work. Open the workspace here again to register it.',
  )

export const notFound = (message = 'No such endpoint.') => new Refusal('not_found', 404, message)

export const methodNotAllowed = () =>
  new Refusal('method_not_allowed', 405, 'That endpoint does not take this method.')

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

export function secondsUntilNextUtcDay(now = Date.now()): number {
  const day = 24 * 60 * 60 * 1000
  return Math.ceil((day - (now % day)) / 1000)
}
