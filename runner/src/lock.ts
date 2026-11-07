// One Runner per computer (#2161): the Claude Code plugin starts one with every host session,
// beside any standalone Runner. Whichever listens on the Runner home's socket runs the jobs; the
// others hold a connection to it and take over when it closes. Exiting releases it. The holder
// writes its kind to each one waiting, so that one can say who runs the jobs.

import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'

import { runnerHome } from './home'

const RETRY_MS = 5_000
/** How long a waiting process listens for the holder's kind before saying it is unknown. */
const KIND_MS = 1_000

/** 启动 Runner 的插件宿主或终端。 */
export type Holder = 'claude-code' | 'codex' | 'terminal'
const HOLDERS: readonly string[] = ['claude-code', 'codex', 'terminal']

export function lockPath(): string {
  const home = runnerHome()
  if (process.platform === 'win32') return `\\\\.\\pipe\\wildcrane-${crypto.createHash('sha256').update(home).digest('hex').slice(0, 16)}`
  return path.join(home, 'runner.sock')
}

export interface MachineLock {
  release(): void
  /** Another process waits to take over, so the computer stays connected past this one. */
  waited(): boolean
}

/** Calls `onHeld` once this process runs the computer's jobs, `onWaiting` while another does —
 *  with its kind, unless it did not say. */
export function holdMachine(kind: Holder, onHeld: () => void, onWaiting?: (holder?: Holder) => void): MachineLock {
  const where = lockPath()
  let closed = false
  let server: net.Server | null = null
  let waiting: net.Socket | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const peers = new Set<net.Socket>()

  const later = (ms: number) => {
    if (!closed) timer = setTimeout(attempt, ms)
  }

  const attempt = () => {
    timer = null
    if (closed) return
    if (process.platform !== 'win32') fs.mkdirSync(path.dirname(where), { recursive: true, mode: 0o700 })
    const s = net.createServer((peer) => {
      peers.add(peer)
      peer.on('error', () => {}).on('close', () => peers.delete(peer))
      peer.write(`${JSON.stringify({ kind, settings: 1 })}\n`)
    })
    s.once('error', (e: NodeJS.ErrnoException) => {
      if (e.code !== 'EADDRINUSE') return later(RETRY_MS)
      const probe = net.connect(where)
      probe.once('connect', () => {
        waiting = probe
        let told = false
        let said = ''
        const tell = (holder?: Holder) => {
          if (told || waiting !== probe) return
          told = true
          clearTimeout(silent)
          onWaiting?.(holder)
        }
        const silent = setTimeout(tell, KIND_MS)
        probe.on('data', (d) => {
          said += d
          const line = said.split('\n')
          if (line.length < 2) return
          let got: unknown
          try {
            got = (JSON.parse(line[0]!) as { kind?: unknown }).kind
          } catch {}
          tell(typeof got === 'string' && HOLDERS.includes(got) ? (got as Holder) : undefined)
        })
        probe.once('close', () => {
          clearTimeout(silent)
          waiting = null
          later(0)
        })
      })
      probe.once('error', () => {
        if (waiting === probe) return
        if (process.platform !== 'win32') {
          const removeIfStill = net.connect(where)
          removeIfStill.once('connect', () => {
            removeIfStill.destroy()
            later(0)
          })
          // Nobody answered twice: a holder that crashed. The second ask keeps two processes
          // finding it at once from removing the one that just started listening.
          removeIfStill.once('error', () => {
            fs.rmSync(where, { force: true })
            later(50 + Math.random() * 200)
          })
          return
        }
        later(RETRY_MS)
      })
    })
    s.listen(where, () => {
      if (closed) return void s.close()
      server = s
      onHeld()
    })
  }

  attempt()
  return {
    waited: () => peers.size > 0,
    release() {
      if (closed) return
      closed = true
      if (timer) clearTimeout(timer)
      waiting?.destroy()
      server?.close()
      for (const peer of peers) peer.destroy()
    },
  }
}

/** 旧执行者不识别退出广播时，先要求用户重开插件。 */
export function runnerSettingsSupport(): Promise<boolean | null> {
  return new Promise((resolve) => {
    const peer = net.connect(lockPath())
    let data = '', ended = false
    const finish = (value: boolean | null) => {
      if (ended) return
      ended = true
      clearTimeout(timer)
      peer.destroy()
      resolve(value)
    }
    const timer = setTimeout(() => finish(false), 1000)
    peer.on('error', () => finish(null))
    peer.on('data', (chunk) => {
      data += chunk
      if (!data.includes('\n')) return
      try { finish((JSON.parse(data.split('\n')[0]!) as { settings?: number }).settings === 1) }
      catch { finish(false) }
    })
    peer.on('end', () => finish(false))
  })
}
