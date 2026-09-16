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
import { claimRunPictures, returnRunPictures } from './pictures'
import { deliveryFor } from './deliveries'
import { dependencyRefusal, type DependencyScope } from './dependencies'
import { buildRun } from './prompts'
import { cardWorkflowId, workflowFor, workflowKnown, workflowProblems } from './workflows'
import { closeRun, markSpawned, openResume, openRun } from './sessions'
import type { AgentRequest, RunRecord, RunRefusal } from './types'

/** Open a run and spawn its watcher. `spawned` false means nothing is watching it — the
 *  record is there but no process will ever report on it, which is the caller's to raise.
 *  `scope` is the round a spec run was asked for in, for its dependency check (#782). */
export async function startRun(
  req: AgentRequest,
  scope: DependencyScope = {},
): Promise<{ run: RunRecord; spawned: boolean } | RunRefusal> {
  const sessionId = randomUUID()
  const cardId = Number.isInteger(req.id) ? (req.id as number) : null
  const short =
    workflowRefusal(req) ??
    (req.action === 'spec' && cardId !== null && req.specAgent ? dependencyRefusal(cardId, req.specAgent, scope) : null)
  if (short) return { error: short }
  const held = await takeRunCard(sessionId, cardId)
  if (!held.ok) return { error: held.error }

  const opened = open(req, sessionId)
  if ('error' in opened) await dropRunCard(sessionId)
  return opened
}

// Built-in workflows the command no longer ships (#821). A card still naming one runs on the
// default instead of being refused — it cannot be moved to another workflow.
const RETIRED_WORKFLOWS = ['content']

// Why this run's card cannot start on the workflow it names (#715): a stage with no lead, or
// one led by an agent this board no longer has. It is read before the card lock is taken, so
// a refused run leaves nothing behind.
//
// The whole workflow is checked rather than only the stage this run is: a card that cannot be
// reviewed is a card that should not be built, and finding that out after the build is worse
// than finding it out now. A run already inside a delivery is not checked — that delivery
// froze its own answer, and re-reading the board would refuse a build in flight over a change
// made after it started.
export function workflowRefusal(req: AgentRequest): string | null {
  if (!Number.isInteger(req.id)) return null
  if (deliveryFor(req)) return null
  const id = cardWorkflowId(req.id as number)
  // A card naming a workflow this board no longer has RESOLVES to the default, so that the
  // card is still readable — but it does not run: `workflowFor` never answers nothing here,
  // and a card quietly built by agents nobody assigned it is worse than a card that stops.
  if (!workflowKnown(id) && !RETIRED_WORKFLOWS.includes(id)) return `#${req.id} names the "${id}" workflow, and this board has no such workflow.`
  const flow = workflowFor(id)
  if (!flow) return null
  const problems = workflowProblems(flow.id)
  if (!problems.length) return null
  return `${problems[0]} Assign it in Configuration → Workflows, or with \`akb workflow stage ${flow.id} --stage <stage> --lead <agent>\`.`
}

/** The same, from inside a board move — where the board's own lock is held and nothing may be
 *  awaited. Only a run with NO card gets here (the changelog a close writes), so there is no
 *  card lock to take; what a Cloud board still refuses is a workspace out of reach. */
export function startCardlessRun(req: AgentRequest): { run: RunRecord; spawned: boolean } | RunRefusal {
  const can = runCanStart()
  return can.ok ? open(req, randomUUID()) : { error: can.error }
}

/** What this run is written down from (#517): the pictures pasted into the create sheet
 *  become the run's own — the box is renamed after it, so the log prune takes them with the
 *  log — and `pictures` is always what was claimed out of that box. A request that names a
 *  file itself names a path on this machine, and these come from a browser, so it is dropped
 *  rather than followed. */
export function runAsk(req: AgentRequest, sessionId: string): AgentRequest {
  const pictures = claimRunPictures(req.box, sessionId, req.shots)
  return {
    ...req,
    box: undefined,
    shots: undefined,
    pictures: pictures.length ? pictures : undefined,
  }
}

function open(req: AgentRequest, sessionId: string): { run: RunRecord; spawned: boolean } | RunRefusal {
  // A run refused below gives its pictures back — the sheet is still up with its words.
  const ask = runAsk(req, sessionId)
  const { prompt, notes } = buildRun(ask)
  const opened = openRun(ask, prompt, notes, sessionId)
  if ('error' in opened) {
    returnRunPictures(sessionId, req.box)
    return opened
  }
  const { run } = opened
  const pid = spawnWatcher(run.sessionId)
  markSpawned(run.sessionId, pid)
  return { run, spawned: pid !== undefined }
}

/** Continue the saved harness conversation through the same path as the Resume command. */
export async function startResume(id: string): Promise<{ run: RunRecord; spawned: boolean } | RunRefusal> {
  const opened = await openResume(id)
  if ('error' in opened) return opened
  const pid = spawnWatcher(opened.run.sessionId)
  markSpawned(opened.run.sessionId, pid)
  if (pid === undefined) await closeRun(opened.run.sessionId, { status: 'error', code: null, error: 'Could not start the resumed run watcher.' })
  return { run: opened.run, spawned: pid !== undefined }
}
