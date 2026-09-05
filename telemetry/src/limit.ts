/**
 * What one address may send in an hour.
 *
 * The day's allowance protects the money, not the numbers: without a limit one script spends
 * the day's requests in a minute and every real install that day is dropped. An install id
 * is a value the sender makes up, so a flood would use a fresh one each time; the address a
 * request arrived from is the one thing a sender cannot choose.
 *
 * The counter lives in a Durable Object's memory and is never written down — no storage
 * call, so nothing about the address outlives the object, and the object outlives nothing
 * but a quiet hour. Cloudflare's own rate-limiting binding counts over ten or sixty seconds
 * only, which is why the hour is counted here instead.
 */

import { LIMITS } from '../contract.ts'

export class AddressHour {
  private hour = ''
  private taken = 0

  fetch(request: Request): Response {
    const hour = new URL(request.url).searchParams.get('hour') ?? ''
    if (hour !== this.hour) {
      this.hour = hour
      this.taken = 0
    }
    this.taken += 1
    return new Response(null, { status: this.taken > LIMITS.requestsPerHour ? 429 : 204 })
  }
}

/**
 * Whether this request is within the hour's allowance.
 *
 * A request with no address behind it — `wrangler dev`, a test — is not counted. A limiter
 * that cannot be reached lets the request through: the endpoint staying up matters more than
 * one hour of one address being counted exactly.
 */
export async function withinLimit(
  limiter: DurableObjectNamespace,
  address: string,
  now: Date,
): Promise<boolean> {
  if (!address) return true
  const hour = now.toISOString().slice(0, 13)
  try {
    const stub = limiter.get(limiter.idFromName(await hashed(address)))
    const answer = await stub.fetch(`https://limiter/?hour=${hour}`)
    return answer.status !== 429
  } catch (error) {
    console.error('telemetry: limiter unreachable', error)
    return true
  }
}

/** The address never names anything, here or anywhere else. */
async function hashed(address: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(address))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
