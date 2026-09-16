// Who triage is open to (#453).
//
// The first version is free to invited Cloud accounts. Pricing is what turns it into a paid
// feature.
//
// One answer, asked wherever triage is used: the local UI hides the rail row with it, and
// `akb triage fetch` and `akb triage run` refuse with it. Nothing else decides — Cloud is
// asked every time, through the admission check every preview shares (../cloud/admission.ts).

import { cloudAdmission } from '../cloud/admission'
import type { SignalsAccess } from '../view/types'

export type { SignalsAccess }

/** Whether this board may use triage at all. */
export const signalsAccess = (): Promise<SignalsAccess> => cloudAdmission('Triage')
