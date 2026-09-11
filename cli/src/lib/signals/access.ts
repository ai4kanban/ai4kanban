// Who triage is open to (#453).
//
// The first version is free to invited Cloud accounts on an Engineering board. Pricing is
// what turns it into a paid feature, and Marketing boards are not in it at all — a topic
// board plans content, not engineering work.
//
// One answer, asked wherever triage is used: the local UI hides the rail row with it, and
// `akb triage fetch` and `akb triage run` refuse with it. Nothing else decides — Cloud is
// asked every time, through the admission check every preview shares (../cloud/admission.ts).

import { cloudAdmission } from '../cloud/admission'
import { SOLUTION_WORK, solution } from '../solution'
import type { SignalsAccess } from '../view/types'

export type { SignalsAccess }

/** Whether this board may use triage at all. */
export async function signalsAccess(): Promise<SignalsAccess> {
  const work = solution()
  if (work !== 'product') {
    return {
      open: false,
      why: `Triage is an ${SOLUTION_WORK.product.long} board feature; this board's work is ${SOLUTION_WORK[work].long}.`,
    }
  }
  return cloudAdmission('Triage')
}
