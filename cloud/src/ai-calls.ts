/**
 * What each hosted AI call cost upstream (#1355): one row in `cloud.ai_calls` per call that
 * reached the provider. Numbers only, never the content.
 */

import { call } from './db.ts'
import type { Env } from './env.ts'

export type AiCapability = 'judge' | 'speech' | 'image'

export interface AiCall {
  ok: boolean
  /** Input tokens for judge, seconds for speech, 1 for image. */
  usage?: number | null
  /** US dollars, as the provider reported it. */
  cost?: number | null
  generationId?: string | null
}

export const GENERATION_URL = 'https://openrouter.ai/api/v1/generation'
/** A generation's stats land shortly after its answer, so the lookup waits between tries. */
export const COST_LOOKUP = { tries: 3, waitMs: 2000 }

const numberOrNull = (n: unknown): number | null => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null)

/** Record a call. A failure is logged, never raised: the user's answer does not depend on it. */
export async function recordAiCall(env: Env, user: string, capability: AiCapability, made: AiCall): Promise<void> {
  try {
    await call(env, 'record_ai_call', {
      p_user_id: user,
      p_capability: capability,
      p_ok: made.ok,
      p_usage: numberOrNull(made.usage),
      p_cost_usd: numberOrNull(made.cost),
      p_generation_id: made.generationId || null,
    })
  } catch (e) {
    console.error('cloud: ai call not recorded', user, capability, e)
  }
}

/** What a generation cost, for an answer that carries no usage of its own. Null when unknown. */
export async function generationCost(env: Env, id: string | null): Promise<number | null> {
  if (!id || !env.OPENROUTER_API_KEY) return null
  for (let attempt = 0; attempt < COST_LOOKUP.tries; attempt++) {
    await new Promise((done) => setTimeout(done, COST_LOOKUP.waitMs))
    try {
      const answer = await fetch(`${GENERATION_URL}?id=${encodeURIComponent(id)}`, {
        headers: { authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
      })
      if (!answer.ok) continue
      const out = (await answer.json().catch(() => null)) as { data?: { total_cost?: unknown } } | null
      const cost = numberOrNull(out?.data?.total_cost)
      if (cost !== null) return cost
    } catch {
      // Tried again below; an unknown cost is recorded as such.
    }
  }
  return null
}
