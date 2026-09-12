// Who a Cloud preview is open to (#453, #582).
//
// Two features are invite-only so far — triage (../signals/access.ts) and the Marketing
// board (../../commands/install.ts) — and both ask the same question: has Cloud, just now,
// said this account is admitted? Cloud is asked every time; nothing is cached and nothing is
// decided here beyond turning the four states a sign-in comes back with into one answer.
//
// An unreachable Cloud is a refusal. `signed-in` with an error is what this machine LAST
// knew, not an admission, and a preview must not stand open for an account that was never
// invited.

import { BoardError } from '../io'
import { SOLUTION_WORK, type Solution } from '../solution'

import { readCloudAccount } from './account'

/** Whether a preview is open here, and — when it is not — the one line that says why. */
export type Admission = { open: true } | { open: false; why: string }

const SIGN_IN = 'Sign in to Cloud from the AI4Kanban app, under Configuration → Cloud & Notifications.'

/** Whether this machine's Cloud account may use `feature`. `feature` opens each sentence, so
 *  it is capitalised and reads as a noun: "Triage", "The Marketing board". */
export async function cloudAdmission(feature: string): Promise<Admission> {
  const account = await readCloudAccount()
  if (account.error) {
    return { open: false, why: `${feature} is open to invited Cloud accounts, and Cloud could not be reached to check: ${account.error}` }
  }
  switch (account.state) {
    case 'signed-in':
      return { open: true }
    case 'not-admitted':
      return {
        open: false,
        why: `${feature} is open to invited Cloud accounts. Request an invite in the AI4Kanban app, under Configuration → Cloud & Notifications.`,
      }
    case 'expired':
      return { open: false, why: `Your Cloud sign-in has expired. ${SIGN_IN}` }
    default:
      return { open: false, why: `${feature} is a Cloud preview. ${SIGN_IN}` }
  }
}

// The Marketing board is alpha and invite-only (#582). Both doors onto a fresh board ask —
// `akb install --solution marketing` and the `init` move under it — and both ask before
// anything is written, so a refused install leaves the folder exactly as it found it.
/** Refuse a board this account may not make. */
export async function allowedSolution(name?: Solution): Promise<void> {
  if (name !== 'marketing') return
  const access = await cloudAdmission(`The ${SOLUTION_WORK.marketing.long} board`)
  if (!access.open) throw new BoardError(access.why, { kind: 'not-admitted', solution: name })
}
