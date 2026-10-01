// Who triage is open to (#453, #1296): Pro accounts only.
//
// One answer, asked wherever triage is used: the local UI hides the rail row with it, and
// `akb triage fetch`, `akb triage run` and the auto-sort refuse with it.

import { proAccess } from '../cloud/pro'
import type { SignalsAccess } from '../view/types'

export type { SignalsAccess }

/** Whether this board may use triage at all. Asking also refreshes the Pro answer the flow reads. */
export async function signalsAccess(): Promise<SignalsAccess> {
  const access = await proAccess()
  if (access === 'pro') return { open: true }
  if (access === 'signed-out') return { open: false, why: 'Triage needs Pro. Sign in first.' }
  if (access === 'free') return { open: false, why: 'Triage needs Pro.' }
  return { open: false, why: "Couldn't confirm your Pro plan. Reconnect and retry." }
}
