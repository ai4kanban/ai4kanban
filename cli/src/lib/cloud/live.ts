// One private Realtime topic, kept open (#319).
//
// Realtime carries HINTS and nothing else: the identifier of something the Worker already
// stored. Every durable read and write goes over `fetch` (./client.ts), so a missed or
// reordered broadcast loses nothing — the catch-up read on every connect and reconnect is
// what makes that true.
//
// Two topics are opened through here, both private and both authorized by an RLS policy on
// `realtime.messages`:
//
//   • `account:<subject>` — every event of this account (#319). One listener, in the board
//     server the window is showing, because a second would raise one notification twice.
//   • `server:<server id>` — the requests one board's server has to run (#318). One listener
//     per enabled board, backgrounded ones included: a request is addressed to one server,
//     so a second listener cannot duplicate anything, and the board a user has switched away
//     from is exactly the one whose approval would otherwise never run.
//
// It is written against the published Realtime protocol rather than pulling in a client,
// which keeps `cli/dist/kanban.mjs` a file of ours alone and keeps a terminal `akb` on
// Node 18: this module is only ever loaded on the connect path, which the app alone is on,
// and it says so plainly when the runtime has no `WebSocket` to give it.

import { cloudConfigured, cloudEndpoints } from './config'
import { keepAuthorized } from './realtime'
import { accessToken, readSession } from './session'

/** The Realtime protocol version this speaks. */
const VSN = '1.0.0'
/** Phoenix drops a socket that stops sending these. Well inside its own 60s window. */
const HEARTBEAT_MS = 25_000
/** How long a `phx_join` has to be answered before the socket is thrown away and opened
 *  again. An open socket that never joined receives nothing, and nothing else here would
 *  ever notice: the server holds it open, the heartbeat keeps answering on `phoenix`, and
 *  the bell goes quiet with no error anywhere. */
const JOIN_TIMEOUT_MS = 10_000
/** Backoff between reconnects, in order. The last one repeats. */
const BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 30_000]

interface Frame {
  topic: string
  event: string
  payload: Record<string, unknown>
  ref?: string | null
}

/** What the connection tells whoever opened it. */
export interface LiveHandlers {
  /** Which private topic to join, without the `realtime:` prefix. */
  topic: string
  /** One hint, as it was broadcast — an id and nothing else. Read what it names through the
   *  Worker: Postgres is the authority for what it now says. */
  onHint(payload: Record<string, unknown>): void
  /** The socket is up and joined. `firstTime` is false on a RECONNECT — which is the case
   *  the second notification exists for, because the window may have been sitting unwatched
   *  the whole time the connection was down. */
  onReady(firstTime: boolean): void
}

export interface LiveConnection {
  close(): void
}

/**
 * Open one private topic and keep it open. Returns the way to close it, or null when this
 * machine cannot hold one: no Cloud project in the build, nobody signed in, or a runtime
 * with no `WebSocket` — which is what keeps a terminal `akb` on Node 18, where the catch-up
 * read through the Worker is the whole of the flow.
 */
export function connectCloudLive(handlers: LiveHandlers): LiveConnection | null {
  const session = readSession()
  if (!cloudConfigured() || !session || !handlers.topic) return null
  const Socket = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket
  if (!Socket) return null

  const { supabaseUrl, anonKey } = cloudEndpoints()
  const url = `${supabaseUrl.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(anonKey)}&vsn=${VSN}`
  const topic = `realtime:${handlers.topic}`

  let socket: WebSocket | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null
  let joinTimer: ReturnType<typeof setTimeout> | null = null
  let retry: ReturnType<typeof setTimeout> | null = null
  let stopAuth: (() => void) | null = null
  let attempts = 0
  let joined = false
  let everJoined = false
  let closed = false
  let ref = 0

  const nextRef = () => String(++ref)

  const push = (frame: Frame) => {
    try {
      socket?.send(JSON.stringify({ ...frame, ref: frame.ref ?? nextRef() }))
    } catch {
      // A socket that has gone under us is one the close handler is about to reconnect.
    }
  }

  const teardown = () => {
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = null
    if (joinTimer) clearTimeout(joinTimer)
    joinTimer = null
    stopAuth?.()
    stopAuth = null
    joined = false
    const going = socket
    socket = null
    try {
      going?.close()
    } catch {
      // Already gone.
    }
  }

  const reconnect = () => {
    if (closed) return
    teardown()
    const wait = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)]!
    attempts += 1
    retry = setTimeout(open, wait)
    retry.unref?.()
  }

  const open = async () => {
    if (closed) return
    const token = await accessToken()
    if (closed) return
    if (!token.ok) return reconnect()

    let live: WebSocket
    try {
      live = new Socket(url)
    } catch {
      return reconnect()
    }
    socket = live

    live.onopen = () => {
      if (closed || socket !== live) return
      push({
        topic,
        event: 'phx_join',
        payload: {
          // A private channel is what the RLS policy on `realtime.messages` is checked
          // against, so nobody else's socket can join this one.
          config: { private: true, broadcast: { self: false }, presence: { key: '' } },
          access_token: token.token,
        },
      })
      // A join nobody answers is the one failure the socket itself never reports: it stays
      // open and the heartbeat keeps being answered on `phoenix`, so only a clock notices.
      joinTimer = setTimeout(reconnect, JOIN_TIMEOUT_MS)
      joinTimer.unref?.()
      heartbeat = setInterval(() => push({ topic: 'phoenix', event: 'heartbeat', payload: {} }), HEARTBEAT_MS)
      heartbeat.unref?.()
      // Realtime holds the token it was given for the life of the connection, so a
      // refreshed session has to be handed to the socket as well (#326).
      stopAuth = keepAuthorized({
        setAuth: (fresh: string) => push({ topic, event: 'access_token', payload: { access_token: fresh } }),
      })
    }

    live.onmessage = (message: MessageEvent) => {
      if (closed || socket !== live) return
      let frame: Frame
      try {
        frame = JSON.parse(String(message.data)) as Frame
      } catch {
        return
      }
      if (frame.topic !== topic) return
      if (frame.event === 'phx_reply') {
        const status = (frame.payload as { status?: string }).status
        // Once joined the only replies left are the token pushes', and a socket already
        // receiving is not thrown away over one of them.
        if (joined) return
        // Nothing else has been pushed on this topic yet, so a refusal here is the join's:
        // reconnect rather than sit on a socket that will never receive an event.
        if (status !== 'ok') return reconnect()
        if (joinTimer) clearTimeout(joinTimer)
        joinTimer = null
        joined = true
        // The backoff resets on a join, not on an open: a socket that opens every second
        // and is refused every time is exactly what the backoff is for.
        attempts = 0
        const firstTime = !everJoined
        everJoined = true
        handlers.onReady(firstTime)
        return
      }
      if (frame.event === 'broadcast') {
        const body = frame.payload as { payload?: Record<string, unknown> }
        if (body.payload) handlers.onHint(body.payload)
      }
    }

    live.onerror = () => {
      if (!closed && socket === live) reconnect()
    }
    live.onclose = () => {
      if (!closed && socket === live) reconnect()
    }
  }

  void open()

  return {
    close() {
      closed = true
      if (retry) clearTimeout(retry)
      retry = null
      teardown()
    },
  }
}
