/**
 * Hosted narration for demo videos (#1054). The OpenRouter key stays here; a machine sends
 * a voice, a tier and a line and gets the audio back.
 *
 * Each voice belongs to one language, and its language and the tier pick the model (#87). Chinese
 * answers mp3, the only format its model streams; the others speak raw 24 kHz mono PCM, sent as wav.
 *
 * Pro only, spending the month's AI credits by the second (#1113). The length is known only
 * once spoken, so any credit left lets a line start and the last one may run over. A failure
 * spends nothing and never falls back to another tier or model.
 *
 * The audio carries no cost, so what a line cost us is looked up by its generation id after
 * the answer is sent, and recorded in `cloud.ai_calls` (#1355).
 */

import { generationCost, recordAiCall } from './ai-calls.ts'
import { onTrialOnly, readBilling } from './billing.ts'
import { CREDIT_RATES, readCredits, spendCredits } from './credits.ts'
import type { Env } from './env.ts'
import { badRequest, creditsUsedUp, proRequired, speechFailed, speechUnavailable, trialCreditsUsedUp } from './errors.ts'

export const MAX_SPEECH_CHARS = 4000
const PCM_RATE = 24000

export type SpeechTier = keyof typeof CREDIT_RATES.speech
type Language = 'zh' | 'en' | 'multilingual'

/** Each language's model by tier. Only here, so a model change needs no client release. Why
 *  these: `endpoints.md`. */
export const SPEECH_MODELS: Record<Language, Record<SpeechTier, string>> = {
  zh: { standard: 'minimax/speech-2.8-turbo', premium: 'minimax/speech-2.8-hd' },
  en: { standard: 'elevenlabs/eleven-flash-v2.5', premium: 'elevenlabs/eleven-v3' },
  multilingual: { standard: 'google/gemini-3.8-flash-lite-tts', premium: 'google/gemini-3.8-flash-tts' },
}

const GEMINI = [
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe',
  'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib',
  'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima',
  'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat',
]

/** Our voice names, each with its language and the provider's id, which both tiers share. Kept
 *  in step with `cli/src/agents/scriptwriter/references/voices.md`. */
export const VOICES: Record<string, { language: Language; id: string }> = {
  Yunzhou: { language: 'zh', id: 'male-qn-jingying' },
  Mingxuan: { language: 'zh', id: 'presenter_male' },
  Haoran: { language: 'zh', id: 'Chinese (Mandarin)_Gentleman' },
  Zihao: { language: 'zh', id: 'male-qn-qingse' },
  Xinyi: { language: 'zh', id: 'female-chengshu' },
  Ruoxi: { language: 'zh', id: 'presenter_female' },
  Tianqing: { language: 'zh', id: 'female-tianmei' },
  Wanyu: { language: 'zh', id: 'Chinese (Mandarin)_Wise_Women' },
  Arthur: { language: 'en', id: 'JBFqnCBsd6RMkjVDRZzb' },
  Graham: { language: 'en', id: 'nPczCjzI2devNBz1zQrb' },
  Edmund: { language: 'en', id: 'onwK4e9ZLuTAKqWW03F9' },
  Miles: { language: 'en', id: 'cjVigY5qzO86Huf0OWal' },
  Clara: { language: 'en', id: 'EXAVITQu4vr4xnSDxMaL' },
  Hazel: { language: 'en', id: 'Xb7hH8MSUJpSbSDYk0k2' },
  Ivy: { language: 'en', id: 'XrExE9yKIg1WjnnlVkGX' },
  Nora: { language: 'en', id: 'cgSgspJ2msm6clMCkdW9' },
  ...Object.fromEntries(GEMINI.map((name) => [name, { language: 'multilingual' as const, id: name }])),
}

const LANGUAGE_NAMES = { zh: 'Chinese', en: 'English' }

/** Chinese when Han characters are over half of them and the Latin words together, so a
 *  Chinese line naming English products stays Chinese; null with neither. */
export function mainLanguage(text: string): 'zh' | 'en' | null {
  const han = text.match(/\p{Script=Han}/gu)?.length ?? 0
  const latin = text.match(/\p{Script=Latin}+/gu)?.length ?? 0
  if (!han && !latin) return null
  return han > (han + latin) / 2 ? 'zh' : 'en'
}

export async function speak(env: Env, ctx: ExecutionContext, user: string, body: unknown): Promise<Response> {
  const { voice, text, tier = 'standard' } = (body ?? {}) as { voice?: unknown; text?: unknown; tier?: unknown }
  const named = Object.keys(VOICES).find((v) => typeof voice === 'string' && v.toLowerCase() === voice.toLowerCase())
  if (!named) throw badRequest(`Unknown voice. Pick one of: ${Object.keys(VOICES).join(', ')}.`)
  if (!Object.hasOwn(CREDIT_RATES.speech, tier as string)) {
    throw badRequest(`Unknown tier. Pick one of: ${Object.keys(CREDIT_RATES.speech).join(', ')}.`)
  }
  const tiered = tier as SpeechTier
  if (typeof text !== 'string' || !text.trim()) throw badRequest('Give the text to speak.')
  if (text.length > MAX_SPEECH_CHARS) {
    throw badRequest(`That text is too long. Split it into parts of ${MAX_SPEECH_CHARS} characters or fewer.`)
  }
  const { language, id } = VOICES[named]!
  const spoken = language === 'multilingual' ? null : mainLanguage(text)
  if (spoken && spoken !== language) {
    const name = LANGUAGE_NAMES[spoken]
    throw badRequest(`This text is in ${name}. Pick ${name === 'English' ? 'an' : 'a'} ${name} voice.`)
  }
  const billing = await readBilling(env, user)
  if (billing.plan !== 'pro') throw proRequired()
  if ((await readCredits(env, user, billing)).left <= 0) throw onTrialOnly(billing) ? trialCreditsUsedUp() : creditsUsedUp()
  if (!env.OPENROUTER_API_KEY) throw speechUnavailable()

  const mp3 = language === 'zh'
  const failed = async () => {
    await recordAiCall(env, user, 'speech', { ok: false, tier: tiered })
    return speechFailed()
  }
  let answer: Response
  try {
    answer = await fetch('https://openrouter.ai/api/v1/audio/speech', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'content-type': 'application/json',
        'x-title': 'WildCrane Cloud',
      },
      body: JSON.stringify({
        model: SPEECH_MODELS[language][tiered],
        input: text,
        voice: id,
        response_format: mp3 ? 'mp3' : 'pcm',
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
  const audio = new Uint8Array(await answer.arrayBuffer())
  const seconds = mp3 ? mp3Seconds(audio) : audio.length / (PCM_RATE * 2)
  await spendCredits(env, user, 'speech', (seconds / 60) * CREDIT_RATES.speech[tiered])
  const generationId = answer.headers.get('x-generation-id')
  ctx.waitUntil(
    generationCost(env, generationId).then((cost) =>
      recordAiCall(env, user, 'speech', { ok: true, usage: seconds, cost, generationId, tier: tiered }),
    ),
  )
  return new Response(mp3 ? audio : wav(audio), {
    headers: { 'content-type': mp3 ? 'audio/mpeg' : 'audio/wav', 'x-voice': named, 'x-tier': tiered },
  })
}

const MP3_BITRATES = {
  v1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  v2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
}
const MP3_RATES = { v1: [44100, 48000, 32000], v2: [22050, 24000, 16000], v25: [11025, 12000, 8000] }

/** An MPEG layer III stream's length, summed frame by frame past any ID3 tag. */
export function mp3Seconds(bytes: Uint8Array): number {
  let at = 0
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    at = 10 + ((bytes[6]! << 21) | (bytes[7]! << 14) | (bytes[8]! << 7) | bytes[9]!)
  }
  let seconds = 0
  while (at + 4 <= bytes.length) {
    const [a, b, c] = [bytes[at]!, bytes[at + 1]!, bytes[at + 2]!]
    const version = (b >> 3) & 3 // 3: MPEG-1, 2: MPEG-2, 0: MPEG-2.5
    const bitrateIndex = c >> 4
    const rateIndex = (c >> 2) & 3
    if (a !== 0xff || (b & 0xe0) !== 0xe0 || ((b >> 1) & 3) !== 1 || version === 1 || bitrateIndex % 15 === 0 || rateIndex === 3) {
      at++
      continue
    }
    const v1 = version === 3
    const rate = MP3_RATES[v1 ? 'v1' : version === 2 ? 'v2' : 'v25'][rateIndex]!
    const samples = v1 ? 1152 : 576
    seconds += samples / rate
    at += Math.floor(((samples / 8) * MP3_BITRATES[v1 ? 'v1' : 'v2'][bitrateIndex]! * 1000) / rate) + ((c >> 1) & 1)
  }
  return seconds
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
