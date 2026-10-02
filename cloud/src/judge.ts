/**
 * Judging one triage item (#1221). The machine assembles the state and the choice questions;
 * this forwards them to Jev with the key it holds and answers each question's choice,
 * probabilities and confidence as they came back.
 *
 * Pro only and free: nothing is spent from the month's AI credits. What each call cost us is
 * recorded in `cloud.ai_calls` (#1355).
 */

import { recordAiCall } from './ai-calls.ts'
import { readBilling } from './billing.ts'
import type { Env } from './env.ts'
import { badRequest, judgeFailed, judgeUnavailable, proRequired } from './errors.ts'
import { json } from './http.ts'

export const JUDGE_MODEL = 'typesafe/jev-1.13'
export const DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions'
/** Jev reads at most 32K tokens; this caps the bytes long before a request could be a burden. */
export const MAX_BODY_CHARS = 200_000
export const MAX_OPTIONS = 500

interface Answer {
  choice: string
  probabilities: Record<string, number>
  confidence: number
}

function readQuestions(questions: unknown): Record<string, unknown> {
  if (!questions || typeof questions !== 'object' || Array.isArray(questions)) {
    throw badRequest('Give the questions to ask, by name.')
  }
  const named = Object.entries(questions)
  if (named.length === 0) throw badRequest('Ask at least one question.')
  for (const [name, question] of named) {
    const { type, instructions, criteria } = (question ?? {}) as Record<string, unknown>
    if (type !== 'choice') throw badRequest(`${name}: only choice questions are asked.`)
    if (typeof instructions !== 'string' || !instructions.trim()) throw badRequest(`${name}: give its instructions.`)
    const options = criteria && typeof criteria === 'object' && !Array.isArray(criteria) ? Object.values(criteria) : []
    if (options.length < 2 || options.length > MAX_OPTIONS || options.some((o) => typeof o !== 'string')) {
      throw badRequest(`${name}: give between 2 and ${MAX_OPTIONS} options, each with its criteria.`)
    }
  }
  return questions as Record<string, unknown>
}

export async function judge(env: Env, user: string, body: unknown): Promise<Response> {
  const { state, questions } = (body ?? {}) as { state?: unknown; questions?: unknown }
  if (typeof state !== 'string' && (!state || typeof state !== 'object')) throw badRequest('Give the state to judge.')
  const asked = readQuestions(questions)
  if (JSON.stringify(body).length > MAX_BODY_CHARS) throw badRequest('That item and its context are too long to judge.')
  const billing = await readBilling(env, user)
  if (billing.plan !== 'pro') throw proRequired()
  if (!env.OPENROUTER_API_KEY) throw judgeUnavailable()

  const failed = async () => {
    await recordAiCall(env, user, 'judge', { ok: false })
    return judgeFailed()
  }
  let answer: Response
  try {
    answer = await fetch(DECISIONS_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'content-type': 'application/json',
        'x-title': 'AI4Kanban Cloud',
      },
      body: JSON.stringify({ model: JUDGE_MODEL, state, questions: asked }),
    })
  } catch (e) {
    console.error('cloud: judge unreachable', e)
    throw await failed()
  }
  if (!answer.ok) {
    console.error('cloud: judge refused', answer.status, await answer.text().catch(() => ''))
    throw await failed()
  }
  const out = (await answer.json().catch(() => null)) as {
    id?: string
    answers?: Record<string, Partial<Answer>>
    model?: string
    usage?: { cost?: number; input_tokens?: number }
  } | null
  const answers: Record<string, Answer> = {}
  for (const name of Object.keys(asked)) {
    const one = out?.answers?.[name]
    if (typeof one?.choice !== 'string' || typeof one.confidence !== 'number') {
      console.error('cloud: judge answer missing', name)
      throw await failed()
    }
    answers[name] = { choice: one.choice, probabilities: one.probabilities ?? {}, confidence: one.confidence }
  }
  console.log('cloud: judged', JSON.stringify({ user, cost: out?.usage?.cost ?? null, tokens: out?.usage?.input_tokens ?? null }))
  await recordAiCall(env, user, 'judge', {
    ok: true,
    usage: out?.usage?.input_tokens,
    cost: out?.usage?.cost,
    generationId: answer.headers.get('x-generation-id') ?? out?.id,
  })
  return json({ answers, model: out?.model ?? JUDGE_MODEL })
}
