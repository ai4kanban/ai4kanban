// Starting a run, in the two steps every run takes.
//
// Write it down, then hand it to a process of its own. It is one function because there is
// more than one caller: the command a person types, and the watcher of a run that has just
// ended and is starting the refine that follows it. Both take the same two steps in the
// same order, and a run started either way is the same run.

import { spawnWatcher } from './launch'
import { buildRun } from './prompts'
import { markSpawned, openRun } from './sessions'
import type { AgentRequest, RunRecord } from './types'

/** Open a run and spawn its watcher. `spawned` false means nothing is watching it — the
 *  record is there but no process will ever report on it, which is the caller's to raise. */
export function startRun(req: AgentRequest): { run: RunRecord; spawned: boolean } | { error: string } {
  const { prompt, notes } = buildRun(req)
  const opened = openRun(req, prompt, notes)
  if ('error' in opened) return { error: opened.error }
  const { run } = opened
  const pid = spawnWatcher(run.sessionId)
  markSpawned(run.sessionId, pid)
  return { run, spawned: pid !== undefined }
}
