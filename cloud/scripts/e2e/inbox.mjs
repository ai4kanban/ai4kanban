// Supabase Auth sends sign-in codes through Resend, so a code mailed to Resend's test
// address delivered+<tag>@resend.dev can be read back from Resend's API: no inbox needed.

import { waitFor } from './browser.mjs'

const API = 'https://api.resend.com'

export const testAddress = (tag) => `delivered+${tag}@resend.dev`

/** The 6-digit code in the newest mail to `address` sent after `since`, and when it arrived. */
export async function signInCode(key, address, since) {
  const get = async (path) => {
    const response = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${key}`, 'user-agent': 'wildcrane-e2e' }, signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`Resend answered ${response.status}`)
    return await response.json()
  }
  return await waitFor(async () => {
    const { data } = await get('/emails?limit=20')
    const mail = data.find((m) => m.to?.includes(address) && Date.parse(m.created_at) >= since - 2_000)
    if (!mail) return undefined
    const full = await get(`/emails/${mail.id}`)
    const code = /\b(\d{6})\b/.exec(full.html ?? full.text ?? '')?.[1]
    return code ? { code, subject: full.subject, at: Date.parse(mail.created_at) } : undefined
  }, 120_000, `no sign-in mail reached ${address} within 2 minutes`, 3_000)
}
