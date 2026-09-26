// Print specialist instructions here, or request a separate run.

import { insideRun, printFlow } from '../lib/agent/flow'
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
  specAgentAssigned,
  specAgentList,
  specAgentNamesOnBoard,
  SPEC_ASSIGN_HOME,
} from '../lib/agents'
import { activeDelivery } from '../lib/agent/deliveries'
import { cardWorkflowId, frozenReviewers, workflowFor } from '../lib/agent/workflows'
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
  // No agent named: say which ones there are. Every agent on the hook, because this is
  // typed with no card in hand — which of them a card may actually ask for is its own
  // workflow's answer, and the ask below is where that is checked.
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

  const id = opts.id
  if (id === undefined) {
    die(`say which card: ${program} spec ${name} <id> [note]`, { kind: 'needs-input' })
  }
  if (!locate(id)) die(`no task with id ${id} under ${rel(TODO)}`, { kind: 'card-not-found', id })

  // A reviewer is printed inside the review of the delivery that froze it (#820).
  if (agent.stage === 'review') {
    const delivery = activeDelivery(id)
    if (!delivery || !frozenReviewers(delivery.workflow).some((h) => h.agent === name)) {
      die(`\`${name}\` is not a reviewer on a delivery in flight on #${id}, so it has nothing to review.`, {
        kind: 'spec-agent-off',
        specAgent: name,
      })
    }
    if (opts.print !== true) {
      die(`a reviewer works inside the review run: \`${program} spec ${name} ${id} --print\``, { kind: 'needs-input' })
    }
    return printFlow({ action: 'spec', id, title: titleOf(id), specAgent: name, notes: noteOf(opts.note ?? [], opts.notes) }, program)
  }

  // Not on this card's workflow (#749). A flow naming an agent from memory would otherwise
  // walk round the assignment, so the ask is refused rather than quietly dropped — and the
  // refusal says what to do instead, because whoever left it off the stage meant to, and a
  // flow that stopped over it would turn a choice into a blocker.
  if (!specAgentAssigned(name, cardWorkflowId(id))) {
    die(
      `the \`${name}\` spec agent is not assigned to the planning of #${id}, so it isn't running. Plan that part of the card yourself and carry on. It joins when ${SPEC_ASSIGN_HOME}.`,
      { kind: 'spec-agent-off', specAgent: name },
    )
  }

  const notes = noteOf(opts.note ?? [], opts.notes)
  const req: AgentRequest = { action: 'spec', id, title: titleOf(id), specAgent: name, notes }

  const inside = insideRun()
  if (inside && readRuns().find((r) => r.sessionId === inside)?.action === 'spec') {
    die(
      'a spec agent does not ask for another spec agent — answer the part you own and leave the rest of the card to the session planning it.',
      { kind: 'spec-agent-recursion', specAgent: name },
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

  if (opts.print === true) return printFlow(req, program)

  // Separate requests from a board run start after its parent finishes.
  if (inside) {
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
