// The folder every machine-level AI4Kanban file lives in.
//
// Outside every repository, so the desktop app, the board UI server it starts and an `akb`
// in a terminal reach one answer. It held nothing but the Cloud sign-in until the language
// setting joined it (#334), which is why it no longer lives under `cloud/`.

import os from 'node:os'
import path from 'node:path'

/** `AI4KANBAN_HOME` moves it, which is what a test uses. */
export function machineHome(): string {
  return process.env.AI4KANBAN_HOME || path.join(os.homedir(), '.ai4kanban')
}
