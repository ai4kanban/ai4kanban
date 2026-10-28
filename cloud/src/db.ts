/**
 * The Worker reaches Postgres over HTTPS through PostgREST and never opens a connection.
 * One call is one function, and a function is one transaction — so a mutation's whole
 * check-apply-audit sequence either lands or does not (#311).
 */

import { DAILY_WRITE_BUDGET } from './config.ts'
import type { Env } from './env.ts'
import {
  Refusal,
  alreadyActed,
  badRequest,
  conflict,
  versionConflict,
  dailyWriteBudgetReached,
  lastOwner,
  notFound,
  notYours,
  operationReused,
  ownerOnly,
  quotaExceeded,
  runnerElsewhere,
  folderTaken,
  runtimeUnavailable,
  serverElsewhere,
  serviceUnavailable,
  sharedRefusal,
  staleRevision,
  storageLimitReached,
  templateExists,
  trainingSlotTaken,
  trainingTooManyAttempts,
} from './errors.ts'
import type { Quota } from './errors.ts'

/** SQLSTATE the schema raises when a mutation would go past the day's write budget. */
export const PG_WRITE_BUDGET_EXCEEDED = 'AKB01'

/** SQLSTATE `cloud.require_owner` raises when a row belongs to another account. */
export const PG_NOT_YOURS = 'AKB02'

/** SQLSTATE an action against a revision that has moved raises (#319). */
export const PG_STALE_REVISION = 'AKB03'

/** SQLSTATE a second action on one event raises. Exactly one, whichever surface took it. */
export const PG_ALREADY_ACTED = 'AKB04'

/** SQLSTATE attaching a second machine to one board raises (#318). */
export const PG_SERVER_ELSEWHERE = 'AKB05'

/** SQLSTATE one operation id used for two different changes raises. */
export const PG_OPERATION_REUSED = 'AKB07'

/** SQLSTATE a member without the owner role raises on an owner-only move. */
export const PG_OWNER_ONLY = 'AKB14'

/** SQLSTATE a change that would leave the workspace with no owner raises. */
export const PG_LAST_OWNER = 'AKB16'

/** SQLSTATE a training booking for an hour already held raises (#683). */
export const PG_TRAINING_SLOT_TAKEN = 'AKB17'

/** SQLSTATE a caller past the booking rate limit raises (#683). */
export const PG_TRAINING_TOO_MANY_ATTEMPTS = 'AKB18'

/** SQLSTATE publishing a template under a name already taken raises (#1708). */
export const PG_TEMPLATE_EXISTS = 'AKB19'

/** SQLSTATEs the public API raises (#2000): a row the account does not hold, and a state
 *  rule broken. */
export const PG_V1_NOT_FOUND = 'AKB20'
export const PG_V1_CONFLICT = 'AKB21'
/** The card or a memory changed since the caller read it (#2037). */
export const PG_V1_OUTDATED = 'AKB27'
/** A request naming something it may not use, such as another task's share link (#2055). */
export const PG_V1_INVALID = 'AKB28'

/** SQLSTATE registering a second computer as the account's Runner raises (#2001). */
export const PG_RUNNER_ELSEWHERE = 'AKB22'
/** A folder already held by another project on this computer (#2022): `details` names it. */
export const PG_FOLDER_TAKEN = 'AKB29'
/** A chat's connector is not ready on the task's Runner (#2083): `details` names it, `hint` why. */
export const PG_RUNTIME_UNAVAILABLE = 'AKB30'
/** A plan quota is used up (#2017): `details` names it, `hint` carries the limit. */
export const PG_QUOTA_EXCEEDED = 'AKB23'

/** SQLSTATEs of shared review (#2019): a share link that cannot be used, one used without
 *  the right to, and a decision on what is no longer under review. `details` says which. */
export const PG_SHARED = ['AKB24', 'AKB25', 'AKB26']

/** Postgres' own codes for a database that has stopped taking writes. */
const PG_READ_ONLY = ['25006', '53100']

interface PostgrestError {
  code?: string
  message?: string
  details?: string
  hint?: string
}

/** Calls a function without a write budget — a read, or a write the service exempts. */
export function call<T>(env: Env, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  return rpc<T>(env, fn, args)
}

/**
 * Calls a mutating function. The day's budget travels with the call so it is counted in
 * the same transaction as the write it guards, and a deploy — not a migration — changes it.
 */
export function mutate<T>(env: Env, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  return rpc<T>(env, fn, { ...args, p_daily_write_budget: DAILY_WRITE_BUDGET })
}

async function rpc<T>(env: Env, fn: string, args: Record<string, unknown>): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(args),
    })
  } catch {
    throw serviceUnavailable()
  }

  // A function returning `void` answers with no body at all — `mark_mail_sent` is one, and
  // parsing that as JSON would throw a send that Resend already accepted back into the
  // failed path, mailing the same code again every hour.
  if (response.ok) {
    const body = await response.text()
    return (body ? JSON.parse(body) : undefined) as T
  }

  const error = (await response.json().catch(() => ({}))) as PostgrestError
  throw refusalFor(error, response.status)
}

/** Turns a Postgres failure into the refusal a client is meant to show. */
export function refusalFor(error: PostgrestError, status: number): Refusal {
  if (error.code === PG_WRITE_BUDGET_EXCEEDED) return dailyWriteBudgetReached()
  if (error.code === PG_NOT_YOURS) return notYours()
  if (error.code === PG_STALE_REVISION) return staleRevision()
  if (error.code === PG_ALREADY_ACTED) return alreadyActed()
  if (error.code === PG_SERVER_ELSEWHERE) return serverElsewhere(error.message)
  if (error.code === PG_OPERATION_REUSED) return operationReused()
  if (error.code === PG_OWNER_ONLY) return ownerOnly(error.message)
  if (error.code === PG_LAST_OWNER) return lastOwner(error.message)
  if (error.code === PG_TRAINING_SLOT_TAKEN) return trainingSlotTaken()
  if (error.code === PG_TRAINING_TOO_MANY_ATTEMPTS) return trainingTooManyAttempts()
  if (error.code === PG_TEMPLATE_EXISTS) return templateExists(error.message)
  if (error.code === PG_V1_NOT_FOUND) return notFound(error.message)
  if (error.code === PG_V1_CONFLICT) return conflict(error.message ?? '')
  if (error.code === PG_V1_OUTDATED) return versionConflict(error.message ?? '')
  if (error.code === PG_V1_INVALID) return badRequest(error.message ?? '')
  if (error.code === PG_RUNNER_ELSEWHERE) return runnerElsewhere(error.message)
  if (error.code === PG_FOLDER_TAKEN) return folderTaken(error.details ?? '')
  if (error.code === PG_RUNTIME_UNAVAILABLE) return runtimeUnavailable(error.details ?? '', error.hint ?? '')
  if (error.code === PG_QUOTA_EXCEEDED) return quotaExceeded(error.details as Quota, Number(error.hint))
  if (error.code && PG_SHARED.includes(error.code)) return sharedRefusal(error.details)
  if (error.code && PG_READ_ONLY.includes(error.code)) return storageLimitReached()
  console.error('cloud: database refused a call', {
    status,
    code: error.code,
    message: error.message,
  })
  return serviceUnavailable()
}
