/**
 * AI credits (#1113): Pro's monthly pool for every hosted capability. The grant and each
 * capability's rate live here and nowhere else; `cloud.credit_spends` records what was spent.
 *
 * A credit is one second of narration. Another capability is priced by its upstream cost over
 * narration's — a cover image is expected at about 160 (#1114). Nothing carries over: a UTC
 * month starts full, and any credit left lets a use start, so the last one may run over.
 */

import { call } from './db.ts'
import type { Env } from './env.ts'

export const MONTHLY_CREDITS = 5000

export const CREDIT_RATES = {
  /** Per second spoken. */
  speech: 1,
} as const

export type CreditUse = keyof typeof CREDIT_RATES

/** What the Billing tab draws. `resetsAt` is the next UTC month's first instant. */
export interface Credits {
  total: number
  left: number
  resetsAt: string
}

export async function creditsUsed(env: Env, user: string): Promise<number> {
  return Number(await call<number>(env, 'credits_used', { p_user_id: user }))
}

export function creditsOf(used: number, now = Date.now()): Credits {
  const at = new Date(now)
  return {
    total: MONTHLY_CREDITS,
    left: Math.max(0, Math.floor(MONTHLY_CREDITS - used)),
    resetsAt: new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1)).toISOString(),
  }
}

/** Record a spend. A failure is logged, never raised: what it pays for is already done. */
export async function spendCredits(env: Env, user: string, use: CreditUse, amount: number): Promise<void> {
  try {
    await call(env, 'spend_credits', { p_user_id: user, p_use: use, p_credits: amount * CREDIT_RATES[use] })
  } catch (e) {
    console.error('cloud: credits not recorded', user, use, e)
  }
}
