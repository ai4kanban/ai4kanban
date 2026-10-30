// Hosted narration (#1054): only a Pro user reaches it, spending their AI credits (#1113),
// the key never leaves the Worker, and a provider failure is a refusal rather than silence.
// The voice's language and the tier pick the model (#87).

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { jwksUrl, issuerFor, resetJwksCache } from '../src/auth.ts'
import worker from '../src/index.ts'
import { COST_LOOKUP, GENERATION_URL } from '../src/ai-calls.ts'
import { CREDIT_RATES, MONTHLY_CREDITS, TRIAL_CREDITS } from '../src/credits.ts'
import { SPEECH_MODELS, VOICES, mainLanguage, mp3Seconds, wav } from '../src/speech.ts'

const SUPABASE_URL = 'https://project.supabase.co'
const ENV = { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'service-role', OPENROUTER_API_KEY: 'or-key' }
const SUBJECT = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const PCM = new Uint8Array([0x01, 0x00, 0xff, 0x7f])
const SECONDS = PCM.length / 48000
// Two MPEG-1 layer III frames at 128 kbps and 44.1 kHz, behind an empty ID3 tag.
const FRAME = new Uint8Array(417)
FRAME.set([0xff, 0xfb, 0x90, 0x00])
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0, ...FRAME, ...FRAME])
const MP3_SECONDS = (2 * 1152) / 44100
const charge = (seconds, tier) => (seconds / 60) * CREDIT_RATES.speech[tier]
const PRO = { id: 'sub_1', customer_id: 'c', period: 'yearly', status: 'active', current_period_end: null }

const realFetch = globalThis.fetch
let keyPair
let admitted
let subscriptions
let used
let provider
let sent
let recorded
let recording
let generation
let looked
let later
let trials
let trialUsed
const realWait = COST_LOOKUP.waitMs

beforeEach(async () => {
  resetJwksCache()
  keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  admitted = true
  subscriptions = { [SUBJECT]: [PRO], [OTHER]: [PRO] }
  used = {}
  trials = {}
  trialUsed = {}
  provider = (body) =>
    body.response_format === 'mp3'
      ? new Response(MP3, { headers: { 'content-type': 'audio/mpeg', 'x-generation-id': 'gen-s1' } })
      : new Response(PCM, { headers: { 'content-type': 'audio/pcm;rate=24000;channels=1', 'x-generation-id': 'gen-s1' } })
  sent = []
  recorded = []
  recording = 'up'
  generation = () => json({ data: { total_cost: 0.003 } })
  looked = []
  later = []
  COST_LOOKUP.waitMs = 0
  globalThis.fetch = async (url, init) => {
    const address = String(url)
    if (address === jwksUrl(SUPABASE_URL)) return json({ keys: [{ ...jwk, kid: 'k', alg: 'ES256' }] })
    if (address.endsWith('/rest/v1/rpc/account_for_session')) {
      return json({ admitted, handle: 'lin', name: null, avatar_url: null, account_id: admitted ? SUBJECT : null })
    }
    // What 0031_credits.sql does, which test/sql/checks.sql proves against a real database.
    const body = init?.body ? JSON.parse(init.body) : {}
    if (address.endsWith('/rest/v1/rpc/subscriptions_for')) return json(subscriptions[body.p_user_id] ?? [])
    if (address.endsWith('/rest/v1/rpc/credits_used')) return json(used[body.p_user_id] ?? 0)
    if (address.endsWith('/rest/v1/rpc/seed_grant_for')) return json(null)
    if (address.endsWith('/rest/v1/rpc/trial_for')) return json(trials[body.p_user_id] ?? null)
    if (address.endsWith('/rest/v1/rpc/trial_credits_used')) return json(trialUsed[body.p_user_id] ?? 0)
    if (address.endsWith('/rest/v1/rpc/spend_credits')) {
      assert.equal(body.p_use, 'speech')
      used[body.p_user_id] = (used[body.p_user_id] ?? 0) + body.p_credits
      return json(used[body.p_user_id])
    }
    if (address.endsWith('/rest/v1/rpc/record_ai_call')) {
      if (recording === 'down') return json({ message: 'down' }, 500)
      recorded.push(body)
      return new Response(null, { status: 204 })
    }
    if (address.startsWith(GENERATION_URL)) {
      looked.push({ address, headers: init.headers })
      return generation()
    }
    if (address === 'https://openrouter.ai/api/v1/audio/speech') {
      sent.push({ headers: init.headers, body: JSON.parse(init.body) })
      return provider(JSON.parse(init.body))
    }
    throw new Error(`unexpected fetch of ${address}`)
  }
})

afterEach(async () => {
  // A record still on its way would land in the next test's lists.
  await Promise.all(later)
  globalThis.fetch = realFetch
  COST_LOOKUP.waitMs = realWait
})

describe('POST /v1/speech', () => {
  it('answers wav in the named voice, with the key held by the Worker', async () => {
    const res = await call({ voice: 'kore', text: '안녕하세요' })

    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'audio/wav')
    const body = new Uint8Array(await res.arrayBuffer())
    assert.deepEqual(body, wav(PCM))
    assert.equal(new TextDecoder().decode(body.slice(0, 4)), 'RIFF')
    assert.deepEqual(body.slice(44), PCM)
    assert.deepEqual(sent[0].body, {
      model: SPEECH_MODELS.multilingual.standard,
      input: '안녕하세요',
      voice: 'Kore',
      response_format: 'pcm',
    })
    assert.equal(sent[0].headers.authorization, 'Bearer or-key')
    assert.equal(res.headers.get('x-voice'), 'Kore')
    assert.equal(res.headers.get('x-tier'), 'standard')
  })

  it('spends the standard tier’s credits by the second, unless premium is asked for', async () => {
    assert.deepEqual(CREDIT_RATES.speech, { standard: 160, premium: 270 })
    await call({ voice: 'Kore', text: 'Hi' })
    assert.equal(used[SUBJECT], charge(SECONDS, 'standard'))

    const res = await call({ voice: 'Kore', text: 'Hi', tier: 'premium' }, ENV, OTHER)
    assert.equal(res.headers.get('x-tier'), 'premium')
    assert.equal(sent[1].body.model, SPEECH_MODELS.multilingual.premium)
    assert.equal(used[OTHER], charge(SECONDS, 'premium'))
  })

  it('reads a Chinese voice with the Chinese model, answering its mp3 as it came', async () => {
    const res = await call({ voice: 'yunzhou', text: '欢迎使用 WildCrane，AI 版本 v2.5。', tier: 'premium' })

    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'audio/mpeg')
    assert.equal(res.headers.get('x-voice'), 'Yunzhou')
    assert.deepEqual(new Uint8Array(await res.arrayBuffer()), MP3)
    assert.deepEqual(sent[0].body, {
      model: SPEECH_MODELS.zh.premium,
      input: '欢迎使用 WildCrane，AI 版本 v2.5。',
      voice: VOICES.Yunzhou.id,
      response_format: 'mp3',
    })
    assert.equal(used[SUBJECT], charge(MP3_SECONDS, 'premium'))
    await Promise.all(later)
    assert.deepEqual(recorded, [
      row({ p_usage: MP3_SECONDS, p_cost_usd: 0.003, p_generation_id: 'gen-s1', p_tier: 'premium' }),
    ])
  })

  it('reads an English voice with the English model, as wav', async () => {
    const res = await call({ voice: 'Arthur', text: 'Welcome to WildCrane 2.5.' })

    assert.equal(res.headers.get('content-type'), 'audio/wav')
    assert.deepEqual(sent[0].body, {
      model: SPEECH_MODELS.en.standard,
      input: 'Welcome to WildCrane 2.5.',
      voice: VOICES.Arthur.id,
      response_format: 'pcm',
    })
  })

  it('refuses a line whose main language is not the voice’s, before reaching the provider', async () => {
    const zh = await call({ voice: 'Arthur', text: '欢迎使用 WildCrane。' })
    assert.equal(zh.status, 400)
    assert.equal((await zh.json()).error.message, 'This text is in Chinese. Pick a Chinese voice.')

    const en = await call({ voice: 'Yunzhou', text: 'Welcome to 野鹤.' })
    assert.equal((await en.json()).error.message, 'This text is in English. Pick an English voice.')
    assert.equal(sent.length, 0)
    assert.equal(used[SUBJECT], undefined)
  })

  it('lets a multilingual voice read any language', async () => {
    assert.equal((await call({ voice: 'Kore', text: '欢迎使用 WildCrane。' })).status, 200)
  })

  it('refuses an unknown tier', async () => {
    const res = await call({ voice: 'Kore', text: 'Hi', tier: 'economy' })
    assert.equal(res.status, 400)
    assert.equal(sent.length, 0)
  })

  it('records the call after answering, with its seconds and the cost looked up by generation (#1355)', async () => {
    const res = await call({ voice: 'Kore', text: 'Hi' })
    assert.equal(res.status, 200)
    assert.equal(later.length, 1)

    await Promise.all(later)
    assert.deepEqual(looked, [{ address: `${GENERATION_URL}?id=gen-s1`, headers: { authorization: 'Bearer or-key' } }])
    assert.deepEqual(recorded, [row({ p_usage: SECONDS, p_cost_usd: 0.003, p_generation_id: 'gen-s1' })])
  })

  it('records the call with no cost when the lookup finds none, keeping the generation', async () => {
    generation = () => json({ error: { message: 'not found' } }, 404)
    await call({ voice: 'Kore', text: 'Hi' })
    await Promise.all(later)

    assert.equal(looked.length, COST_LOOKUP.tries)
    assert.deepEqual(recorded, [row({ p_usage: SECONDS, p_generation_id: 'gen-s1' })])
  })

  it('answers and charges all the same when the call cannot be recorded', async () => {
    recording = 'down'
    assert.equal((await call({ voice: 'Kore', text: 'Hi' })).status, 200)
    await Promise.all(later)
    assert.equal(used[SUBJECT], charge(SECONDS, 'standard'))
  })

  it('serves Pro whether or not the account is admitted to Cloud', async () => {
    admitted = false
    assert.equal((await call({ voice: 'Kore', text: 'Hi' })).status, 200)
  })

  it('refuses a free or lapsed user, before reaching the provider', async () => {
    subscriptions[SUBJECT] = []
    const free = await call({ voice: 'Kore', text: 'Hi' })
    assert.equal(free.status, 403)
    assert.equal((await free.json()).error.code, 'pro_required')

    subscriptions[SUBJECT] = [{ ...PRO, status: 'canceled', current_period_end: '2020-01-01T00:00:00.000Z' }]
    assert.equal((await call({ voice: 'Kore', text: 'Hi' })).status, 403)
    assert.equal(sent.length, 0)
  })

  it('stops a user whose credits are used up, and only that user', async () => {
    used[SUBJECT] = MONTHLY_CREDITS
    const res = await call({ voice: 'Kore', text: 'Hi' })

    assert.equal(res.status, 429)
    assert.equal((await res.json()).error.code, 'credits_used_up')
    assert.ok(Number(res.headers.get('retry-after')) > 0)
    assert.equal(sent.length, 0)
    assert.equal(recorded.length, 0)

    assert.equal((await call({ voice: 'Kore', text: 'Hi' }, ENV, OTHER)).status, 200)
  })

  it('stops a trial user at the trial’s 1000 credits, with no retry (#1932)', async () => {
    subscriptions[SUBJECT] = []
    trials[SUBJECT] = { starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 86_400_000).toISOString() }
    trialUsed[SUBJECT] = TRIAL_CREDITS - 1
    assert.equal((await call({ voice: 'Kore', text: 'Hi' })).status, 200)

    trialUsed[SUBJECT] = TRIAL_CREDITS
    const res = await call({ voice: 'Kore', text: 'Hi' })
    assert.equal(res.status, 429)
    assert.equal((await res.json()).error.code, 'credits_used_up')
    assert.equal(res.headers.get('retry-after'), null)
  })

  it('lets a line start with any credit left', async () => {
    used[SUBJECT] = MONTHLY_CREDITS - 1
    assert.equal((await call({ voice: 'Kore', text: 'Hi' })).status, 200)
  })

  it('refuses an unknown voice and an empty line', async () => {
    assert.equal((await call({ voice: 'alloy', text: 'Hi' })).status, 400)
    assert.equal((await call({ voice: 'Kore', text: ' ' })).status, 400)
    assert.equal(sent.length, 0)
  })

  it('says so when this build carries no key', async () => {
    const res = await call({ voice: 'Kore', text: 'Hi' }, { ...ENV, OPENROUTER_API_KEY: undefined })

    assert.equal(res.status, 503)
    assert.equal((await res.json()).error.code, 'speech_unavailable')
  })

  it('turns a provider failure into a refusal of its own', async () => {
    provider = () => json({ error: { message: 'upstream' } }, 500)
    const res = await call({ voice: 'Kore', text: 'Hi' })

    assert.equal(res.status, 502)
    assert.equal((await res.json()).error.code, 'speech_failed')
    assert.equal(used[SUBJECT], undefined)

    provider = () => {
      throw new Error('offline')
    }
    assert.equal((await call({ voice: 'Kore', text: 'Hi' })).status, 502)
    assert.deepEqual(recorded, Array(2).fill(row({ p_ok: false })))
  })
})

const row = (over = {}) => ({
  p_user_id: SUBJECT,
  p_capability: 'speech',
  p_ok: true,
  p_usage: null,
  p_cost_usd: null,
  p_generation_id: null,
  p_tier: 'standard',
  ...over,
})

async function call(body, env = ENV, subject = SUBJECT) {
  const request = new Request('https://api.example/v1/speech', {
    method: 'POST',
    headers: { authorization: `Bearer ${await token(subject)}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return worker.fetch(request, env, { waitUntil: (promise) => void later.push(promise) })
}

async function token(subject) {
  const now = Math.floor(Date.now() / 1000)
  const claims = { sub: subject, iss: issuerFor(SUPABASE_URL), aud: 'authenticated', exp: now + 3600 }
  const input = `${b64u(JSON.stringify({ alg: 'ES256', kid: 'k' }))}.${b64u(JSON.stringify(claims))}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    keyPair.privateKey,
    new TextEncoder().encode(input),
  )
  return `${input}.${b64uBytes(new Uint8Array(signature))}`
}

describe('mainLanguage', () => {
  it('counts each Latin word against the Han characters', () => {
    assert.equal(mainLanguage('在 WildCrane v2.5 里，AI 会先写 script，再用 TTS 生成旁白。'), 'zh')
    assert.equal(mainLanguage('Welcome to 野鹤.'), 'en')
    assert.equal(mainLanguage('2.5'), null)
  })
})

describe('mp3Seconds', () => {
  it('sums the frames past the ID3 tag', () => {
    assert.equal(mp3Seconds(MP3), MP3_SECONDS)
  })
})

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const b64u = (text) => b64uBytes(new TextEncoder().encode(text))

const b64uBytes = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

describe('VOICES', () => {
  it('matches the scriptwriter’s voice list, group by group', async () => {
    const { readFile } = await import('node:fs/promises')
    const list = await readFile(new URL('../../cli/src/agents/scriptwriter/references/voices.md', import.meta.url), 'utf8')
    const groups = { Chinese: 'zh', English: 'en', Multilingual: 'multilingual' }
    const listed = {}
    let group
    for (const line of list.split('\n')) {
      if (line.startsWith('## ')) group = groups[line.slice(3)]
      const name = /^\| (\w+) \|/.exec(line)?.[1]
      if (name && name !== 'Voice') listed[name] = group
    }
    assert.deepEqual(listed, Object.fromEntries(Object.entries(VOICES).map(([name, v]) => [name, v.language])))
  })
})
