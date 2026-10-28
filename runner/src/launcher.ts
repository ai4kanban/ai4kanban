// The launcher: every start asks Cloud which Runner version to use, fetches it from npm when
// it is not here yet, and runs it. A new version that crashes before it connects, or never
// connects, is dropped for the version that ran before. The newest two that connected are kept.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { cloudEndpoints } from '../../cli/src/lib/cloud/config'
import { machineId } from './home'
import { status, t } from './i18n'
import { EXIT_OUTDATED, EXIT_REFUSED } from './protocol'
import { compare, entryOf, install, legacyVersionsDir, versionDir, versionsDir } from './update'

const ASK_MS = 5_000
/** How long a new version has, once signed in, to connect before it is given up on. */
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
}

const stateFile = () => path.join(versionsDir(), 'state.json')

export function readState(): State {
  try {
    const held = JSON.parse(fs.readFileSync(stateFile(), 'utf8')) as Partial<State>
    return { good: held.good ?? [], bad: held.bad ?? [] }
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

async function askTarget(machine: string): Promise<string | null> {
  try {
    const answer = await fetch(`${cloudEndpoints().api}/v1/runner/version?machine=${machine}`, {
      signal: AbortSignal.timeout(ASK_MS),
    })
    if (!answer.ok) return null
    const { version } = (await answer.json()) as { version?: string | null }
    return typeof version === 'string' && version ? version : null
  } catch {
    return null
  }
}

/** Which versions to try, in order: the one Cloud names when it can be had, then the newest
 *  that ran here, or this package's own when that is newer. */
export async function candidates(own: Candidate): Promise<Candidate[]> {
  const state = readState()
  const proven = state.good.find((v) => fs.existsSync(entryOf(versionDir(v))))
  const current = proven && compare(proven, own.version) > 0 ? { version: proven, entry: entryOf(versionDir(proven)) } : own
  const target = await askTarget(machineId())
  if (!target || target === current.version || state.bad.includes(target)) return [current]
  // The desktop app's shell speaks to the Runner it shipped with or a newer one; an older one
  // predates it.
  if (process.env.WILDCRANE_DESKTOP && compare(target, own.version) < 0) return [current]
  if (target === own.version) return [own, current]
  const got = await install(target)
  if (got.ok) {
    const known = state.good.includes(target)
    return [{ version: target, entry: entryOf(got.dir), fresh: !known }, current]
  }
  if (got.why === 'node') status(t.nodeTooOld(got.detail))
  return [current]
}

type Outcome = { exit: number } | { failed: 'crashed' | 'timeout' }

function runOnce(candidate: Candidate): Promise<Outcome> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [candidate.entry], {
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      env: { ...process.env, WILDCRANE_RUNNER_VERSION: candidate.version },
    })
    let connected = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let timedOut = false
    let stopping = false
    const forward = (signal: NodeJS.Signals) => () => {
      stopping = true
      child.kill(signal)
    }
    const onInt = forward('SIGINT')
    const onTerm = forward('SIGTERM')
    process.on('SIGINT', onInt)
    process.on('SIGTERM', onTerm)

    child.on('message', (message: { type?: string }) => {
      if (message.type === 'started' && candidate.fresh && !connected) {
        timer = setTimeout(() => {
          timedOut = true
          child.kill('SIGTERM')
        }, Number(process.env.WILDCRANE_CONNECT_MS) || CONNECT_MS)
      }
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
      if (timer) clearTimeout(timer)
      process.off('SIGINT', onInt)
      process.off('SIGTERM', onTerm)
      if (connected || !candidate.fresh || stopping) return resolve({ exit: code ?? (signal ? 1 : 0) })
      if (timedOut) return resolve({ failed: 'timeout' })
      if (code === 0 || code === EXIT_REFUSED || code === EXIT_OUTDATED) return resolve({ exit: code })
      resolve({ failed: 'crashed' })
    })
  })
}

/** Start the Runner and answer the exit code to leave with. */
export async function launch(own: Candidate): Promise<number> {
  const list = await candidates(own)
  for (let i = 0; i < list.length; i++) {
    const candidate = list[i]!
    const outcome = await runOnce(candidate)
    if ('exit' in outcome) return outcome.exit
    if (outcome.failed === 'crashed') markBad(candidate.version)
    const next = list[i + 1]
    if (next) status(t.rolledBack(next.version))
  }
  return 1
}
