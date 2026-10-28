// Signing in from a terminal: the same GitHub PKCE flow as the CLI's (cli/src/lib/cloud/
// signin.ts), with the answer caught on a loopback port instead of the app's URL scheme.
// The Supabase project must allow `http://127.0.0.1:*/**` as a redirect URL.

import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import http from 'node:http'

import { cloudEndpoints } from '../../cli/src/lib/cloud/config'
import { sessionFrom, writeSession } from '../../cli/src/lib/cloud/session'
import { status, t } from './i18n'

const WAIT_MS = 10 * 60 * 1000

const PAGE = (ok: boolean) =>
  `<!doctype html><meta charset="utf-8"><title>WildCrane</title><body style="font:16px system-ui;margin:4em;text-align:center">${
    ok ? '已登录，可以关闭此页面。<br>Signed in — you can close this page.' : '登录未完成。<br>Sign-in did not finish.'
  }</body>`

/** Why a sign-in did not finish. `detail` is the provider's or the network's own words. */
export interface SignInFailure {
  why: 'cancelled' | 'denied' | 'timeout' | 'unreachable' | 'other'
  detail: string
}

export interface SignInOptions {
  /** Told the sign-in address once it is known. The terminal prints it. */
  onUrl?: (url: string) => void
  /** Aborting gives up the wait. */
  signal?: AbortSignal
}

/** Sign in through the browser and write the session. Resolves to why it failed, or null. */
export async function signIn(options: SignInOptions = {}): Promise<SignInFailure | null> {
  const verifier = base64url(crypto.randomBytes(32))
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest())

  let finish: (code: string | null, failure?: SignInFailure) => void = () => {}
  const answered = new Promise<{ code: string | null; failure?: SignInFailure }>((resolve) => {
    finish = (code, failure) => resolve({ code, failure })
  })
  const server = http.createServer((req, res) => {
    const asked = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (asked.pathname !== '/signed-in') {
      res.writeHead(404).end()
      return
    }
    const params = asked.searchParams
    const code = params.get('code')
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(PAGE(!!code))
    const error = params.get('error')
    finish(code, code ? undefined : {
      why: error === 'access_denied' ? 'denied' : 'other',
      detail: params.get('error_description') || error || 'no code came back',
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as { port: number }

  const { supabaseUrl, anonKey } = cloudEndpoints()
  const url = new URL(`${supabaseUrl}/auth/v1/authorize`)
  url.searchParams.set('provider', 'github')
  url.searchParams.set('redirect_to', `http://127.0.0.1:${port}/signed-in`)
  url.searchParams.set('scopes', 'user:email')
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 's256')
  const onUrl = options.onUrl ?? ((u: string) => status(t.signIn(u)))
  onUrl(url.toString())
  openBrowser(url.toString())

  const timer = setTimeout(() => finish(null, { why: 'timeout', detail: 'timed out' }), WAIT_MS)
  const cancel = () => finish(null, { why: 'cancelled', detail: 'cancelled' })
  options.signal?.addEventListener('abort', cancel)
  const { code, failure } = await answered
  clearTimeout(timer)
  options.signal?.removeEventListener('abort', cancel)
  server.close()
  if (!code) return failure ?? { why: 'other', detail: 'no code came back' }

  let response: Response
  try {
    response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=pkce`, {
      method: 'POST',
      headers: { apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
    })
  } catch (e) {
    return { why: 'unreachable', detail: e instanceof Error ? e.message : String(e) }
  }
  const session = response.ok ? sessionFrom(await response.json()) : null
  if (!session) return { why: 'other', detail: `Cloud answered ${response.status}` }
  writeSession(session)
  return null
}

function openBrowser(url: string): void {
  const [command, args] =
    process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : ['xdg-open', [url]]
  try {
    spawn(command, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref()
  } catch {
    // The URL is printed; opening it by hand works as well.
  }
}

const base64url = (bytes: Buffer): string =>
  bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
