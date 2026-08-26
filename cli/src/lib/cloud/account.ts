// Which account this machine acts as, and whether Cloud takes its work.
//
// One call, four answers — the four a sign-in can come back with, which is exactly what the
// Cloud section of the Configuration dialog draws and what `akb cloud` prints. Admission is
// never decided here: the service is asked every time, and its refusal is carried through
// word for word so a client shows it as it stands.

import { cloudConfigured, cloudEndpoints, NOT_CONFIGURED } from './config'
import { accessToken, clearSession, readSession, sessionFile } from './session'
import type { CloudAccount } from './types'

export type { CloudAccount, CloudState } from './types'

interface SessionBody {
  session?: {
    admitted?: boolean
    handle?: string | null
    name?: string | null
    avatar_url?: string | null
    avatarUrl?: string | null
    email?: string
    accountId?: string | null
  }
  refusal?: { code?: string; message?: string }
}

/** Ask Cloud who this machine is. */
export async function readCloudAccount(): Promise<CloudAccount> {
  const blank: CloudAccount = {
    state: 'signed-out',
    handle: null,
    name: null,
    avatarUrl: null,
    email: null,
    message: null,
    sessionFile: sessionFile(),
    configured: cloudConfigured(),
  }
  if (!blank.configured) return { ...blank, message: NOT_CONFIGURED }

  const token = await accessToken()
  if (!token.ok) {
    if (token.reason === 'signed-out') return blank
    // Still signed in, just unable to prove it this minute.
    if (token.reason === 'unreachable') {
      return { ...blank, ...held(), state: 'signed-in', error: token.error }
    }
    // Auth refused the refresh token, so the sign-in is over. `error` means Cloud could not
    // be reached and both screens say exactly that, so Auth's own words do not go in it.
    return { ...blank, ...held(), state: 'expired' }
  }

  let response: Response
  try {
    response = await fetch(`${cloudEndpoints().api}/v1/session`, {
      headers: { authorization: `Bearer ${token.token}` },
    })
  } catch (e) {
    // Signed in and unable to ask — say so rather than reporting a sign-in that ended.
    return {
      ...blank,
      ...held(),
      state: 'signed-in',
      error: e instanceof Error ? e.message : String(e),
    }
  }

  const body = (await response.json().catch(() => ({}))) as SessionBody & {
    error?: { code?: string; message?: string }
  }
  if (!response.ok) {
    const refusal = body.error
    // A sign-in the service will not accept is over, whatever this machine still holds.
    if (refusal?.code === 'unauthenticated') {
      return { ...blank, ...held(), state: 'expired', message: refusal.message ?? null }
    }
    if (refusal?.code === 'not_admitted') {
      return { ...blank, ...held(), state: 'not-admitted', message: refusal.message ?? null }
    }
    return { ...blank, ...held(), state: 'signed-in', error: refusal?.message }
  }

  const session = body.session ?? {}
  const attested = {
    handle: session.handle ?? null,
    name: session.name ?? null,
    avatarUrl: session.avatar_url ?? session.avatarUrl ?? null,
    email: session.email ?? null,
  }
  return session.admitted
    ? { ...blank, ...attested, state: 'signed-in' }
    : { ...blank, ...attested, state: 'not-admitted', message: body.refusal?.message ?? null }
}

/** Sign this machine out. Nothing already on any board is touched. */
export function signOutOfCloud(): { ok: true } {
  clearSession()
  return { ok: true }
}

/** What this machine last knew about the account, for the answers the service can't give. */
function held(): Pick<CloudAccount, 'handle' | 'name' | 'avatarUrl' | 'email'> {
  const session = readSession()
  return {
    handle: session?.handle ?? null,
    name: session?.name ?? null,
    avatarUrl: session?.avatarUrl ?? null,
    email: session?.email ?? null,
  }
}
