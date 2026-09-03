// Putting a spec skill on a card.
//
// `akb spec` with nothing after it lists the skills. `akb spec <skill> <id> [note]` asks
// for one, and what that means depends on who is asking:
//
//   - a flow working inside a run the board started — the ask is written onto that run's
//     record and started by its watcher the moment the run ends,
//   - anyone else — it starts right now, as an ordinary run.
//
// Either way it is a run of its own, with its own log, stoppable like anything else, and
// it starts clean. That is the one thing this command will not bend on: there is no
// `--print`, because a spec skill run in the conversation that asked for it is the
// conversation's own opinion written under someone else's name.

import { insideRun } from '../lib/agent/flow'
import { askForSpec, readRuns } from '../lib/agent/sessions'
import { startRun } from '../lib/agent/start'
import { titleOf } from '../lib/agent/sessions'
import type { AgentRequest } from '../lib/agent/types'
import { locate } from '../lib/cards'
import { say } from '../lib/io'
import { die, rel, DIR_FLAG, TODO } from '../lib/paths'
import {
  findSpecSkill,
  notASkill,
  specSkillEnabled,
  specSkillList,
  specSkillNamesOnBoard,
  SPEC_SWITCH_HOME,
} from '../lib/spec-skills'
import type { MoveResult } from '../lib/types'
import { parseFlags } from '../lib/validate'
import { followRun, short } from './run'

const FLAGS = ['follow', 'dir', 'json', 'notes', 'print']

export async function cmdSpec(args: string[], program = 'akb'): Promise<MoveResult> {
  const { flags, positional } = parseFlags(args, FLAGS)

  // No skill named: say which ones there are. This is the list a flow reads to decide
  // whether a card needs one at all, so a switched-off skill is not in it (#191). Typed by
  // a person it is still named, in the closing line — a skill that vanished with no
  // explanation reads as a board that broke.
  if (!positional.length) {
    say(specSkillList(program, !insideRun()))
    return { agents: specSkillNamesOnBoard() }
  }

  const askedName = String(positional[0]).trim()
  const skill = findSpecSkill(askedName)
  if (!skill) die(notASkill(askedName), { kind: 'no-such-spec-agent', specAgent: askedName })
  const name = skill.name

  // Switched off in the board's settings (#191). A flow naming a skill from memory would
  // otherwise walk round the switch, so the ask is refused rather than quietly dropped —
  // and the refusal says what to do instead, because the user turned this off on purpose
  // and a flow that stopped over it would turn a preference into a blocker.
  if (!specSkillEnabled(name)) {
    die(
      `the \`${name}\` spec skill is switched off for this board, so it isn't running. Plan that part of the card yourself and carry on. It goes back on in ${SPEC_SWITCH_HOME}.`,
      { kind: 'spec-agent-off', specAgent: name },
    )
  }

  const id = Number(positional[1])
  if (!Number.isInteger(id)) {
    die(`say which card: ${program} spec ${name} <id> [note]`, { kind: 'needs-input' })
  }
  if (!locate(id)) die(`no task with id ${id} under ${rel(TODO)}`, { kind: 'card-not-found', id })

  // The one starting command with no `--print`. A printed flow is "do it here", and here is
  // exactly where a spec skill must not be: it is worth a run precisely because it has not
  // read the conversation that wanted it.
  if (flags.print === true) {
    die(
      `a spec skill has no --print: it is worth asking for only because it starts clean, and printing its instructions would have you write the section in the conversation that asked for it. Run \`${program} spec ${name} ${id}\` and it starts on its own.`,
      { kind: 'bad-option' },
    )
  }

  // One skill on one card at a time. A flow that asks while that skill is still working the
  // card would get its section written twice from the same plan, and the second run would
  // land on whatever the first one left — so the ask is dropped, not queued behind it.
  const live = readRuns().find(
    (r) => r.status === 'running' && r.action === 'spec' && r.cardId === id && r.specAgent === name,
  )
  if (live) {
    say(`${name} is already working on #${id} — run ${short(live.sessionId)}. One ask is enough; don't wait for it.`)
    return { specAgent: name, cardId: id, queued: false, pending: true }
  }

  const notes = noteOf(positional.slice(2), flags.notes)
  const req: AgentRequest = { action: 'spec', id, title: titleOf(id), specAgent: name, notes }

  // Asked for from inside a run: written down, not started. A run never starts another, and
  // a skill that ran inside the asking run would read the very conversation it is meant to
  // be free of.
  const inside = insideRun()
  if (inside) {
    // …unless the asking run is itself a spec run (#403). A spec skill answers one part of
    // the card and nothing else, so a skill asking for a skill is either work it was given
    // and should do, or work outside its own part. Refused rather than dropped: a chain that
    // silently went nowhere reads as a board that lost the ask.
    if (readRuns().find((r) => r.sessionId === inside)?.action === 'spec') {
      die(
        `a spec skill does not ask for another spec skill — answer the part you own and leave the rest of the card to the session planning it.`,
        { kind: 'spec-skill-recursion', specAgent: name },
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
        : `asked for the ${name} spec skill on #${id}. The board starts it when this run ends — don't wait for it, and don't write its section yourself.`,
    )
    return { specAgent: name, cardId: id, queued: queued === 'queued', pending: true }
  }

  const started = await startRun(req)
  if ('error' in started) die(started.error, { kind: 'run-refused', action: 'spec' })
  const { run, spawned } = started
  if (!spawned) die(`couldn't start a process to run ${run.sessionId}`, { kind: 'spawn-failed' })
  say(`spec ${name} #${id} — run ${run.sessionId}`)
  say(`  follow it: ${program} log ${short(run.sessionId)} --follow${DIR_FLAG}`)
  say(`  stop it:   ${program} stop ${short(run.sessionId)}${DIR_FLAG}`)
  if (flags.follow === true) return { sessionId: run.sessionId, ...(await followRun(run.sessionId, '', program)) }
  return { sessionId: run.sessionId, action: 'spec', specAgent: name, cardId: id }
}

// What the flow wants looked at. Everything after the id is the note, so it can be typed
// without quoting; `--notes` is the same thing spelled for a caller building a command.
function noteOf(rest: string[], flag: unknown): string | undefined {
  const typed = rest.join(' ').trim()
  if (typed) return typed
  return typeof flag === 'string' && flag.trim() ? flag.trim() : undefined
}
