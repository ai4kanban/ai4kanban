// Putting a spec agent on a card.
//
// `akb spec` with nothing after it lists the agents. `akb spec <agent> <id> [note]` asks
// for one, and what that means depends on who is asking:
//
//   - a flow working inside a run the board started — the ask is written onto that run's
//     record and started by its watcher the moment the run ends,
//   - anyone else — it starts right now, as an ordinary run.
//
// Either way it is a run of its own, with its own log, stoppable like anything else, and
// it starts clean. That is the one thing this command will not bend on: there is no
// `--print`, because a spec agent run in the conversation that asked for it is the
// conversation's own opinion written under someone else's name.

import { insideRun } from '../lib/agent/flow'
import { askForSpec, readRuns } from '../lib/agent/sessions'
import { startRun } from '../lib/agent/start'
import { titleOf } from '../lib/agent/sessions'
import type { AgentRequest } from '../lib/agent/types'
import { locate } from '../lib/cards'
import { say } from '../lib/io'
import { die, rel, BOARD_FLAG, TODO } from '../lib/paths'
import {
  findSpecAgent,
  notAnAgent,
  specAgentEnabled,
  specAgentList,
  specAgentNamesOnBoard,
  SPEC_SWITCH_HOME,
} from '../lib/agents'
import type { MoveResult } from '../lib/types'
import { followRun, short } from './run'

/** `akb spec`, as its command declares it (lib/cli/agent.ts). */
export interface SpecOptions {
  agent?: string
  id?: number
  note?: string[]
  notes?: string
  follow?: boolean
  print?: boolean
}

export async function cmdSpec(opts: SpecOptions, program = 'akb'): Promise<MoveResult> {
  // No agent named: say which ones there are. This is the list a flow reads to decide
  // whether a card needs one at all, so a switched-off agent is not in it (#191). Typed by
  // a person it is still named, in the closing line — an agent that vanished with no
  // explanation reads as a board that broke.
  if (!opts.agent) {
    say(specAgentList(program, !insideRun()))
    return { agents: specAgentNamesOnBoard() }
  }

  const askedName = opts.agent.trim()
  const agent = findSpecAgent(askedName)
  // An agent on another hook is on this board but is not what fills a card's spec, so it is
  // turned away by the same door as a name nobody has.
  if (!agent || agent.kind !== 'spec') die(notAnAgent(askedName), { kind: 'no-such-spec-agent', specAgent: askedName })
  const name = agent.name

  // Switched off in the board's settings (#191). A flow naming an agent from memory would
  // otherwise walk round the switch, so the ask is refused rather than quietly dropped —
  // and the refusal says what to do instead, because the user turned this off on purpose
  // and a flow that stopped over it would turn a preference into a blocker.
  if (!specAgentEnabled(name)) {
    die(
      `the \`${name}\` spec agent is switched off for this board, so it isn't running. Plan that part of the card yourself and carry on. It goes back on in ${SPEC_SWITCH_HOME}.`,
      { kind: 'spec-agent-off', specAgent: name },
    )
  }

  const id = opts.id
  if (id === undefined) {
    die(`say which card: ${program} spec ${name} <id> [note]`, { kind: 'needs-input' })
  }
  if (!locate(id)) die(`no task with id ${id} under ${rel(TODO)}`, { kind: 'card-not-found', id })

  // The one starting command with no `--print`. A printed flow is "do it here", and here is
  // exactly where a spec agent must not be: it is worth a run precisely because it has not
  // read the conversation that wanted it.
  if (opts.print === true) {
    die(
      `a spec agent has no --print: it is worth asking for only because it starts clean, and printing its instructions would have you write the section in the conversation that asked for it. Run \`${program} spec ${name} ${id}\` and it starts on its own.`,
      { kind: 'bad-option' },
    )
  }

  // One agent on one card at a time. A flow that asks while that agent is still working the
  // card would get its section written twice from the same plan, and the second run would
  // land on whatever the first one left — so the ask is dropped, not queued behind it.
  const live = readRuns().find(
    (r) => r.status === 'running' && r.action === 'spec' && r.cardId === id && r.specAgent === name,
  )
  if (live) {
    say(`${name} is already working on #${id} — run ${short(live.sessionId)}. One ask is enough; don't wait for it.`)
    return { specAgent: name, cardId: id, queued: false, pending: true }
  }

  const notes = noteOf(opts.note ?? [], opts.notes)
  const req: AgentRequest = { action: 'spec', id, title: titleOf(id), specAgent: name, notes }

  // Asked for from inside a run: written down, not started. A run never starts another, and
  // an agent that ran inside the asking run would read the very conversation it is meant to
  // be free of.
  const inside = insideRun()
  if (inside) {
    // …unless the asking run is itself a spec run (#403). A spec agent answers one part of
    // the card and nothing else, so an agent asking for an agent is either work it was given
    // and should do, or work outside its own part. Refused rather than dropped: a chain that
    // silently went nowhere reads as a board that lost the ask.
    if (readRuns().find((r) => r.sessionId === inside)?.action === 'spec') {
      die(
        `a spec agent does not ask for another spec agent — answer the part you own and leave the rest of the card to the session planning it.`,
        { kind: 'spec-agent-recursion', specAgent: name },
      )
    }
    const queued = askForSpec(inside, { specAgent: name, cardId: id, notes })
    if (queued === 'no-run') {
      die(`run ${short(inside)} is not on this board's list, so the ask has nowhere to be written down`, {
        kind: 'no-such-run',
        run: inside,
      })
    }
    say(
      queued === 'already'
        ? `${name} was already asked for on #${id} — one ask is enough; it starts when this run ends.`
        : `asked for the ${name} spec agent on #${id}. The board starts it when this run ends — don't wait for it, and don't write its section yourself.`,
    )
    return { specAgent: name, cardId: id, queued: queued === 'queued', pending: true }
  }

  const started = await startRun(req)
  if ('error' in started) die(started.error, { kind: 'run-refused', action: 'spec' })
  const { run, spawned } = started
  if (!spawned) die(`couldn't start a process to run ${run.sessionId}`, { kind: 'spawn-failed' })
  say(`spec ${name} #${id} — run ${run.sessionId}`)
  say(`  follow it: ${program} run log ${short(run.sessionId)} --follow${BOARD_FLAG}`)
  say(`  stop it:   ${program} run stop ${short(run.sessionId)}${BOARD_FLAG}`)
  if (opts.follow === true) return { sessionId: run.sessionId, ...(await followRun(run.sessionId, '', program)) }
  return { sessionId: run.sessionId, action: 'spec', specAgent: name, cardId: id }
}

// What the flow wants looked at. Everything after the id is the note, so it can be typed
// without quoting; `--notes` is the same thing spelled for a caller building a command.
function noteOf(words: string[], flag: string | undefined): string | undefined {
  const typed = words.join(' ').trim()
  if (typed) return typed
  return flag?.trim() || undefined
}
