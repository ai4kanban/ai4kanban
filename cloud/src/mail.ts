/**
 * The one way the preview sends email: Resend, from the Worker, from the hourly run (#327).
 *
 * It is deliberately not the Cloudflare `send_email` binding. That is free to a verified
 * destination address on our own account and to nobody else, and an invitation goes to a
 * person we have never mailed before.
 *
 * Sending from here rather than from whoever approves a request is what makes a failed send
 * retryable: the key stays in the Worker, and a record the provider did not accept is picked
 * up again on the next run.
 */

import { MAIL_FROM, SUPPORT_EMAIL } from './config.ts'
import type { Env } from './env.ts'

export interface Message {
  to: string
  subject: string
  text: string
  /** Who a reply goes to. `support@ai4kanban.dev` for an invitation; the requester for the
   *  notice that they asked, so answering by hand is a reply. */
  replyTo?: string
}

/** Hand one message to Resend. Throws with the provider's own words, which the record keeps
 *  as its last failure. */
export async function sendMail(env: Env, message: Message): Promise<void> {
  if (!env.RESEND_API_KEY) throw new Error('no RESEND_API_KEY')

  let response: Response
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [message.to],
        reply_to: message.replyTo ?? SUPPORT_EMAIL,
        subject: message.subject,
        text: message.text,
      }),
    })
  } catch (e) {
    throw new Error(`resend unreachable: ${e instanceof Error ? e.message : String(e)}`)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`resend answered ${response.status}: ${body.slice(0, 300)}`)
  }
}
