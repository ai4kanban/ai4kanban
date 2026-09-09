// Who the inbox is open to (#453).
//
// The first version is free to invited Cloud accounts on an Engineering board. Pricing is
// what turns it into a paid feature, and Marketing boards are not in it at all — a topic
// board plans content, not engineering work.
//
// One answer, asked in both directions: the local UI hides the rail row with it, and
// `akb signals fetch` refuses with it. Nothing else decides — Cloud is asked every time,
// the way every other admission check asks it.

import { readCloudAccount } from '../cloud/account'
import { SOLUTION_WORK, solution } from '../solution'
import type { SignalsAccess } from '../view/types'

export type { SignalsAccess }

const SIGN_IN = 'Sign in to Cloud from the AI4Kanban app, under Configuration → Notifications.'

/** Whether this board may use the inbox at all. */
export async function signalsAccess(): Promise<SignalsAccess> {
  const work = solution()
  if (work !== 'product') {
    return {
      open: false,
      why: `The inbox is an ${SOLUTION_WORK.product.long} board feature; this board's work is ${SOLUTION_WORK[work].long}.`,
    }
  }
  const account = await readCloudAccount()
  // `signed-in` with an error is what this machine LAST knew, not an admission Cloud just
  // made. Admission has to be confirmed to open the inbox, so an unreachable Cloud closes it
  // rather than leaving the feature standing for an account that was never invited.
  if (account.error) {
    return { open: false, why: `The inbox is open to invited Cloud accounts, and Cloud could not be reached to check: ${account.error}` }
  }
  switch (account.state) {
    case 'signed-in':
      return { open: true }
    case 'not-admitted':
      return {
        open: false,
        why: 'The inbox is open to invited Cloud accounts. Request an invite in the AI4Kanban app, under Configuration → Notifications.',
      }
    case 'expired':
      return { open: false, why: `Your Cloud sign-in has expired. ${SIGN_IN}` }
    default:
      return { open: false, why: `The inbox is a Cloud preview. ${SIGN_IN}` }
  }
}
