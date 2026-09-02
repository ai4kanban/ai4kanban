// The commands a person actually types.
//
// `akb board <move>` is the board's own bookkeeping — the agent's commands, between runs.
// These are the other half: the runs themselves. Implement a card, run a recurring one,
// refine it, resolve its questions, revise it, create cards, propose, plan a release,
// archive, reject — plus seeing what is running, reading a run's log, stopping one, and
// continuing one that stopped short.
//
// The same plumbing as the board's moves sits under them: which board to work on, refusing
// without ending the process, and answering a program in JSON instead of a person in
// prose. What is different is that none of these finish the work they start — a run is a
// process of its own, and these commands hand it over and return.

import { BoardError, say, startCollecting, stopCollecting, type Sink } from './io'
import {
  answer,
  nearestMove,
  prose,
  report,
  resolveBoard,
  sayIfOffline,
  splitShared,
} from './board-cli'
import { openBoard } from './board'
import { flushOnExit } from './cloud/publish'
import { catchUpOnExit } from './cloud/requests'
import { KANBAN, setBoardRoot } from './paths'
import { cmdAgent } from '../commands/agent'
import { cmdChat } from '../commands/chat'
import { cmdCloud } from '../commands/cloud'
import { cmdGuide } from '../commands/guide'
import { cmdApprove, cmdCancel, cmdDiscard, cmdLog, cmdResume, cmdRuns, cmdStartRun, cmdStop, cmdWatch } from '../commands/run'
import { cmdSpec } from '../commands/spec'
import { RUN_COMMANDS } from './agent/flows'
import { agentManual } from './agent/manual'
import type { CommandAction } from './agent/types'
import type { MoveResult } from './types'

// The word a person types, and the kind of run it starts — the board's own list of flows
// (agent/flows.ts), which the runs table and the Rules pane read too, so a flow shipped
// later reaches all three at once. `revise` reads better than the name the record keeps it
// under (`edit`), and both go to the same run.
const RUNS: Record<string, CommandAction> = RUN_COMMANDS

// Everything else these commands do — reading and steering the runs, and the settings they
// run under.
const OTHER: Record<string, (args: string[], program: string) => MoveResult | Promise<MoveResult>> = {
  runs: cmdRuns,
  // Not a run at all: a conversation, held here in this process for as long as the reply
  // takes. It is in this table because a person types it, not because it starts anything.
  chat: (args, program) => cmdChat(args, program),
  // Not in RUNS above: a spec run is asked for by agent name rather than by card alone,
  // and asked for from inside a run it is written down instead of started (#187).
  spec: (args, program) => cmdSpec(args, program),
  log: cmdLog,
  stop: cmdStop,
  resume: cmdResume,
  // Ends a DELIVERY, where `stop` ends one run of it. The two are not the same word:
  // stopping a run leaves the delivery in flight and the card still held.
  cancel: cmdCancel,
  // Cancel hands the card back and leaves the delivery's checkout alone; this is what
  // throws that checkout away (#303). Two commands because they lose different things.
  discard: cmdDiscard,
  // Sign off the tree a delivery would land, on a board that requires it (#308). It ends
  // nothing and starts nothing — it lets a delivery already waiting carry on.
  approve: cmdApprove,
  agent: (args) => cmdAgent(args),
}

// The two that need no board. A guide is the same text wherever it is read, and an agent
// asking what a flow says before installing one is exactly who should get an answer; the
// Cloud sign-in belongs to the machine rather than to any one project (#326).
const GUIDE = 'guide'
const CLOUD = 'cloud'
const BOARDLESS = [GUIDE, CLOUD]

// …except the one `cloud` move that IS about a project: carrying its board into a workspace
// (#315). Export is not one of them — it WRITES a board into the folder `--to` names, and a
// restore onto a machine that has no board is exactly when it is reached for.
const CLOUD_NEEDS_BOARD = ['import']

const NAMES = [...Object.keys(RUNS), ...Object.keys(OTHER), ...BOARDLESS]

// The watcher's own door. Not a command anyone types — `akb implement 12` spawns it — and
// spelled so it can never be mistaken for one. It is handled before everything else
// because it is the one thing here that does not return in a moment.
const WATCH = '__watch'

export interface RunAgentOptions {
  program?: string
  cwd?: string
  installHint?: string
}

/** Run one of these commands and return the exit code. Never exits the process itself: the
 *  caller may be the CLI, a board UI, or a test. */
export async function runAgent(argv: string[], options: RunAgentOptions = {}): Promise<number> {
  const { program = 'akb', cwd = process.cwd(), installHint = '`akb install`' } = options

  // Seeded from a raw scan so that a refusal in the parse itself — `--dir` with nothing
  // after it — still answers in the form the caller asked for.
  let json = argv.includes('--json')
  let rest: string[] = []
  let dir: string | null = null
  try {
    ;({ rest, dir, json } = splitShared(argv))
  } catch (err) {
    return report(err, { program, json })
  }
  const [raw, ...args] = rest

  if (raw === undefined || raw === 'help' || raw === '--help' || raw === '-h') {
    say(agentManual(program))
    return 0
  }

  // Before the board lookup, on purpose — see BOARDLESS above.
  if (raw === GUIDE || (raw === CLOUD && !CLOUD_NEEDS_BOARD.includes(args[0] ?? ''))) {
    const box = json ? startCollecting() : null
    try {
      const data = raw === GUIDE ? cmdGuide(args, program) : await cmdCloud(args, program)
      if (json) answer({ ok: true, ...data, ...prose(box) })
      return 0
    } catch (err) {
      return report(err, { program, json, box: box as Sink | null, move: raw })
    } finally {
      if (json) stopCollecting()
    }
  }

  const action = raw ? RUNS[raw] : undefined
  const other = raw ? OTHER[raw] : undefined
  if (!action && !other && raw !== WATCH && raw !== CLOUD) {
    const guess = nearestMove(raw, NAMES)
    const err = new BoardError(`unknown command "${raw}".${guess ? ` Did you mean \`${guess}\`?` : ''}`, {
      kind: 'unknown-move',
      move: raw,
    })
    return report(err, { program, json, help: agentManual(program) })
  }

  // Every command works on one board, and the watcher is told which by the command that
  // spawned it — so this is the same lookup for all of them.
  let root: string
  try {
    root = resolveBoard('runs', { dir, cwd, installHint })
    setBoardRoot(root, dir !== null)
    // …and which board that checkout opens: the folder, or the workspace its committed
    // pointer names (#316). A refusal here is the whole answer — a run against a board that
    // could not be opened would be a run against no board at all.
    const opened = await openBoard(root)
    if (!opened.ok) throw new BoardError(opened.error, { kind: `cloud-${opened.reason}`, dir: root })
    sayIfOffline()
  } catch (err) {
    return report(err, { program, json })
  }

  // The watcher runs for as long as the agent does, writes its own log, and says nothing
  // to anyone. It never collects prose and never answers in JSON.
  if (raw === WATCH) return await cmdWatch(args)

  const box = json ? startCollecting() : null
  try {
    const data = raw === CLOUD
      ? await cmdCloud(args, program)
      : action
        ? await cmdStartRun(action, args, program)
        : await other!(args, program)
    if (json) answer({ ok: true, board: KANBAN, ...data, ...prose(box) })
    // This command is over the moment it returns, so this is the outbox's one chance to
    // reach Cloud (#319) and the board's one chance to claim an approval taken somewhere
    // else (#318). Both bounded, and silent either way.
    await flushOnExit()
    await catchUpOnExit()
    return 0
  } catch (err) {
    return report(err, { program, json, box: box as Sink | null, move: raw })
  } finally {
    if (json) stopCollecting()
  }
}
