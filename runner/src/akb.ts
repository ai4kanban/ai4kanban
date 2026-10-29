// The akb the Runner carries (#2020): built beside it into `akb/` (scripts/build.mjs), run by
// path with this Node. An `akb` shim leads the PATH of everything it starts, so a command a
// flow prints, or an agent types, reaches this copy and not another one on the computer.

import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { RUN_LANGUAGE_ENV } from '../../cli/src/lib/agent/language'
import type { Language } from '../../cli/src/lib/machine/types'
import { runnerHome } from './home'

export interface Akb {
  command: string
  args: string[]
}

export const bundledAkb = (): Akb => ({
  command: process.execPath,
  args: [path.join(path.dirname(fileURLToPath(import.meta.url)), 'akb', 'bin', 'ai4kanban.mjs')],
})

const quote = (s: string) => (/^[\w./:@=-]+$/.test(s) ? s : `"${s}"`)

/** A folder holding an `akb` that runs `akb`, rewritten when the Runner moved. */
function shimDir(akb: Akb): string {
  const dir = path.join(runnerHome(), 'bin', 'akb')
  const line = [akb.command, ...akb.args].map(quote).join(' ')
  const [file, text] = process.platform === 'win32'
    ? [path.join(dir, 'akb.cmd'), `@${line} %*\r\n`]
    : [path.join(dir, 'akb'), `#!/bin/sh\nexec ${line} "$@"\n`]
  try {
    if (fs.readFileSync(file, 'utf8') === text) return dir
  } catch {
    // Not written yet.
  }
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, text, { mode: 0o755 })
  return dir
}

/** This environment without the marks of a board run it may have been started inside. `board`
 *  is named to every `akb` an agent types, which would otherwise find no board, or the project's own.
 *  `task` is the Cloud task it works for, where a task akb makes goes to Cloud (#2063). `lang`,
 *  the language its runs write in (#11). */
export function akbEnv(akb: Akb, board?: string, task?: string, lang?: Language | null): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  const dropped = ['AI4KANBAN_BOARD', 'AI4KANBAN_TASK', RUN_LANGUAGE_ENV]
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('KANBAN_') && !dropped.includes(k)) env[k] = v
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH'
  env[key] = [shimDir(akb), env[key]].filter(Boolean).join(path.delimiter)
  env.AI4KANBAN_COMMAND = 'akb'
  if (board) env.AI4KANBAN_BOARD = board
  if (task) env.AI4KANBAN_TASK = task
  if (lang) env[RUN_LANGUAGE_ENV] = lang
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

/** Run one akb command to its end. `show` receives its output as it arrives. */
export function runAkb(
  akb: Akb,
  args: string[],
  opts: { cwd: string; board?: string; task?: string; lang?: Language | null; show?: (text: string) => void; track?: (child: ChildProcess) => void },
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
      child = spawn(akb.command, [...akb.args, ...args], { cwd: opts.cwd, env: akbEnv(akb, opts.board, opts.task, opts.lang), stdio: ['ignore', 'pipe', 'pipe'] })
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
