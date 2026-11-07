// Which copy of an agent's CLI this machine should run.
//
// One answer for the test, a chat, a board run and the login probe: every place the CLI is
// commonly installed is looked at, and the newest copy that starts wins. Reading a version
// means starting the copy, so what a copy answered is kept (`agent-copies.json`) until its
// file changes or the answer ages; a look that finds it all kept only reads the disk.

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { machineHome } from '../machine/home'
import { quoteArg } from './argv'
import type { Harness } from './harnesses/types'
import { commandBinary } from './installed'

const WINDOWS = process.platform === 'win32'
const PROBE_MS = 3_000
/** How long an answer stands for a screen… */
const KEEP_MS = 60 * 60_000
/** …and for a spawn, which is about to depend on it. */
export const SPAWN_MS = 5 * 60_000

export interface Copy {
  file: string
  /** The copy a shell would run: the first the PATH answers with. */
  entry: boolean
  starts: boolean
  version: string | null
}

/** What `--version` printed, reduced to the version: the first dotted number with its suffix.
 *  `zcode-app-cli 3.14.4-29`, `grok 1.0.70 (f50904eaee6c) [stable]`, `2026.10.01-e373342`. */
export function versionIn(output: string): string | null {
  const plain = output.replace(/\x1b\[[0-9;]*m/g, '')
  return /(?<![\w.-])v?(\d+(?:\.\d+)+(?:-[0-9A-Za-z.-]+)?)/.exec(plain)?.[1] ?? null
}

const RELEASE_STAGE = /^(alpha|beta|canary|dev|next|nightly|pre|preview|rc)[.-]?(\d*)$/i

/** Which of two versions is newer: positive for `a`, negative for `b`, 0 for the same, and null
 *  when their suffixes can't be ordered — a Cursor build hash, or a ZCode revision against a
 *  plain version, where the suffix could mean either direction. */
export function compareVersions(a: string, b: string): number | null {
  const [numberA = '', ...restA] = a.split('-')
  const [numberB = '', ...restB] = b.split('-')
  const [x, y] = [numberA.split('.').map(Number), numberB.split('.').map(Number)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const step = (x[i] ?? 0) - (y[i] ?? 0)
    if (step) return step
  }
  const [tagA, tagB] = [restA.join('-'), restB.join('-')]
  if (tagA === tagB) return 0
  if (/^\d+$/.test(tagA) && /^\d+$/.test(tagB)) return Number(tagA) - Number(tagB)
  const [stageA, stageB] = [RELEASE_STAGE.exec(tagA), RELEASE_STAGE.exec(tagB)]
  if (!tagA && stageB) return 1
  if (stageA && !tagB) return -1
  if (stageA && stageB && stageA[1]!.toLowerCase() === stageB[1]!.toLowerCase()) {
    return Number(stageA[2] || 0) - Number(stageB[2] || 0)
  }
  return null
}

function newest(copies: Copy[]): Copy | null {
  let best = copies[0] ?? null
  for (const copy of copies) {
    if (!copy.version) return null
    for (const other of copies) {
      if (!other.version || compareVersions(copy.version, other.version) === null) return null
    }
    if (compareVersions(copy.version, best!.version!)! > 0) best = copy
  }
  return best
}

/** The copy to run. The entry stands whenever anything is unknown; a copy that cannot start is
 *  only returned when nothing starts, so the run's own error says what is wrong. */
export function pick(copies: Copy[]): Copy | null {
  const live = copies.filter((copy) => copy.starts)
  if (!live.length) return copies.find((copy) => copy.entry) ?? copies[0] ?? null
  const entry = live.find((copy) => copy.entry)
  const best = newest(live)
  if (best) return entry && compareVersions(entry.version!, best.version!) === 0 ? entry : best
  return entry ?? newest(live.filter((copy) => copy.version)) ?? live[0]!
}

/** The immediate subfolders of one folder; none when it can't be read. */
export function folders(parent: string): string[] {
  try {
    return fs
      .readdirSync(parent, { withFileTypes: true })
      .filter((one) => one.isDirectory())
      .map((one) => one.name)
  } catch {
    return []
  }
}

/** Names holding a version, highest first, ties on the name. */
export function byVersion(names: string[]): string[] {
  const numbers = (name: string) => /(\d+(?:\.\d+)+)/.exec(name)?.[1]?.split('.').map(Number) ?? []
  return [...names].sort((a, b) => {
    const [x, y] = [numbers(a), numbers(b)]
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const step = (y[i] ?? -1) - (x[i] ?? -1)
      if (step) return step
    }
    return a < b ? -1 : a > b ? 1 : 0
  })
}

/** The two highest `<parent>/<version>/<tail>`: a self-updating CLI keeps old versions around,
 *  and the second is all a broken newest needs. Without `tail`, the entries are the files. */
export function latestIn(parent: string, tail = ''): string[] {
  let names: string[]
  try {
    names = fs.readdirSync(parent)
  } catch {
    return []
  }
  return byVersion(names.filter((name) => !name.startsWith('.')))
    .slice(0, 2)
    .map((name) => path.join(parent, name, tail))
}

const env = (name: string) => process.env[name]?.trim() ?? ''

/** Where a CLI installed by a package manager or a Node version manager ends up, on this OS. */
function commonDirs(): string[] {
  const home = os.homedir()
  const under = (...parts: string[]) => path.join(home, ...parts)
  const nodes = (root: string, tail: string[] = []) =>
    root ? folders(root).map((version) => path.join(root, version, ...tail)) : []
  if (WINDOWS) {
    const [app, local, data, programs] = [env('APPDATA'), env('LOCALAPPDATA'), env('ProgramData'), env('ProgramFiles')]
    return [
      under('.local', 'bin'),
      under('.bun', 'bin'),
      under('scoop', 'shims'),
      ...(app ? [path.join(app, 'npm')] : []),
      ...(local ? [path.join(local, 'pnpm'), path.join(local, 'Volta', 'bin'), path.join(local, 'Microsoft', 'WinGet', 'Links')] : []),
      ...(data ? [path.join(data, 'chocolatey', 'bin')] : []),
      ...(programs ? [path.join(programs, 'nodejs')] : []),
      ...nodes(env('NVM_HOME')),
      ...(app ? nodes(path.join(app, 'fnm', 'node-versions'), ['installation']) : []),
    ]
  }
  const support = process.platform === 'darwin' ? under('Library', 'Application Support') : under('.local', 'share')
  return [
    under('.local', 'bin'),
    under('bin'),
    '/usr/local/bin',
    '/usr/bin',
    // Not on macOS, where a stat under /home waits on the automounter.
    process.platform === 'darwin' ? '/opt/homebrew/bin' : '/home/linuxbrew/.linuxbrew/bin',
    under('.npm-global', 'bin'),
    under('.yarn', 'bin'),
    under('.bun', 'bin'),
    ...(env('PNPM_HOME') ? [env('PNPM_HOME')] : []),
    under('Library', 'pnpm'),
    under('.local', 'share', 'pnpm'),
    path.join(env('VOLTA_HOME') || under('.volta'), 'bin'),
    ...nodes(path.join(env('NVM_DIR') || under('.nvm'), 'versions', 'node'), ['bin']),
    ...nodes(path.join(env('FNM_DIR') || path.join(support, 'fnm'), 'node-versions'), ['installation', 'bin']),
    ...nodes(path.join(env('ASDF_DATA_DIR') || under('.asdf'), 'installs', 'nodejs'), ['bin']),
    ...nodes(under('.local', 'share', 'mise', 'installs', 'node'), ['bin']),
    ...nodes(under('.nodenv', 'versions'), ['bin']),
    ...nodes('/usr/local/n/versions/node', ['bin']),
  ]
}

/** Every file the PATH answers `binary` with, in its order. */
function onPath(binary: string): string[] {
  const names = WINDOWS
    ? [binary, ...(process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean).map((ext) => `${binary}${ext.toLowerCase()}`)]
    : [binary]
  return (process.env.PATH ?? '').split(path.delimiter).filter(Boolean).flatMap((dir) => names.map((name) => path.join(dir, name)))
}

const isFile = (file: string) => {
  try {
    return fs.statSync(file).isFile()
  } catch {
    return false
  }
}

/** The copies on this machine, the entry first and each real file once. A harness's pin is the
 *  only copy when it names a file. */
function copyFiles(harness: Harness): { file: string; entry: boolean }[] {
  const pinned = harness.pinned?.()
  if (pinned && isFile(pinned)) return [{ file: pinned, entry: false }]
  const binary = commandBinary(harness.command)
  const exe = (file: string) => (WINDOWS && !path.extname(file) ? `${file}.exe` : file)
  const path_ = onPath(binary).filter(isFile)
  // The test scripts' fake PATH has to be the whole machine.
  const elsewhere = process.env.AI4KANBAN_PATH_ONLY ? [] : [...(harness.installs?.() ?? []), ...commonDirs().map((dir) => path.join(dir, binary))]
  const others = elsewhere.map(exe).filter(isFile)
  const seen = new Set<string>()
  return [...path_, ...others].flatMap((file, i) => {
    const real = fs.realpathSync.native(file)
    if (seen.has(real)) return []
    seen.add(real)
    return [{ file, entry: i === 0 && path_.length > 0 }]
  })
}

/** Whether `file` is one of the copies `locate` chooses between. */
export const isCopy = (harness: Harness, file: string): boolean => copyFiles(harness).some((one) => one.file === file)

interface Answer {
  key: string
  at: number
  starts: boolean
  version: string | null
}

let answers: Record<string, Answer> | undefined
const answersFile = () => path.join(machineHome(), 'agent-copies.json')

function kept(): Record<string, Answer> {
  if (answers) return answers
  try {
    answers = JSON.parse(fs.readFileSync(answersFile(), 'utf8')) as Record<string, Answer>
  } catch {
    answers = {}
  }
  return answers
}

function keep(file: string, answer: Answer): void {
  kept()[file] = answer
  try {
    fs.mkdirSync(machineHome(), { recursive: true })
    const staged = `${answersFile()}.${process.pid}`
    fs.writeFileSync(staged, JSON.stringify(answers))
    fs.renameSync(staged, answersFile())
  } catch {
    // Unwritable: the next process asks again.
  }
}

function keyOf(file: string): string {
  const real = fs.realpathSync.native(file)
  const stat = fs.statSync(real)
  return `${real}|${stat.size}|${stat.mtimeMs}`
}

function known(file: string, maxAge: number): Answer | undefined {
  const answer = kept()[file]
  return answer && answer.key === keyOf(file) && Date.now() - answer.at < maxAge ? answer : undefined
}

/** A timeout or any other answer is a copy that runs; only a clear never-started counts. */
function judge(code: string | undefined, status: number | null, stdout: string, stderr: string) {
  if (code && ['ENOENT', 'EACCES', 'EPERM', 'ENOEXEC', 'EINVAL'].includes(code)) return { starts: false, version: null }
  if ((status === 126 || status === 127) && !stdout.trim()) return { starts: false, version: null }
  return { starts: true, version: status === 0 ? versionIn(stdout) ?? versionIn(stderr) : null }
}

/** `env` with the copy's folder first on the PATH: `#!/usr/bin/env node` in an nvm folder needs
 *  that folder's node, which a Runner started by launchd has not got. */
export function copyEnv(file: string, given: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  if (!path.isAbsolute(file)) return given
  return { ...given, PATH: [path.dirname(file), given.PATH].filter(Boolean).join(path.delimiter) }
}

const probeOptions = (file: string) => ({ cwd: os.tmpdir(), env: copyEnv(file), windowsHide: true, shell: false })

function probe(file: string): Answer {
  const key = keyOf(file)
  const run = spawnSync(file, ['--version'], { ...probeOptions(file), stdio: ['ignore', 'pipe', 'pipe'], timeout: PROBE_MS, encoding: 'utf8' })
  const code = (run.error as NodeJS.ErrnoException | undefined)?.code
  const answer = { key, at: Date.now(), ...judge(code, run.status, run.stdout ?? '', run.stderr ?? '') }
  keep(file, answer)
  return answer
}

function probeAsync(file: string): Promise<void> {
  const key = keyOf(file)
  return new Promise((resolve) => {
    let [stdout, stderr] = ['', '']
    const child = spawn(file, ['--version'], { ...probeOptions(file), stdio: ['ignore', 'pipe', 'pipe'], timeout: PROBE_MS })
    const done = (code: string | undefined, status: number | null) => {
      keep(file, { key, at: Date.now(), ...judge(code, status, stdout, stderr) })
      resolve()
    }
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('error', (e: NodeJS.ErrnoException) => done(e.code, null))
    child.on('close', (status) => done(undefined, status))
  })
}

/** Starts the copies nothing is known about at once, so the next `locate` waits on none. For a
 *  long-lived process, which must not block on a cold look. */
export async function warm(harness: Harness): Promise<void> {
  await Promise.all(copyFiles(harness).filter(({ file }) => !known(file, KEEP_MS)).map(({ file }) => probeAsync(file)))
}

/** The copy to run, or null when this machine has none. `maxAge` is how old an answer about the
 *  chosen copy may be: a spawn asks for `SPAWN_MS`, and a copy found broken gives way to the next. */
export function locate(harness: Harness, maxAge = KEEP_MS): Copy | null {
  const files = copyFiles(harness)
  const copies = files.map(({ file, entry }): Copy => {
    const { starts, version } = known(file, KEEP_MS) ?? probe(file)
    return { file, entry, starts, version }
  })
  for (;;) {
    const best = pick(copies)
    if (!best?.starts || known(best.file, maxAge)) return best
    const { starts, version } = probe(best.file)
    Object.assign(best, { starts, version })
    if (starts) return pick(copies)
  }
}

/** The copy to spawn: `locate`, without starting anything when there is no choice to make. */
export function chooseCopy(harness: Harness, maxAge = KEEP_MS): Copy | null {
  const files = copyFiles(harness)
  return files.length === 1 ? { ...files[0]!, starts: true, version: null } : locate(harness, maxAge)
}

/** What to spawn for `copy`: the bare name when the PATH would find it anyway. */
export const spawnName = (copy: Copy | null, binary: string): string => (copy && !copy.entry ? copy.file : binary)

/** A shell's spelling of `spawnName` (Windows runs these through one). */
export const shellName = (name: string): string => (WINDOWS && name.includes(' ') ? quoteArg(name) : name)

/** The line a run owes its log when the PATH's copy couldn't start and another took over. */
export function brokenEntryNote(copy: Copy, binary: string, harness: Harness): string | undefined {
  if (copy.entry || !copy.starts) return undefined
  const entry = copyFiles(harness).find((one) => one.entry)
  if (!entry || known(entry.file, KEEP_MS)?.starts !== false) return undefined
  const app = /([^/\\]+)\.app[/\\]/.exec(copy.file)?.[1]
  return `The ${binary} on your PATH can't start, so this run uses ${app ? `the one inside ${app}` : copy.file}.`
}
