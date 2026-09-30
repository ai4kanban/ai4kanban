// Whether this machine's Cloud account has Pro (#1038).
//
// Cloud's `GET /v1/billing` answers. A Pro answer is kept per account for ten minutes, and
// stands in for Cloud — offline, or with billing down — until seven days past its period end.
// A free answer is never kept, so a purchase counts on the very next try.

import fs from 'node:fs'
import path from 'node:path'

import { refusal, type RunRefusal } from '../agent/types'
import { machineHome } from '../machine/home'
import { cloudConfigured, cloudEndpoints } from './config'
import { accessToken, readSession } from './session'
import type { ProAccess } from './types'

export type { ProAccess }


const FRESH_MS = 10 * 60_000
const GRACE_MS = 7 * 24 * 60 * 60_000
const ASK_MS = 8_000

interface HeldPro {
  subject: string
  checkedAt: number
  periodEnd: string | null
}

const heldFile = (): string => path.join(machineHome(), 'pro.json')

function readHeld(subject: string | undefined): HeldPro | null {
  if (!subject) return null
  try {
    const held = JSON.parse(fs.readFileSync(heldFile(), 'utf8')) as Partial<HeldPro>
    if (held.subject !== subject || typeof held.checkedAt !== 'number') return null
    return { subject, checkedAt: held.checkedAt, periodEnd: typeof held.periodEnd === 'string' ? held.periodEnd : null }
  } catch {
    return null
  }
}

function writeHeld(held: HeldPro): void {
  try {
    fs.mkdirSync(machineHome(), { recursive: true, mode: 0o700 })
    const tmp = `${heldFile()}.${process.pid}.tmp`
    fs.writeFileSync(tmp, `${JSON.stringify(held)}\n`, { mode: 0o600 })
    fs.renameSync(tmp, heldFile())
  } catch {
    // Unkept, the next check simply asks Cloud again.
  }
}

/** Forget the kept answer — on sign-out, and whenever Cloud says the account is not Pro. */
export function forgetPro(): void {
  fs.rmSync(heldFile(), { force: true })
}

// A Pro answer Cloud cannot refresh right now holds until seven days past its period end, or
// past when it was read for a plan with no end.
const fallback = (held: HeldPro | null, now: number): ProAccess => {
  if (!held) return 'unconfirmed'
  const end = held.periodEnd ? Date.parse(held.periodEnd) : held.checkedAt
  return now < (Number.isFinite(end) ? end : held.checkedAt) + GRACE_MS ? 'pro' : 'unconfirmed'
}

/** Whether the Pro answer this machine last kept still stands, read without reaching Cloud —
 *  for a flow printed where nothing may be awaited. `proAccess` is what refreshes it. */
export function heldPro(now = Date.now()): boolean {
  return fallback(readHeld(readSession()?.subject), now) === 'pro'
}

/** Ask whether this machine's account has Pro. Never throws. */
export async function proAccess(now = Date.now()): Promise<ProAccess> {
  if (!cloudConfigured()) return 'signed-out'
  const token = await accessToken()
  if (!token.ok) {
    if (token.reason !== 'unreachable') return 'signed-out'
    return fallback(readHeld(readSession()?.subject), now)
  }
  const subject = token.session.subject
  const held = readHeld(subject)
  if (held && now - held.checkedAt < FRESH_MS) return 'pro'

  let response: Response
  try {
    response = await fetch(`${cloudEndpoints().api}/v1/billing`, {
      headers: { authorization: `Bearer ${token.token}` },
      signal: AbortSignal.timeout(ASK_MS),
    })
  } catch {
    return fallback(held, now)
  }
  const body = (await response.json().catch(() => ({}))) as {
    billing?: { plan?: string; periodEnd?: string | null; grantEnd?: string | null }
    error?: { code?: string }
  }
  if (response.ok && body.billing) {
    if (body.billing.plan !== 'pro') {
      forgetPro()
      return 'free'
    }
    // Held until whichever runs longer: the subscription, or a seed partner's grant (#1039).
    const ends = [body.billing.periodEnd, body.billing.grantEnd].filter((d): d is string => !!d).sort()
    writeHeld({ subject, checkedAt: now, periodEnd: ends.at(-1) ?? null })
    return 'pro'
  }
  if (body.error?.code === 'unauthenticated') return 'signed-out'
  return fallback(held, now)
}

/** Whether this account may use a Pro workflow — run it, or duplicate it. */
export async function proGate(
  flow: { id: string; name: string; pro: boolean },
  ask: () => Promise<ProAccess> = proAccess,
): Promise<RunRefusal | null> {
  if (!flow.pro) return null
  const access = await ask()
  const args = { workflow: flow.id, name: flow.name }
  if (access === 'pro') return null
  if (access === 'signed-out') return refusal('proSignIn', `${flow.name} needs Pro. Sign in first.`, args)
  if (access === 'free') return refusal('proRequired', `${flow.name} needs Pro.`, args)
  return refusal('proUnconfirmed', "Couldn't confirm your Pro plan. Reconnect and retry.", args)
}
