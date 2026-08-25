import { Refusal, serviceUnavailable } from './errors.ts'

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  })
}

/** The one error shape the service returns: `{ error: { code, message } }`. */
export function refusalResponse(error: unknown): Response {
  const refusal = error instanceof Refusal ? error : serviceUnavailable()
  const headers: Record<string, string> = {}
  if (refusal.retryAfterSeconds !== undefined) {
    headers['retry-after'] = String(refusal.retryAfterSeconds)
  }
  return json({ error: { code: refusal.code, message: refusal.message } }, refusal.status, headers)
}
