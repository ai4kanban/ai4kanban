/**
 * The Worker reaches Postgres over HTTPS through PostgREST and never opens a connection.
 * One call is one function, and a function is one transaction — so a mutation's whole
 * check-apply-audit sequence either lands or does not (#311).
 */

import { DAILY_WRITE_BUDGET } from './config.ts'
import type { Env } from './env.ts'
import {
  Refusal,
  dailyWriteBudgetReached,
  notYours,
  serviceUnavailable,
  storageLimitReached,
} from './errors.ts'

/** SQLSTATE the schema raises when a mutation would go past the day's write budget. */
export const PG_WRITE_BUDGET_EXCEEDED = 'AKB01'

/** SQLSTATE `cloud.require_owner` raises when a row belongs to another account. */
export const PG_NOT_YOURS = 'AKB02'

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

  if (response.ok) return (await response.json()) as T

  const error = (await response.json().catch(() => ({}))) as PostgrestError
  throw refusalFor(error, response.status)
}

/** Turns a Postgres failure into the refusal a client is meant to show. */
export function refusalFor(error: PostgrestError, status: number): Refusal {
  if (error.code === PG_WRITE_BUDGET_EXCEEDED) return dailyWriteBudgetReached()
  if (error.code === PG_NOT_YOURS) return notYours()
  if (error.code && PG_READ_ONLY.includes(error.code)) return storageLimitReached()
  console.error('cloud: database refused a call', {
    status,
    code: error.code,
    message: error.message,
  })
  return serviceUnavailable()
}
