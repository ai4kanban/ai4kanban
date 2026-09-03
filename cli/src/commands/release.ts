// ---- release new / release list / release close / release drop ---------------
//
// The commands over docs/kanban/releases.md: add a release to the end of the list, say
// what it is for, read what each one holds, close one when its version ships, and drop one
// the team gives up on. There is no rename and no reorder — the file is a line or two a
// person can edit faster than any command could.

import fs from 'node:fs'

import { die, rel, DIR_FLAG, RELEASES } from '../lib/paths'
import { say } from '../lib/io'
import { boardCommand } from '../lib/agent/command'
import { insideRun } from '../lib/agent/flow'
import { startCardlessRun } from '../lib/agent/start'
import { short } from './run'
import { NO_RELEASE, parseFlags } from '../lib/validate'
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

const USAGE = `usage:
  release new <id> [--goal ".."] [--fill]
                             add a release to the end of the list (e.g. \`release new v1\`);
                             --goal says what the version is for; --fill puts the
                             high-priority cards with no release in as it is made
  release goal <id> "..."    change what a release is for ("" clears it)
  release list               the releases in ship order, with what each one holds
  release close <id>         the version shipped: write the summary, clear the release off the rest
  release drop <id>          the version will not ship: take it off the list with no shipped
                             record, clear the release off its open cards
  release changelog <id>     put a changelog at the top of that version's newest closed
                             section: --file <path>, or --text ".." for a one-liner`

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

export function cmdRelease(args: string[]): MoveResult {
  const [sub, ...rest] = args
  if (sub === 'new') return releaseNew(rest)
  if (sub === 'goal') return releaseGoalCmd(rest)
  if (sub === 'list') return releaseList()
  if (sub === 'close') return releaseClose(rest)
  if (sub === 'drop') return releaseDrop(rest)
  if (sub === 'changelog') return releaseChangelog(rest)
  // The usage block is the whole message here, so it is printed as it stands — putting
  // the command in front of a block of lines would only bury the first one.
  if (sub === undefined) die(USAGE, { kind: 'usage', bare: true })
  die(`unknown release command "${sub}".\n${USAGE}`, { kind: 'unknown-release-command', command: sub })
}

function releaseNew(rest: string[]): MoveResult {
  const fill = rest.includes('--fill')
  // --goal takes the next word as the goal; everything left over is the version id.
  let goal = ''
  const ids: string[] = []
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--fill') continue
    if (rest[i] === '--goal') {
      if (i + 1 >= rest.length) die('--goal needs the goal after it, e.g. `release new v1 --goal "..."`')
      goal = rest[++i]!
      continue
    }
    ids.push(rest[i]!)
  }
  if (ids.length > 1) die(`release new takes one version id (got "${ids.join(' ')}") — quote it if it has spaces`)
  const id = addRelease(ids[0], goal)
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
function releaseGoalCmd(rest: string[]): MoveResult {
  const [id, ...words] = rest
  if (!id) die('release goal needs a version id and the goal, e.g. `release goal v1 "the first version worth showing someone"`')
  if (!words.length) {
    die(
      `release goal needs the goal after the version id, e.g. \`release goal ${quoteId(id)} "..."\` — ` +
        `\`release goal ${quoteId(id)} ""\` clears it.`,
    )
  }
  if (words.length > 1) die(`release goal takes one goal (got ${words.length} words) — quote it: \`release goal ${quoteId(id)} "..."\``)
  const { goal } = setReleaseGoal(id, words[0])
  if (goal) say(`${id} is for: ${goal}`)
  else say(`${id} now says what it is for nowhere — its goal is cleared`)
  say(`  ${rel(RELEASES)}`)
  return { release: id, goal }
}

function releaseClose(rest: string[]): MoveResult {
  if (rest.length > 1) die(`release close takes one version id (got "${rest.join(' ')}") — quote it if it has spaces`)
  const { id, shipped, left, summary, remaining } = closeRelease(rest[0])
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
  // that writes that, the same way the board UI's close does. It is the one `akb board ...`
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
  const command = `${program} changelog ${quoteId(id)}`
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
  say(`  follow it: ${program} log ${run} --follow${DIR_FLAG}`)
  say(`  stop it:   ${program} stop ${run}${DIR_FLAG}`)
  return { sessionId: started.run.sessionId }
}

// ---- release changelog -------------------------------------------------------
//
// The one door the changelog run writes through. It is a move rather than an instruction
// because "at the top of the newest section, once" has to be true, not asked for: this
// splices the lines under their own heading and leaves every other byte of the file alone.
// Run it again and the changelog is REPLACED, so a version taken through it twice carries
// one changelog, not two.

function releaseChangelog(rest: string[]): MoveResult {
  const { flags, positional } = parseFlags(rest, ['file', 'text'])
  const id = String(positional[0] ?? '').trim()
  if (!id) die('release changelog needs a version id, e.g. `release changelog v1 --file changelog.md`')
  if (positional.length > 1) {
    die(`release changelog takes one version id (got "${positional.join(' ')}") — quote it if it has spaces`)
  }
  if (flags.file !== undefined && flags.text !== undefined) die('pass --file or --text, not both')
  let raw: string
  if (flags.file !== undefined) {
    if (flags.file === true) die('--file needs a path after it')
    try {
      raw = fs.readFileSync(String(flags.file), 'utf8')
    } catch {
      die(`can't read ${String(flags.file)} — write the changelog to a file, then pass its path`)
    }
  } else if (flags.text !== undefined) {
    raw = flags.text === true ? '' : String(flags.text)
  } else {
    die('the changelog has to come from somewhere: --file <path>, or --text ".." for a one-liner')
  }
  const { file, lines, replaced } = writeChangelog(id, raw!)
  say(`${replaced ? 'rewrote' : 'wrote'} the changelog for ${id} (${file})`)
  for (const line of lines) say(`  ${line}`)
  return { release: id, file, lines, replaced }
}

function releaseDrop(rest: string[]): MoveResult {
  if (rest.length > 1) die(`release drop takes one version id (got "${rest.join(' ')}") — quote it if it has spaces`)
  const { id, archived, left, remaining } = dropRelease(rest[0])
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
