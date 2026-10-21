/**
 * Hosted music for video clones (#1822). The OpenRouter key stays here; a machine sends a
 * prompt and a length, and gets an instrumental track back that ends at that length.
 *
 * The model takes no length, so the prompt asks it to end there, and the answer is cut at the
 * last sound before it and faded out. Pro only, at a flat price per track from the month's AI
 * credits (#1113); a failure costs nothing. Neither the answer nor a refusal names the provider
 * or the model.
 */

import { generationCost, recordAiCall } from './ai-calls.ts'
import { onTrialOnly, readBilling } from './billing.ts'
import { readCredits, spendCredits } from './credits.ts'
import type { Env } from './env.ts'
import { badRequest, creditsUsedUp, musicFailed, musicUnavailable, proRequired, trialCreditsUsedUp } from './errors.ts'

export const MUSIC_MODEL = 'google/lyria-3-pro-preview'
export const MAX_PROMPT_CHARS = 4000
export const MIN_SECONDS = 5
export const MAX_SECONDS = 180
const FADE_SECONDS = 1.5
/** Quieter than this, as a share of full scale, counts as silence at the end. */
const SILENCE = 0.002

export async function generateMusic(env: Env, ctx: ExecutionContext, user: string, body: unknown): Promise<Response> {
  const { prompt, seconds } = (body ?? {}) as { prompt?: unknown; seconds?: unknown }
  if (typeof prompt !== 'string' || !prompt.trim()) throw badRequest('Give the prompt for the music.')
  if (prompt.length > MAX_PROMPT_CHARS) {
    throw badRequest(`That prompt is too long. Keep it to ${MAX_PROMPT_CHARS} characters or fewer.`)
  }
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
    throw badRequest(`Give the length in seconds, from ${MIN_SECONDS} to ${MAX_SECONDS}.`)
  }
  const billing = await readBilling(env, user)
  if (billing.plan !== 'pro') throw proRequired()
  if ((await readCredits(env, user, billing)).left <= 0) throw onTrialOnly(billing) ? trialCreditsUsedUp() : creditsUsedUp()
  if (!env.OPENROUTER_API_KEY) throw musicUnavailable()

  const failed = async () => {
    await recordAiCall(env, user, 'music', { ok: false })
    return musicFailed()
  }
  const length = Math.round(seconds * 10) / 10
  let answer: Response
  try {
    answer = await askModel(
      env,
      JSON.stringify({
        model: MUSIC_MODEL,
        messages: [
          {
            role: 'user',
            content:
              `${prompt.trim()}\n\nInstrumental only, no vocals. The piece is ${length} seconds long ` +
              `and comes to a clear ending at ${length} seconds.`,
          },
        ],
        modalities: ['text', 'audio'],
        audio: { format: 'wav' },
        stream: true,
      }),
    )
  } catch (e) {
    console.error('cloud: music unreachable', e)
    throw await failed()
  }
  if (!answer.ok) {
    console.error('cloud: music refused', answer.status, await answer.text().catch(() => ''))
    throw await failed()
  }
  const streamed = readStream(await answer.text().catch(() => ''))
  if (streamed.audio.length === 0) {
    console.error('cloud: music missing from the answer')
    throw await failed()
  }
  const wav = isWav(streamed.audio) ? endAt(streamed.audio, length) : null
  const mp3 = wav ? null : endMp3At(streamed.audio, length)
  const generationId = answer.headers.get('x-generation-id') ?? streamed.id
  await spendCredits(env, user, 'music', 1)
  const usage = wav?.seconds ?? mp3?.seconds ?? length
  ctx.waitUntil(
    (streamed.cost !== null ? Promise.resolve(streamed.cost) : generationCost(env, generationId)).then((cost) =>
      recordAiCall(env, user, 'music', { ok: true, usage, cost, generationId }),
    ),
  )
  return new Response(wav?.bytes ?? mp3?.bytes ?? streamed.audio, {
    headers: { 'content-type': wav ? 'audio/wav' : 'audio/mpeg' },
  })
}

const ask = (env: Env, body: string) =>
  fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'content-type': 'application/json',
      'x-title': 'AI4Kanban Cloud',
    },
    body,
  })

/**
 * The model's answer. A subrequest made while serving a user carries that user's country, and
 * the model refuses some of them (#1828), so the call goes out from a `MusicCall` alarm.
 */
function askModel(env: Env, body: string): Promise<Response> {
  if (!env.MUSIC_CALLS) return ask(env, body)
  const call = env.MUSIC_CALLS.get(env.MUSIC_CALLS.newUniqueId())
  return call.fetch('https://music-call/', { method: 'POST', body })
}

/** Makes one model call from its alarm and answers it to the request that asked. */
export class MusicCall {
  private call?: { body: string; done: (answer: Response) => void }
  private readonly state: DurableObjectState
  private readonly env: Env

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    const body = await request.text()
    const answer = new Promise<Response>((done) => (this.call = { body, done }))
    await this.state.storage.setAlarm(Date.now())
    return answer
  }

  async alarm(): Promise<void> {
    const call = this.call
    this.call = undefined
    if (!call) return
    try {
      const res = await ask(this.env, call.body)
      call.done(new Response(await res.text(), { status: res.status, headers: res.headers }))
    } catch (e) {
      console.error('cloud: music unreachable', e)
      call.done(new Response(null, { status: 502 }))
    }
  }
}

/** The audio, generation id and cost carried by a server-sent event stream. */
export function readStream(text: string): { audio: Uint8Array<ArrayBuffer>; id: string | null; cost: number | null } {
  const parts: Uint8Array[] = []
  let id: string | null = null
  let cost: number | null = null
  for (const line of text.split('\n')) {
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trim()
    if (!data || data === '[DONE]') continue
    let chunk: {
      id?: string
      usage?: { cost?: number }
      choices?: { delta?: { audio?: { data?: string } } }[]
    }
    try {
      chunk = JSON.parse(data)
    } catch {
      continue
    }
    id ??= chunk.id ?? null
    if (typeof chunk.usage?.cost === 'number') cost = chunk.usage.cost
    const b64 = chunk.choices?.[0]?.delta?.audio?.data
    if (b64) parts.push(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
  }
  const audio = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    audio.set(p, at)
    at += p.length
  }
  return { audio, id, cost }
}

const tag = (bytes: Uint8Array, at: number) => String.fromCharCode(...bytes.subarray(at, at + 4))
const isWav = (bytes: Uint8Array) => bytes.length > 12 && tag(bytes, 0) === 'RIFF' && tag(bytes, 8) === 'WAVE'

/**
 * A PCM WAV cut at `seconds`, or earlier where its sound stops, with the last stretch faded
 * out. Null when its format is not one handled here, so it is sent as it came.
 */
export function endAt(bytes: Uint8Array, seconds: number): { bytes: Uint8Array<ArrayBuffer>; seconds: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let format = 0
  let channels = 0
  let rate = 0
  let bits = 0
  let at = 12
  while (at + 8 <= bytes.length) {
    const id = tag(bytes, at)
    const size = view.getUint32(at + 4, true)
    if (id === 'fmt ') {
      format = view.getUint16(at + 8, true)
      channels = view.getUint16(at + 10, true)
      rate = view.getUint32(at + 12, true)
      bits = view.getUint16(at + 22, true)
      if (format === 0xfffe && size >= 40) format = view.getUint16(at + 32, true)
    } else if (id === 'data') {
      const sample = sampler(view, format, bits)
      if (!sample || !channels || !rate) return null
      const start = at + 8
      const frameBytes = channels * (bits / 8)
      const frames = Math.floor(Math.min(size, bytes.length - start) / frameBytes)
      let end = Math.min(frames, Math.round(seconds * rate))
      while (end > 0 && silent(sample, start, end - 1, channels, bits)) end--
      const fade = Math.min(end, Math.round(FADE_SECONDS * rate))
      const out = new Uint8Array(start + end * frameBytes)
      out.set(bytes.subarray(0, out.length))
      const outView = new DataView(out.buffer)
      const outSample = sampler(outView, format, bits)!
      for (let f = end - fade; f < end; f++) {
        const gain = (end - f) / fade
        for (let c = 0; c < channels; c++) {
          const offset = start + (f * channels + c) * (bits / 8)
          outSample.set(offset, outSample.get(offset) * gain)
        }
      }
      outView.setUint32(4, out.length - 8, true)
      outView.setUint32(at + 4, end * frameBytes, true)
      return { bytes: out, seconds: end / rate }
    }
    at += 8 + size + (size % 2)
  }
  return null
}

function silent(sample: Sampler, start: number, frame: number, channels: number, bits: number): boolean {
  for (let c = 0; c < channels; c++) {
    if (Math.abs(sample.get(start + (frame * channels + c) * (bits / 8))) > SILENCE) return false
  }
  return true
}

/** Reads and writes one sample, scaled to -1..1. */
interface Sampler {
  get(offset: number): number
  set(offset: number, value: number): void
}

function sampler(view: DataView, format: number, bits: number): Sampler | null {
  if (format === 1 && bits === 16) {
    return {
      get: (o) => view.getInt16(o, true) / 32768,
      set: (o, v) => view.setInt16(o, Math.round(v * 32768), true),
    }
  }
  if (format === 1 && bits === 24) {
    return {
      get: (o) => ((view.getUint8(o) | (view.getUint8(o + 1) << 8) | (view.getInt8(o + 2) << 16)) / 8388608),
      set: (o, v) => {
        const n = Math.round(v * 8388608)
        view.setUint8(o, n & 0xff)
        view.setUint8(o + 1, (n >> 8) & 0xff)
        view.setInt8(o + 2, n >> 16)
      },
    }
  }
  if (format === 3 && bits === 32) {
    return { get: (o) => view.getFloat32(o, true), set: (o, v) => view.setFloat32(o, v, true) }
  }
  return null
}

const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
const RATES = [44100, 48000, 32000]
const GRANULE = 576
/** One `global_gain` step is 1.5 dB; this many leave a granule inaudible. */
const MUTE_STEPS = 80

/**
 * An MPEG-1 Layer III answer cut at `seconds`, or earlier where its sound stops, with the last
 * stretch faded out by lowering each granule's global gain, so nothing is re-encoded. Null when
 * its format is not one handled here.
 */
export function endMp3At(bytes: Uint8Array, seconds: number): { bytes: Uint8Array<ArrayBuffer>; seconds: number } | null {
  let start = 0
  if (tag(bytes, 0).startsWith('ID3') && bytes.length > 10) {
    start = 10 + (((bytes[6]! & 127) << 21) | ((bytes[7]! & 127) << 14) | ((bytes[8]! & 127) << 7) | (bytes[9]! & 127))
  }
  const frames: { at: number; length: number; channels: number }[] = []
  let rate = 0
  for (let at = start; at + 4 <= bytes.length; ) {
    const h = ((bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!) >>> 0
    const bitrate = BITRATES[(h >>> 12) & 15] ?? 0
    const frameRate = RATES[(h >>> 10) & 3] ?? 0
    // MPEG-1, Layer III, no CRC: a changed side info would fail a CRC.
    if (h >>> 21 !== 0x7ff || ((h >>> 19) & 3) !== 3 || ((h >>> 17) & 3) !== 1 || !((h >>> 16) & 1)) break
    if (!bitrate || !frameRate || (rate && frameRate !== rate)) break
    rate = frameRate
    const length = Math.floor((144 * bitrate * 1000) / rate) + ((h >>> 9) & 1)
    if (at + length > bytes.length) break
    frames.push({ at, length, channels: ((h >>> 6) & 3) === 3 ? 1 : 2 })
    at += length
  }
  if (frames.length === 0) return null

  const granules = (f: (typeof frames)[number]) =>
    Array.from({ length: 2 * f.channels }, (_, i) => (f.at + 4) * 8 + (f.channels === 1 ? 18 : 20) + i * 59)
  let end = Math.min(frames.length, Math.round((seconds * rate) / (2 * GRANULE)))
  // A granule with no big values carries no tone: only silence, or close to it.
  while (end > 0 && granules(frames[end - 1]!).every((g) => readBits(bytes, g + 12, 9) === 0)) end--
  const last = frames[end - 1]
  if (!last) return null

  const out = new Uint8Array(bytes.subarray(0, last.at + last.length))
  const fade = Math.min(end * 2, Math.round((FADE_SECONDS * rate) / GRANULE))
  for (let f = Math.max(0, end - Math.ceil(fade / 2)); f < end; f++) {
    const frame = frames[f]!
    granules(frame).forEach((g, i) => {
      const left = (end - f) * 2 - Math.floor(i / frame.channels) - 1
      if (left >= fade) return
      const gain = left / fade
      const steps = gain > 0 ? Math.min(MUTE_STEPS, Math.ceil(-4 * Math.log2(gain))) : MUTE_STEPS
      writeBits(out, g + 21, 8, Math.max(0, readBits(out, g + 21, 8) - steps))
    })
  }
  return { bytes: out, seconds: (end * 2 * GRANULE) / rate }
}

/** `width` bits from bit `bit`, most significant first. */
function readBits(bytes: Uint8Array, bit: number, width: number): number {
  let n = 0
  for (let i = 0; i < width; i++) {
    const b = bit + i
    n = (n << 1) | ((bytes[b >> 3]! >> (7 - (b & 7))) & 1)
  }
  return n
}

function writeBits(bytes: Uint8Array, bit: number, width: number, value: number): void {
  for (let i = 0; i < width; i++) {
    const b = bit + i
    const mask = 1 << (7 - (b & 7))
    const byte = bytes[b >> 3]!
    bytes[b >> 3] = (value >> (width - 1 - i)) & 1 ? byte | mask : byte & ~mask
  }
}
