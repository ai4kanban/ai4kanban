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
  boardNotEmpty,
  cardLocked,
  dailyWriteBudgetReached,
  nodeRemoved,
  notFound,
  notYours,
  operationReused,
  revisionConflict,
  serverElsewhere,
  serviceUnavailable,
  staleRevision,
  storageLimitReached,
} from './errors.ts'

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

/** SQLSTATE a workspace write against a revision that has moved raises (#314). `details`
 *  carries the revision the resource holds now. */
export const PG_REVISION_CONFLICT = 'AKB06'

/** SQLSTATE one operation id used for two different changes raises. */
export const PG_OPERATION_REUSED = 'AKB07'

/** SQLSTATE a call from a machine the workspace no longer runs its work on raises. */
export const PG_NODE_REMOVED = 'AKB08'

/** SQLSTATE a call naming a card or a delivery the workspace does not hold raises. */
export const PG_NOT_IN_WORKSPACE = 'AKB10'

/** SQLSTATE a write to a card another writer is holding raises (#315). `details` carries the
 *  instant that writer's lease runs out. */
export const PG_CARD_LOCKED = 'AKB11'

/** SQLSTATE an import into a workspace that already holds a board raises (#315). */
export const PG_BOARD_NOT_EMPTY = 'AKB12'

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
  if (error.code === PG_REVISION_CONFLICT) return revisionConflict(error.details ?? '')
  if (error.code === PG_OPERATION_REUSED) return operationReused()
  if (error.code === PG_NODE_REMOVED) return nodeRemoved()
  if (error.code === PG_NOT_IN_WORKSPACE) return notFound(error.message)
  if (error.code === PG_CARD_LOCKED) return cardLocked(error.message, error.details)
  if (error.code === PG_BOARD_NOT_EMPTY) return boardNotEmpty(error.message)
  if (error.code && PG_READ_ONLY.includes(error.code)) return storageLimitReached()
  console.error('cloud: database refused a call', {
    status,
    code: error.code,
    message: error.message,
  })
  return serviceUnavailable()
}
