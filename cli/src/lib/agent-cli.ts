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
import { cmdGuide } from '../commands/guide'
import { cmdLog, cmdResume, cmdRuns, cmdStartRun, cmdStop, cmdWatch } from '../commands/run'
import { cmdSpec } from '../commands/spec'
import type { AgentAction } from './agent/types'
import type { MoveResult } from './types'

// The word a person types, and the kind of run it starts. The spellings are the ones the
// board's buttons already stand for; `revise` reads better than the name the record keeps
// it under, and both go to the same run.
const RUNS: Record<string, AgentAction> = {
  implement: 'implement',
  run: 'run',
  refine: 'refine',
  resolve: 'resolve',
  revise: 'edit',
  create: 'create',
  propose: 'propose',
  archive: 'archive',
  reject: 'reject',
  'plan-release': 'plan-release',
  setup: 'setup',
}

// Everything else these commands do — reading and steering the runs, and the settings they
// run under.
const OTHER: Record<string, (args: string[], program: string) => MoveResult | Promise<MoveResult>> = {
  runs: cmdRuns,
  // Not in RUNS above: a spec run is asked for by agent name rather than by card alone,
  // and asked for from inside a run it is written down instead of started (#187).
  spec: (args, program) => cmdSpec(args, program),
  log: cmdLog,
  stop: cmdStop,
  resume: cmdResume,
  agent: (args) => cmdAgent(args),
}

// The flows themselves. Alone among these it needs no board: a guide is the same text
// wherever it is read, and an agent asking what a flow says before installing one is
// exactly who should get an answer.
const GUIDE = 'guide'

const NAMES = [...Object.keys(RUNS), ...Object.keys(OTHER), GUIDE]

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

  // Before the board lookup, on purpose — see GUIDE above.
  if (raw === GUIDE) {
    const box = json ? startCollecting() : null
    try {
      const data = cmdGuide(args, program)
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
    const data = action ? cmdStartRun(action, args, program) : await other!(args, program)
    if (json) answer({ ok: true, board: KANBAN, ...data, ...prose(box) })
    return 0
  } catch (err) {
    return report(err, { program, json, box: box as Sink | null, move: raw })
  } finally {
    if (json) stopCollecting()
  }
}

// The agent's manual: every command an agent working on this board may call, and when to
// call it. It is one of the two places the words live — the other is the short note
// installed in the project, which points here — so a rule added anywhere else is a third
// copy that will drift.
function help(program: string): string {
  return `${program} — start a run, and steer it.

Usage: ${program} <command> [args] [options]

Runs — every one of them also takes --print, and the rule for it is below
  implement <id> [note]     build the card
  run <id> [note]           one pass of a recurring card
  refine <id>               sharpen the card until it is ready to build
  resolve <id> [note]       answer its open questions (--and-implement carries on)
  revise <id> "<what>"      change the card to say something else
  create "<what you want>"  write the card(s) for it   (--release v1)
  propose                   write the next tasks       (--module m, --count n,
                            --boldness safe|normal|bold)
  plan-release <version>    fill a release from its goal
  setup                     finish setting the board up — every step still unticked
                            on docs/kanban/setup-checklist.md, in one run
  archive <id>              finish the card
  reject <id> "<why>"       drop the card

The run starts and this returns — close the terminal and it keeps working. Add
--follow to any of them to watch the log instead of returning.

Print it, or run it — the two modes every command above has
  --print     say what to do and start nothing. What it prints is filled in for this
              board: the card's own path, the steps it has left, the memory file its
              modules point at, the release it is in, the flows the job is done by in
              full, and the command that closes the job — because nothing is watching
              you finish.
  (no flag)   start a run: a second agent, its own context, working on its own.

  Print when the user is asking you for the action here, in a session. You do the job
  in the conversation you are already in: it costs no second agent, a correction is
  their next message rather than a whole run thrown away, and it can't collide with
  the changes already in the working tree.

  Start a run when the user wants the work to happen on its own — in the background,
  while they do something else, on a card they are not watching. That is the explicit
  ask. It also wins on long read-heavy jobs that need nothing from the conversation:
  proposing across the repo, planning a release, refining round after round.

  Some jobs are better done by the agent that was there. It just built the card, so it
  knows which steps it really did; a fresh agent sees unticked boxes and works the rest
  out from the diff.

  When it is not clear which was meant, print. A printed flow costs nothing and can
  still be followed by starting a run; a started run costs a second agent, a second
  context, and money nobody asked to spend.

  An agent already working inside a run the board started always prints, whether or not
  it says --print. A run never starts another run, so it cannot spawn a copy of itself.

Spec agents — a named agent that fills one part of a card's spec
  spec                         the spec agents this board has, and what each one owns
  spec <agent> <id> [note]     put one on a card

  It is a run of its own: it starts clean, with the card and your note and nothing
  else, and it writes one section of that card — \`## By \`<agent>\` agent\` — and
  changes nothing more. That is why it has no --print: doing it in the conversation
  that asked for it is the one thing it exists not to be.

  Asked for from inside a run, it is written down rather than started, and the board
  starts it the moment that run ends. So a flow asks and carries straight on — it
  never waits for the agent, and never writes the agent's section itself.

Runs in flight
  runs [--card <id>] [--all]   what is running, and what ran lately
  log [<run>] [--follow]       one run's log; --full for all of it
  stop [<run>]                 end a run
  resume [<run>]               continue one that failed, was cut off or was stopped

A <run> is a run's id, any prefix of one that names only one run, or \`last\`.
Left out, it means the newest run.

The agent that runs them
  agent                        what runs, and how it is set up
  agent list                   the agents it can run, and what each one takes
  agent use <name>             pick one
  agent set <key> [value]      a setting or a key; no value clears it. \`agent\` lists
                               the keys the picked agent takes — model, reasoning
                               effort, provider, endpoint, and its API key
  agent test                   one small chat, to see the setup works

  A key is the one thing to hand back rather than run. Give the user the line —
  \`${program} agent set apiKey <their-key>\` — and let them type it: a key an agent types
  lands in its transcript and in the shell history, and a saved key is never read back.

The flows
  guide                        every flow the board has, one line each
  guide <topic>                one in full. \`guide board\` is how the board works at
                               all — card format, layout, the memory set

A printed flow already carries the flows its action is done by, so this is for the rest:
how the board works, the module map, setup, updating, the local UI.

The board's own bookkeeping
  ${program} board help                 every move: ids, a card's fields, releases, the index
  ${program} board help <move>          one move in full

Those are the agent's commands between runs — a person never has to type one. They own
docs/kanban/next-id, a card's frontmatter and metrics.csv; write and edit only a card's
body.

When an ask can't run, this is the one line that fixes it
  no board here                 \`${program} install\` in the project
  the board is half a board     \`${program} board init\` adds what is missing
  this command is behind        \`npm install -g ai4kanban@latest\`, then \`${program} update\`
  the agent isn't installed     \`${program} agent test\` — it names the install command
  no key, or the wrong one      \`${program} agent\` says what is set; the user runs
                                \`${program} agent set apiKey <their-key>\`
  a run won't start             \`${program} runs\` — one run per card at a time, and
                                the refusal names the run already on it
  a run died part-way           \`${program} resume <run>\` continues that conversation

Options — any command takes these
  --dir <path>   the project to work on. Default: the nearest board at or above
                 the folder you ran in
  --json         answer as one JSON object instead of prose`
}
