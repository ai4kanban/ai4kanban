import { Refusal, methodNotAllowed, serviceUnavailable } from './errors.ts'

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  })
}

/** The one error shape the service returns: `{ error: { code, message } }`. A conflict adds
 *  `current`, the revision the resource holds now, so a client re-reads that one card
 *  rather than the whole board (#314). */
export function refusalResponse(error: unknown): Response {
  const refusal = error instanceof Refusal ? error : serviceUnavailable()
  const headers: Record<string, string> = {}
  if (refusal.retryAfterSeconds !== undefined) {
    headers['retry-after'] = String(refusal.retryAfterSeconds)
  }
  return json(
    {
      error: {
        code: refusal.code,
        message: refusal.message,
        ...(refusal.current !== undefined ? { current: refusal.current } : {}),
        ...(refusal.until !== undefined ? { until: refusal.until } : {}),
      },
    },
    refusal.status,
    headers,
  )
}

export function requireMethod(request: Request, method: string): void {
  if (request.method !== method) throw methodNotAllowed()
}

/** A JSON body, or nothing. A request that carries something other than JSON is a bad
 *  request; each route says which field it was missing. */
export async function bodyOf(request: Request): Promise<unknown> {
  return (await request.json().catch(() => null)) as unknown
}
