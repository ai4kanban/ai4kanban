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
import { buildRun } from './prompts'
import { proAccess, proGate, type ProAccess } from '../cloud/pro'
import { cardWorkflowId, workflowById, workflowFor, workflowIssues, workflows } from './workflows'
import { cancelDelivery, carriedSession, closeRun, markSpawned, openResume, openRun, peekRun } from './sessions'
import { runtimeById } from './runtimes'
import { scheduledBusy, stalePasses } from './scheduled'
import { takeChatSession } from './chat'
import { refusal, workflowDeleted, type AgentRequest, type RunRecord, type RunRefusal } from './types'

/** Open a run and spawn its watcher. `spawned` false means nothing is watching it — the
 *  record is there but no process will ever report on it, which is the caller's to raise. */
export async function startRun(req: AgentRequest): Promise<{ run: RunRecord; spawned: boolean } | RunRefusal> {
  const sessionId = randomUUID()
  const cardId = Number.isInteger(req.id) ? (req.id as number) : null
  const short = workflowRefusal(req) ?? (await proRefusal(req)) ?? (await scheduledRefusal(req))
  if (short) return short
  const held = await takeRunCard(sessionId, cardId)
  if (!held.ok) return held

  const opened = open(req, sessionId)
  if ('error' in opened) await dropRunCard(sessionId)
  return opened
}

// Why this run's card cannot start on the workflow it names (#715): a stage with no lead, or
// one led by an agent this board no longer has. It is read before the card lock is taken, so
// a refused run leaves nothing behind.
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
  // A workflow that finishes in planning builds nothing (#1057).
  if (flow.delivers === 'plan' && req.action === 'implement') {
    return refusal('planDelivered', `#${req.id} is finished during planning, so it is archived rather than built.`, { card: String(req.id) })
  }
  const [problem] = workflowIssues(flow.id)
  if (!problem) return null
  // A refused lead is brought back by fixing its file, not by assigning another (#1342).
  if (problem.reason === 'workflowLeadRefused') return problem
  const command = `akb workflow stage ${flow.id} --stage <stage> --lead <agent>`
  return {
    ...problem,
    error: `${problem.error} Assign it in Configuration → Workflows, or with \`${command}\`.`,
    args: { ...problem.args, command },
  }
}

// Why a scheduled agent's new pass cannot start (#1401): its workflow needs Pro, or its last
// pass is still running or landing. One that stopped short is given up here — the new pass
// replaces it — so a failing agent never piles up worktrees.
async function scheduledRefusal(req: AgentRequest): Promise<RunRefusal | null> {
  if (req.action !== 'scheduled' || req.deliveryId || !req.workflow || !req.specAgent) return null
  const pass = { workflow: req.workflow, agent: req.specAgent }
  const flow = workflowById(pass.workflow)
  const refused = (flow ? await proGate(flow) : null) ?? scheduledBusy(pass)
  if (refused) return refused
  for (const id of stalePasses(pass)) await cancelDelivery(id)
  return null
}

// Archive takes a card off the board, which needs no Pro.
const FREE_ACTIONS = ['archive']

/** Why this card's run needs Pro this account cannot show (#1038). Skipped where
 *  `workflowRefusal` skips, so a delivery already under way finishes on the plan it began on. */
export async function proRefusal(req: AgentRequest, ask: () => Promise<ProAccess> = proAccess): Promise<RunRefusal | null> {
  if (!Number.isInteger(req.id) || FREE_ACTIONS.includes(req.action) || deliveryFor(req)) return null
  const flow = workflowFor(cardWorkflowId(req.id as number))
  return flow?.pro ? proGate(flow, ask) : null
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

/** The same, from inside a board move — where the board's own lock is held and nothing may be
 *  awaited. Only a run with NO card gets here (the changelog a close writes), so there is no
 *  card lock to take; what a Cloud board still refuses is a workspace out of reach. */
export function startCardlessRun(req: AgentRequest): { run: RunRecord; spawned: boolean } | RunRefusal {
  const can = runCanStart()
  return can.ok ? open(req, randomUUID()) : can
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
  // Plan tasks is said into the discussion's own session (#1026), and a discussion's Start now
  // forks it (#1246) — held until the run is written down.
  const fromChat = ask.action === 'create' || ask.action === 'implement' ? ask.chat : undefined
  const said = fromChat ? takeChatSession(fromChat, ask.action === 'implement') : undefined
  if (said && 'error' in said) {
    returnRunPictures(sessionId, req.box)
    return said
  }
  // A card's planning carries its own session on (#1304), where there is one to carry, and
  // its log opens by saying which it was (#1309).
  const planning = said ? undefined : carriedSession(ask)
  const carried = planning?.carried
  let opened: ReturnType<typeof openRun>
  try {
    // The skill is called the way the conversation's own CLI takes it.
    // A sort is the board's own loop (#1263): no agent, so no prompt.
    const { prompt, notes } =
      ask.action === 'triage'
        ? { prompt: '', notes: [] }
        : buildRun(said ? { ...ask, runtime: said.runtime } : carried ? { ...ask, session: carried.fork ? 'fork' : 'resume' } : ask)
    if (planning) notes.unshift(planning.note)
    opened = openRun(ask, prompt, notes, sessionId, said ?? carried)
  } finally {
    said?.release()
  }
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
