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

import { advancePhase } from './approve'
import { spawnWatcher } from './launch'
import { claimRunPictures, returnRunPictures } from './pictures'
import { deliveryFor } from './deliveries'
import { buildRun } from './prompts'
import { archivesOnApproval, cardWorkflowId, workflowFor, workflowIssues, workflows } from './workflows'
import { cancelDelivery, carriedSession, closeRun, markSpawned, openResume, openRun, peekRun } from './sessions'
import { runtimeById } from './runtimes'
import { scheduledBusy, stalePasses } from './scheduled'
import { refusal, workflowDeleted, type AgentRequest, type RunRecord, type RunRefusal } from './types'

/** Open a run and spawn its watcher. `spawned` false means nothing is watching it — the
 *  record is there but no process will ever report on it, which is the caller's to raise. */
export async function startRun(req: AgentRequest): Promise<{ run: RunRecord; spawned: boolean } | RunRefusal> {
  const sessionId = randomUUID()
  const cardId = Number.isInteger(req.id) ? (req.id as number) : null
  const short = workflowRefusal(req) ?? (await scheduledRefusal(req))
  if (short) return short
  // Approve moves the card on only once its run is cleared to start (#1790).
  const moved = req.action === 'approve' ? advancePhase(cardId!) : null
  if (moved) return moved
  return open(req, sessionId)
}

// Why this run's card cannot start on the workflow it names (#715): a land agent this board
// cannot run. It is read before the card lock is taken, so a refused run leaves nothing behind.
//
// The whole workflow is checked rather than only the stage this run is: a card that cannot be
// reviewed is a card that should not be built, and finding that out after the build is worse
// than finding it out now. A run already inside a delivery is not checked — that delivery
// froze its own answer, and re-reading the board would refuse a build in flight over a change
// made after it started.
export function workflowRefusal(req: AgentRequest): RunRefusal | null {
  if (!Number.isInteger(req.id)) return null
  if (deliveryFor(req)) return null
  const id = cardWorkflowId(req.id as number)
  // A card naming a workflow this board no longer has RESOLVES to the default, so that the
  // card is still readable — but it does not run: `workflowFor` never answers nothing here,
  // and a card quietly built by agents nobody assigned it is worse than a card that stops.
  if (workflowDeleted(id, workflows().map((w) => w.id))) {
    return refusal('workflowUnknown', `#${req.id} names the "${id}" workflow, and this board has no such workflow.`, {
      card: String(req.id),
      workflow: id,
    })
  }
  const flow = workflowFor(id)
  if (!flow) return null
  // A workflow that lands nothing builds nothing: its last approval archives the card.
  if (archivesOnApproval(flow) && req.action === 'implement') {
    return refusal('planDelivered', `#${req.id} lands nothing, so its last approval archives it rather than building it.`, { card: String(req.id) })
  }
  const [problem] = workflowIssues(flow.id)
  return problem ?? null
}

// Why a scheduled agent's new pass cannot start (#1401): its last pass is still running or
// landing. One that stopped short is given up here — the new pass
// replaces it — so a failing agent never piles up worktrees.
async function scheduledRefusal(req: AgentRequest): Promise<RunRefusal | null> {
  if (req.action !== 'scheduled' || req.deliveryId || !req.workflow || !req.specAgent) return null
  const pass = { workflow: req.workflow, agent: req.specAgent }
  const refused = scheduledBusy(pass)
  if (refused) return refused
  for (const id of stalePasses(pass)) await cancelDelivery(id)
  return null
}

/** Start a sub-run of the live run `parentId` (#1421): the same agent, in the same folder, on
 *  the parent's runtime unless one is named. It takes no card lock and passes no gate the
 *  parent already passed. */
export function startSubRun(parentId: string, prompt: string, runtime?: string): { run: RunRecord; spawned: boolean } | RunRefusal {
  const parent = peekRun(parentId)
  if (!parent || parent.status !== 'running') return refusal('runNotFound', `run ${parentId.slice(0, 8)} is not running here`, { id: parentId })
  if (parent.action === 'sub') return refusal('subRunNested', 'a sub-run cannot start sub-runs of its own')
  const inherited = parent.runtime && runtimeById(parent.runtime) ? parent.runtime : undefined
  return open(
    {
      action: 'sub',
      id: parent.cardId ?? undefined,
      parentId,
      description: prompt,
      specAgent: parent.agent,
      runtime: runtime ?? inherited,
    },
    randomUUID(),
  )
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
  // A card's planning carries its own session on (#1304), where there is one to carry, and
  // its log opens by saying which it was (#1309).
  const planning = carriedSession(ask)
  const carried = planning?.carried
  const { prompt, notes } = buildRun(carried ? { ...ask, session: carried.fork ? 'fork' : 'resume' } : ask)
  if (planning) notes.unshift(planning.note)
  const opened = openRun(ask, prompt, notes, sessionId, carried)
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
  if (pid === undefined) await closeRun(opened.run.sessionId, { status: 'error', code: null, error: 'Could not start the resumed run watcher.', errorWhy: [{ kind: 'resumeUnstarted' }] })
  return { run: opened.run, spawned: pid !== undefined }
}
