/**
 * Hosted narration for demo videos (#1054). The OpenRouter key stays here; a machine sends
 * a voice and a line and gets mp3 back.
 */

import type { Env } from './env.ts'
import { badRequest, speechFailed, speechUnavailable } from './errors.ts'

export const SPEECH_MODEL = 'google/gemini-3.8-flash-tts'
export const MAX_SPEECH_CHARS = 4000

/** The model's voices. Each speaks every language it does. Kept in step with
 *  `cli/src/agents/scriptwriter/references/voices.md`. */
export const VOICES = [
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe',
  'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib',
  'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima',
  'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat',
] as const

export async function speak(env: Env, body: unknown): Promise<Response> {
  const { voice, text } = (body ?? {}) as { voice?: unknown; text?: unknown }
  const named = VOICES.find((v) => typeof voice === 'string' && v.toLowerCase() === voice.toLowerCase())
  if (!named) throw badRequest(`Unknown voice. Pick one of: ${VOICES.join(', ')}.`)
  if (typeof text !== 'string' || !text.trim()) throw badRequest('Give the text to speak.')
  if (text.length > MAX_SPEECH_CHARS) {
    throw badRequest(`That text is too long. Split it into parts of ${MAX_SPEECH_CHARS} characters or fewer.`)
  }
  if (!env.OPENROUTER_API_KEY) throw speechUnavailable()

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
        response_format: 'mp3',
      }),
    })
  } catch (e) {
    console.error('cloud: speech unreachable', e)
    throw speechFailed()
  }
  if (!answer.ok) {
    console.error('cloud: speech refused', answer.status, await answer.text().catch(() => ''))
    throw speechFailed()
  }
  return new Response(answer.body, {
    headers: { 'content-type': 'audio/mpeg', 'x-voice': named },
  })
}
