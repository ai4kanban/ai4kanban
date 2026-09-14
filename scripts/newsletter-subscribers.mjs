#!/usr/bin/env node
// Turn the repo's stargazers into a deliverable newsletter list.
//
// Walks every stargazer, looks for an email that clearly belongs to that person
// (public profile → their own website → a public commit we can attribute), and keeps the
// result in one local file outside the repo, plus an encrypted copy to carry elsewhere.
//
//   node scripts/newsletter-subscribers.mjs                  # collect, write, back up
//   node scripts/newsletter-subscribers.mjs --max-lookups 50 # smaller slice of the queue
//   node scripts/newsletter-subscribers.mjs --dry-run        # report only, write nothing
//
// GITHUB_TOKEN is required (the unauthenticated rate limit is too small to finish).
// NEWSLETTER_BACKUP_PASSPHRASE encrypts the backup; without it openssl asks on the tty.
//
// The list and its backup live in ~/.ai4kanban/newsletter/ and never enter git. An
// unsubscribe is permanent here: re-collecting can never turn it back on.

import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import {
  BACKUP_FILE,
  LIST_FILE,
  applyUnsubscribes,
  readList,
  usableEmail,
  writeList,
} from './newsletter/list.mjs'

export { usableEmail }

const REPO = 'ai4kanban/ai4kanban'
const API = 'https://api.github.com'

const MAX_LOOKUPS = 200          // per run; the rest stays queued for next time
const RECHECK_AFTER_DAYS = 30    // how long a fruitless lookup rests before a retry
const RATE_LIMIT_FLOOR = 50      // stop and save while there is still budget to spare
const MAX_COMMIT_READS = 3       // commits read back per user before giving up
const SITE_TIMEOUT_MS = 8000
const SITE_MAX_BYTES = 512 * 1024

// A mailto on one of these is not evidence the address is the stargazer's own.
const SHARED_HOSTS = new Set([
  'twitter.com', 'x.com', 'linkedin.com', 'facebook.com', 'instagram.com',
  'youtube.com', 'github.com', 'gitlab.com', 't.me', 'weibo.com', 'zhihu.com',
  'bilibili.com', 'juejin.cn', 'csdn.net',
])

const HELP = `
从 GitHub Star 用户建立周报订阅名单 / Build the newsletter list from GitHub stargazers

用法 / Usage
  node scripts/newsletter-subscribers.mjs [选项 / options]

选项 / Options
  --repo <owner/name>   目标仓库 / repository (默认 / default: ${REPO})
  --max-lookups <n>     本次最多查找几位用户 / email lookups this run (默认 / default: ${MAX_LOOKUPS})
  --dry-run             只报告，不写名单 / report only, write nothing
  --no-backup           跳过加密备份 / skip the encrypted backup
  -h, --help            显示本说明 / show this help

环境变量 / Environment
  GITHUB_TOKEN                      GitHub 访问令牌，必填 / access token, required
  NEWSLETTER_BACKUP_PASSPHRASE      备份口令；留空则由 openssl 询问 / backup passphrase; openssl asks if unset

名单位置 / List location
  ${LIST_FILE}
`.trim()

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const opts = { repo: REPO, maxLookups: MAX_LOOKUPS, dryRun: false, backup: true }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') opts.help = true
    else if (arg === '--dry-run') opts.dryRun = true
    else if (arg === '--no-backup') opts.backup = false
    else if (arg === '--repo') opts.repo = argv[++i]
    else if (arg === '--max-lookups') opts.maxLookups = Number(argv[++i])
    else die(`无法识别的选项 / Unknown option: ${arg}`)
  }
  if (!opts.repo || !/^[\w.-]+\/[\w.-]+$/.test(opts.repo)) die('仓库格式应为 owner/name / Repository must be owner/name')
  if (!Number.isFinite(opts.maxLookups) || opts.maxLookups < 1) die('--max-lookups 需要一个正整数 / --max-lookups needs a positive number')
  return opts
}

function die(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

const say = (message) => process.stdout.write(`${message}\n`)

// ---------------------------------------------------------------- github api

let rateRemaining = Infinity

async function gh(endpoint) {
  const res = await fetch(`${API}${endpoint}`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'user-agent': 'ai4kanban-newsletter',
      'x-github-api-version': '2022-11-28',
    },
  })
  const remaining = Number(res.headers.get('x-ratelimit-remaining'))
  if (Number.isFinite(remaining)) rateRemaining = remaining
  if (res.status === 404) return null
  if (res.status === 403 || res.status === 429) {
    rateRemaining = 0
    return null
  }
  if (!res.ok) throw new Error(`GitHub ${res.status} ${endpoint}`)
  return res.json()
}

async function fetchStargazers(repo) {
  const users = []
  for (let page = 1; page <= 400; page++) {
    const batch = await gh(`/repos/${repo}/stargazers?per_page=100&page=${page}`)
    if (!batch) break
    if (!Array.isArray(batch) || batch.length === 0) break
    users.push(...batch.filter((u) => u && u.login && u.type === 'User'))
    if (batch.length < 100) break
  }
  return users
}

// ---------------------------------------------------------------- email rules

// A commit counts only when GitHub itself ties it to the account — that link exists
// because the address is registered to it, which is the attribution we need.
export function commitBelongsTo(commit, login) {
  return String(commit?.author?.login || '').toLowerCase() === login.toLowerCase()
}

export function siteUrl(blog) {
  const raw = String(blog || '').trim()
  if (!raw) return null
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    const host = url.hostname.replace(/^www\./, '')
    if (SHARED_HOSTS.has(host)) return null
    return url
  } catch {
    return null
  }
}

export async function mailtoOnSite(url) {
  // Someone else's server, on someone else's schedule: a timeout aborts the body read too,
  // so the whole visit stays inside one catch.
  let html
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(SITE_TIMEOUT_MS),
      headers: { 'user-agent': 'ai4kanban-newsletter', accept: 'text/html' },
    })
    if (!res.ok || !String(res.headers.get('content-type') || '').includes('text/html')) return null
    html = (await res.text()).slice(0, SITE_MAX_BYTES)
  } catch {
    return null
  }
  for (const match of html.matchAll(/mailto:([^"'?\s>]+)/gi)) {
    let candidate = match[1]
    try {
      candidate = decodeURIComponent(candidate)
    } catch {
      // a stray % in the href — take it as written
    }
    const email = usableEmail(candidate)
    if (email) return email
  }
  return null
}

// Public profile → their own website → an attributable public commit.
export async function findEmail(login) {
  const user = await gh(`/users/${login}`)
  if (!user) return { state: 'none' }

  const profileEmail = usableEmail(user.email)
  if (profileEmail) {
    return { state: 'found', email: profileEmail, source: 'profile', sourceUrl: user.html_url, name: user.name }
  }

  const site = siteUrl(user.blog)
  if (site) {
    const siteEmail = await mailtoOnSite(site)
    if (siteEmail) {
      return { state: 'found', email: siteEmail, source: 'website', sourceUrl: site.href, name: user.name }
    }
  }

  // The events feed no longer carries the commits themselves, only the head each push
  // landed on — so read those commits back, newest first.
  const events = await gh(`/users/${login}/events/public?per_page=100`)
  const heads = []
  for (const event of Array.isArray(events) ? events : []) {
    if (event.type !== 'PushEvent') continue
    if (event.actor?.login?.toLowerCase() !== login.toLowerCase()) continue
    const sha = event.payload?.head
    const repo = event.repo?.name
    if (!sha || !repo || heads.some((h) => h.sha === sha)) continue
    heads.push({ repo, sha })
    if (heads.length >= MAX_COMMIT_READS) break
  }
  for (const { repo, sha } of heads) {
    const commit = await gh(`/repos/${repo}/commits/${sha}`)
    if (!commit || !commitBelongsTo(commit, login)) continue
    const email = usableEmail(commit.commit?.author?.email)
    if (email) {
      return { state: 'found', email, source: 'commit', sourceUrl: commit.html_url, name: user.name }
    }
  }

  return { state: 'none', name: user.name }
}

// ---------------------------------------------------------------- the list file

function newRecord(user, now) {
  return {
    login: user.login,
    github_id: user.id,
    name: null,
    profile_url: user.html_url || `https://github.com/${user.login}`,
    email: null,
    source: 'collected',        // collected | subscribed — only `subscribed` survives an unsubscribe
    email_source: null,         // profile | website | commit
    email_source_url: null,
    deliverable: false,
    undeliverable_reason: 'pending_lookup',
    unsubscribed: false,
    unsubscribed_at: null,
    first_seen_at: now,
    last_checked_at: null,
    sends: [],
  }
}

// Whoever claimed the address first keeps it; everyone else is held back as a duplicate.
export function dedupe(subscribers) {
  const owner = new Map()
  const ordered = [...subscribers].sort((a, b) => String(a.first_seen_at).localeCompare(String(b.first_seen_at)))
  for (const record of ordered) {
    if (!record.email || record.unsubscribed) continue
    const held = owner.get(record.email)
    if (!held) {
      owner.set(record.email, record)
      if (record.undeliverable_reason === 'duplicate_email') {
        record.deliverable = true
        record.undeliverable_reason = null
      }
      continue
    }
    record.deliverable = false
    record.undeliverable_reason = 'duplicate_email'
  }
}

// The rules tighten over time; an address the list already holds must still pass them.
export function revalidate(subscribers) {
  let dropped = 0
  for (const record of subscribers) {
    if (!record.email || record.unsubscribed) continue
    if (usableEmail(record.email)) continue
    record.email = null
    record.email_source = null
    record.email_source_url = null
    record.deliverable = false
    record.undeliverable_reason = 'address_rejected'
    record.last_checked_at = null
    dropped++
  }
  return dropped
}

// ---------------------------------------------------------------- backup

function backup(passphrase) {
  const tmp = `${BACKUP_FILE}.tmp`
  const pass = passphrase ? ['-pass', 'env:NEWSLETTER_BACKUP_PASSPHRASE'] : []
  const run = spawnSync('openssl', ['enc', '-aes-256-cbc', '-pbkdf2', '-salt', '-in', LIST_FILE, '-out', tmp, ...pass], {
    stdio: passphrase ? 'pipe' : 'inherit',
  })
  if (run.status !== 0) {
    fs.rmSync(tmp, { force: true })
    return { ok: false, reason: (run.stderr?.toString() || '').trim() || '加密失败 / encryption failed' }
  }
  fs.chmodSync(tmp, 0o600)
  fs.renameSync(tmp, BACKUP_FILE)

  if (!passphrase) return { ok: true, verified: false }
  const check = spawnSync('openssl', ['enc', '-d', '-aes-256-cbc', '-pbkdf2', '-in', BACKUP_FILE, '-pass', 'env:NEWSLETTER_BACKUP_PASSPHRASE'], { maxBuffer: 1 << 28 })
  const same = check.status === 0 && check.stdout.toString() === fs.readFileSync(LIST_FILE, 'utf8')
  return { ok: true, verified: same }
}

// ---------------------------------------------------------------- run

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) return say(HELP)
  if (!process.env.GITHUB_TOKEN) die('需要 GITHUB_TOKEN 环境变量 / GITHUB_TOKEN is required')

  const now = new Date().toISOString()
  const list = readList(opts.repo)
  list.repo = opts.repo

  say(`仓库 / Repository: ${opts.repo}`)
  const stargazers = await fetchStargazers(opts.repo)
  say(`Star 用户 / Stargazers: ${stargazers.length}`)

  const byLogin = new Map(list.subscribers.map((r) => [r.login.toLowerCase(), r]))
  let added = 0
  for (const user of stargazers) {
    if (byLogin.has(user.login.toLowerCase())) continue
    const record = newRecord(user, now)
    list.subscribers.push(record)
    byLogin.set(user.login.toLowerCase(), record)
    added++
  }

  const dropped = revalidate(list.subscribers)

  // Before the queue is built, not just after it is spent: a fresh record for someone who
  // already left is blocked by their login, and looking their address up would be both a
  // wasted call and a lookup nobody asked for.
  applyUnsubscribes(list)

  // Never looked at first; then the ones whose last look found nothing, oldest first.
  const stale = Date.now() - RECHECK_AFTER_DAYS * 86400000
  const queue = list.subscribers
    .filter((r) => !r.email && !r.unsubscribed)
    .filter((r) => !r.last_checked_at || Date.parse(r.last_checked_at) < stale)
    .sort((a, b) => String(a.last_checked_at || '').localeCompare(String(b.last_checked_at || '')))

  say(`待查找 / Queued for lookup: ${queue.length}`)

  let looked = 0
  let found = 0
  let stoppedByRateLimit = false
  for (const record of queue) {
    if (looked >= opts.maxLookups) break
    if (rateRemaining < RATE_LIMIT_FLOOR) {
      stoppedByRateLimit = true
      break
    }
    let result
    try {
      result = await findEmail(record.login)
    } catch (error) {
      result = { state: 'none' }
      process.stderr.write(`  跳过 / Skipped ${record.login}: ${error.message}\n`)
    }
    looked++
    record.last_checked_at = new Date().toISOString()
    if (result.name) record.name = result.name
    if (result.state === 'found') {
      record.email = result.email
      record.email_source = result.source
      record.email_source_url = result.sourceUrl
      record.deliverable = true
      record.undeliverable_reason = null
      found++
    } else {
      record.undeliverable_reason = 'no_public_email'
    }
    if (looked % 25 === 0) process.stderr.write(`  查找中 / Looking up: ${looked}/${Math.min(queue.length, opts.maxLookups)}\n`)
  }

  applyUnsubscribes(list)
  dedupe(list.subscribers)

  const deliverable = list.subscribers.filter((r) => r.deliverable && !r.unsubscribed)
  const remaining = list.subscribers.filter((r) => !r.email && !r.unsubscribed && !r.last_checked_at).length

  say('')
  say(`新增 Star 用户 / Newly starred: ${added}`)
  say(`本次查找 / Looked up this run: ${looked}，找到邮箱 / with an email: ${found}`)
  say(`可投递 / Deliverable: ${deliverable.length}`)
  say(`已退订 / Unsubscribed: ${list.subscribers.filter((r) => r.unsubscribed).length}`)
  say(`仍待查找 / Still queued: ${remaining}`)
  if (dropped) say(`已按当前规则剔除的旧地址 / Held addresses the rules now reject: ${dropped}`)
  if (stoppedByRateLimit) say('已接近 GitHub 速率上限，余下的下次继续 / Near the GitHub rate limit; the rest waits for the next run')

  if (opts.dryRun) return say('\n预演，未写入名单 / Dry run — nothing written')

  writeList(list)
  say(`\n名单 / List: ${LIST_FILE}`)

  if (!opts.backup) return
  const passphrase = process.env.NEWSLETTER_BACKUP_PASSPHRASE
  if (!passphrase && !process.stdin.isTTY) {
    return say('未设置 NEWSLETTER_BACKUP_PASSPHRASE，跳过加密备份 / No passphrase set — backup skipped')
  }
  const result = backup(passphrase)
  if (!result.ok) return say(`加密备份失败 / Backup failed: ${result.reason}`)
  say(`备份 / Backup: ${BACKUP_FILE}${result.verified ? ' (已校验 / verified)' : ''}`)
}

// Not `import.meta.main` — that needs Node 24.2/22.18, and below it the script would
// silently do nothing at all.
const isEntry = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isEntry) main().catch((error) => die(`运行失败 / Failed: ${error.message}`))
