// The work an approval taken somewhere else leaves for this board's server (#318).
//
// #319 got as far as the durable action. This is the other half: Cloud holds an action taken
// off this machine as one claimable REQUEST, and the machine registered as the board's server
// catches up with it, claims it, re-reads the local task, and runs the very same flow an
// Implement or a Resolve on this machine would have run.
//
// Three rules hold the whole thing together:
//
//   • one claim, one execution — the claim is Cloud's, taken in one transaction, so a retry
//     and a second local process cannot both start the same delivery;
//   • the approved revision is binding — the local card is read again before anything runs,
//     and a card that has moved is refused rather than built to a specification the user
//     never approved;
//   • a lost claim is interrupted, not free — the lease expiring is what says a server died,
//     and the request stays bound to that machine, which takes it up again when it returns.
//
// Everything here is best effort and never throws at its callers: a terminal command and a
// board server both call in, and neither may fail over Cloud.

import { activeDelivery } from '../agent/deliveries'
import { insideRun } from '../agent/env'
import { peekRun } from '../agent/sessions'
import { startRun } from '../agent/start'
import { REPO_ROOT } from '../paths'
import { findCard } from '../view/read'
import type { WriteResult } from '../view/types'
import { claimRequest, listRequests, renewClaim } from './client'
import { answeredFromEvent, answerNotes, type CloudEventAnswer, type CloudEventQuestion } from './events'
import { claimForTask, dropClaim, heldClaims, holdClaim, notePublication, publishedFor } from './outbox'
import { recordCloudDeliveryState } from './publish'
import { serverForBoard } from './servers'
import { userQuestions } from './snapshot'

/** One job for a board's server, with everything it needs to run it and nothing else. */
export interface CloudRequest {
  id: string
  boardId: string
  eventId: string
  serverId: string | null
  claimedBy: string | null
  /** `interrupted` is derived by Cloud from a lease that ran out, never stored. */
  state: 'waiting' | 'claimed' | 'finished' | 'interrupted'
  leaseExpiresAt: string | null
  taskId: number
  taskTitle: string
  /** The card revision the action was granted against. Binding. */
  revision: string
  decision: 'implement' | 'answer'
  answers: CloudEventAnswer[]
  /** The questions the event carried, so a remote answer is read back against the list it
   *  was given rather than against whatever the card says now. */
  questions: CloudEventQuestion[]
}

/**
 * How often a live claim's lease is renewed.
 *
 * Well inside the service's own CLAIM_LEASE_SECONDS (cloud/src/config.ts), and measured in
 * minutes because a renewal is a write against one daily budget shared by the whole service:
 * a delivery running for hours must cost tens of them rather than thousands.
 */
export const RENEW_MS = 5 * 60_000

/** How long a terminal command waits for the catch-up before it ends anyway. Long enough for
 *  a healthy round trip, short enough that a terminal never feels held up by Cloud — the same
 *  bargain the outbox's flush makes. What it does not reach is caught up next time. */
const CATCH_UP_ON_EXIT_MS = 4_000

/** What a start refused by the local board reports, so a refused approval and a broken build
 *  never read as one outcome. */
type Refusal = { started: false; reason: string }
type Started = { started: true }

// ---- catching up -------------------------------------------------------------

/**
 * Claim and start whatever is waiting for this board's server.
 *
 * The durable read is what makes a missed or reordered hint cost nothing, so this runs on
 * every start, on every reconnect, and once for any short-lived `akb` command that opens the
 * board — which is what lets a machine with no window open still run an approval.
 */
export async function catchUpCloudRequests(root = REPO_ROOT): Promise<void> {
  const here = serverForBoard(root)
  if (!here) return
  const answer = await listRequests(here.serverId)
  if (!answer.ok) return
  for (const request of answer.value.requests) {
    await take(request, here.serverId)
  }
}

/** One request, named by a Realtime hint. The id travels over the socket; what it now says
 *  is read from Cloud, exactly as the bell resolves an event hint. */
export async function takeCloudRequest(requestId: string, root = REPO_ROOT): Promise<void> {
  const here = serverForBoard(root)
  if (!here) return
  const answer = await listRequests(here.serverId)
  if (!answer.ok) return
  const request = answer.value.requests.find((r) => r.id === requestId)
  if (request) await take(request, here.serverId)
}

/**
 * Claim one request and start it, or end it saying why not.
 *
 * A request already running here is left alone: its claim is live, and its delivery is the
 * one carrying it. One this machine claimed and left INTERRUPTED is taken up again only when
 * the board is still carrying that delivery — otherwise it waits for the user's Resume or
 * Cancel on the card page, because starting a second build over a repository the first one
 * may already have written to is not something to do unasked.
 */
async function take(request: CloudRequest, serverId: string): Promise<void> {
  if (request.state === 'claimed' || request.state === 'finished') return
  if (request.state === 'interrupted') {
    // Ours to take up again, and only while the work it started is still here.
    if (request.claimedBy !== serverId) return
    const held = claimForTask(request.taskId)
    if (!carrying(request.taskId, request.decision, held?.sessionId)) return
    const again = await claimRequest(request.id, serverId)
    if (again.ok && again.value.claimed) holdClaim(claimOf(request, held?.sessionId))
    return
  }
  const claimed = await claimRequest(request.id, serverId)
  if (!claimed.ok) return
  if (!claimed.value.claimed) return

  // From here the request is this machine's, so every ending has to be reported: a claim
  // that starts nothing and says nothing would sit there until its lease ran out.
  notePublication(request.taskId, request.eventId, 'accepted')
  holdClaim(claimOf(request))
  const started = start(request)
  if (!started.started) {
    recordCloudDeliveryState(request.taskId, 'failed', started.reason)
    dropClaim(request.id)
  }
}

const claimOf = (request: CloudRequest, sessionId?: string) => ({
  requestId: request.id,
  eventId: request.eventId,
  taskId: request.taskId,
  decision: request.decision,
  sessionId,
})

/**
 * Whether the work a claim started is still going on this board.
 *
 * Two questions, and both matter: it is what tells a server coming back to its own delivery
 * from one whose delivery has gone, and it is what stops a lease being renewed forever for a
 * delivery that died without reporting — a claim nobody is working must be allowed to run out
 * and read as interrupted, which is the whole of how a killed server is noticed.
 */
function carrying(taskId: number, decision: 'implement' | 'answer', sessionId?: string): boolean {
  if (decision === 'implement') return !!activeDelivery(taskId)
  return !!sessionId && peekRun(sessionId)?.status === 'running'
}

// ---- starting the local flow -------------------------------------------------

/**
 * Re-read the card and run the flow the approval asked for.
 *
 * The approved revision is binding: a card edited after the message was created is refused
 * rather than built to a specification the user did not approve. That check is the final one
 * — Cloud may reject a revision it already knows is stale, but the board is what decides.
 */
function start(request: CloudRequest): Started | Refusal {
  const card = findCard(request.taskId)
  if (!card) return { started: false, reason: `#${request.taskId} is no longer on this board.` }
  if (card.revision !== request.revision) {
    return { started: false, reason: `#${request.taskId} has changed since this was approved.` }
  }

  if (request.decision === 'implement') {
    if (card.status !== 'ready') {
      return { started: false, reason: `#${request.taskId} is no longer ready to build.` }
    }
    const run = startRun({ action: 'implement', id: card.id, title: card.title })
    if ('error' in run) return { started: false, reason: run.error }
    if (!run.spawned) return { started: false, reason: 'This machine could not start a process for that run.' }
    return { started: true }
  }

  // An answer: the questions it answers must still be the card's, because the entries are
  // one per question in the order the event carried them.
  if (!sameQuestions(userQuestions(card), request.questions)) {
    return { started: false, reason: `The open questions on #${request.taskId} have changed since this was answered.` }
  }
  const notes = answerNotes(answeredFromEvent(request.questions, request.answers))
  const run = startRun({ action: 'resolve', id: card.id, title: card.title, notes })
  if ('error' in run) return { started: false, reason: run.error }
  if (!run.spawned) return { started: false, reason: 'This machine could not start a process for that run.' }
  // A resolve is not a delivery, so nothing else reports how it ended. The run it started is
  // what does (see reportCloudRunEnd in ./publish.ts).
  holdClaim(claimOf(request, run.run.sessionId))
  recordCloudDeliveryState(request.taskId, 'running')
  return { started: true }
}

/** Whether an answer still answers the card's own questions. The list the event carried is
 *  read off `./snapshot`, so the two sides are one judgment rather than two that agree until
 *  they don't. */
const sameQuestions = (asking: CloudEventQuestion[], carried: CloudEventQuestion[]): boolean =>
  asking.length === carried.length && asking.every((q, i) => q.text === carried[i]?.text)

// ---- holding the claim -------------------------------------------------------

/**
 * Renew every claim this board is still carrying, and let go of the ones it is not.
 *
 * Called from whichever process is alive: the board server's own timer and the watcher of a
 * run. A claim whose task has no live event on record any more is finished work whose
 * outcome already went out, so it is dropped rather than renewed forever.
 */
export async function renewCloudClaims(root = REPO_ROOT): Promise<void> {
  const here = serverForBoard(root)
  if (!here) return
  for (const claim of heldClaims()) {
    const held = publishedFor(claim.taskId)
    if (!held || held.eventId !== claim.eventId || !carrying(claim.taskId, claim.decision, claim.sessionId)) {
      dropClaim(claim.requestId)
      continue
    }
    const answer = await renewClaim(claim.requestId, here.serverId)
    // Cloud says this machine no longer holds it — moved away, disabled, or already
    // finished. Renewing it again would be a write a day for nothing.
    if (answer.ok && !answer.value.renewed) dropClaim(claim.requestId)
  }
}

/** Renew for as long as the caller lives, and return the way to stop. What the watcher of a
 *  run holds: a delivery started from a terminal has no board server behind it, and the
 *  watcher is the one process alive for the whole of its run. */
export function holdCloudClaims(root = REPO_ROOT): () => void {
  const timer = setInterval(() => void renewCloudClaims(root).catch(() => {}), RENEW_MS)
  timer.unref?.()
  return () => clearInterval(timer)
}

/** Give a short-lived command its one chance to claim what is waiting before the process
 *  ends. Bounded, and silent either way — a command must not hang on a network the board
 *  never waited for. */
export async function catchUpOnExit(root = REPO_ROOT): Promise<void> {
  // Not from inside a run: the agent working in one makes many board moves, and a Cloud read
  // on each would spend the account's request budget on a question the process that started
  // the run already asked.
  if (insideRun()) return
  if (!serverForBoard(root)) return
  await Promise.race([catchUpCloudRequests(root).catch(() => {}), sleep(CATCH_UP_ON_EXIT_MS)])
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    timer.unref?.()
  })

// ---- the two moves a card page offers an interrupted request -----------------

/** Take an interrupted request up again and run its flow from the start. The claim is
 *  Cloud's to give: a machine that no longer holds the board is refused here, not on screen. */
export async function resumeCloudRequest(eventId: string, root = REPO_ROOT): Promise<WriteResult> {
  const here = serverForBoard(root)
  if (!here) return { ok: false, error: 'This machine does not run this board’s work.' }
  const answer = await listRequests(here.serverId)
  if (!answer.ok) return { ok: false, error: answer.error }
  const request = answer.value.requests.find((r) => r.eventId === eventId && r.state !== 'finished')
  if (!request) {
    return { ok: false, error: 'This machine cannot take that up — it is held by the machine that started it.' }
  }

  const claimed = await claimRequest(request.id, here.serverId)
  if (!claimed.ok) return { ok: false, error: claimed.error }
  if (!claimed.value.claimed) return { ok: false, error: claimed.value.reason ?? 'That request could not be taken up.' }

  notePublication(request.taskId, request.eventId, 'accepted')
  holdClaim(claimOf(request))
  const started = start(request)
  if (started.started) return { ok: true }
  recordCloudDeliveryState(request.taskId, 'failed', started.reason)
  dropClaim(request.id)
  return { ok: false, error: started.reason }
}

/**
 * End an interrupted request. Whatever it left on the machine that started it stays exactly
 * where it is — the board never undoes work — and the event says it was cancelled.
 *
 * Unlike Resume this needs no claim, because the machine that holds one may be the machine
 * that has gone: a board moved here after a restored home directory is exactly the case where
 * cancelling is the only way out.
 */
export function cancelCloudRequest(taskId: number, eventId: string): WriteResult {
  if (!eventId) return { ok: false, error: 'There is nothing waiting on this card.' }
  const held = publishedFor(taskId)
  // A board that never claimed this one has no record to report against — the approval was
  // taken elsewhere and its machine never came back. One is written so the outcome has
  // somewhere to go, and the outbox retries it like every other.
  if (held?.eventId !== eventId) notePublication(taskId, eventId, 'accepted')
  recordCloudDeliveryState(taskId, 'cancelled')
  const claim = claimForTask(taskId)
  if (claim) dropClaim(claim.requestId)
  return { ok: true }
}
