// Who may sort triage (#453, #1296, #1299): Pro accounts only.
//
// Triage itself is open to every account. This answer gates the sort alone: `akb triage run`,
// **Auto-sort** on the page, and the sort a new item starts.

import { proAccess } from '../cloud/pro'
import type { SignalsAccess } from '../view/types'

export type { SignalsAccess }

/** Whether this account may sort triage. Asking also refreshes the Pro answer the flow reads. */
export async function signalsAccess(): Promise<SignalsAccess> {
  const access = await proAccess()
  if (access === 'pro') return { open: true }
  if (access === 'signed-out') return { open: false, why: 'Sorting triage needs Pro. Sign in first.' }
  if (access === 'free') return { open: false, why: 'Sorting triage needs Pro.' }
  return { open: false, why: "Couldn't confirm your Pro plan. Reconnect and retry." }
}
