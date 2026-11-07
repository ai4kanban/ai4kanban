// `.ai4kanban.json` at the repository root once pointed a checkout at a Cloud board. Cloud
// boards are retired (#2046): the file is only detected, so `akb` can say it does nothing.

import fs from 'node:fs'
import path from 'node:path'

export const POINTER_FILE = '.ai4kanban.json'

/** Whether this checkout still carries a pointer naming a workspace. */
export function hasRetiredPointer(root: string): boolean {
  try {
    const held = JSON.parse(fs.readFileSync(path.join(root, POINTER_FILE), 'utf8')) as { workspace?: unknown }
    return typeof held.workspace === 'string' && held.workspace.trim() !== ''
  } catch {
    return false
  }
}
