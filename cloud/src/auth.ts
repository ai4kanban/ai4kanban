import { CLOCK_SKEW_SECONDS, JWKS_MIN_REFETCH_MS, JWKS_TTL_MS } from './config.ts'
import { unauthenticated } from './errors.ts'

/** What a verified sign-in token tells the service about the caller. */
export interface Identity {
  /** The Supabase user id — the stable handle a member record hangs off (#314). */
  subject: string
  email?: string
  /** The identity provider behind the sign-in; `github` for every member today. */
  provider?: string
  expiresAt: number
}

interface JwtHeader {
  alg?: string
  kid?: string
  typ?: string
}

interface JwtClaims {
  sub?: string
  iss?: string
  aud?: string | string[]
  exp?: number
  nbf?: number
  email?: string
  app_metadata?: { provider?: string }
}

type Jwk = JsonWebKey & { kid?: string; alg?: string }

const SUPPORTED_ALGORITHMS = ['ES256', 'RS256'] as const
type Algorithm = (typeof SUPPORTED_ALGORITHMS)[number]

interface JwksCache {
  source: string
  keys: Map<string, CryptoKey>
  fetchedAt: number
}

let cache: JwksCache | null = null
let inFlight: Promise<JwksCache> | null = null

export const jwksUrl = (supabaseUrl: string) =>
  `${trimSlash(supabaseUrl)}/auth/v1/.well-known/jwks.json`

export const issuerFor = (supabaseUrl: string) => `${trimSlash(supabaseUrl)}/auth/v1`

/** Reads the bearer token off a request, or refuses when there is none. */
export function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer (.+)$/i.exec(header.trim())
  if (!match?.[1]) throw unauthenticated()
  return match[1]
}

/**
 * Verifies a Supabase sign-in token against the project's JWKS. The keys are asymmetric,
 * so the Worker holds no signing secret and one cannot leak from here (#311).
 */
export async function verifyAccessToken(
  token: string,
  supabaseUrl: string,
  now = Date.now(),
): Promise<Identity> {
  const parts = token.split('.')
  if (parts.length !== 3) throw unauthenticated('That sign-in token is not readable.')
  const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string]

  const header = decodeJson<JwtHeader>(encodedHeader)
  const alg = header.alg
  if (!alg || !isSupported(alg)) throw unauthenticated('That sign-in token is signed the wrong way.')
  if (!header.kid) throw unauthenticated('That sign-in token names no signing key.')

  const signature = decodeSegment(encodedSignature)
  const key = await signingKey(header.kid, alg, supabaseUrl, now)
  const signed = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  const ok = await crypto.subtle.verify(verifyParams(alg), key, signature, signed)
  if (!ok) throw unauthenticated('That sign-in token did not verify.')

  return checkClaims(decodeJson<JwtClaims>(encodedPayload), supabaseUrl, now)
}

/** Drops the cached JWKS. Tests use it; the Worker never needs to. */
export function resetJwksCache(): void {
  cache = null
  inFlight = null
}

function checkClaims(claims: JwtClaims, supabaseUrl: string, now: number): Identity {
  const seconds = Math.floor(now / 1000)
  if (claims.iss !== issuerFor(supabaseUrl)) {
    throw unauthenticated('That sign-in token came from somewhere else.')
  }
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!audience.includes('authenticated')) {
    throw unauthenticated('That sign-in token is not a signed-in session.')
  }
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < seconds) {
    throw unauthenticated('Your sign-in has expired. Sign in again.')
  }
  if (typeof claims.nbf === 'number' && claims.nbf - CLOCK_SKEW_SECONDS > seconds) {
    throw unauthenticated('That sign-in token is not usable yet.')
  }
  if (!claims.sub) throw unauthenticated('That sign-in token names no account.')

  return {
    subject: claims.sub,
    email: claims.email,
    provider: claims.app_metadata?.provider,
    expiresAt: claims.exp * 1000,
  }
}

async function signingKey(
  kid: string,
  alg: Algorithm,
  supabaseUrl: string,
  now: number,
): Promise<CryptoKey> {
  let keys = await jwks(supabaseUrl, now, false)
  let key = keys.get(cacheKey(kid, alg))
  if (!key) {
    // An unknown `kid` is what a rotated signing key looks like, so fetch once more.
    keys = await jwks(supabaseUrl, now, true)
    key = keys.get(cacheKey(kid, alg))
  }
  if (!key) throw unauthenticated('That sign-in token names an unknown signing key.')
  return key
}

async function jwks(
  supabaseUrl: string,
  now: number,
  forceRefresh: boolean,
): Promise<Map<string, CryptoKey>> {
  const fresh = cache?.source === supabaseUrl && now - cache.fetchedAt < JWKS_TTL_MS
  const throttled = cache?.source === supabaseUrl && now - cache.fetchedAt < JWKS_MIN_REFETCH_MS
  if (cache && (forceRefresh ? throttled : fresh)) return cache.keys

  inFlight ??= fetchJwks(supabaseUrl, now).finally(() => {
    inFlight = null
  })
  cache = await inFlight
  return cache.keys
}

async function fetchJwks(supabaseUrl: string, now: number): Promise<JwksCache> {
  const response = await fetch(jwksUrl(supabaseUrl))
  if (!response.ok) throw unauthenticated('Cloud could not check your sign-in. Try again shortly.')

  const body = (await response.json()) as { keys?: Jwk[] }
  const keys = new Map<string, CryptoKey>()
  for (const jwk of body.keys ?? []) {
    if (!jwk.kid || !jwk.alg || !isSupported(jwk.alg)) continue
    const imported = await crypto.subtle.importKey('jwk', jwk, importParams(jwk.alg), false, [
      'verify',
    ])
    keys.set(cacheKey(jwk.kid, jwk.alg), imported)
  }
  return { source: supabaseUrl, keys, fetchedAt: now }
}

/**
 * Keys are cached under `kid` *and* the algorithm they were imported for, so a token
 * cannot name a key the project publishes for one algorithm and have it verified as
 * another.
 */
const cacheKey = (kid: string, alg: Algorithm) => `${alg}:${kid}`

const isSupported = (alg: string): alg is Algorithm =>
  (SUPPORTED_ALGORITHMS as readonly string[]).includes(alg)

function importParams(alg: Algorithm): EcKeyImportParams | RsaHashedImportParams {
  return alg === 'ES256'
    ? { name: 'ECDSA', namedCurve: 'P-256' }
    : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }
}

function verifyParams(alg: Algorithm): EcdsaParams | AlgorithmIdentifier {
  return alg === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'RSASSA-PKCS1-v1_5' }
}

function decodeJson<T>(segment: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(decodeSegment(segment))) as T
  } catch {
    throw unauthenticated('That sign-in token is not readable.')
  }
}

/** A segment that is not base64url is a bad token, not a service failure. */
function decodeSegment(segment: string) {
  try {
    return base64UrlToBytes(segment)
  } catch {
    throw unauthenticated('That sign-in token is not readable.')
  }
}

function base64UrlToBytes(segment: string) {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const trimSlash = (url: string) => url.replace(/\/+$/, '')
