// The desktop Billing tab (#1109): the plan, its charges, and the two Creem pages it opens.
// Every call uses this machine's Cloud sign-in, so buying never asks for a second one.

import { cloudConfigured, cloudEndpoints } from './config'
import { accessToken } from './session'
import type { BillingLink, BillingRead, CloudBilling, CloudInvoice, InvoicesRead } from './types'

export type { BillingLink, BillingRead, CloudBilling, CloudInvoice, InvoicesRead }

const ASK_MS = 10_000

type Asked = { ok: true; body: Record<string, unknown> } | { ok: false; signedOut: boolean; error: string }

async function ask(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Asked> {
  if (!cloudConfigured()) return { ok: false, signedOut: true, error: 'Cloud is not configured.' }
  const token = await accessToken()
  if (!token.ok) {
    return { ok: false, signedOut: token.reason !== 'unreachable', error: ('error' in token && token.error) || token.reason }
  }
  let response: Response
  try {
    response = await fetch(`${cloudEndpoints().api}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token.token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(ASK_MS),
    })
  } catch (e) {
    return { ok: false, signedOut: false, error: e instanceof Error ? e.message : String(e) }
  }
  const answer = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: { code?: string; message?: string }
  }
  if (response.ok) return { ok: true, body: answer }
  return {
    ok: false,
    signedOut: answer.error?.code === 'unauthenticated',
    error: answer.error?.message ?? `Cloud answered ${response.status}.`,
  }
}

/** The account's plan. Never throws. */
export async function readBilling(): Promise<BillingRead> {
  const asked = await ask('GET', '/v1/billing')
  if (!asked.ok) return { state: asked.signedOut ? 'signed-out' : 'unavailable' }
  const billing = asked.body.billing as CloudBilling | undefined
  return billing ? { state: 'ok', billing } : { state: 'unavailable' }
}

/** The account's charges, newest first. Never throws. */
export async function readInvoices(): Promise<InvoicesRead> {
  const asked = await ask('GET', '/v1/billing/invoices')
  const invoices = asked.ok ? (asked.body.invoices as CloudInvoice[] | undefined) : undefined
  return Array.isArray(invoices) ? { ok: true, invoices } : { ok: false }
}

async function link(path: string, body?: unknown): Promise<BillingLink> {
  const asked = await ask('POST', path, body)
  if (!asked.ok) return { ok: false, error: asked.error }
  const url = asked.body.url
  return typeof url === 'string' && url ? { ok: true, url } : { ok: false, error: 'Cloud gave no link.' }
}

/** Creem's checkout for Pro, returning to the public done page. */
export function startCheckout(period: 'monthly' | 'yearly'): Promise<BillingLink> {
  return link('/v1/billing/checkout', { period, source: 'desktop' })
}

/** Creem's billing portal, where the plan is changed, cancelled or paid. */
export function openBillingPortal(): Promise<BillingLink> {
  return link('/v1/billing/portal')
}
