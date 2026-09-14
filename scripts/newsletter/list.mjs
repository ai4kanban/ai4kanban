// The subscriber list: where it lives, how it is read and written, and what an unsubscribe
// does to it. Shared by `newsletter-subscribers.mjs`, which fills it, and
// `newsletter-send.mjs`, which mails it.
//
// The file never enters git and never reaches a hosted service. An unsubscribe is permanent:
// it is kept by address *and* by GitHub login, so re-collecting the same person — or the
// same person under a new address — can never turn it back on.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

export const LIST_DIR = path.join(os.homedir(), '.ai4kanban', 'newsletter')
export const LIST_FILE = path.join(LIST_DIR, 'subscribers.json')
export const BACKUP_FILE = path.join(LIST_DIR, 'subscribers.json.enc')
export const SECRET_FILE = path.join(LIST_DIR, 'unsubscribe-secret')
export const SCHEMA_VERSION = 2

const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[a-z0-9.-]+\.[a-z]{2,}$/i
const NOREPLY_LOCAL = /^(no-?reply|do-?not-?reply|donotreply|noreply.*)$/i
// Machines and shared mailboxes, not a person: a commit made as root is not a reader.
const ROLE_LOCAL = /^(root|admin|administrator|postmaster|hostmaster|webmaster|abuse|mailer-daemon|git|builder|build|ci|jenkins|runner|actions|github-actions(\[bot\])?|.*\[bot\]|.*-bot)$/i
const PLACEHOLDER_DOMAINS = /(^|\.)(example\.(com|org|net)|test|invalid|local|localdomain|localhost|users\.noreply\.github\.com|sentry\.io)$/i

export function usableEmail(value) {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return null
  const [local, domain] = email.split('@')
  if (NOREPLY_LOCAL.test(local) || ROLE_LOCAL.test(local)) return null
  if (PLACEHOLDER_DOMAINS.test(domain)) return null
  return email
}

export function emptyList(repo) {
  return {
    schema_version: SCHEMA_VERSION,
    repo,
    updated_at: null,
    unsubscribed_emails: [],
    unsubscribed_logins: [],
    subscribers: [],
  }
}

export function readList(repo) {
  if (!fs.existsSync(LIST_FILE)) return emptyList(repo)
  return upgrade(JSON.parse(fs.readFileSync(LIST_FILE, 'utf8')), repo)
}

/** Bring an older file up to the current shape, or refuse a newer one. */
export function upgrade(list, repo) {
  if (list.schema_version > SCHEMA_VERSION) {
    throw new Error(`名单文件版本不匹配 / Unexpected list version: ${list.schema_version}`)
  }
  list.schema_version = SCHEMA_VERSION
  list.repo ||= repo
  list.unsubscribed_emails ||= []
  list.unsubscribed_logins ||= []
  list.subscribers ||= []
  for (const record of list.subscribers) record.sends ||= []
  return list
}

export function writeAtomically(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, contents, { mode: 0o600 })
  fs.renameSync(tmp, file)
}

export function writeList(list) {
  list.updated_at = new Date().toISOString()
  writeAtomically(LIST_FILE, `${JSON.stringify(list, null, 2)}\n`)
}

/**
 * Fold every unsubscribe the list knows about back into the records: the two blocked sets,
 * plus any record already flagged. Both sets only ever grow, which is what makes the
 * decision irreversible — a later collection run re-adds the person and this puts them
 * straight back into `unsubscribed`.
 */
export function applyUnsubscribes(list) {
  const blockedEmails = new Set(list.unsubscribed_emails.map((e) => String(e).toLowerCase()))
  const blockedLogins = new Set((list.unsubscribed_logins ?? []).map((l) => String(l).toLowerCase()))
  for (const record of list.subscribers) {
    if (!record.unsubscribed) continue
    if (record.email) blockedEmails.add(record.email)
    if (record.login) blockedLogins.add(record.login.toLowerCase())
  }
  for (const record of list.subscribers) {
    const blocked =
      (record.email && blockedEmails.has(record.email)) ||
      (record.login && blockedLogins.has(record.login.toLowerCase()))
    if (!blocked) continue
    record.unsubscribed = true
    record.unsubscribed_at ||= new Date().toISOString()
    record.deliverable = false
    record.undeliverable_reason = 'unsubscribed'
    if (record.email) blockedEmails.add(record.email)
    if (record.login) blockedLogins.add(record.login.toLowerCase())
  }
  list.unsubscribed_emails = [...blockedEmails].sort()
  list.unsubscribed_logins = [...blockedLogins].sort()
}

// ---------------------------------------------------------------- unsubscribe tokens

/**
 * The link in the email carries a token, never the address: the site records that a token
 * asked to stop, and only this machine — which holds the key — can work out whose it is.
 *
 * The key is written once and kept beside the list. Losing it breaks every link already in
 * a reader's inbox, so it is never regenerated on its own.
 */
export function readSecret({ create = true } = {}) {
  const fromEnv = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET
  if (fromEnv) return fromEnv
  if (fs.existsSync(SECRET_FILE)) return fs.readFileSync(SECRET_FILE, 'utf8').trim()
  if (!create) return null
  const secret = crypto.randomBytes(32).toString('hex')
  writeAtomically(SECRET_FILE, `${secret}\n`)
  return secret
}

export function unsubscribeToken(email, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(String(email).trim().toLowerCase())
    .digest('hex')
    .slice(0, 24)
}
