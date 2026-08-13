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
  splitShared,
} from './board-cli'
import { KANBAN, setBoardRoot } from './paths'
import { cmdAgent } from '../commands/agent'
import { cmdLog, cmdResume, cmdRuns, cmdStartRun, cmdStop, cmdWatch } from '../commands/run'
import type { AgentAction } from './agent/types'
import type { MoveResult } from './types'

// The word a person types, and the kind of run it starts. The spellings are the ones the
// board's buttons already stand for; `refine` and `revise` read better than the names the
// record keeps them under, and both go to the same run.
const RUNS: Record<string, AgentAction> = {
  implement: 'implement',
  run: 'run',
  refine: 'auto-refine',
  resolve: 'resolve',
  revise: 'edit',
  create: 'create',
  propose: 'propose',
  archive: 'archive',
  reject: 'reject',
  'plan-release': 'plan-release',
}

// Everything else these commands do — reading and steering the runs, and the settings they
// run under.
const OTHER: Record<string, (args: string[]) => MoveResult | Promise<MoveResult>> = {
  runs: cmdRuns,
  log: cmdLog,
  stop: cmdStop,
  resume: cmdResume,
  agent: (args) => cmdAgent(args),
}

const NAMES = [...Object.keys(RUNS), ...Object.keys(OTHER)]

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
    say(help(program))
    return 0
  }

  const action = raw ? RUNS[raw] : undefined
  const other = raw ? OTHER[raw] : undefined
  if (!action && !other && raw !== WATCH) {
    const guess = nearestMove(raw, NAMES)
    const err = new BoardError(`unknown command "${raw}".${guess ? ` Did you mean \`${guess}\`?` : ''}`, {
      kind: 'unknown-move',
      move: raw,
    })
    return report(err, { program, json, help: help(program) })
  }

  // Every command works on one board, and the watcher is told which by the command that
  // spawned it — so this is the same lookup for all of them.
  let root: string
  try {
    root = resolveBoard('runs', { dir, cwd, installHint })
    setBoardRoot(root)
  } catch (err) {
    return report(err, { program, json })
  }

  // The watcher runs for as long as the agent does, writes its own log, and says nothing
  // to anyone. It never collects prose and never answers in JSON.
  if (raw === WATCH) return await cmdWatch(args)

  const box = json ? startCollecting() : null
  try {
    const data = action ? cmdStartRun(action, args) : await other!(args)
    if (json) answer({ ok: true, board: KANBAN, ...data, ...prose(box) })
    return 0
  } catch (err) {
    return report(err, { program, json, box: box as Sink | null, move: raw })
  } finally {
    if (json) stopCollecting()
  }
}

function help(program: string): string {
  return `${program} — start a run, and steer it.

Usage: ${program} <command> [args] [options]

Runs
  implement <id> [note]     build the card
  run <id> [note]           one pass of a recurring card
  refine <id>               sharpen the card until it is ready to build
  resolve <id> [note]       answer its open questions (--and-implement carries on)
  revise <id> "<what>"      change the card to say something else
  create "<what you want>"  write the card(s) for it   (--release v1)
  propose                   write the next tasks       (--module m, --count n,
                            --boldness safe|normal|bold)
  plan-release <version>    fill a release from its goal
  archive <id>              finish the card
  reject <id> "<why>"       drop the card

The run starts and this returns — close the terminal and it keeps working. Add
--follow to any of them to watch the log instead of returning.

Runs in flight
  runs [--card <id>] [--all]   what is running, and what ran lately
  log [<run>] [--follow]       one run's log; --full for all of it
  stop [<run>]                 end a run
  resume [<run>]               continue one that failed or was cut off

A <run> is a run's id, any prefix of one that names only one run, or \`last\`.
Left out, it means the newest run.

The agent that runs them
  agent                        what runs, and how it is set up
  agent list                   the agents it can run, and what each one takes
  agent use <name>             pick one
  agent set <key> [value]      a setting or a key; no value clears it
  agent test                   one small chat, to see the setup works

Options — any command takes these
  --dir <path>   the project to work on. Default: the nearest board at or above
                 the folder you ran in
  --json         answer as one JSON object instead of prose

\`${program} board help\` is the board's own bookkeeping — the commands an agent calls
between runs. You never have to type one.`
}
