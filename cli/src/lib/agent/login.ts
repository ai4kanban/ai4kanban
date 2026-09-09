// Which of the agents this machine has are logged out.
//
// `installed.ts` answers the first question a spawn asks: is the binary there. This answers
// the one straight after it — would that binary do any work? A CLI installed but logged out
// is offered as ready, and the first card run on it burns before it fails.
//
// It is a SECOND path beside `installed.ts`, never part of it, because everything about it
// is the opposite. This one spawns, it is cached, and it is async; that one is spawn-free,
// uncached and on the page-load path. Nothing here can slow that down or make it stale.
//
// What it never does is gate. Implement, Schedule, Resolve, a chat and
// `akb card implement` all start exactly as they did — a stale or wrong reading here costs one
// wasted run, where gating on it would lock someone out of an agent that works. So the whole
// of its answer is a warning, and it is only ever given for a CLI that said outright that
// nobody is logged in — or, since #550, one that would not start at all, which is the other
// thing only a spawn can find out.
//
// One probe per CLI, one verdict per ROW. The spawn follows the command the installed answer
// already resolves, so two runtimes on one harness are one probe; the verdict is then read
// per runtime, because a row signing with a key of its own is never logged out however that
// CLI answers (#467).

import { spawn, type ChildProcess } from 'node:child_process'

import { REPO_ROOT } from '../paths'
import { quoteArg, splitCommand } from './argv'
import type { Harness } from './harnesses'
import { commandBinary, pathLookup } from './installed'
import { shownForProvider } from './providers'
import { activeProviderOf, commandOf, readBlock } from './resolve'
import { harnessOfRuntime, readRuntimes, type Runtime } from './runtimes'
import type { LoggedOutAgent } from './types'

/** How long one probe may take before it reads as unknown. A few seconds: long enough for a
 *  cold CLI to start, short enough that a stuck one never holds the picker. */
const BUDGET_MS = 5_000

/** How long an answer stands before the CLIs are asked again. About a minute: opening the
 *  pane twice doesn't respawn every CLI, and a login made in a terminal clears the warning
 *  the next time the pane is opened. */
const CACHE_MS = 60_000

/** The most output one probe's answer is read from. These print a line or a small JSON
 *  object; anything past this is a CLI that had something else in mind. */
const MAX_OUTPUT = 64 * 1024

const WINDOWS = process.platform === 'win32'

/** What a Windows shell prints when the thing it was handed never ran: a path it could not
 *  find, and one it was refused — which is what a `codex.exe` under `WindowsApps` answers.
 *
 *  Only ever read alongside a non-zero exit and no login reading, so a CLI that merely prints
 *  these words while working is never called unrunnable. Off Windows there is no shell in the
 *  way and the spawn's own `error` says it instead. */
const SHELL_REFUSED =
  /is not recognized as an internal|Access is denied|The system cannot find the (file|path)|cannot execute/i

/** What one probe made of the CLI it asked. `unknown` is the answer to everything that isn't
 *  a clear reading — no probe declared, a budget that ran out, output neither reading covers —
 *  and it says nothing on any screen.
 *
 *  `cannot-run` is the one verdict that isn't about a login (#550): the file this row resolves
 *  to is on the machine and would not start. A desktop app's own bundled CLI is where that
 *  turns up — discovery finds the file, and only a spawn can say the ACL refuses it. */
export type LoginState = 'ready' | 'logged-out' | 'unknown' | 'cannot-run'

/** What this connector's own readings make of one probe's output. `ready` is asked first, so
 *  a CLI that prints both — a login beside the words "not logged in" in a hint — is never
 *  called logged out. */
export function readLogin(harness: Harness, output: string): LoginState {
  const probe = harness.login
  if (!probe) return 'unknown'
  const text = plain(output)
  if (probe.ready(text)) return 'ready'
  return probe.loggedOut(text) ? 'logged-out' : 'unknown'
}

/** The output with a terminal's own marks taken out: OpenCode draws its credential list in
 *  colour and box characters, and a reading should be about the words. */
function plain(output: string): string {
  return output.replace(/\u001B\[[0-9;]*[A-Za-z]/g, '')
}

/** One row worth asking about, and the binary to ask. */
export interface Ask {
  runtime: Runtime
  harness: Harness
  binary: string
}

/** Which rows a probe round asks about, and with what. Only a login can be probed, so three
 *  kinds of row are left out and each keeps whatever state it already had:
 *
 *  - one whose harness declares no probe — there is nothing to ask;
 *  - one whose binary isn't on the PATH — `installed` already says so, in words with the
 *    command that fixes it, and a spawn would only fail;
 *  - one that signs its runs with a key of its own, because then the CLI's login decides
 *    nothing. That is read off the row's settings rather than declared: a `secret` this
 *    computer holds under that row's own name, that the picked provider still needs. A key
 *    saved under a provider nobody picked is not one a run would use, so it doesn't count. */
export function toAsk(): Ask[] {
  const onPath = pathLookup()
  const asks: Ask[] = []
  for (const runtime of readRuntimes()) {
    const harness = harnessOfRuntime(runtime)
    if (!harness.login) continue
    const command = commandOf(runtime.settings, harness)
    if (!onPath(command)) continue
    const { values, secretsSet } = readBlock(
      harness,
      runtime.settings,
      splitCommand(command),
      runtime.id,
    )
    const picked = activeProviderOf({ harness, values, secretsSet })
    const ownKey = harness.settings.some(
      (s) =>
        s.kind === 'secret' &&
        secretsSet.includes(s.key) &&
        shownForProvider(harness.settings, s.key, picked),
    )
    if (ownKey) continue
    asks.push({ runtime, harness, binary: commandBinary(command) })
  }
  return asks
}

/** The probe's child process, or nothing when it wouldn't start at all. */
function start(binary: string, args: string[]): ChildProcess | undefined {
  try {
    // Under a shell the command line is one string again, so a binary whose path holds a
    // space goes back in quoted — which is most of what a Windows path is (agent/argv.ts).
    // Without the shell it is already one argument and needs nothing.
    return spawn(WINDOWS ? quoteArg(binary) : binary, args, {
      cwd: REPO_ROOT,
      // Nothing to type at: a probe that stopped to ask would spend its whole budget and
      // answer nothing. Its stdout and stderr are one answer — several of these print the
      // status on one and their housekeeping on the other.
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      // On Windows the thing on the PATH is `claude.cmd`, which Node can only start through
      // a shell. The arguments are this file's own and the binary is the user's own config,
      // so a shell adds no reach they didn't already have.
      shell: WINDOWS,
    })
  } catch {
    return undefined
  }
}

/** What one probe came back with: everything the CLI printed, and whether the executable
 *  itself never ran. */
export interface Probe {
  output: string
  /** The file is there and still would not start — a spawn that failed outright, or a shell
   *  that refused what it was given. */
  unrunnable: boolean
}

/** One probe, run to a hard budget. Everything that can go wrong — a CLI that hangs, a
 *  non-zero exit, output nothing recognises — comes back as whatever was printed and is read
 *  like any other output.
 *
 *  The one thing told apart from that is a binary that never started: the spawn's own `error`,
 *  or, under the Windows shell that hides it, the shell's refusal beside a non-zero exit. */
export function ask({ harness, binary }: Ask): Promise<Probe> {
  const args = harness.login?.args ?? []
  return new Promise((resolve) => {
    let output = ''
    let broken = false
    let settled = false
    const finish = (code?: number | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      const refused = WINDOWS && code !== 0 && SHELL_REFUSED.test(output)
      resolve({ output, unrunnable: broken || refused })
    }
    const child = start(binary, args)
    if (!child) return resolve({ output: '', unrunnable: true })
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish()
    }, BUDGET_MS)
    const take = (chunk: Buffer): void => {
      if (output.length < MAX_OUTPUT) output += chunk.toString()
    }
    child.stdout?.on('data', take)
    child.stderr?.on('data', take)
    child.on('error', () => {
      broken = true
      finish()
    })
    child.on('close', (code) => finish(code))
  })
}

let held: { at: number; answer: Promise<LoggedOutAgent[]> } | undefined

/** Every runtime whose CLI says nobody is logged into it, with the command that logs them
 *  back in. Empty is the ordinary answer, and also the answer whenever nothing could be read.
 *
 *  Cached for about a minute and shared by every caller inside it, so opening the picker
 *  twice is one round of spawns rather than two. */
export async function loggedOutAgents(): Promise<LoggedOutAgent[]> {
  const now = Date.now()
  if (!held || now - held.at > CACHE_MS) held = { at: now, answer: probeAll() }
  return held.answer
}

/** One round: every CLI worth asking, all at once, and then a verdict per row. It never
 *  rejects — a probe round that couldn't run is an empty list, not an error a picker has to
 *  handle.
 *
 *  Rows sharing a binary share its answer: the spawns are deduplicated by what would be run,
 *  so two runtimes on one harness cost one probe. */
async function probeAll(): Promise<LoggedOutAgent[]> {
  let asks: Ask[]
  try {
    asks = toAsk()
  } catch {
    return []
  }
  const spawns = new Map<string, Promise<Probe>>()
  const answers = await Promise.all(
    asks.map(async (one): Promise<LoggedOutAgent | undefined> => {
      const key = `${one.harness.name} ${one.binary}`
      const held = spawns.get(key) ?? ask(one)
      spawns.set(key, held)
      const probe = await held
      const read = readLogin(one.harness, probe.output)
      // A CLI that answered says whatever it answered; only one that said nothing readable
      // can be the executable that would not start.
      const state = read === 'unknown' && probe.unrunnable ? 'cannot-run' : read
      if (state === 'cannot-run') {
        return {
          runtime: one.runtime.id,
          harness: one.harness.name,
          login: one.harness.login?.login ?? '',
          state,
          install: one.harness.install,
        }
      }
      if (state !== 'logged-out') return undefined
      return {
        runtime: one.runtime.id,
        harness: one.harness.name,
        login: one.harness.login?.login ?? '',
        state,
      }
    }),
  )
  return answers.filter((one): one is LoggedOutAgent => !!one)
}
