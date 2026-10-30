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

const CRANE =
  'M2 55.75C2 55.69 2.69 55.09 3.55 54.37L5.09 53.1L6.61 53.1L8.13 53.1L12.49 49.87C14.9 48.07 16.83 46.58 16.77 46.53C16.75 46.47 15.56 46.64 14.15 46.89C12.74 47.13 11.55 47.3 11.53 47.24C11.47 47.19 12.02 46.22 12.71 45.06L14.01 42.96L18.21 41.34C20.53 40.45 22.41 39.65 22.41 39.57C22.41 39.49 21.27 38.55 19.92 37.5C15.92 34.4 13.13 31.31 10.86 27.47L10.01 26.01L10.53 26.18C10.84 26.26 12.96 27.2 15.28 28.25C17.6 29.32 19.53 30.12 19.59 30.07C19.64 30.01 17.68 28.69 15.25 27.11C12.8 25.57 10.56 23.97 10.31 23.58C9.15 21.95 7.25 17.5 7.25 16.46C7.25 16.26 10.01 17.95 13.38 20.18C16.77 22.45 19.73 24.38 19.95 24.49C20.42 24.74 20.25 24.57 13.9 19.02L9.18 14.88L8.6 13.36C7.72 10.96 6.97 7.54 6.97 5.77L6.97 4.14L9.4 6.46C12.66 9.61 15.56 12.01 23.57 18.25C27.32 21.18 30.5 23.72 30.64 23.91C30.8 24.08 31.68 26.51 32.6 29.3L34.28 34.35L35.72 35.65C37.54 37.3 37.98 37.47 36.85 36.09L35.96 35.01L37.12 34.71C39.11 34.21 40.16 33.52 42.54 31.12L44.8 28.8L46.02 28.96C46.71 29.07 47.56 29.07 47.95 28.96L48.67 28.8L48.67 28.25L48.67 27.69L49.27 27.69C49.63 27.69 50.1 27.58 50.32 27.42L50.71 27.17L51.01 27.42C51.18 27.56 52.78 27.86 54.58 28.08C56.37 28.3 57.86 28.52 57.94 28.58C58 28.63 56.73 28.85 55.13 29.05C53.53 29.24 50.96 29.77 49.44 30.21C47.92 30.65 46.57 31.01 46.43 31.01C46.29 31.01 44.22 32.97 41.85 35.37C37.57 39.62 34.42 42.14 30.83 44.15L29.14 45.09L25.97 45.73L22.77 46.39L14.59 51.11L6.42 55.86L4.21 55.86C2.99 55.86 2 55.8 2 55.75Z'
const CREST = 'M44.97 27.45C44.61 26.89 46.57 25.76 47.87 25.76C48.72 25.76 50.6 26.7 50.6 27.14C50.6 27.64 45.27 27.97 44.97 27.45Z'

type Outcome = 'ok' | 'denied' | 'failed'

const COPY = {
  zh: {
    ok: ['已登录 WildCrane', '可以关闭此页面，回到 WildCrane 继续。'],
    denied: ['登录未完成', '你取消了 GitHub 授权。请回到 WildCrane 重新登录。'],
    failed: ['登录未完成', '登录时出了点问题。请回到 WildCrane 重试。'],
  },
  en: {
    ok: ['Signed in to WildCrane', 'You can close this page and return to WildCrane.'],
    denied: ["Sign-in didn't finish", 'GitHub access was cancelled. Return to WildCrane to sign in again.'],
    failed: ["Sign-in didn't finish", 'Something went wrong while signing in. Return to WildCrane to try again.'],
  },
}

/** Chinese when the browser's first language is Chinese, else English. */
const langOf = (accept: string | undefined): 'zh' | 'en' =>
  /^\s*zh\b/i.test(accept ?? '') ? 'zh' : 'en'

// Colors and type follow web/src/review/globals.css; icons are Feather's check and x.
const PAGE = (outcome: Outcome, lang: 'zh' | 'en') => {
  const [title, body] = COPY[lang][outcome]
  const ok = outcome === 'ok'
  const icon = ok ? '<polyline points="20 6 9 17 4 12"/>' : '<path d="M18 6 6 18M6 6l12 12"/>'
  return `<!doctype html><html lang="${lang === 'zh' ? 'zh-CN' : 'en'}"><meta charset="utf-8">\
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · WildCrane</title><style>\
*{margin:0;box-sizing:border-box}\
body{display:flex;flex-direction:column;min-height:100dvh;background:#fff;color:#24231f;\
font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}\
header{padding:16px 36px 0}\
main{flex:1;display:flex;align-items:center;justify-content:center;padding:0 36px 64px;text-align:center}\
.icon{display:flex;margin:0 auto;width:44px;height:44px;border-radius:50%;align-items:center;justify-content:center;\
background:${ok ? '#e4f3ea' : '#f7ddce'};color:${ok ? '#2f6b46' : '#b83a12'}}\
h1{margin-top:16px;font-size:24px;font-weight:850;line-height:1.25;letter-spacing:-0.02em}\
p{margin:8px auto 0;max-width:38ch;font-size:13px;line-height:19px;color:#565550}\
</style><header><svg viewBox="2 4 56 52" width="23.7" height="22" aria-hidden="true">\
<path d="${CRANE}" fill="#24231f"/><path d="${CREST}" fill="#dd4f1e"/></svg></header>\
<main><div><span class="icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" \
stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg></span>\
<h1>${title}</h1><p>${body}</p></div></main></html>`
}

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

  let finish: (failure: SignInFailure | null) => void = () => {}
  const answered = new Promise<SignInFailure | null>((resolve) => (finish = resolve))
  let answering = false
  const server = http.createServer(async (req, res) => {
    const asked = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (asked.pathname !== '/signed-in' || answering) {
      res.writeHead(404).end()
      return
    }
    answering = true
    const params = asked.searchParams
    const code = params.get('code')
    const error = params.get('error')
    const failure: SignInFailure | null = code ? await exchange(code, verifier)
      : { why: error === 'access_denied' ? 'denied' : 'other',
          detail: params.get('error_description') || error || 'no code came back' }
    const outcome = !failure ? 'ok' : failure.why === 'denied' ? 'denied' : 'failed'
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(PAGE(outcome, langOf(req.headers['accept-language'])))
    finish(failure)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as { port: number }

  const { supabaseUrl } = cloudEndpoints()
  const url = new URL(`${supabaseUrl}/auth/v1/authorize`)
  url.searchParams.set('provider', 'github')
  url.searchParams.set('redirect_to', `http://127.0.0.1:${port}/signed-in`)
  url.searchParams.set('scopes', 'user:email')
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 's256')
  const onUrl = options.onUrl ?? ((u: string) => status(t.signIn(u)))
  onUrl(url.toString())
  openBrowser(url.toString())

  const timer = setTimeout(() => finish({ why: 'timeout', detail: 'timed out' }), WAIT_MS)
  const cancel = () => finish({ why: 'cancelled', detail: 'cancelled' })
  options.signal?.addEventListener('abort', cancel)
  const failure = await answered
  clearTimeout(timer)
  options.signal?.removeEventListener('abort', cancel)
  server.close()
  return failure
}

/** Trade the code for a session and write it. */
async function exchange(code: string, verifier: string): Promise<SignInFailure | null> {
  const { supabaseUrl, anonKey } = cloudEndpoints()
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
  const session = response.ok ? sessionFrom(await response.json().catch(() => ({}))) : null
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
