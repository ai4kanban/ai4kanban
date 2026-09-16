// Who a Cloud preview is open to (#453, #582).
//
// Triage (../signals/access.ts) is invite-only so far, and it asks one question: has Cloud,
// just now, said this account is admitted? Cloud is asked every time; nothing is cached and
// nothing is decided here beyond turning the four states a sign-in comes back with into one
// answer.
//
// An unreachable Cloud is a refusal. `signed-in` with an error is what this machine LAST
// knew, not an admission, and a preview must not stand open for an account that was never
// invited.

import { readCloudAccount } from './account'

/** Whether a preview is open here, and — when it is not — the one line that says why. */
export type Admission = { open: true } | { open: false; why: string }

const SIGN_IN = 'Sign in to Cloud from the AI4Kanban app, under Configuration → Cloud & Notifications.'

/** Whether this machine's Cloud account may use `feature`. `feature` opens each sentence, so
 *  it is capitalised and reads as a noun: "Triage". */
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
