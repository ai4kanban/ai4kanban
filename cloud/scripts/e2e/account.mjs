// The throwaway account: signed in through the web app's own email-code form, then admitted
// by hand the way a person is (a GitHub identity row plus an invite-list entry), and removed
// with cloud.remove_account, which cascades every row the account owns.

import { randomUUID } from 'node:crypto'

import { waitFor } from './browser.mjs'
import { signInCode, testAddress } from './inbox.mjs'
import { SUPABASE_KEY, SUPABASE_URL, TEST_PREFIX, WEB, literal } from './prod.mjs'

const SESSION_KEY = 'wildcrane.review.session'

/** Signs `page` in as a new account and admits it; returns its handle, email and user id. */
export async function signUp(page, { sql, resendKey, tag }) {
  const handle = `${TEST_PREFIX}${tag}`
  const email = testAddress(handle)
  await page.goto(`${WEB}/`)
  await codeForm(page, email, resendKey)

  const [user] = await sql(`select id from auth.users where email = ${literal(email)}`)
  if (!user) throw new Error(`no auth user for ${email}`)
  await sql(`
    insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    values (${literal(randomUUID())}, ${literal(handle)}, ${literal(user.id)},
            jsonb_build_object('sub', ${literal(handle)}, 'user_name', ${literal(handle)}, 'email', ${literal(email)}),
            'github', now(), now(), now());
    insert into cloud.admitted_accounts (handle, note) values (${literal(handle)}, 'end-to-end test, removed after the run');`)

  // The token carries the admission as a claim; expire the stored one so the app refreshes it.
  await page.evaluate(`(() => {
    const s = JSON.parse(localStorage.getItem(${JSON.stringify(SESSION_KEY)}))
    localStorage.setItem(${JSON.stringify(SESSION_KEY)}, JSON.stringify({ ...s, expires_at: 0 }))
  })()`)
  await page.goto(`${WEB}/`)
  return { handle, email, userId: user.id }
}

/** Fills the email-code sign-in form the web app and the review page share. */
export async function codeForm(page, email, resendKey) {
  await waitFor(async () => (await page.text()).includes('Send code'), 20_000, 'the sign-in form did not show')
  // Auth allows one code per address a minute.
  let since
  await waitFor(async () => {
    since = Date.now()
    await page.fill('input[type=email]', email)
    await page.click(/^Send code$/)
    return await waitFor(() => page.evaluate('!!document.querySelector("input[autocomplete=one-time-code]")'), 10_000, 'no code field')
  }, 90_000, 'the form would not send a code', 15_000)
  const { code } = await signInCode(resendKey, email, since)
  await page.fill('input[autocomplete=one-time-code]', code)
  await page.evaluate('document.querySelector("input[autocomplete=one-time-code]").form.requestSubmit()')
  await waitFor(() => page.evaluate(`!!localStorage.getItem(${JSON.stringify(SESSION_KEY)})`), 20_000, 'the code did not sign in')
}

/**
 * A second, separate sign-in for the same account, as the Runner does its own: sharing the
 * page's refresh token would sign one of them out at the other's first refresh.
 */
export async function codeSignIn(email, resendKey) {
  const auth = async (path, body) => {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  let since = Date.now()
  // Auth allows one code per address a minute.
  const sent = await waitFor(async () => {
    since = Date.now()
    const r = await auth('otp', { email, create_user: false })
    if (r.status === 200) return true
    if (r.status !== 429) throw new Error(`sending a code failed: ${r.status}`)
  }, 120_000, 'Auth kept refusing a second code', 10_000)
  if (!sent) throw new Error('no code sent')
  const { code } = await signInCode(resendKey, email, since)
  const { status, body } = await auth('verify', { type: 'email', email, token: code })
  if (status !== 200 || !body.access_token) throw new Error(`the second code did not sign in: ${status}`)
  return { access_token: body.access_token, refresh_token: body.refresh_token, expires_at: body.expires_at * 1000, email }
}

/** An access token from `session`, refreshed a minute before it expires. */
export function tokenSource(session) {
  let current = session
  return async () => {
    if (current.expires_at - Date.now() > 60_000) return current.access_token
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: current.refresh_token }),
      signal: AbortSignal.timeout(30_000),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || !body.access_token) throw new Error(`refreshing the test session failed: ${response.status}`)
    current = { ...current, access_token: body.access_token, refresh_token: body.refresh_token, expires_at: body.expires_at * 1000 }
    return current.access_token
  }
}

/** Removes test accounts and everything they own: `handles`, or every leftover when none. */
export async function removeTestAccounts(sql, handles) {
  const all = handles ?? (await sql(`select handle from cloud.admitted_accounts where handle like ${literal(`${TEST_PREFIX}%`)}`)).map((r) => r.handle)
  for (const handle of all) {
    if (!handle.startsWith(TEST_PREFIX)) throw new Error(`refusing to remove ${handle}: not a test account`)
    await sql(`select cloud.remove_account(${literal(handle)})`)
    await sql(`delete from auth.users where email = ${literal(testAddress(handle))}`)
  }
  return all
}
