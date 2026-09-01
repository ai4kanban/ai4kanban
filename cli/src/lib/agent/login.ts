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
// What it never does is gate. Implement, Schedule, Resolve & implement, a chat and
// `akb implement` all start exactly as they did — a stale or wrong reading here costs one
// wasted run, where gating on it would lock someone out of an agent that works. So the whole
// of its answer is a warning, and it is only ever given for a CLI that said outright that
// nobody is logged in.
//
// One answer per agent, not per runtime. The probe follows the same per-agent command the
// installed answer already resolves, so two runtimes on one agent are one probe and a
// runtime's own `command` override is not a second CLI to ask.

import { spawn, type ChildProcess } from 'node:child_process'

import { REPO_ROOT } from '../paths'
import { HARNESSES, type Harness } from './harnesses'
import { commandBinary, pathLookup } from './installed'
import { shownForProvider } from './providers'
import { activeProviderOf, commandOf, readBlock } from './resolve'
import { configBlock, safeConfig } from './settings'
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

/** What one probe's output said. `unknown` is the answer to everything that isn't a clear
 *  reading — no probe declared, a spawn that failed, a budget that ran out, output neither
 *  reading covers — and it says nothing on any screen. */
export type LoginState = 'ready' | 'logged-out' | 'unknown'

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

/** One agent worth asking, and the binary to ask. */
interface Ask {
  harness: Harness
  binary: string
}

/** Which agents a probe round asks, and with what. Only a login can be probed, so three
 *  kinds of agent are left out and each keeps whatever state it already had:
 *
 *  - one whose connector declares no probe — there is nothing to ask;
 *  - one whose binary isn't on the PATH — `installed` already says so, in words with the
 *    command that fixes it, and a spawn would only fail;
 *  - one whose saved setup signs runs with a key of its own, because then the CLI's login
 *    decides nothing. That is read off the settings rather than declared: a `secret` this
 *    board holds, that the picked provider still needs. A key saved under a provider nobody
 *    picked is not one a run would use, so it doesn't count. */
export function toAsk(): Ask[] {
  const cfg = safeConfig()
  const blocks = configBlock(cfg.harnessSettings)
  const onPath = pathLookup()
  const asks: Ask[] = []
  for (const harness of HARNESSES) {
    if (!harness.login) continue
    const block = configBlock(blocks[harness.name])
    const command = commandOf(block, harness)
    if (!onPath(command)) continue
    const { values, secretsSet } = readBlock(harness, block, command.split(/\s+/).filter(Boolean))
    const picked = activeProviderOf({ harness, values, secretsSet })
    const ownKey = harness.settings.some(
      (s) =>
        s.kind === 'secret' &&
        secretsSet.includes(s.key) &&
        shownForProvider(harness.settings, s.key, picked),
    )
    if (ownKey) continue
    asks.push({ harness, binary: commandBinary(command) })
  }
  return asks
}

/** The probe's child process, or nothing when it wouldn't start at all. */
function start(binary: string, args: string[]): ChildProcess | undefined {
  try {
    return spawn(binary, args, {
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

/** One probe, run to a hard budget. Everything that can go wrong — a binary that won't
 *  start, a CLI that hangs, a non-zero exit — comes back as whatever was printed, which is
 *  then read like any other output and lands on `unknown`. */
function ask({ harness, binary }: Ask): Promise<string> {
  const args = harness.login?.args ?? []
  return new Promise((resolve) => {
    let output = ''
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(output)
    }
    const child = start(binary, args)
    if (!child) return resolve('')
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish()
    }, BUDGET_MS)
    const take = (chunk: Buffer): void => {
      if (output.length < MAX_OUTPUT) output += chunk.toString()
    }
    child.stdout?.on('data', take)
    child.stderr?.on('data', take)
    child.on('error', finish)
    child.on('close', finish)
  })
}

let held: { at: number; answer: Promise<LoggedOutAgent[]> } | undefined

/** Every agent this machine has whose own CLI says nobody is logged into it, with the
 *  command that logs them back in. Empty is the ordinary answer, and also the answer
 *  whenever nothing could be read.
 *
 *  Cached for about a minute and shared by every caller inside it, so opening the picker
 *  twice is one round of spawns rather than two. */
export async function loggedOutAgents(): Promise<LoggedOutAgent[]> {
  const now = Date.now()
  if (!held || now - held.at > CACHE_MS) held = { at: now, answer: probeAll() }
  return held.answer
}

/** One round: every agent worth asking, all at once. It never rejects — a probe round that
 *  couldn't run is an empty list, not an error a picker has to handle. */
async function probeAll(): Promise<LoggedOutAgent[]> {
  let asks: Ask[]
  try {
    asks = toAsk()
  } catch {
    return []
  }
  const answers = await Promise.all(
    asks.map(async (one) => {
      const state = readLogin(one.harness, await ask(one))
      if (state !== 'logged-out') return undefined
      return { harness: one.harness.name, login: one.harness.login?.login ?? '' }
    }),
  )
  return answers.filter((one): one is LoggedOutAgent => !!one)
}
