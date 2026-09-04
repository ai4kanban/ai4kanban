// ---- release new / release list / release close / release drop ---------------
//
// The commands over docs/kanban/releases.md: add a release to the end of the list, say
// what it is for, read what each one holds, close one when its version ships, and drop one
// the team gives up on. There is no rename and no reorder — the file is a line or two a
// person can edit faster than any command could.

import fs from 'node:fs'

import { die, rel, BOARD_FLAG, RELEASES } from '../lib/paths'
import { say } from '../lib/io'
import { boardCommand } from '../lib/agent/command'
import { insideRun } from '../lib/agent/flow'
import { startCardlessRun } from '../lib/agent/start'
import { short } from './run'
import { NO_RELEASE } from '../lib/validate'
import {
  readReleases,
  readReleaseEntries,
  hasReleaseList,
  addRelease,
  setReleaseGoal,
  countByRelease,
  openCards,
  quoteId,
  closeRelease,
  dropRelease,
  fillRelease,
  writeChangelog,
} from '../lib/releases'
import type { MoveResult } from '../lib/types'

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

/** `akb raw release`, as its subcommands declare them (lib/cli/board.ts). Each one takes
 *  its own few, so this is their union. */
export interface ReleaseOptions {
  goal?: string
  fill?: boolean
  file?: string
  text?: string
}

/** Which of `release`'s words was typed, and what it was given. The subcommand is args[0] —
 *  it is a word the command tree matched, never something to be guessed at here. */
export function cmdRelease(args: string[], opts: ReleaseOptions): MoveResult {
  const [sub, ...rest] = args
  if (sub === 'new') return releaseNew(rest[0]!, opts)
  if (sub === 'goal') return releaseGoalCmd(rest[0]!, rest[1] ?? '')
  if (sub === 'list') return releaseList()
  if (sub === 'close') return releaseClose(rest[0]!)
  if (sub === 'drop') return releaseDrop(rest[0]!)
  if (sub === 'changelog') return releaseChangelog(rest[0]!, opts)
  die(`unknown release command "${String(sub)}".`, { kind: 'unknown-release-command', command: sub })
}

function releaseNew(version: string, opts: ReleaseOptions): MoveResult {
  const fill = opts.fill === true
  const goal = opts.goal ?? ''
  const id = addRelease(version, goal)
  const known = readReleases()
  say(`added release ${id} to ${rel(RELEASES)}`)
  say(`  ship order: ${known.join(' → ')}`)
  // A release with no goal is fine, but nothing else says what the version is for — so the
  // way to say it is printed where it is still one command away.
  if (goal.trim()) say(`  for: ${goal.replace(/\s+/g, ' ').trim()}`)
  else say(`  say what it is for with \`release goal ${quoteId(id)} "..."\``)
  if (!fill) {
    say(`  put a card in it with \`update <id> --release ${quoteId(id)}\``)
    return { release: id, goal: goal.trim(), ship_order: known, filled: [] }
  }
  // --fill: one line per card it moved, and one for every high-priority card it left out,
  // with the test that card failed — nothing is dropped silently.
  const { fill: moved, skipped } = fillRelease(id)
  const answer = { release: id, goal: goal.trim(), ship_order: known, filled: moved, left: skipped }
  if (!moved.length && !skipped.length) {
    say('  no card without a release is high priority — the release starts empty')
    return answer
  }
  for (const card of moved) say(`  in    #${card.id} ${card.title}`)
  for (const card of skipped) say(`  left  #${card.id} ${card.title} — ${card.reason}`)
  return answer
}

// Say what a release is for, or change it later (#164). The goal is one line on disk
// whatever is typed, and an empty one clears it — a release with no goal is a state the
// board works over, so unsaying it has to be possible too.
function releaseGoalCmd(id: string, text: string): MoveResult {
  const { goal } = setReleaseGoal(id, text)
  if (goal) say(`${id} is for: ${goal}`)
  else say(`${id} now says what it is for nowhere — its goal is cleared`)
  say(`  ${rel(RELEASES)}`)
  return { release: id, goal }
}

function releaseClose(version: string): MoveResult {
  const { id, shipped, left, summary, remaining } = closeRelease(version)
  say(`closed release ${id} — its line is off ${rel(RELEASES)}`)
  say(`  shipped      ${plural(shipped.length, 'card')}${shipped.length ? `: ${shipped.map((c) => `#${c.id}`).join(', ')}` : ''}`)
  say(
    `  no release   ${plural(left.length, 'card')} still open${left.length ? `: ${left.map((c) => `#${c.id}`).join(', ')}` : ''}`,
  )
  say(`  summary      ${rel(summary)}`)
  say(`  ship order: ${remaining.join(' → ') || '(no releases left)'}`)
  // A card with every box ticked looks shipped but never was — and the close can't be run
  // again to pick it up, so it's named here while the user can still act on it.
  const looksDone = left.filter((c) => c.done)
  if (looksDone.length) {
    say('')
    say(`${plural(looksDone.length, 'card')} had every todo ticked but was never archived, so it counts as not shipped:`)
    for (const card of looksDone) say(`  #${card.id} ${card.title}`)
    say(`  archive the ones that really shipped, then move their line by hand in ${rel(summary)}`)
  }
  // The summary says which cards shipped, not what changed — so the close starts the run
  // that writes that, the same way the board UI's close does. It is the one `akb raw ...`
  // command that starts a run, because the changelog has no other moment: nobody reads a
  // list of card ids, and a step the user has to remember is a step nobody takes.
  say('')
  if (!shipped.length) {
    say('nothing shipped, so there is no changelog to write.')
    return { release: id, shipped, left, summary: rel(summary), ship_order: remaining }
  }
  const changelog = startChangelog(id)
  return { release: id, shipped, left, summary: rel(summary), ship_order: remaining, changelog }
}

/** Start the run that writes the closed version's changelog, and say what happened.
 *
 *  Inside a run nothing is started — a run never starts another — so the command is named
 *  instead, exactly as it used to be. Same when the run refuses or the process won't spawn:
 *  the close itself is already written and can't be run again, so the fallback is always a
 *  command the user can type. */
function startChangelog(id: string): { sessionId?: string; command?: string } {
  const program = boardCommand()
  const command = `${program} release changelog ${quoteId(id)}`
  const byHand = (why: string) => {
    say(`the summary says which cards shipped, not what changed for the user — ${why}.`)
    say(`  write it with \`${command}\` — an agent reads this section and puts a changelog at the top of it.`)
    return { command }
  }
  const inside = insideRun()
  if (inside) return byHand('a run never starts another')
  const started = startCardlessRun({ action: 'changelog', release: id })
  if ('error' in started) return byHand(started.error)
  if (!started.spawned) return byHand(`couldn't start a process to run ${started.run.sessionId}`)
  const run = short(started.run.sessionId)
  say(`writing the changelog — run ${started.run.sessionId}`)
  say(`  an agent reads this section and puts a few plain lines at the top of it, saying what the version changed.`)
  say(`  follow it: ${program} run log ${run} --follow${BOARD_FLAG}`)
  say(`  stop it:   ${program} run stop ${run}${BOARD_FLAG}`)
  return { sessionId: started.run.sessionId }
}

// ---- release changelog -------------------------------------------------------
//
// The one door the changelog run writes through. It is a move rather than an instruction
// because "at the top of the newest section, once" has to be true, not asked for: this
// splices the lines under their own heading and leaves every other byte of the file alone.
// Run it again and the changelog is REPLACED, so a version taken through it twice carries
// one changelog, not two.

function releaseChangelog(id: string, opts: ReleaseOptions): MoveResult {
  if (opts.file !== undefined && opts.text !== undefined) die('pass --file or --text, not both')
  let raw: string
  if (opts.file !== undefined) {
    try {
      raw = fs.readFileSync(opts.file, 'utf8')
    } catch {
      die(`can't read ${opts.file} — write the changelog to a file, then pass its path`)
    }
  } else if (opts.text !== undefined) {
    raw = opts.text
  } else {
    die('the changelog has to come from somewhere: --file <path>, or --text ".." for a one-liner')
  }
  const { file, lines, replaced } = writeChangelog(id, raw!)
  say(`${replaced ? 'rewrote' : 'wrote'} the changelog for ${id} (${file})`)
  for (const line of lines) say(`  ${line}`)
  return { release: id, file, lines, replaced }
}

function releaseDrop(version: string): MoveResult {
  const { id, archived, left, remaining } = dropRelease(version)
  say(`dropped release ${id} — its line is off ${rel(RELEASES)}; nothing shipped`)
  say(
    `  archived under it  ${plural(archived.length, 'card')}${archived.length ? `: ${archived.map((c) => `#${c.id}`).join(', ')}` : ''}`,
  )
  say(
    `  no release         ${plural(left.length, 'card')} still open${left.length ? `: ${left.map((c) => `#${c.id}`).join(', ')}` : ''}`,
  )
  say(`  ship order: ${remaining.join(' → ') || '(no releases left)'}`)
  return { release: id, archived, left, ship_order: remaining }
}

function releaseList(): MoveResult {
  const entries = readReleaseEntries()
  const known = entries.map((e) => e.id)
  const counts = countByRelease()
  // The cards in no release are counted too, as a trailing `(no release)` row — they are
  // the pool a fill or a top-up draws from, so the list says how big it is.
  const rows = entries.map((e) => ({ id: e.id, label: e.id, goal: e.goal, ...(counts.get(e.id) || { cards: 0, ready: 0 }) }))
  rows.push({ id: NO_RELEASE, label: '(no release)', goal: '', ...(counts.get(NO_RELEASE) || { cards: 0, ready: 0 }) })
  const width = Math.max(...rows.map((r) => r.label.length))

  if (!hasReleaseList()) {
    say(`no releases yet — \`release new v1\` makes the first one (writes ${rel(RELEASES)}).`)
  } else if (!known.length) {
    say(`no releases on the list in ${rel(RELEASES)} — \`release new v1\` adds one.`)
  } else {
    say(`releases in ${rel(RELEASES)}, in ship order:`)
  }
  for (const r of rows) {
    say(`  ${r.label.padEnd(width)}  ${plural(r.cards, 'card')}, ${r.ready} ready`)
    // What the version is for, under the counts — a release made before goals existed, or
    // made without one, simply has no second line.
    if (r.goal) say(`  ${' '.repeat(width)}  ${r.goal}`)
  }

  // A card may name a release the list doesn't have — after a hand edit, or on a board
  // that carried the field before the list existed. Naming those ids is the whole repair
  // path: add the release, or move the cards.
  const strays = new Map<string, number[]>()
  for (const card of openCards()) {
    if (card.release === NO_RELEASE || known.includes(card.release)) continue
    strays.set(card.release, [...(strays.get(card.release) || []), card.id])
  }
  if (strays.size) {
    say('')
    say('cards naming a release that is not on the list:')
    for (const [id, ids] of strays) {
      say(`  ${id} — ${ids.map((n) => `#${n}`).join(', ')}`)
    }
    const [first] = strays.keys() as unknown as [string]
    say(
      `  put it back with \`release new ${quoteId(first)}\`, or move the cards with \`update <id> --release <known>\``,
    )
  }
  return {
    releases: rows.filter((r) => r.id !== NO_RELEASE).map((r) => ({ id: r.id, goal: r.goal, cards: r.cards, ready: r.ready })),
    no_release: { cards: counts.get(NO_RELEASE)?.cards || 0, ready: counts.get(NO_RELEASE)?.ready || 0 },
    strays: [...strays].map(([id, ids]) => ({ release: id, cards: ids })),
  }
}
