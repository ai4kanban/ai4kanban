// The presence connection (#2163): while it pings, Cloud counts this computer as online, and
// within about 90 seconds of it going quiet — sleep, a lost network, a crash — as offline.
// Registration stays what keeps the Runner connected; this only lets Cloud notice sooner.

import * as api from './api'

const PING_MS = 30_000
const BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 30_000]

export interface Presence {
  close(): void
}

export function keepPresence(machineId: string, pingMs = PING_MS): Presence {
  let closed = false
  let ws: WebSocket | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let attempts = 0

  const retry = () => {
    if (closed) return
    timer = setTimeout(open, BACKOFF_MS[Math.min(attempts++, BACKOFF_MS.length - 1)]!)
    timer.unref?.()
  }

  const open = async () => {
    timer = null
    const socket = await api.openPresence(machineId).catch(() => null)
    if (closed) return socket?.close()
    if (!socket) return retry()
    ws = socket
    let opened = false
    let dropped = false
    let heard = Date.now()
    let ping: ReturnType<typeof setInterval> | null = null
    const drop = async () => {
      if (dropped) return
      dropped = true
      if (ping) clearInterval(ping)
      if (ws === socket) ws = null
      try {
        socket.close()
      } catch {
        // already closed
      }
      if (closed) return
      // A Cloud from before the route: registration alone keeps the Runner online.
      if (!opened) {
        const route = await api.presenceRoute(machineId)
        if (!route.ok && route.code === 'not_found') return
      }
      retry()
    }
    socket.addEventListener('open', () => {
      opened = true
      attempts = 0
      ping = setInterval(() => {
        // Two pings unanswered: the connection died without saying so, as after a sleep.
        if (Date.now() - heard > pingMs * 2) return void drop()
        try {
          socket.send('ping')
        } catch {
          // closing
        }
      }, pingMs)
      ping.unref?.()
    })
    socket.addEventListener('message', () => (heard = Date.now()))
    socket.addEventListener('close', () => void drop())
  }

  void open()
  return {
    close: () => {
      closed = true
      if (timer) clearTimeout(timer)
      ws?.close()
    },
  }
}
