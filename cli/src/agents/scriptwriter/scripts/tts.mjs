#!/usr/bin/env node
// Generate narration in a hosted voice from references/voices.md.
//
//   node scripts/tts.mjs --voice <name> --out <file.wav> "<text>"
//
// Runtime: Node 18 or later, nothing else. Save it from a built-in agent with
// `akb raw agent-file scriptwriter scripts/tts.mjs > tts.mjs`. It acts as the AI4Kanban Cloud
// account this machine is signed in to, and never falls back to another voice: on failure it
// prints why and exits 1. Exit 2 is a usage error.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const API = (process.env.AI4KANBAN_CLOUD_URL || 'https://api.ai4kanban.dev').replace(/\/+$/, '')
const ANON_KEY = process.env.AI4KANBAN_SUPABASE_ANON_KEY || 'sb_publishable_ioUQ23BTtoj8NKqndp0Jrw_omVR3m4n'
const HOME = process.env.AI4KANBAN_HOME || path.join(os.homedir(), '.ai4kanban')
const SESSION = path.join(HOME, 'session.json')
const LOCK = path.join(HOME, 'session.lock')

const FALLBACK = {
  zh: '也可以改用本地声音（`npx hyperframes tts --list`）。',
  en: 'You can also use a local voice instead (`npx hyperframes tts --list`).',
}
const MESSAGES = {
  'signed-out': {
    zh: '未登录 AI4Kanban Cloud。请在 AI4Kanban 应用的“配置 → Cloud”中登录后重试。',
    en: 'Not signed in to AI4Kanban Cloud. Sign in from Configuration → Cloud in the AI4Kanban app, then try again.',
  },
  expired: {
    zh: 'AI4Kanban Cloud 登录已过期。请在 AI4Kanban 应用的“配置 → Cloud”中重新登录后重试。',
    en: 'Your AI4Kanban Cloud sign-in has expired. Sign in again from Configuration → Cloud in the AI4Kanban app, then try again.',
  },
  unreachable: {
    zh: '无法连接 AI4Kanban Cloud。请检查网络后重试。',
    en: 'Could not reach AI4Kanban Cloud. Check your connection and try again.',
  },
  not_admitted: {
    zh: '托管声音目前只对已受邀的 AI4Kanban Cloud 用户开放。',
    en: 'Hosted voices are available to invited AI4Kanban Cloud users only.',
  },
  failed: {
    zh: '托管声音暂时无法生成旁白，请稍后重试。',
    en: 'Hosted voices could not generate the narration right now. Try again later.',
  },
}

class Failure extends Error {}

/** Thrown, not exited, so the refresh lock is released on the way out. */
function fail(key) {
  const m = MESSAGES[key]
  throw new Failure([m.zh, m.en, FALLBACK.zh, FALLBACK.en].join('\n'))
}

function usage(problem) {
  console.error(`${problem}\nusage: node scripts/tts.mjs --voice <name> --out <file.wav> "<text>"`)
  process.exit(2)
}

function parseArgs(argv) {
  const args = { text: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--voice' || a === '--out') args[a.slice(2)] = argv[++i]
    else args.text.push(a)
  }
  if (!args.voice) usage('Missing --voice.')
  if (!args.out) usage('Missing --out.')
  args.text = args.text.join(' ').trim()
  if (!args.text) usage('Missing the text to speak.')
  return args
}

function readSession() {
  try {
    const held = JSON.parse(fs.readFileSync(SESSION, 'utf8'))
    return held.accessToken && held.refreshToken && held.supabaseUrl ? held : null
  } catch {
    return null
  }
}

/** A token good for the next minute. Refreshes under the lock the app and `akb` share, so no
 *  two processes spend the same refresh token. */
async function accessToken() {
  let held = readSession()
  if (!held) fail('signed-out')
  if (Number(held.expiresAt) - 60_000 > Date.now()) return held.accessToken

  const release = await takeLock()
  try {
    held = readSession()
    if (!held) fail('signed-out')
    if (Number(held.expiresAt) - 60_000 > Date.now()) return held.accessToken
    let res
    try {
      res = await fetch(`${held.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ refresh_token: held.refreshToken }),
      })
    } catch {
      fail('unreachable')
    }
    if (res.status >= 500) fail('unreachable')
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.access_token || !body.refresh_token) fail('expired')
    const next = {
      ...held,
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: body.expires_at ? body.expires_at * 1000 : Date.now() + (body.expires_in ?? 3600) * 1000,
    }
    const tmp = `${SESSION}.${process.pid}.tmp`
    fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
    fs.renameSync(tmp, SESSION)
    return next.accessToken
  } finally {
    release()
  }
}

async function takeLock() {
  const until = Date.now() + 20_000
  for (;;) {
    try {
      fs.mkdirSync(LOCK)
      fs.writeFileSync(path.join(LOCK, 'owner'), `${process.pid}\n`)
      return () => fs.rmSync(LOCK, { recursive: true, force: true })
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
      let age = 0
      try {
        age = Date.now() - fs.statSync(LOCK).mtimeMs
      } catch {}
      if (age > 30_000) fs.rmSync(LOCK, { recursive: true, force: true })
      else if (Date.now() > until) return () => {}
      else await new Promise((r) => setTimeout(r, 50))
    }
  }
}

const { voice, out, text } = parseArgs(process.argv.slice(2))
try {
  const token = await accessToken()
  let res
  try {
    res = await fetch(`${API}/v1/speech`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ voice, text }),
    })
  } catch {
    fail('unreachable')
  }
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}))
    if (res.status === 401) fail('expired')
    if (error?.code === 'not_admitted') fail('not_admitted')
    if (res.status === 400) usage(error?.message ?? 'The request was refused.')
    fail('failed')
  }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()))
  console.log(`${out} (${res.headers.get('x-voice') ?? voice})`)
} catch (e) {
  if (!(e instanceof Failure)) throw e
  console.error(e.message)
  process.exit(1)
}
