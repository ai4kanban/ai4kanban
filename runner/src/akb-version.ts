// Which akb a job step runs (#171). Cloud names a version on every registration; it comes down
// from npm in the background and is switched to once its contract matches this Runner's and it
// answers `--version`. One that does not is never tried again. Anything else that goes wrong
// leaves the version in use, and with none usable the akb the Runner carries runs.

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { BUNDLED_SHIM, akbArgs, akbHome, bundledAkb, type Akb } from './akb'
import { IDLE_MS } from './cache'
import { AKB_CONTRACT, AKB_VERSION } from './protocol'
import { installPackage, type Package } from './update'

const CHECK_MS = 10_000
/** A version Cloud names becomes a folder's name. */
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

interface State {
  /** The downloaded version in use; null for the one the Runner carries. */
  current: string | null
  /** Versions that failed the check. Never tried again. */
  bad: string[]
}

const stateFile = () => path.join(akbHome(), 'state.json')
export const akbVersionDir = (version: string) => path.join(akbHome(), version)
const entryOf = (dir: string) => path.join(dir, 'bin', 'ai4kanban.mjs')
const AKB: Package = { name: 'wildcrane', dirOf: akbVersionDir, entryOf }

export function readAkbState(): State {
  try {
    const held = JSON.parse(fs.readFileSync(stateFile(), 'utf8')) as Partial<State>
    return { current: held.current ?? null, bad: held.bad ?? [] }
  } catch {
    return { current: null, bad: [] }
  }
}

/** Renamed into place, so another Runner here never reads half of it. */
function writeAkbState(state: State): void {
  fs.mkdirSync(akbHome(), { recursive: true })
  const staging = `${stateFile()}.${process.pid}.tmp`
  fs.writeFileSync(staging, `${JSON.stringify(state, null, 2)}\n`)
  fs.renameSync(staging, stateFile())
}

function contractOf(dir: string): number | null {
  try {
    return (JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as { akbContract?: number }).akbContract ?? null
  } catch {
    return null
  }
}

const usable = (dir: string) => fs.existsSync(entryOf(dir)) && contractOf(dir) === AKB_CONTRACT

/** The akb to start a step on. Its folder's time says when it was last chosen. */
export function currentAkb(): Akb {
  const { current } = readAkbState()
  if (!current) return bundledAkb()
  const dir = akbVersionDir(current)
  if (!usable(dir)) return bundledAkb()
  try {
    const now = new Date()
    fs.utimesSync(dir, now, now)
  } catch {
    // Only the cleanup reads it.
  }
  return { command: process.execPath, args: akbArgs(entryOf(dir)), version: current, shim: path.join(dir, 'shim') }
}

const answers = (dir: string, version: string) =>
  new Promise<boolean>((resolve) => {
    execFile(process.execPath, [entryOf(dir), '--version'], { timeout: CHECK_MS, killSignal: 'SIGKILL' }, (error, stdout) =>
      resolve(!error && stdout.trim().split(/\s+/).at(-1) === version))
  })

/** What Cloud named last, which a download finishing late must still be. */
let wanted: string | null = null
let fetching = false

function useVersion(current: string | null): void {
  const state = readAkbState()
  if (state.current !== current) writeAkbState({ ...state, current })
}

async function fetchVersion(version: string): Promise<void> {
  const got = await installPackage(AKB, version)
  if (!got.ok) return console.error(`runner: akb ${version} was not fetched: ${got.detail}`)
  if (contractOf(got.dir) !== AKB_CONTRACT || !(await answers(got.dir, version))) {
    console.error(`runner: akb ${version} failed its check and will not be used`)
    const state = readAkbState()
    return writeAkbState({ ...state, bad: [...new Set([...state.bad, version])] })
  }
  if (wanted === version) useVersion(version)
}

/** Act on a registration's `akb`. Never throws, and a download does not hold up what called it. */
export async function followAkb(named: { version: string | null } | undefined): Promise<void> {
  if (!named) return
  const { version } = named
  try {
    if (version !== null && !VERSION.test(version)) return
    wanted = version
    if (version === null || version === AKB_VERSION) return useVersion(null)
    const state = readAkbState()
    if (fetching || state.bad.includes(version) || (state.current === version && usable(akbVersionDir(version)))) return
    fetching = true
    await fetchVersion(version).finally(() => (fetching = false))
  } catch (e) {
    console.error(`runner: the akb version was not followed: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/** Drop what was not chosen for `IDLE_MS`, the current version and this Runner's own shim aside. */
export function sweepAkb(now = Date.now()): void {
  const { current } = readAkbState()
  let entries: fs.Dirent[] = []
  try {
    entries = fs.readdirSync(akbHome(), { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (!e.isDirectory() || e.name === current || e.name === BUNDLED_SHIM) continue
    const dir = path.join(akbHome(), e.name)
    if (now - fs.statSync(dir).mtimeMs > IDLE_MS) fs.rmSync(dir, { recursive: true, force: true })
  }
}
