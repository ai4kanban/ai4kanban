/**
 * Hosted narration for demo videos (#1054). The OpenRouter key stays here; a machine sends
 * a voice and a line and gets wav back — the model only speaks raw 24 kHz mono PCM.
 *
 * Pro only, spending the month's AI credits by the second (#1113). The length is known only
 * once spoken, so any credit left lets a line start and the last one may run over.
 *
 * The audio carries no cost, so what a line cost us is looked up by its generation id after
 * the answer is sent, and recorded in `cloud.ai_calls` (#1355).
 */

import { generationCost, recordAiCall } from './ai-calls.ts'
import { readBilling } from './billing.ts'
import { creditsUsed, MONTHLY_CREDITS, spendCredits } from './credits.ts'
import type { Env } from './env.ts'
import { badRequest, creditsUsedUp, proRequired, speechFailed, speechUnavailable } from './errors.ts'

export const SPEECH_MODEL = 'google/gemini-3.8-flash-tts'
export const MAX_SPEECH_CHARS = 4000
const PCM_RATE = 24000

/** The model's voices. Each speaks every language it does. Kept in step with
 *  `cli/src/agents/scriptwriter/references/voices.md`. */
export const VOICES = [
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe',
  'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib',
  'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima',
  'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat',
] as const

export async function speak(env: Env, ctx: ExecutionContext, user: string, body: unknown): Promise<Response> {
  const { voice, text } = (body ?? {}) as { voice?: unknown; text?: unknown }
  const named = VOICES.find((v) => typeof voice === 'string' && v.toLowerCase() === voice.toLowerCase())
  if (!named) throw badRequest(`Unknown voice. Pick one of: ${VOICES.join(', ')}.`)
  if (typeof text !== 'string' || !text.trim()) throw badRequest('Give the text to speak.')
  if (text.length > MAX_SPEECH_CHARS) {
    throw badRequest(`That text is too long. Split it into parts of ${MAX_SPEECH_CHARS} characters or fewer.`)
  }
  const [billing, used] = await Promise.all([readBilling(env, user), creditsUsed(env, user)])
  if (billing.plan !== 'pro') throw proRequired()
  if (used >= MONTHLY_CREDITS) throw creditsUsedUp()
  if (!env.OPENROUTER_API_KEY) throw speechUnavailable()

  const failed = async () => {
    await recordAiCall(env, user, 'speech', { ok: false })
    return speechFailed()
  }
  let answer: Response
  try {
    answer = await fetch('https://openrouter.ai/api/v1/audio/speech', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'content-type': 'application/json',
        'x-title': 'AI4Kanban Cloud',
      },
      body: JSON.stringify({
        model: SPEECH_MODEL,
        input: text,
        voice: named,
        response_format: 'pcm',
      }),
    })
  } catch (e) {
    console.error('cloud: speech unreachable', e)
    throw await failed()
  }
  if (!answer.ok) {
    console.error('cloud: speech refused', answer.status, await answer.text().catch(() => ''))
    throw await failed()
  }
  const pcm = new Uint8Array(await answer.arrayBuffer())
  const seconds = pcm.length / (PCM_RATE * 2)
  await spendCredits(env, user, 'speech', seconds)
  const generationId = answer.headers.get('x-generation-id')
  ctx.waitUntil(
    generationCost(env, generationId).then((cost) =>
      recordAiCall(env, user, 'speech', { ok: true, usage: seconds, cost, generationId }),
    ),
  )
  return new Response(wav(pcm), {
    headers: { 'content-type': 'audio/wav', 'x-voice': named },
  })
}

/** 16-bit mono PCM behind a RIFF header. */
export function wav(pcm: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(44 + pcm.length)
  const view = new DataView(out.buffer)
  const ascii = (at: number, text: string) => [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)))
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + pcm.length, true)
  ascii(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, PCM_RATE, true)
  view.setUint32(28, PCM_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, pcm.length, true)
  out.set(pcm, 44)
  return out
}
