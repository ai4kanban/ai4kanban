#!/usr/bin/env node
// Generate a video cover through AI4Kanban Cloud, spending the user's Pro credits per image.
//
//   node scripts/image.mjs --aspect <ratio> [--ref <file>]… --out <file.png> "<prompt>"
//
// Runtime: Node 18 or later, nothing else. Save it from a built-in agent with
// `akb raw agent-file cover-designer scripts/image.mjs > image.mjs`. It acts as the AI4Kanban
// Cloud account this machine is signed in to: on failure it prints why and exits 1. Exit 2 is a
// usage error.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const API = (process.env.AI4KANBAN_CLOUD_URL || 'https://api.ai4kanban.dev').replace(/\/+$/, '')
const ANON_KEY = process.env.AI4KANBAN_SUPABASE_ANON_KEY || 'sb_publishable_ioUQ23BTtoj8NKqndp0Jrw_omVR3m4n'
const HOME = process.env.AI4KANBAN_HOME || path.join(os.homedir(), '.ai4kanban')
const SESSION = path.join(HOME, 'session.json')
const LOCK = path.join(HOME, 'session.lock')

const FALLBACK = {
  zh: '也可以改用素材排版制作封面。',
  en: 'You can also lay out the cover from existing material instead.',
}
const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
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
  pro_required: {
    zh: '生成封面是 Pro 功能。升级 Pro：https://ai4kanban.dev/pricing',
    en: 'Generated covers are a Pro feature. Upgrade at https://ai4kanban.dev/pricing',
  },
  credits_used_up: {
    zh: '本月积分已用完，下月 1 日（UTC）重置；可在桌面应用的 Billing 页查看余额。',
    en: 'This month’s AI credits are used up. They reset on the 1st of next month (UTC); check your balance on the Billing page in the desktop app.',
  },
  failed: {
    zh: '封面暂时无法生成，请稍后重试。',
    en: 'The cover could not be generated right now. Try again later.',
  },
}

class Failure extends Error {}

/** Thrown, not exited, so the refresh lock is released on the way out. */
function fail(key) {
  const m = MESSAGES[key]
  throw new Failure([m.zh, m.en, FALLBACK.zh, FALLBACK.en].join('\n'))
}

function usage(problem) {
  console.error(`${problem}\nusage: node scripts/image.mjs --aspect <ratio> [--ref <file>]… --out <file.png> "<prompt>"`)
  process.exit(2)
}

function parseArgs(argv) {
  const args = { prompt: [], refs: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--aspect' || a === '--out') args[a.slice(2)] = argv[++i]
    else if (a === '--ref') args.refs.push(argv[++i])
    else args.prompt.push(a)
  }
  if (!args.aspect) usage('Missing --aspect.')
  if (!args.out) usage('Missing --out.')
  args.prompt = args.prompt.join(' ').trim()
  if (!args.prompt) usage('Missing the prompt.')
  return args
}

function dataUrl(file) {
  const type = TYPES[path.extname(file ?? '').toLowerCase()]
  if (!type) usage(`--ref ${file ?? ''}: use a PNG, JPEG or WebP file.`)
  try {
    return `data:${type};base64,${fs.readFileSync(file).toString('base64')}`
  } catch (e) {
    usage(`--ref ${file}: ${e.message}`)
  }
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

const { aspect, refs, out, prompt } = parseArgs(process.argv.slice(2))
const references = refs.map(dataUrl)
try {
  const token = await accessToken()
  let res
  try {
    res = await fetch(`${API}/v1/image`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, aspect, references }),
    })
  } catch {
    fail('unreachable')
  }
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}))
    if (res.status === 401) fail('expired')
    if (error?.code === 'pro_required' || error?.code === 'credits_used_up') fail(error.code)
    if (res.status === 400) usage(error?.message ?? 'The request was refused.')
    fail('failed')
  }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()))
  console.log(`${out} (${res.headers.get('x-model') ?? 'unknown model'})`)
} catch (e) {
  if (!(e instanceof Failure)) throw e
  console.error(e.message)
  process.exit(1)
}
