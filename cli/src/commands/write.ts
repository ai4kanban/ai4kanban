// Calling a write agent in on a topic (#424).
//
// The marketing counterpart of `akb spec`: the writer writes the draft and asks for a
// specialist only where one helps — an image for a post, a chart, a file it cannot make
// itself. `akb write` with nothing after it lists the agents; `akb write <agent> <id> [note]`
// asks for one, and what that means depends on who is asking:
//
//   - a run the board started — the ask is written onto that run's record and started by its
//     watcher the moment the run ends,
//   - anyone else — it starts right now, as an ordinary run.
//
// Either way it is a run of its own, and there is no `--print` for the same reason `akb spec`
// has none: an agent run inside the conversation that asked for it is that conversation's own
// work under someone else's name.

import { insideRun } from '../lib/agent/flow'
import { askForWrite, readRuns, titleOf } from '../lib/agent/sessions'
import { startRun } from '../lib/agent/start'
import type { AgentRequest } from '../lib/agent/types'
import { locate } from '../lib/cards'
import { say } from '../lib/io'
import { die, rel, BOARD_FLAG, TODO } from '../lib/paths'
import { solution } from '../lib/solution'
import {
  findWriteAgent,
  notAWriteAgent,
  specAgentEnabled,
  writeAgentList,
  writeHookAgents,
  SPEC_SWITCH_HOME,
} from '../lib/agents'
import type { MoveResult } from '../lib/types'
import { followRun, short } from './run'

/** `akb write`, as its command declares it (lib/cli/agent.ts). */
export interface WriteOptions {
  agent?: string
  id?: number
  note?: string[]
  notes?: string
  follow?: boolean
  print?: boolean
}

export async function cmdWrite(opts: WriteOptions, program = 'akb'): Promise<MoveResult> {
  // A write agent joins the board's writer, and only a marketing board has one — which is
  // also why `kind: write` does not parse anywhere else (lib/agents/parse.ts).
  if (solution() !== 'marketing') {
    die(
      `\`${program} write\` is the marketing solution's — this board is \`${solution()}\`, and its cards have no draft for an agent to add to. A card's spec is filled by \`${program} spec\`.`,
      { kind: 'wrong-solution', solution: solution() },
    )
  }

  // No agent named: say which ones there are. This is the list the writer reads to decide
  // whether the draft needs one at all, so a switched-off agent is not in it.
  if (!opts.agent) {
    say(writeAgentList(program, !insideRun()))
    return { agents: writeHookAgents().map((a) => a.name) }
  }

  const askedName = opts.agent.trim()
  const agent = findWriteAgent(askedName)
  if (!agent) die(notAWriteAgent(askedName), { kind: 'no-such-write-agent', specAgent: askedName })
  const name = agent.name

  // Switched off in the board's settings. Refused rather than quietly dropped, and the
  // refusal says what to do instead: the user turned this off on purpose, and a run that
  // stopped over it would turn a preference into a blocker.
  if (!specAgentEnabled(name)) {
    die(
      `the \`${name}\` write agent is switched off for this board, so it isn't running. Write what you can yourself and carry on. It goes back on in ${SPEC_SWITCH_HOME}.`,
      { kind: 'write-agent-off', specAgent: name },
    )
  }

  const id = opts.id
  if (id === undefined) die(`say which topic: ${program} write ${name} <id> [note]`, { kind: 'needs-input' })
  if (!locate(id)) die(`no task with id ${id} under ${rel(TODO)}`, { kind: 'card-not-found', id })

  if (opts.print === true) {
    die(
      `a write agent has no --print: it is worth asking for only because it starts clean, and printing its instructions would have you make the file in the conversation that asked for it. Run \`${program} write ${name} ${id}\` and it starts on its own.`,
      { kind: 'bad-option' },
    )
  }

  // One agent on one card at a time. A second ask while the first is still going would write
  // the same files twice from the same note, the second run landing on what the first left.
  const live = readRuns().find(
    (r) => r.status === 'running' && r.action === 'write' && r.cardId === id && r.specAgent === name,
  )
  if (live) {
    say(`${name} is already working on #${id} — run ${short(live.sessionId)}. One ask is enough; don't wait for it.`)
    return { specAgent: name, cardId: id, queued: false, pending: true }
  }

  const notes = noteOf(opts.note ?? [], opts.notes)
  const req: AgentRequest = { action: 'write', id, title: titleOf(id), specAgent: name, notes }

  // Asked for from inside a run: written down, not started. A run never starts another, and
  // an agent that ran inside the asking run would read the very conversation it is meant to
  // be free of.
  const inside = insideRun()
  if (inside) {
    // …unless the asking run is itself a write agent. An agent asking for an agent is either
    // work it was given and should do, or work outside its own part. Refused rather than
    // dropped: a chain that silently went nowhere reads as a board that lost the ask.
    if (readRuns().find((r) => r.sessionId === inside)?.action === 'write') {
      die(
        `a write agent does not ask for another write agent — make the files you were asked for and leave the rest of the draft to the run writing it.`,
        { kind: 'write-agent-recursion', specAgent: name },
      )
    }
    const queued = askForWrite(inside, { specAgent: name, cardId: id, notes })
    if (queued === 'no-run') {
      die(`run ${short(inside)} is not on this board's list, so the ask has nowhere to be written down`, {
        kind: 'no-such-run',
        run: inside,
      })
    }
    say(
      queued === 'already'
        ? `${name} was already asked for on #${id} — one ask is enough, so name every file you want in that one note.`
        : `asked for the ${name} write agent on #${id}. The board starts it when this run ends — don't wait for it, and don't make its files yourself.`,
    )
    return { specAgent: name, cardId: id, queued: queued === 'queued', pending: true }
  }

  const started = await startRun(req)
  if ('error' in started) die(started.error, { kind: 'run-refused', action: 'write' })
  const { run, spawned } = started
  if (!spawned) die(`couldn't start a process to run ${run.sessionId}`, { kind: 'spawn-failed' })
  say(`write ${name} #${id} — run ${run.sessionId}`)
  say(`  follow it: ${program} run log ${short(run.sessionId)} --follow${BOARD_FLAG}`)
  say(`  stop it:   ${program} run stop ${short(run.sessionId)}${BOARD_FLAG}`)
  if (opts.follow === true) return { sessionId: run.sessionId, ...(await followRun(run.sessionId, '', program)) }
  return { sessionId: run.sessionId, action: 'write', specAgent: name, cardId: id }
}

// Which files the writer wants, in its own words. Everything after the id is the note, so it
// can be typed without quoting; `--notes` is the same thing spelled for a caller building a
// command.
function noteOf(words: string[], flag: string | undefined): string | undefined {
  const typed = words.join(' ').trim()
  if (typed) return typed
  return flag?.trim() || undefined
}
