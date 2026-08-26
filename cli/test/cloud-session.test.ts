// The Cloud sign-in, held on the machine (#326).
//
// What is asked here: the session file is one machine's and not one board's, a refresh is
// taken by one process at a time and the loser takes what the winner wrote, a sign-in that
// comes back refused says so, and the four states the Configuration dialog draws are the
// four this reports.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { readCloudAccount, signOutOfCloud } from '../src/lib/cloud/account.ts'
import { finishSignIn, startSignIn } from '../src/lib/cloud/signin.ts'
import {
  accessToken,
  clearSession,
  readSession,
  sessionFile,
  writeSession,
  type CloudSession,
} from '../src/lib/cloud/session.ts'

const SUPABASE = 'https://project.supabase.co'
const API = 'https://api.example.test'
const SUBJECT = '11111111-1111-4111-8111-111111111111'

let home = ''
const realFetch = globalThis.fetch
/** Every request the module made, in order. */
let calls: string[] = []

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-cloud-'))
  process.env.AI4KANBAN_HOME = home
  process.env.AI4KANBAN_SUPABASE_URL = SUPABASE
  process.env.AI4KANBAN_SUPABASE_ANON_KEY = 'anon-key'
  process.env.AI4KANBAN_CLOUD_URL = API
  calls = []
})

afterEach(() => {
  globalThis.fetch = realFetch
  fs.rmSync(home, { recursive: true, force: true })
  delete process.env.AI4KANBAN_HOME
  delete process.env.AI4KANBAN_SUPABASE_URL
  delete process.env.AI4KANBAN_SUPABASE_ANON_KEY
  delete process.env.AI4KANBAN_CLOUD_URL
})

const session = (over: Partial<CloudSession> = {}): CloudSession => ({
  version: 1,
  supabaseUrl: SUPABASE,
  accessToken: 'token-1',
  refreshToken: 'refresh-1',
  expiresAt: Date.now() + 60 * 60 * 1000,
  subject: SUBJECT,
  handle: 'neverchanje',
  name: 'Tao Wu',
  ...over,
})

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

describe('the session file', () => {
  it('is nobody until a sign-in writes one', () => {
    assert.equal(readSession(), null)
  })

  it('lives outside every repository, readable by its owner alone', () => {
    writeSession(session())

    assert.equal(path.dirname(sessionFile()), home)
    assert.equal(fs.statSync(sessionFile()).mode & 0o777, 0o600)
    assert.equal(readSession()?.handle, 'neverchanje')
  })

  it('ignores a session written against another Cloud project', () => {
    writeSession(session())
    process.env.AI4KANBAN_SUPABASE_URL = 'https://elsewhere.supabase.co'

    assert.equal(readSession(), null)
  })

  it('reads a damaged file as signed out rather than refusing to draw', () => {
    fs.mkdirSync(home, { recursive: true })
    fs.writeFileSync(sessionFile(), '{ half a file')

    assert.equal(readSession(), null)
  })

  it('is forgotten by signing out, twice over without complaint', () => {
    writeSession(session())
    clearSession()
    clearSession()

    assert.equal(readSession(), null)
  })
})

describe('the token a request carries', () => {
  it('says signed out when there is no session', async () => {
    assert.deepEqual(await accessToken(), { ok: false, reason: 'signed-out' })
  })

  it('hands back the held token while it is still good', async () => {
    writeSession(session())
    globalThis.fetch = async () => {
      throw new Error('nothing should be fetched')
    }

    const token = await accessToken()

    assert.equal(token.ok && token.token, 'token-1')
  })

  it('refreshes one about to run out, and keeps the pair it is given', async () => {
    writeSession(session({ expiresAt: Date.now() + 5_000 }))
    globalThis.fetch = async (url) => {
      calls.push(String(url))
      return jsonResponse({ access_token: 'token-2', refresh_token: 'refresh-2', expires_in: 3600 })
    }

    const token = await accessToken()

    assert.equal(token.ok && token.token, 'token-2')
    assert.equal(readSession()?.refreshToken, 'refresh-2')
    assert.equal(calls.length, 1)
    assert.match(calls[0]!, /grant_type=refresh_token/)
  })

  it('leaves one working session when two readers refresh at once', async () => {
    writeSession(session({ expiresAt: Date.now() + 5_000 }))
    globalThis.fetch = async (url) => {
      calls.push(String(url))
      // Slow enough that the second reader is certainly waiting on the lock.
      await new Promise((resolve) => setTimeout(resolve, 40))
      return jsonResponse({
        access_token: `token-${calls.length + 1}`,
        refresh_token: `refresh-${calls.length + 1}`,
        expires_in: 3600,
      })
    }

    const [first, second] = await Promise.all([accessToken(), accessToken()])

    // One refresh between them: the loser found the file already moved on and took it.
    assert.equal(calls.length, 1)
    assert.equal(first.ok, true)
    assert.equal(second.ok, true)
    assert.equal(first.ok && second.ok && first.token, second.ok ? second.token : '')
    assert.equal(readSession()?.accessToken, first.ok ? first.token : '')
  })

  it('reports an expired sign-in rather than throwing into a running delivery', async () => {
    writeSession(session({ expiresAt: Date.now() + 5_000 }))
    globalThis.fetch = async () =>
      jsonResponse({ error: 'invalid_grant', error_description: 'Refresh token not found' }, 400)

    const token = await accessToken()

    assert.deepEqual(token, {
      ok: false,
      reason: 'expired',
      error: 'Refresh token not found',
    })
    // The file is left alone, so nothing else on the machine is signed out by this.
    assert.equal(readSession()?.refreshToken, 'refresh-1')
  })

  it('does not call a laptop off the network signed out', async () => {
    writeSession(session({ expiresAt: Date.now() + 5_000 }))
    globalThis.fetch = async () => {
      throw new Error('getaddrinfo ENOTFOUND')
    }

    const token = await accessToken()

    assert.equal(token.ok, false)
    assert.equal(token.ok ? '' : token.reason, 'unreachable')
    assert.equal(readSession()?.refreshToken, 'refresh-1')
  })
})

describe('signing in', () => {
  it('asks GitHub through the project, and comes back to the app', () => {
    const start = startSignIn()

    assert.equal(start.ok, true)
    const url = new URL(start.ok ? start.url : '')
    assert.equal(url.origin + url.pathname, `${SUPABASE}/auth/v1/authorize`)
    assert.equal(url.searchParams.get('provider'), 'github')
    assert.equal(url.searchParams.get('redirect_to'), 'ai4kanban://cloud/signed-in')
    assert.equal(url.searchParams.get('code_challenge_method'), 's256')
    assert.ok(url.searchParams.get('code_challenge'))
  })

  it('keeps the secret half on this machine and never in the URL', () => {
    const start = startSignIn()
    const url = new URL(start.ok ? start.url : '')

    assert.equal(url.searchParams.get('code_verifier'), null)
    assert.equal(fs.statSync(path.join(home, 'signing-in.json')).mode & 0o777, 0o600)
  })

  it('turns the answer into a session', async () => {
    startSignIn()
    globalThis.fetch = async (url) => {
      calls.push(String(url))
      if (String(url).includes('/auth/v1/token')) {
        return jsonResponse({
          access_token: 'token-1',
          refresh_token: 'refresh-1',
          expires_in: 3600,
          user: { id: SUBJECT, email: 'someone@example.com' },
        })
      }
      return jsonResponse({
        session: { admitted: true, handle: 'neverchanje', name: 'Tao Wu', account_id: SUBJECT },
      })
    }

    const done = await finishSignIn('ai4kanban://cloud/signed-in?code=the-code')

    assert.deepEqual(done, { ok: true })
    assert.equal(readSession()?.subject, SUBJECT)
    assert.equal(readSession()?.handle, 'neverchanje')
    assert.match(calls[0]!, /grant_type=pkce/)
  })

  it('says what a refused consent screen said', async () => {
    const done = await finishSignIn(
      'ai4kanban://cloud/signed-in?error=access_denied&error_description=You%20said%20no',
    )

    assert.deepEqual(done, { ok: false, error: 'You said no' })
    assert.equal(readSession(), null)
  })

  it('refuses an answer to a sign-in nobody started', async () => {
    const done = await finishSignIn('ai4kanban://cloud/signed-in?code=the-code')

    assert.equal(done.ok, false)
    assert.match(done.ok ? '' : done.error, /Sign in again/)
  })

  it('spends the started sign-in once', async () => {
    startSignIn()
    globalThis.fetch = async (url) =>
      String(url).includes('/auth/v1/token')
        ? jsonResponse({
            access_token: 'token-1',
            refresh_token: 'refresh-1',
            expires_in: 3600,
            user: { id: SUBJECT },
          })
        : jsonResponse({ session: { admitted: true, handle: 'neverchanje', account_id: SUBJECT } })

    await finishSignIn('ai4kanban://cloud/signed-in?code=the-code')
    const again = await finishSignIn('ai4kanban://cloud/signed-in?code=the-code')

    assert.equal(again.ok, false)
  })
})

describe('what the Cloud section draws', () => {
  it('reports nobody when nobody is signed in', async () => {
    const account = await readCloudAccount()

    assert.equal(account.state, 'signed-out')
    assert.equal(account.sessionFile, sessionFile())
    assert.equal(account.configured, true)
  })

  it('reports the admitted account and the handle the provider attests', async () => {
    writeSession(session())
    globalThis.fetch = async () =>
      jsonResponse({
        session: { admitted: true, handle: 'neverchanje', name: 'Tao Wu', account_id: SUBJECT },
      })

    const account = await readCloudAccount()

    assert.equal(account.state, 'signed-in')
    assert.equal(account.handle, 'neverchanje')
    assert.equal(account.message, null)
  })

  it('names the account Cloud refused, in the service’s own words', async () => {
    writeSession(session())
    globalThis.fetch = async () =>
      jsonResponse({
        session: { admitted: false, handle: 'someone-else', account_id: null },
        refusal: { code: 'not_admitted', message: 'Cloud is an invite-only preview…' },
      })

    const account = await readCloudAccount()

    assert.equal(account.state, 'not-admitted')
    assert.equal(account.handle, 'someone-else')
    assert.equal(account.message, 'Cloud is an invite-only preview…')
  })

  it('reports an expired sign-in when the refresh is refused', async () => {
    writeSession(session({ expiresAt: Date.now() + 5_000 }))
    globalThis.fetch = async () =>
      jsonResponse({ error: 'invalid_grant', error_description: 'Refresh token not found' }, 400)

    const account = await readCloudAccount()

    assert.equal(account.state, 'expired')
    // It still knows whose sign-in ended, so the pane can say so.
    assert.equal(account.handle, 'neverchanje')
    // Cloud answered — it refused. Carrying Auth's words in `error` would have both screens
    // say Cloud could not be reached beside a sign-in they have just called expired.
    assert.equal(account.error, undefined)
  })

  it('says Cloud is unreachable without reporting a sign-in that ended', async () => {
    writeSession(session())
    globalThis.fetch = async () => {
      throw new Error('getaddrinfo ENOTFOUND')
    }

    const account = await readCloudAccount()

    assert.equal(account.state, 'signed-in')
    assert.match(account.error ?? '', /ENOTFOUND/)
  })

  it('says the same when the refresh itself could not be made', async () => {
    writeSession(session({ expiresAt: Date.now() + 5_000 }))
    globalThis.fetch = async () => {
      throw new Error('getaddrinfo ENOTFOUND')
    }

    const account = await readCloudAccount()

    assert.equal(account.state, 'signed-in')
    assert.equal(account.handle, 'neverchanje')
  })

  it('stops reaching Cloud when the user signs out', async () => {
    writeSession(session())
    signOutOfCloud()

    assert.equal((await readCloudAccount()).state, 'signed-out')
  })
})
