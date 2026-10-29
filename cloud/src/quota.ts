/**
 * What each plan allows (#2017). Test prices: the numbers move with real costs, so every
 * surface — the API, the pricing page, the desktop app — reads them from here.
 */

import type { Billing } from './billing.ts'
import { readBilling } from './billing.ts'
import { call } from './db.ts'
import type { Env } from './env.ts'

const MB = 1024 * 1024
const GB = 1024 * MB

export interface Limits {
  /** Tasks running at once, across every Runner (#2209). More wait queued. */
  tasks: number
  storage: number
  file: number
  /** Days a finished task, its history and its previews are kept. */
  retentionDays: number
}

export const PLANS: Record<Billing['plan'], Limits> = {
  free: { tasks: 3, storage: 1 * GB, file: 100 * MB, retentionDays: 7 },
  pro: { tasks: 10, storage: 20 * GB, file: 1 * GB, retentionDays: 30 },
}

/** One Pro storage pack. */
export const STORAGE_PACK = 100 * GB

export const PRICES = { pro: 19 }

export const limitsOf = (billing: Billing): Limits => {
  const plan = PLANS[billing.plan]
  return billing.plan === 'pro' ? { ...plan, storage: plan.storage + billing.storagePacks * STORAGE_PACK } : plan
}

export const readLimits = async (env: Env, account: string): Promise<Limits> => limitsOf(await readBilling(env, account))

export interface Usage {
  tasks: number
  storage: number
}

export const readUsage = (env: Env, account: string) => call<Usage>(env, 'v1_usage', { p_account: account })

export const SHORTEST_KEEP = Math.min(...Object.values(PLANS).map((p) => p.retentionDays))
