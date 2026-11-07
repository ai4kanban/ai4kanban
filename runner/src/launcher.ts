// 下载指定版本，监督更新交接与启动回退，保留最近两个可用版本。

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { cloudEndpoints } from '../../cli/src/lib/cloud/config'
import { machineId } from './home'
import { status, t } from './i18n'
import { acceptAlphaUpdates } from './preferences'
import { EXIT_OUTDATED, EXIT_REFUSED, EXIT_UPDATE } from './protocol'
import { compare, entryOf, install, legacyVersionsDir, versionDir, versionsDir } from './update'

const ASK_MS = 5_000
/** 新版连接超时后回退。 */
const CONNECT_MS = 2 * 60_000
const KEEP = 2

interface Candidate {
  version: string
  entry: string
  /** Not yet seen connecting on this computer. */
  fresh?: boolean
}

interface State {
  /** Versions that connected here, newest first. */
  good: string[]
  /** Versions that crashed before connecting. Never tried again. */
  bad: string[]
  alpha?: string[]
  rollbackAt?: Record<string, number>
}

const stateFile = () => path.join(versionsDir(), 'state.json')

export function readState(): State {
  try {
    const held = JSON.parse(fs.readFileSync(stateFile(), 'utf8')) as Partial<State>
    return { ...held, good: held.good ?? [], bad: held.bad ?? [] }
  } catch {
    return { good: [], bad: [] }
  }
}

function writeState(state: State): void {
  fs.mkdirSync(versionsDir(), { recursive: true })
  fs.writeFileSync(stateFile(), `${JSON.stringify(state, null, 2)}\n`)
}

/** Record a version that connected, and remove every unpacked version past the newest two. */
function markGood(version: string): void {
  const state = readState()
  state.good = [version, ...state.good.filter((v) => v !== version)].slice(0, KEEP)
  writeState(state)
  for (const name of fs.readdirSync(versionsDir())) {
    if (name === 'state.json' || state.good.includes(name) || name.endsWith('.tmp')) continue
    fs.rmSync(path.join(versionsDir(), name), { recursive: true, force: true })
  }
}

function markBad(version: string): void {
  const state = readState()
  state.bad = [...new Set([...state.bad, version])]
  state.good = state.good.filter((v) => v !== version)
  writeState(state)
}

interface Target { version: string; restartable: boolean; alpha?: boolean; rollback?: number }

async function askTarget(machine: string): Promise<Target | null> {
  const alpha = acceptAlphaUpdates()
  try {
    const answer = await fetch(`${cloudEndpoints().api}/v1/runner/version?machine=${machine}&alpha=${alpha}`, {
      signal: AbortSignal.timeout(ASK_MS),
    })
    if (!answer.ok) return null
    const { version, restartable, alpha: selectedAlpha, rollback } = (await answer.json()) as Partial<Target>
    if (acceptAlphaUpdates() !== alpha) return null
    return typeof version === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version) ? { version, restartable: restartable === true, alpha: selectedAlpha === true, rollback } : null
  } catch {
    return null
  }
}

function waiting(target: Target, current: string): boolean {
  const state = readState()
  return !target.alpha && !!state.alpha?.includes(current) && compare(target.version, current) < 0
    && (target.rollback === undefined || target.rollback === (state.rollbackAt?.[current] ?? 0))
}

function remember(target: Target): void {
  const state = readState()
  if (target.alpha) state.alpha = [...new Set([...(state.alpha ?? []), target.version])]
  if (target.rollback !== undefined) state.rollbackAt = { ...state.rollbackAt, [target.version]: target.rollback }
  writeState(state)
}

/** Which versions to try, in order: the one Cloud names when it can be had, then the newest
 *  that ran here, or this package's own when that is newer. */
/** The newest version that ran here, when it is newer than `own`. */
export function provenNewer(own: string): string | null {
  const proven = readState().good.find((v) => fs.existsSync(entryOf(versionDir(v))))
  return proven && compare(proven, own) > 0 ? proven : null
}

export async function candidates(own: Candidate): Promise<Candidate[]> {
  const state = readState()
  const proven = provenNewer(own.version)
  const current = proven ? { version: proven, entry: entryOf(versionDir(proven)) } : own
  const desired = await askTarget(machineId())
  const target = desired?.version
  if (!desired || !target || waiting(desired, current.version) || state.bad.includes(target)) return [current]
  if (target === current.version) { remember(desired); return [current] }
  if (target === own.version) { remember(desired); return [own, current] }
  const got = await install(target)
  if (got.ok) {
    const latest = await askTarget(machineId())
    if (!latest || latest.version !== target || waiting(latest, current.version)) return [current]
    remember(latest)
    const known = state.good.includes(target)
    return [{ version: target, entry: entryOf(got.dir), fresh: !known }, current]
  }
  if (got.why === 'node') status(t.nodeTooOld(got.detail))
  return [current]
}

type Outcome = { exit: number } | { failed: 'crashed' | 'timeout' } | { update: Candidate }

export interface LaunchOptions {
  signal?: AbortSignal
  onMessage?: (message: { type?: string }) => void
  onSpawn?: (send: (type: string) => void) => void
  quiet?: boolean
  kind?: string
}

function runOnce(candidate: Candidate, options: LaunchOptions): Promise<Outcome> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [candidate.entry], {
      stdio: ['ignore', options.quiet ? 2 : 'inherit', 'inherit', 'ipc'],
      env: { ...process.env, WILDCRANE_RUNNER_VERSION: candidate.version, WILDCRANE_RUNNER_KIND: options.kind ?? 'terminal' },
    })
    options.onSpawn?.((type) => { if (child.connected) child.send({ type }, () => {}) })
    let update: Candidate | null = null
    let checking = false
    const check = async () => {
      if (checking || stopping || update) return
      checking = true
      try {
        const desired = await askTarget(machineId())
        if (!desired?.restartable || waiting(desired, candidate.version)) return
        const target = desired.version
        if (!target || target === candidate.version || readState().bad.includes(target)) return
        const got = await install(target)
        if (!got.ok) { status('Runner 更新下载失败，继续运行当前版本，稍后重试。'); return }
        if (stopping || child.exitCode !== null || child.signalCode !== null) return
        const latest = await askTarget(machineId())
        if (!latest?.restartable || latest.version !== target || waiting(latest, candidate.version)) return
        remember(latest)
        update = { version: target, entry: entryOf(got.dir), fresh: !readState().good.includes(target) }
        child.send({ type: 'update' }, () => {})
      } finally { checking = false }
    }
    const poll = setInterval(() => { if (connected) void check().catch(() => {}) }, Number(process.env.WILDCRANE_UPDATE_MS) || 60_000)
    let connected = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let timedOut = false
    let stopping = false
    let forceKill: ReturnType<typeof setTimeout> | undefined
    if (candidate.fresh) {
      timer = setTimeout(() => {
        timedOut = true
        child.kill('SIGTERM')
        forceKill = setTimeout(() => child.kill('SIGKILL'), 5_000)
      }, Number(process.env.WILDCRANE_CONNECT_MS) || CONNECT_MS)
    }
    const forward = (signal: NodeJS.Signals) => () => {
      stopping = true
      child.kill(signal)
    }
    const onInt = forward('SIGINT')
    const onTerm = forward('SIGTERM')
    process.on('SIGINT', onInt)
    process.on('SIGTERM', onTerm)
    options.signal?.addEventListener('abort', onTerm, { once: true })
    if (options.signal?.aborted) onTerm()

    child.on('message', (message: { type?: string }) => {
      options.onMessage?.(message)
      if (message.type === 'update-deferred') update = null
      // Another Runner on this computer runs the jobs: this one is up, only not connected yet.
      if (message.type === 'waiting' && timer) {
        clearTimeout(timer)
        timer = null
      }
      if (message.type === 'connected' && !connected) {
        connected = true
        if (timer) clearTimeout(timer)
        if (candidate.entry.startsWith(versionsDir() + path.sep)) fs.rmSync(legacyVersionsDir(), { recursive: true, force: true })
        if (candidate.fresh) {
          markGood(candidate.version)
          status(t.updated(candidate.version))
        }
      }
    })
    child.on('exit', (code, signal) => {
      clearInterval(poll)
      clearTimeout(forceKill)
      if (timer) clearTimeout(timer)
      process.off('SIGINT', onInt)
      process.off('SIGTERM', onTerm)
      options.signal?.removeEventListener('abort', onTerm)
      if (code === EXIT_UPDATE && update && !stopping) return resolve({ update })
      if (connected || !candidate.fresh || stopping) return resolve({ exit: code ?? (signal ? 1 : 0) })
      if (timedOut) return resolve({ failed: 'timeout' })
      if (code === 0 || code === EXIT_REFUSED || code === EXIT_OUTDATED) return resolve({ exit: code })
      resolve({ failed: 'crashed' })
    })
  })
}

/** Start the Runner and answer the exit code to leave with. */
export async function launch(own: Candidate, options: LaunchOptions = {}): Promise<number> {
  const list = await candidates(own)
  for (let i = 0; i < list.length; i++) {
    if (options.signal?.aborted) return 0
    const candidate = list[i]!
    const outcome = await runOnce(candidate, options)
    if ('exit' in outcome) return outcome.exit
    if ('update' in outcome) {
      const latest = await askTarget(machineId())
      if (!latest || latest.version !== outcome.update.version || waiting(latest, candidate.version)) {
        list.splice(i + 1, list.length, candidate)
        continue
      }
      list.splice(i + 1, list.length, outcome.update, candidate)
      continue
    }
    markBad(candidate.version)
    const next = list[i + 1]
    if (next) status(t.rolledBack(next.version))
  }
  return 1
}
