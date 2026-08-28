// This board's server, as a long-lived process holds it (#318).
//
// The bell (./center.ts) belongs to the board server the window is showing, because one
// account topic listened to twice would raise one notification twice. This is the opposite
// rule: EVERY enabled board's server listens for its own board, backgrounded ones included.
// A request is addressed to one board's server, so a second listener cannot duplicate an
// interruption — and the board a user has switched away from is exactly the one whose
// approval would otherwise never run.
//
// Two things are held: the catch-up-then-listen pair every Cloud connection here is made of,
// and the timer that renews the claims this board is carrying. A machine with no `WebSocket`
// keeps the timer and catches up through the Worker on it, which is what lets a board server
// on an older runtime still run an approval — just later.

import { REPO_ROOT } from '../paths'
import { connectCloudLive, type LiveConnection } from './live'
import { flushCloudOutbox } from './publish'
import { catchUpCloudRequests, renewCloudClaims, RENEW_MS, takeCloudRequest } from './requests'
import { attachBoardServer, readBoardServer, serverForBoard, wantsServerHere } from './servers'
import { readSession } from './session'

interface Held {
  live: LiveConnection | null
  serverId: string
  timer: ReturnType<typeof setInterval> | null
  starting?: Promise<void>
  /** When this board last asked Cloud who runs it. A board another machine holds would
   *  otherwise ask once a tick, forever, about an answer that changes at human speed. */
  askedAt?: number
}

function state(): Held {
  const g = globalThis as unknown as { __akbCloudServer?: Held }
  if (!g.__akbCloudServer) g.__akbCloudServer = { live: null, serverId: '', timer: null }
  return g.__akbCloudServer
}

/**
 * Start running this board's approvals here, and keep running them.
 *
 * Idempotent, and cheap enough to call on every tick of the board's own timer, which is what
 * the local UI server does — so the server is live for as long as that process is. A board
 * this machine does not run — never attached, moved away, or signed out — starts nothing, and
 * is picked up on the tick after that changes.
 */
export function startCloudServer(root = REPO_ROOT): void {
  const held = state()
  // The outbox's own heartbeat (#329), ahead of every guard below because it belongs to the
  // board rather than to its server: a failed send is otherwise retried only by new activity,
  // and a board whose last write is the one that failed would hold it for good. This tick is
  // the one thing that runs on a board nobody is touching.
  void flushCloudOutbox()
  const here = serverForBoard(root)
  if (!here) {
    if (held.live || held.timer) stopCloudServer()
    // An enabled board with no server row yet: one enabled before this release, or one whose
    // machine was signed out when it was turned on. Registering it is what makes this
    // machine its server, and a board another machine holds is refused and left alone.
    void claimTheBoard(root)
    return
  }
  // The board moved to a different server row — a move here, or a re-attach. The old
  // socket is listening on a topic that will never carry this board's requests again.
  if (held.serverId && held.serverId !== here.serverId) stopCloudServer()
  if (held.live || held.timer || held.starting) return

  held.serverId = here.serverId
  held.timer = setInterval(() => {
    void renewCloudClaims(root).catch(() => {})
    // A runtime with no socket has no hints, and neither does one whose join was refused —
    // so the same timer is the catch-up for both (#329).
    if (!state().live?.joined()) void catchUpCloudRequests(root).catch(() => {})
    // And the same tick reports what this computer now runs the board's runtimes as (#345):
    // the read sends only where the answer changed, so a machine nobody rebinds writes
    // nothing. A board with no window open reaches Cloud through this and nothing else.
    void readBoardServer(root).catch(() => {})
  }, RENEW_MS)
  held.timer.unref?.()

  held.starting = (async () => {
    await catchUpCloudRequests(root)
    // `server:<account>:<server id>` (#329). The account is what the RLS policy guarding the
    // topic is decided on — a policy that had to read the server row could not be evaluated
    // by the signed-in role at all, so the join was refused and no hint ever arrived.
    const subject = readSession()?.subject ?? ''
    held.live = connectCloudLive({
      topic: subject ? `server:${subject}:${here.serverId}` : '',
      // Every reconnect catches up first, so a hint missed while the socket was down costs
      // nothing.
      onReady: () => void catchUpCloudRequests(root).catch(() => {}),
      onHint: (payload) => {
        const id = payload.requestId
        if (typeof id === 'string' && id) void takeCloudRequest(id, root).catch(() => {})
      },
    })
  })()
    // Nobody awaits this, so it must not reject: a server that could not reach Cloud this
    // minute is worth less than the board server it is running inside.
    .catch(() => {})
    .finally(() => {
      held.starting = undefined
    })
}

/** Ask Cloud who runs this board, and register this machine when nobody does. Throttled to
 *  the renew cadence: the answer changes at human speed, and a board another machine holds
 *  would otherwise be asked about once a minute forever. */
async function claimTheBoard(root: string): Promise<void> {
  const held = state()
  if (!wantsServerHere(root)) return
  if (held.askedAt && Date.now() - held.askedAt < RENEW_MS) return
  held.askedAt = Date.now()
  try {
    const server = await readBoardServer(root)
    if (!server.attached) await attachBoardServer(false, root)
  } catch {
    // Cloud could not be reached this minute. The next pass asks again.
  }
}

/** Stop. What signing out, turning the board off, and quitting do. Whatever is already
 *  building here carries on — the local board is never touched by this. */
export function stopCloudServer(): void {
  const held = state()
  held.live?.close()
  held.live = null
  if (held.timer) clearInterval(held.timer)
  held.timer = null
  held.serverId = ''
}
