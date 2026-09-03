// ---- run-blocker -----------------------------------------------------------

import { insideRun } from '../lib/agent/env'
import { recordRunBlocker } from '../lib/agent/store'
import type { ExecutionBlocker } from '../lib/agent/types'
import { say } from '../lib/io'
import { die } from '../lib/paths'
import type { MoveResult } from '../lib/types'

const MAX_FIELD = 240

/** `akb raw run-blocker`, as its command declares it (lib/cli/board.ts). */
export interface RunBlockerOptions {
  step: string
  cause: string
  unblock: string
}

export function cmdRunBlocker(id: number, flags: RunBlockerOptions): MoveResult {
  const sessionId = insideRun()
  if (!sessionId) die('run-blocker is only for the implementation run currently doing the work')

  const blocker: ExecutionBlocker = {
    step: field(flags.step, '--step'),
    cause: field(flags.cause, '--cause'),
    unblock: field(flags.unblock, '--unblock'),
  }
  const out = recordRunBlocker(id, sessionId, blocker)
  if (!out.ok) die(out.error)
  say(`#${id}: implementation blocker recorded; stop this run and resume it after the unblock action`)
  return { id, blocker }
}

function field(raw: string, name: string): string {
  const value = raw.trim()
  if (!value || value.includes('\n') || value.length > MAX_FIELD) die(`${name} needs one short sentence`)
  return value
}
