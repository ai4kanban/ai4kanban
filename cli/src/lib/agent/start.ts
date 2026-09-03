// Starting a run, in the two steps every run takes.
//
// Write it down, then hand it to a process of its own. It is one function because there is
// more than one caller: the command a person types, and the watcher of a run that has just
// ended and is starting the refine that follows it. Both take the same two steps in the
// same order, and a run started either way is the same run.
//
// On a Cloud board there is a step in front of them: the card's workspace lock. It is taken
// BEFORE the record is written, so a card another machine is holding — or a workspace this
// machine cannot reach — refuses the run and leaves nothing behind (#398).

import { randomUUID } from 'node:crypto'

import { dropRunCard, runCanStart, takeRunCard } from '../board'
import { spawnWatcher } from './launch'
import { buildRun } from './prompts'
import { markSpawned, openRun } from './sessions'
import type { AgentRequest, RunRecord } from './types'

/** Open a run and spawn its watcher. `spawned` false means nothing is watching it — the
 *  record is there but no process will ever report on it, which is the caller's to raise. */
export async function startRun(req: AgentRequest): Promise<{ run: RunRecord; spawned: boolean } | { error: string }> {
  const sessionId = randomUUID()
  const cardId = Number.isInteger(req.id) ? (req.id as number) : null
  const held = await takeRunCard(sessionId, cardId)
  if (!held.ok) return { error: held.error }

  const opened = open(req, sessionId)
  if ('error' in opened) await dropRunCard(sessionId)
  return opened
}

/** The same, from inside a board move — where the board's own lock is held and nothing may be
 *  awaited. Only a run with NO card gets here (the changelog a close writes), so there is no
 *  card lock to take; what a Cloud board still refuses is a workspace out of reach. */
export function startCardlessRun(req: AgentRequest): { run: RunRecord; spawned: boolean } | { error: string } {
  const can = runCanStart()
  return can.ok ? open(req, randomUUID()) : { error: can.error }
}

function open(req: AgentRequest, sessionId: string): { run: RunRecord; spawned: boolean } | { error: string } {
  const { prompt, notes } = buildRun(req)
  const opened = openRun(req, prompt, notes, sessionId)
  if ('error' in opened) return { error: opened.error }
  const { run } = opened
  const pid = spawnWatcher(run.sessionId)
  markSpawned(run.sessionId, pid)
  return { run, spawned: pid !== undefined }
}
