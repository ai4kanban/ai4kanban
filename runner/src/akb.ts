// The akb the Runner carries (#2020), built beside it into `akb/` (scripts/build.mjs), or one
// Cloud named (#171, akb-version.ts): run by path with this Node. An `akb` shim leads the PATH of
// everything it starts, so a command a flow prints, or an agent types, reaches that copy and not
// another one on the computer. Each version has its own shim, so a switch leaves a started agent
// on the version it began with.

import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { SCHEDULED_AGENTS_ENV } from '../../cli/src/lib/agent/env'
import { LANGUAGE_ENV, LANGUAGE_LINE_ENV } from '../../cli/src/lib/agent/language'
import { runnerHome } from './home'
import { HOST_PROXY_ENV, hostProxy, proxyEnv } from './proxy'
import { AKB_VERSION } from './protocol'

export interface Akb {
  command: string
  args: string[]
  version: string
  /** The folder its `akb` shim lives in. */
  shim: string
}

export const akbHome = () => path.join(runnerHome(), 'bin', 'akb')
export const BUNDLED_SHIM = `bundled-${AKB_VERSION}`

const PRELOAD = path.join(path.dirname(fileURLToPath(import.meta.url)), 'akb-proxy.mjs')

/** Node arguments that run `entry` on the Runner's proxy route (akb-proxy.ts), the entry last. */
export const akbArgs = (entry: string) => (fs.existsSync(PRELOAD) ? ['--import', pathToFileURL(PRELOAD).href, entry] : [entry])

export const bundledAkb = (): Akb => ({
  command: process.execPath,
  args: akbArgs(path.join(path.dirname(fileURLToPath(import.meta.url)), 'akb', 'bin', 'ai4kanban.mjs')),
  version: AKB_VERSION,
  shim: path.join(akbHome(), BUNDLED_SHIM),
})

const quote = (s: string) => (/^[\w./:@=-]+$/.test(s) ? s : `"${s}"`)

/** A folder holding an `akb` that runs `akb`, rewritten when the Runner moved. */
export function shimDir(akb: Akb): string {
  const dir = akb.shim
  const line = [akb.command, ...akb.args].map(quote).join(' ')
  const [file, text] = process.platform === 'win32'
    ? [path.join(dir, 'akb.cmd'), `@${line} %*\r\n`]
    : [path.join(dir, 'akb'), `#!/bin/sh\nexec ${line} "$@"\n`]
  if (process.platform === 'win32') {
    fs.mkdirSync(dir, { recursive: true })
    const shellLine = [akb.command, ...akb.args].map((s) => `'${s.replaceAll('\\', '/').replaceAll("'", "'\\''")}'`).join(' ')
    fs.writeFileSync(path.join(dir, 'akb'), `#!/bin/sh\nexec ${shellLine} "$@"\n`, { mode: 0o755 })
  }
  try {
    if (fs.readFileSync(file, 'utf8') === text) return dir
  } catch {
    // Not written yet.
  }
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, text, { mode: 0o755 })
  return dir
}

/** 清除上游运行标记，并向子 CLI 传递 Cloud 语言代码；空值禁止本机回退。 */
export function akbEnv(akb: Akb, board?: string, task?: string, language?: 'zh' | 'en' | null, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  const dropped = ['AI4KANBAN_BOARD', 'AI4KANBAN_TASK', 'AI4KANBAN_EXECUTION', LANGUAGE_ENV, LANGUAGE_LINE_ENV, SCHEDULED_AGENTS_ENV]
  for (const [k, v] of Object.entries({ ...proxyEnv(), ...base })) if (!k.startsWith('KANBAN_') && !dropped.includes(k)) env[k] = v
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH'
  env[key] = [shimDir(akb), env[key]].filter(Boolean).join(path.delimiter)
  if (Object.keys(proxyEnv()).some((k) => !/^no_proxy$/i.test(k)) && env.NODE_USE_ENV_PROXY === undefined) env.NODE_USE_ENV_PROXY = '1'
  env[HOST_PROXY_ENV] = JSON.stringify(hostProxy())
  env.AI4KANBAN_COMMAND = 'akb'
  if (board) env.AI4KANBAN_BOARD = board
  if (task) env.AI4KANBAN_TASK = task
  if (language !== undefined) env[LANGUAGE_ENV] = language ?? ''
  return env
}

export interface Ran {
  code: number | null
  /** The tail of stdout. */
  out: string
  /** The last line it printed that says something, for a refusal. */
  last: string
}

const KEEP = 256 * 1024

/** Run one akb command to its end. `env` goes on top of `akbEnv`'s; `show` receives its output
 *  as it arrives. */
export function runAkb(
  akb: Akb,
  args: string[],
  opts: { cwd: string; board?: string; task?: string; language?: 'zh' | 'en' | null; env?: NodeJS.ProcessEnv; show?: (text: string) => void; track?: (child: ChildProcess) => void },
): Promise<Ran> {
  return new Promise((resolve) => {
    let out = ''
    let last = ''
    const note = (text: string) => {
      const line = text.split('\n').map((l) => l.trim()).filter(Boolean).at(-1)
      if (line) last = line
    }
    let child: ChildProcess
    try {
      child = spawn(akb.command, [...akb.args, ...args], { cwd: opts.cwd, env: { ...akbEnv(akb, opts.board, opts.task, opts.language), ...opts.env }, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (e) {
      return resolve({ code: null, out: '', last: e instanceof Error ? e.message : String(e) })
    }
    opts.track?.(child)
    child.stdout!.setEncoding('utf8')
    child.stderr!.setEncoding('utf8')
    child.stdout!.on('data', (chunk: string) => {
      out = (out + chunk).slice(-KEEP)
      note(chunk)
      opts.show?.(chunk)
    })
    child.stderr!.on('data', (chunk: string) => {
      note(chunk)
      opts.show?.(chunk)
    })
    child.on('error', (e) => resolve({ code: null, out, last: e.message }))
    child.on('close', (code) => resolve({ code, out, last }))
  })
}

/** The JSON answer a `--json` command ends with. */
export function answerOf<T>(ran: Ran): T | null {
  const line = ran.out.trim().split('\n').at(-1) ?? ''
  try {
    return JSON.parse(line) as T
  } catch {
    return null
  }
}
