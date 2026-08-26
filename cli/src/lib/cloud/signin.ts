// Signing in to Cloud, from the app.
//
// Two halves, because the browser is in between: `startSignIn` makes the consent URL and
// keeps the secret half of it on this machine, and `finishSignIn` takes the answer the app
// caught on its URL scheme and turns it into the session file. Nothing in a terminal starts
// one — a machine signs in once, from the Configuration dialog, and every `akb` on it reads
// what that wrote.
//
// It is the PKCE flow rather than the implicit one: the tokens come back over a POST this
// process makes, so a session never travels in a URL a browser, a shell history or an OS
// log could keep.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { machineHome } from '../machine/home'
import { readCloudAccount } from './account'
import { cloudConfigured, cloudEndpoints, NOT_CONFIGURED, SIGN_IN_REDIRECT } from './config'
import { rememberProfile, sessionFrom, writeSession } from './session'

/** How long a started sign-in stays good. Long enough to read a consent screen, short
 *  enough that an abandoned one is not still waiting tomorrow. */
const PENDING_TTL_MS = 10 * 60 * 1000

const pendingFile = (): string => path.join(machineHome(), 'signing-in.json')

export interface SignInStart {
  ok: true
  /** The consent screen, to be opened in the user's own browser. */
  url: string
}

export type SignInResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Begin a sign-in: the consent URL to open, with the secret half kept here.
 *
 * GitHub is asked for no scopes at all (cloud/README.md, "Standing up a new project"), so
 * the consent screen offers a public profile and nothing else.
 */
export function startSignIn(): SignInStart | { ok: false; error: string } {
  if (!cloudConfigured()) return { ok: false, error: NOT_CONFIGURED }
  const { supabaseUrl } = cloudEndpoints()
  const verifier = base64url(crypto.randomBytes(32))
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest())

  fs.mkdirSync(machineHome(), { recursive: true, mode: 0o700 })
  fs.writeFileSync(pendingFile(), `${JSON.stringify({ verifier, startedAt: Date.now() })}\n`, {
    mode: 0o600,
  })

  const url = new URL(`${supabaseUrl}/auth/v1/authorize`)
  url.searchParams.set('provider', 'github')
  url.searchParams.set('redirect_to', SIGN_IN_REDIRECT)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 's256')
  return { ok: true, url: url.toString() }
}

/**
 * Finish one: the callback the app caught, turned into the session file.
 *
 * `callback` is the whole URL — `ai4kanban://cloud/signed-in?code=…`, or the same address
 * carrying the refusal the consent screen came back with.
 */
export async function finishSignIn(callback: string): Promise<SignInResult> {
  if (!cloudConfigured()) return { ok: false, error: NOT_CONFIGURED }

  let params: URLSearchParams
  try {
    params = new URL(callback).searchParams
  } catch {
    return { ok: false, error: 'That sign-in answer is not readable.' }
  }
  const refused = params.get('error_description') || params.get('error')
  if (refused) return { ok: false, error: refused }

  const code = params.get('code')
  if (!code) return { ok: false, error: 'That sign-in answer carries no code.' }

  const verifier = takePending()
  if (!verifier) {
    return { ok: false, error: 'That sign-in was started too long ago. Sign in again.' }
  }

  const { supabaseUrl, anonKey } = cloudEndpoints()
  let response: Response
  try {
    response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=pkce`, {
      method: 'POST',
      headers: { apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
    })
  } catch (e) {
    return { ok: false, error: `Cloud could not be reached: ${message(e)}` }
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error_description?: string
      msg?: string
    }
    return { ok: false, error: body.error_description || body.msg || 'That sign-in did not complete.' }
  }

  const session = sessionFrom(await response.json())
  if (!session) return { ok: false, error: 'That sign-in came back without a session.' }
  writeSession(session)
  // The name on screen comes from what the service attests, never from the token — so it is
  // asked for once here and kept only to draw with.
  const view = await readCloudAccount()
  if (view.handle) rememberProfile(view)
  return { ok: true }
}

/** The verifier for the sign-in in flight, taken away as it is read: one answer, one use. */
function takePending(): string | null {
  let held: { verifier?: string; startedAt?: number }
  try {
    held = JSON.parse(fs.readFileSync(pendingFile(), 'utf8')) as typeof held
  } catch {
    return null
  }
  try {
    fs.rmSync(pendingFile())
  } catch {
    // Gone already — the verifier we read is still the one to use.
  }
  if (!held.verifier) return null
  if (!held.startedAt || Date.now() - held.startedAt > PENDING_TTL_MS) return null
  return held.verifier
}

const base64url = (bytes: Buffer): string =>
  bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))
