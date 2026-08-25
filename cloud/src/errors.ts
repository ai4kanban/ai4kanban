/**
 * Every refusal the service can return. A client matches on `code`; `message` is written
 * to be shown to a user as it stands.
 */
export type RefusalCode =
  | 'bad_request'
  | 'unauthenticated'
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

  constructor(code: RefusalCode, status: number, message: string, retryAfterSeconds?: number) {
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

export const notFound = () => new Refusal('not_found', 404, 'No such endpoint.')

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
