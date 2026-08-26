// The Cloud sign-in, held on the machine.
//
// One file, in the user's own home directory and outside every repository, so the board UI
// server the app starts and an `akb` typed in a terminal act as the same account without a
// second sign-in (#326). It is a fact about the machine, not about a board: the app's
// Electron `settings.json` cannot serve — `akb` has no access to it and it is documented as
// hand-editable and holding nothing secret — and Electron's `safeStorage` would bind the
// session to the app alone, which #319 needs it not to be.
//
// Only one process may refresh at a time. Two racing refreshes would each spend the one
// refresh token, and the loser would be signed out for good — so a refresh takes the lock
// beside the file, and a process that finds the file already moved on takes what is there
// rather than refreshing again.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { cloudEndpoints } from './config'

/** What a signed-in machine holds. Nothing here decides anything: admission is the
 *  service's answer, asked for every time (see account.ts). The profile fields are a copy
 *  of what the service last attested, kept only so a terminal can name the account offline. */
export interface CloudSession {
  version: 1
  /** The project this session belongs to. A session from another project is not ours. */
  supabaseUrl: string
  accessToken: string
  refreshToken: string
  /** When the access token runs out, in milliseconds. */
  expiresAt: number
  /** The Supabase user id — the subject every row's owner is keyed on. */
  subject: string
  email?: string
  handle?: string
  name?: string
  avatarUrl?: string
}

/** Refresh this long before the token actually runs out, so a request never carries one
 *  that expires in flight. */
const REFRESH_MARGIN_MS = 60_000
/** How long a refresh may hold the lock before another process calls the holder dead. */
const LOCK_STALE_MS = 30_000
const LOCK_WAIT_MS = 20_000
const LOCK_RETRY_MS = 50

/** The folder every machine-level Cloud file lives in. `AI4KANBAN_HOME` moves it, which is
 *  what a test uses. */
export function cloudHome(): string {
  return process.env.AI4KANBAN_HOME || path.join(os.homedir(), '.ai4kanban')
}

export const sessionFile = (): string => path.join(cloudHome(), 'session.json')
const lockDir = (): string => path.join(cloudHome(), 'session.lock')
const lockOwner = (): string => path.join(lockDir(), 'owner')

/** The session on this machine, or null when nobody is signed in. Unreadable or damaged
 *  reads as signed out: a half-written file is not a session, and refusing to draw the
 *  screen over one would leave no way to sign in again. */
export function readSession(): CloudSession | null {
  let raw: string
  try {
    raw = fs.readFileSync(sessionFile(), 'utf8')
  } catch {
    return null
  }
  try {
    const held = JSON.parse(raw) as Partial<CloudSession>
    if (!held.accessToken || !held.refreshToken || !held.subject) return null
    if (held.supabaseUrl !== cloudEndpoints().supabaseUrl) return null
    return { ...held, version: 1, expiresAt: Number(held.expiresAt) || 0 } as CloudSession
  } catch {
    return null
  }
}

/** Write it, readable by its owner alone. Through a temporary file, so a reader never sees
 *  half of one. */
export function writeSession(session: CloudSession): void {
  fs.mkdirSync(cloudHome(), { recursive: true, mode: 0o700 })
  const tmp = `${sessionFile()}.${process.pid}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600 })
  fs.renameSync(tmp, sessionFile())
}

/** Forget the sign-in. This machine stops reaching Cloud; nothing on any board is touched. */
export function clearSession(): void {
  try {
    fs.rmSync(sessionFile())
  } catch {
    // Already gone — signing out twice is not a failure.
  }
}

/** What a caller gets when it asks for a token to send. The three are kept apart because a
 *  screen answers each of them differently: sign in, sign in AGAIN, or wait — a laptop off
 *  the network must never be told its sign-in ended. */
export type TokenResult =
  | { ok: true; token: string; session: CloudSession }
  | { ok: false; reason: 'signed-out' }
  | { ok: false; reason: 'expired'; error?: string }
  | { ok: false; reason: 'unreachable'; error: string }

/**
 * A token good to send right now, refreshing it first when it is about to run out.
 *
 * It never throws and never ends anything: a delivery already running asks for a token like
 * everybody else, and a refresh that fails comes back as `expired` — the sign-in is over,
 * the run is not.
 */
export async function accessToken(): Promise<TokenResult> {
  const held = readSession()
  if (!held) return { ok: false, reason: 'signed-out' }
  if (!expiringSoon(held)) return { ok: true, token: held.accessToken, session: held }
  return refresh()
}

const expiringSoon = (session: CloudSession): boolean =>
  session.expiresAt - REFRESH_MARGIN_MS <= Date.now()

/**
 * Trade the refresh token for a new pair, under the lock beside the file.
 *
 * Whoever gets the lock re-reads the file first — that re-read is the whole point. Another
 * process may have refreshed while we waited, and its answer is as good as one of our own;
 * taking it is what keeps two readers from spending the same refresh token and signing the
 * user out between them.
 */
async function refresh(): Promise<TokenResult> {
  const lock = await takeLock()
  try {
    const now = readSession()
    if (!now) return { ok: false, reason: 'signed-out' }
    if (!expiringSoon(now)) return { ok: true, token: now.accessToken, session: now }
    const { supabaseUrl, anonKey } = cloudEndpoints()
    let response: Response
    try {
      response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { apikey: anonKey, 'content-type': 'application/json' },
        body: JSON.stringify({ refresh_token: now.refreshToken }),
      })
    } catch (e) {
      // Unreachable is not expired. The file is left exactly as it is, so the sign-in is
      // still there when the network comes back.
      return { ok: false, reason: 'unreachable', error: e instanceof Error ? e.message : String(e) }
    }
    // Auth answering at all and refusing the refresh token is the sign-in being over; a
    // 5xx is the service having a bad minute, which is not the same thing.
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error_description?: string }
      if (response.status >= 500) {
        return { ok: false, reason: 'unreachable', error: body.error_description ?? `Cloud answered ${response.status}` }
      }
      return { ok: false, reason: 'expired', error: body.error_description }
    }
    const fresh = sessionFrom(await response.json(), now)
    if (!fresh) return { ok: false, reason: 'expired' }
    writeSession(fresh)
    return { ok: true, token: fresh.accessToken, session: fresh }
  } finally {
    lock()
  }
}

/** A Supabase token response, turned into the session we hold. Keeps the profile the
 *  previous one carried, since a refresh answers with tokens and not with a profile. */
export function sessionFrom(body: unknown, previous?: CloudSession | null): CloudSession | null {
  const token = body as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    expires_at?: number
    user?: { id?: string; email?: string }
  }
  const subject = token.user?.id ?? previous?.subject
  if (!token.access_token || !token.refresh_token || !subject) return null
  const expiresAt = token.expires_at
    ? token.expires_at * 1000
    : Date.now() + (token.expires_in ?? 3600) * 1000
  return {
    version: 1,
    supabaseUrl: cloudEndpoints().supabaseUrl,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt,
    subject,
    email: token.user?.email ?? previous?.email,
    handle: previous?.handle,
    name: previous?.name,
    avatarUrl: previous?.avatarUrl,
  }
}

/** Record what the service last attested about this account, for a screen to name it. */
export function rememberProfile(profile: {
  handle?: string | null
  name?: string | null
  avatarUrl?: string | null
}): void {
  const held = readSession()
  if (!held) return
  const next: CloudSession = {
    ...held,
    handle: profile.handle ?? undefined,
    name: profile.name ?? undefined,
    avatarUrl: profile.avatarUrl ?? undefined,
  }
  if (next.handle === held.handle && next.name === held.name && next.avatarUrl === held.avatarUrl) {
    return
  }
  writeSession(next)
}

// --- the lock -----------------------------------------------------------------
// A directory, because making one is atomic on every filesystem we run on, and the holder's
// pid inside it so a waiter can tell a live refresh from one a killed process left behind.
// The board's own lock (lib/lock.ts) cannot serve: it is per board and it blocks the event
// loop while it waits, and a refresh is a network call the whole board server waits on.

/** Take it, and return the release. A wait that runs out goes ahead anyway rather than
 *  reporting a failure: the refresh re-reads the file first, so the common ending is still
 *  the loser taking what the winner wrote. */
async function takeLock(): Promise<() => void> {
  const until = Date.now() + LOCK_WAIT_MS
  for (;;) {
    try {
      fs.mkdirSync(cloudHome(), { recursive: true, mode: 0o700 })
      fs.mkdirSync(lockDir())
      try {
        fs.writeFileSync(lockOwner(), `${process.pid}\n`)
      } catch {
        // A lock naming nobody is what the age rule below is for.
      }
      return () => {
        try {
          fs.rmSync(lockDir(), { recursive: true, force: true })
        } catch {
          // Somebody judged us dead and took it — theirs to release now.
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
      if (stale()) {
        fs.rmSync(lockDir(), { recursive: true, force: true })
        continue
      }
      if (Date.now() > until) return () => {}
      await sleep(LOCK_RETRY_MS)
    }
  }
}

function stale(): boolean {
  let held: number | undefined
  try {
    const pid = Number(fs.readFileSync(lockOwner(), 'utf8').trim())
    held = Number.isInteger(pid) && pid > 0 ? pid : undefined
  } catch {
    held = undefined
  }
  if (held !== undefined && !alive(held)) return true
  try {
    return Date.now() - fs.statSync(lockDir()).mtimeMs > LOCK_STALE_MS
  } catch {
    return false
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
