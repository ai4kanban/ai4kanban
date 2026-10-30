/**
 * AI credits (#1113): Pro's monthly pool for every hosted capability. The grant and each
 * capability's rate live here and nowhere else; `cloud.credit_spends` records what was spent.
 *
 * A credit is one second of narration. Another capability is priced by its upstream cost over
 * narration's. Nothing carries over: a UTC month starts full, and any credit left lets a use
 * start, so the last one may run over. The trial (#1932) instead has one fixed pool for its
 * whole length.
 */

import { type Billing, onTrialOnly } from './billing.ts'
import { call } from './db.ts'
import type { Env } from './env.ts'

export const MONTHLY_CREDITS = 5000
export const TRIAL_CREDITS = 1000

export const CREDIT_RATES = {
  /** Per second spoken. */
  speech: 1,
  /** Per generated image by tier, including its reference images (#1114, #77). */
  image: { economy: 230, standard: 320, premium: 769 },
  /** Per hosted music track, whatever its length (#1822): priced at market rate, not by upstream cost (#1827). */
  music: 160,
} as const

export type CreditUse = keyof typeof CREDIT_RATES

/** What the Billing tab draws. `resetsAt` is the next UTC month's first instant, or null for
 *  the trial's pool, which never resets. */
export interface Credits {
  total: number
  left: number
  resetsAt: string | null
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

/** The pool this Pro user spends from: the trial's while it alone makes them Pro, else the month's. */
export async function readCredits(env: Env, user: string, billing: Billing, now = Date.now()): Promise<Credits> {
  if (!onTrialOnly(billing)) return creditsOf(await creditsUsed(env, user), now)
  const used = Number(await call<number>(env, 'trial_credits_used', { p_user_id: user }))
  return { total: TRIAL_CREDITS, left: Math.max(0, Math.floor(TRIAL_CREDITS - used)), resetsAt: null }
}

/** Record a spend. A failure is logged, never raised: what it pays for is already done. */
export async function spendCredits(env: Env, user: string, use: CreditUse, credits: number): Promise<void> {
  try {
    await call(env, 'spend_credits', { p_user_id: user, p_use: use, p_credits: credits })
  } catch (e) {
    console.error('cloud: credits not recorded', user, use, e)
  }
}
