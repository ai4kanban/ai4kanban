#!/usr/bin/env node
// Send one issue of the newsletter: preview it, mail it to yourself, mail it to the list,
// then pick up whatever failed.
//
//   node scripts/newsletter-send.mjs --issue 2026-09-13 --preview
//   node scripts/newsletter-send.mjs --issue 2026-09-13 --test reader@example.com
//   node scripts/newsletter-send.mjs --issue 2026-09-13 --send
//   node scripts/newsletter-send.mjs --issue 2026-09-13 --retry
//
// The list stays on this machine (`~/.ai4kanban/newsletter/subscribers.json`). Every send is
// written to it as it happens, so an interrupted run resumes where it stopped and one
// address is mailed once per issue. Setup and the environment variables: scripts/newsletter/README.md.

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  LIST_FILE,
  applyUnsubscribes,
  readList,
  readSecret,
  unsubscribeToken,
  usableEmail,
  writeList,
} from './newsletter/list.mjs'
import { isAbsolute, renderIssue, validateIssue, withoutImages } from './newsletter/template.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ISSUE_DIR = path.join(ROOT, 'scripts', 'newsletter', 'issues')
const PUBLIC_DIR = path.join(ROOT, 'web', 'public')
const PREVIEW_DIR = path.join(path.dirname(LIST_FILE), 'preview')

const RESEND_API = 'https://api.resend.com'
const SITE_URL = process.env.NEWSLETTER_SITE_URL || 'https://ai4kanban.dev'
const MAIL_FROM = process.env.NEWSLETTER_FROM || 'AI4Kanban <newsletter@ai4kanban.dev>'
const REPLY_TO = process.env.NEWSLETTER_REPLY_TO || 'support@ai4kanban.dev'

// Resend's free tier allows two requests a second. One send every 600ms stays under it with
// room for the odd retry, and 9 readers finish in six seconds.
const SEND_GAP_MS = 600

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif' }

const HELP = `
发送一期周报 / Send one issue of the newsletter

用法 / Usage
  node scripts/newsletter-send.mjs --issue <id> <动作 / action>

动作 / Actions
  --preview             在浏览器里预览这一期 / open this issue in a browser
  --test <address>      测试发送给一个地址 / send one copy to this address
  --send                正式发送给名单 / send to the list
  --retry               重试失败的投递 / pick up the deliveries that failed

选项 / Options
  --issue <id>          期号，对应 scripts/newsletter/issues/<id>.json / the issue file
  --dry-run             只报告发给谁，不发信 / report the recipients, send nothing
  --no-open             预览时不打开浏览器 / do not open the browser on preview
  -h, --help            显示本说明 / show this help

环境变量 / Environment
  RESEND_API_KEY                 Resend 的 API key，发信必填 / required to send
  NEWSLETTER_ADMIN_TOKEN         读取站点退订记录的令牌 / reads the site's unsubscribes
  NEWSLETTER_UNSUBSCRIBE_SECRET  退订链接的签名密钥；留空则用本机保存的那把 / signs the links
  NEWSLETTER_FROM                发件人，默认 / default: ${MAIL_FROM}
  NEWSLETTER_SITE_URL            站点地址，默认 / default: ${SITE_URL}
`.trim()

// ---------------------------------------------------------------- arguments

export function parseArgs(argv) {
  const opts = { dryRun: false, open: true }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') opts.help = true
    else if (arg === '--issue') opts.issue = argv[++i]
    else if (arg === '--preview') opts.action = 'preview'
    else if (arg === '--send') opts.action = 'send'
    else if (arg === '--retry') opts.action = 'retry'
    else if (arg === '--test') {
      opts.action = 'test'
      opts.to = argv[++i]
    } else if (arg === '--dry-run') opts.dryRun = true
    else if (arg === '--no-open') opts.open = false
    else throw new Error(`无法识别的选项 / Unknown option: ${arg}`)
  }
  if (opts.help) return opts
  if (!opts.issue) throw new Error('需要 --issue <id> / --issue <id> is required')
  if (!/^[\w.-]+$/.test(opts.issue)) throw new Error('期号只能用字母、数字、点和连字符 / An issue id is letters, digits, dots and dashes')
  if (!opts.action) throw new Error('需要 --preview、--test、--send 或 --retry / Pick --preview, --test, --send or --retry')
  if (opts.action === 'test' && !usableEmail(opts.to || '')) throw new Error(`--test 需要一个可用地址 / --test needs a usable address: ${opts.to}`)
  return opts
}

function die(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

const say = (message) => process.stdout.write(`${message}\n`)

// ---------------------------------------------------------------- the issue

function readIssue(id) {
  const file = path.join(ISSUE_DIR, `${id}.json`)
  if (!fs.existsSync(file)) die(`找不到这一期 / No such issue: ${file}`)
  const issue = JSON.parse(fs.readFileSync(file, 'utf8'))
  const problems = validateIssue(issue)
  if (problems.length) die(`这一期还不能发 / The issue is not ready:\n  ${problems.join('\n  ')}`)
  return issue
}

/** Every image the issue points at: site-root paths and hosted addresses alike. */
export function issueImages(issue) {
  return [
    '/newsletter/logo.png',
    ...(issue.hero ? [issue.hero.src] : []),
    ...(issue.highlights ?? []).flatMap((h) => (h.image ? [h.image.src] : [])),
  ]
}

function inlineImage(src) {
  if (isAbsolute(src)) return src
  const file = path.join(PUBLIC_DIR, src.replace(/^\//, ''))
  if (!fs.existsSync(file)) return `${SITE_URL}${src}`
  const mime = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`
}

/**
 * A reader's client loads every image over the network, so an issue is only sendable once
 * the site is actually serving them. Checked before the first send rather than discovered
 * in someone's inbox.
 */
async function imagesAreLive(issue) {
  const missing = []
  for (const src of issueImages(issue)) {
    const url = isAbsolute(src) ? src : `${SITE_URL}${src}`
    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) })
      if (!res.ok) missing.push(`${url} → ${res.status}`)
    } catch (error) {
      missing.push(`${url} → ${error.message}`)
    }
  }
  return missing
}

// ---------------------------------------------------------------- resend

async function resend(endpoint, init = {}) {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('需要 RESEND_API_KEY / RESEND_API_KEY is required')
  const res = await fetch(`${RESEND_API}${endpoint}`, {
    ...init,
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', ...init.headers },
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`)
  return body ? JSON.parse(body) : {}
}

async function sendOne({ issue, to, unsubscribeUrl, idempotencyKey }) {
  const mail = renderIssue(issue, { unsubscribeUrl, siteUrl: SITE_URL })
  const result = await resend('/emails', {
    method: 'POST',
    // Re-running a run that died mid-flight must not mail anyone twice; the key is the
    // issue and the reader, so Resend recognises the repeat even when our own record of it
    // never reached the disk.
    headers: idempotencyKey ? { 'idempotency-key': idempotencyKey } : {},
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [to],
      reply_to: REPLY_TO,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      headers: {
        // RFC 8058: the URL form plus the POST opt-in is what turns the client's own
        // "unsubscribe" button into one press with no page to read.
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      tags: [{ name: 'kind', value: 'newsletter' }],
    }),
  })
  return result.id
}

/**
 * What Resend's last event means for this address. `retry` is a failure that may pass on a
 * second attempt; `stop` is one that never will, and takes the address off the list.
 */
export function classify(lastEvent, bounceType) {
  switch (lastEvent) {
    case 'delivered':
    case 'opened':
    case 'clicked':
      return 'done'
    case 'delivery_delayed':
    case 'failed':
    case 'canceled':
      return 'retry'
    case 'bounced':
      return bounceType === 'Transient' ? 'retry' : 'stop'
    case 'complained':
      return 'stop'
    default:
      // queued, scheduled, sent — still on its way. Ask again later.
      return 'pending'
  }
}

/**
 * A hard bounce or a spam complaint: this address is done, for this issue and every issue
 * after it. `pending` reads `deliverable`, so clearing it here is what keeps the next send
 * away from a mailbox that does not exist or from someone who called us spam.
 */
export function stopDelivering(record, entry) {
  const complaint = entry.last_event === 'complained'
  entry.state = complaint ? 'complained' : 'bounced'
  record.deliverable = false
  record.undeliverable_reason = complaint ? 'complaint' : 'hard_bounce'
}

// ---------------------------------------------------------------- the site's unsubscribes

/**
 * Pull back what the site recorded. The site holds tokens, never addresses, so whose they
 * are is worked out here by signing every address on the list the same way.
 */
export async function pullUnsubscribes(list, secret) {
  const token = process.env.NEWSLETTER_ADMIN_TOKEN
  if (!token) throw new Error('需要 NEWSLETTER_ADMIN_TOKEN 才能读回站点上的退订 / NEWSLETTER_ADMIN_TOKEN is required to read the site\'s unsubscribes')

  const res = await fetch(`${SITE_URL}/api/newsletter/unsubscribes`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`站点答复 / The site answered ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const { tokens } = await res.json()

  const byToken = new Map()
  for (const record of list.subscribers) {
    if (record.email) byToken.set(unsubscribeToken(record.email, secret), record.email)
  }
  let matched = 0
  for (const t of Array.isArray(tokens) ? tokens : []) {
    const email = byToken.get(t)
    if (!email || list.unsubscribed_emails.includes(email)) continue
    list.unsubscribed_emails.push(email)
    matched++
  }
  applyUnsubscribes(list)
  return { seen: Array.isArray(tokens) ? tokens.length : 0, added: matched }
}

// ---------------------------------------------------------------- who gets this issue

function openList() {
  if (!fs.existsSync(LIST_FILE)) die(`还没有名单，先跑 newsletter-subscribers.mjs / No list yet — run newsletter-subscribers.mjs first: ${LIST_FILE}`)
  return readList()
}

function sendRecord(record, issue) {
  return record.sends.find((s) => s.issue === issue)
}

/** Everyone this issue still owes a copy to. */
export function pending(list, issue) {
  const seen = new Set()
  const out = []
  for (const record of list.subscribers) {
    if (!record.email || record.unsubscribed || !record.deliverable) continue
    // Claimed before the send is looked at: a second record for the same address must not
    // be owed a copy just because the first one already has one.
    if (seen.has(record.email)) continue
    seen.add(record.email)
    const sent = sendRecord(record, issue)
    if (sent && sent.state !== 'retry') continue
    out.push(record)
  }
  return out
}

// ---------------------------------------------------------------- actions

async function preview(issue, opts) {
  const secret = readSecret()
  const url = `${SITE_URL}/unsubscribe?t=${unsubscribeToken('preview@ai4kanban.dev', secret)}`
  const mail = renderIssue(issue, { unsubscribeUrl: url, siteUrl: SITE_URL, resolveImage: inlineImage })

  const dir = path.join(PREVIEW_DIR, opts.issue)
  fs.mkdirSync(dir, { recursive: true })
  const files = {
    'index.html': mail.html,
    'images-off.html': withoutImages(mail.html),
    'plain.txt': mail.text,
  }
  for (const [name, contents] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), contents)

  say(`主题 / Subject: ${mail.subject}`)
  say(`摘要 / Preview text: ${issue.preheader}`)
  say('')
  for (const name of Object.keys(files)) say(`  ${path.join(dir, name)}`)

  if (!opts.open) return
  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open'
  spawn(opener, [path.join(dir, 'index.html')], { stdio: 'ignore', detached: true }).unref()
}

async function test(issue, opts) {
  const missing = await imagesAreLive(issue)
  for (const line of missing) say(`图片还没上线 / Image not live yet: ${line}`)

  const to = usableEmail(opts.to)
  const secret = readSecret()
  const url = `${SITE_URL}/unsubscribe?t=${unsubscribeToken(to, secret)}`
  if (opts.dryRun) return say(`预演 / Dry run: ${to}`)

  const id = await sendOne({ issue, to, unsubscribeUrl: url })
  say(`已发送 / Sent to ${to} (${id})`)
  say(`退订链接 / Unsubscribe link: ${url}`)
}

async function send(issue, opts) {
  const secret = readSecret()
  const list = openList()

  const pulled = await pullUnsubscribes(list, secret)
  writeList(list)
  say(`站点上的退订 / Unsubscribes on the site: ${pulled.seen}，新增 / newly applied: ${pulled.added}`)

  const missing = await imagesAreLive(issue)
  if (missing.length) die(`图片还没上线，先部署站点 / Deploy the site first — these images are not live:\n  ${missing.join('\n  ')}`)

  const recipients = pending(list, opts.issue)
  say(`待发送 / To send: ${recipients.length}`)
  if (opts.dryRun) {
    for (const record of recipients) say(`  ${record.email}`)
    return say('\n预演，未发送 / Dry run — nothing sent')
  }

  let sent = 0
  let failed = 0
  for (const [index, record] of recipients.entries()) {
    const url = `${SITE_URL}/unsubscribe?t=${unsubscribeToken(record.email, secret)}`
    const entry = sendRecord(record, opts.issue) ?? { issue: opts.issue, to: record.email, attempts: 0 }
    if (!sendRecord(record, opts.issue)) record.sends.push(entry)
    entry.attempts++
    try {
      entry.email_id = await sendOne({
        issue,
        to: record.email,
        unsubscribeUrl: url,
        idempotencyKey: `newsletter-${opts.issue}-${unsubscribeToken(record.email, secret)}`,
      })
      entry.state = 'sent'
      entry.last_event = 'sent'
      entry.sent_at = new Date().toISOString()
      entry.error = null
      sent++
    } catch (error) {
      entry.state = 'retry'
      entry.error = error.message
      failed++
      process.stderr.write(`  发送失败 / Failed ${record.email}: ${error.message}\n`)
    }
    // Written after every single send: an interrupted run must never lose the fact that
    // this address already has its copy.
    writeList(list)
    if (index < recipients.length - 1) await new Promise((r) => setTimeout(r, SEND_GAP_MS))
  }

  say(`\n已发送 / Sent: ${sent}，失败 / Failed: ${failed}`)
  if (failed) say('用 --retry 再跑一次 / Run --retry to pick them up')
  say(`名单 / List: ${LIST_FILE}`)
}

async function retry(issue, opts) {
  const secret = readSecret()
  const list = openList()

  const pulled = await pullUnsubscribes(list, secret)
  writeList(list)
  say(`站点上的退订 / Unsubscribes on the site: ${pulled.seen}，新增 / newly applied: ${pulled.added}`)

  const counts = { done: 0, pending: 0, resent: 0, stopped: 0, failed: 0 }
  for (const record of list.subscribers) {
    const entry = sendRecord(record, opts.issue)
    if (!entry) continue
    // Already settled — asking Resend again cannot change the answer.
    if (entry.state === 'delivered' || entry.state === 'bounced' || entry.state === 'complained') {
      counts[entry.state === 'delivered' ? 'done' : 'stopped']++
      continue
    }

    if (entry.email_id) {
      try {
        const mail = await resend(`/emails/${entry.email_id}`)
        entry.last_event = mail.last_event ?? entry.last_event
        entry.bounce_type = mail.bounce?.type ?? entry.bounce_type ?? null
      } catch (error) {
        process.stderr.write(`  读不回事件 / Could not read the event for ${record.email}: ${error.message}\n`)
      }
    }

    const verdict = entry.state === 'retry' && !entry.email_id ? 'retry' : classify(entry.last_event, entry.bounce_type)
    if (verdict === 'done') {
      entry.state = 'delivered'
      counts.done++
      continue
    }
    if (verdict === 'pending') {
      entry.state = 'sent'
      counts.pending++
      continue
    }
    if (verdict === 'stop') {
      stopDelivering(record, entry)
      counts.stopped++
      writeList(list)
      continue
    }

    // Transient: worth one more attempt — unless the reader left in the meantime.
    if (record.unsubscribed) {
      entry.state = 'skipped'
      writeList(list)
      continue
    }
    if (opts.dryRun) {
      say(`  重发 / Would resend: ${record.email} (${entry.last_event ?? entry.error ?? 'no event'})`)
      counts.resent++
      continue
    }
    const url = `${SITE_URL}/unsubscribe?t=${unsubscribeToken(record.email, secret)}`
    entry.attempts++
    try {
      entry.email_id = await sendOne({ issue, to: record.email, unsubscribeUrl: url })
      entry.state = 'sent'
      entry.last_event = 'sent'
      entry.sent_at = new Date().toISOString()
      entry.error = null
      counts.resent++
    } catch (error) {
      entry.state = 'retry'
      entry.error = error.message
      counts.failed++
      process.stderr.write(`  重发失败 / Resend failed for ${record.email}: ${error.message}\n`)
    }
    writeList(list)
    await new Promise((r) => setTimeout(r, SEND_GAP_MS))
  }

  writeList(list)
  say('')
  say(`已送达 / Delivered: ${counts.done}`)
  say(`仍在投递 / Still on its way: ${counts.pending}`)
  say(`已重发 / Resent: ${counts.resent}`)
  say(`不再重试 / Stopped for good: ${counts.stopped}`)
  if (counts.failed) say(`重发仍失败 / Still failing: ${counts.failed}`)

  const owed = pending(list, opts.issue)
  if (owed.length) say(`\n还有 ${owed.length} 位没收到，用 --send 补上 / ${owed.length} never got a copy — run --send`)
}

// ---------------------------------------------------------------- run

async function main() {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (error) {
    return die(error.message)
  }
  if (opts.help) return say(HELP)

  const issue = readIssue(opts.issue)
  if (opts.action === 'preview') return preview(issue, opts)
  if (opts.action === 'test') return test(issue, opts)
  if (opts.action === 'send') return send(issue, opts)
  return retry(issue, opts)
}

// Not `import.meta.main` — that needs Node 24.2/22.18, and below it the script would
// silently do nothing at all.
const isEntry = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isEntry) main().catch((error) => die(`运行失败 / Failed: ${error.message}`))
