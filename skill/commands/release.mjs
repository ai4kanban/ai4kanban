// ---- release new / release list / release close / release drop ---------------
//
// The commands over docs/kanban/releases.md: add a release to the end of the list, say
// what it is for, read what each one holds, close one when its version ships, and drop one
// the team gives up on. There is no rename and no reorder — the file is a line or two a
// person can edit faster than any command could.

import { die, rel, RELEASES } from '../lib/paths.mjs'
import { NO_RELEASE } from '../lib/validate.mjs'
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
} from '../lib/releases.mjs'

const USAGE = `usage:
  release new <id> [--goal ".."] [--fill]
                             add a release to the end of the list (e.g. \`release new v1\`);
                             --goal says what the version is for; --fill puts the
                             high-priority cards with no release in as it is made
  release goal <id> "..."    change what a release is for ("" clears it)
  release list               the releases in ship order, with what each one holds
  release close <id>         the version shipped: write the summary, clear the release off the rest
  release drop <id>          the version will not ship: take it off the list with no shipped
                             record, clear the release off its open cards`

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

export function cmdRelease(args) {
  const [sub, ...rest] = args
  if (sub === 'new') return releaseNew(rest)
  if (sub === 'goal') return releaseGoalCmd(rest)
  if (sub === 'list') return releaseList()
  if (sub === 'close') return releaseClose(rest)
  if (sub === 'drop') return releaseDrop(rest)
  if (sub === undefined) {
    console.error(USAGE)
    process.exit(1)
  }
  die(`unknown release command "${sub}".\n${USAGE}`)
}

function releaseNew(rest) {
  const fill = rest.includes('--fill')
  // --goal takes the next word as the goal; everything left over is the version id.
  let goal = ''
  const ids = []
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--fill') continue
    if (rest[i] === '--goal') {
      if (i + 1 >= rest.length) die('--goal needs the goal after it, e.g. `release new v1 --goal "..."`')
      goal = rest[++i]
      continue
    }
    ids.push(rest[i])
  }
  if (ids.length > 1) die(`release new takes one version id (got "${ids.join(' ')}") — quote it if it has spaces`)
  const id = addRelease(ids[0], goal)
  const known = readReleases()
  console.log(`added release ${id} to ${rel(RELEASES)}`)
  console.log(`  ship order: ${known.join(' → ')}`)
  // A release with no goal is fine, but nothing else says what the version is for — so the
  // way to say it is printed where it is still one command away.
  if (goal.trim()) console.log(`  for: ${goal.replace(/\s+/g, ' ').trim()}`)
  else console.log(`  say what it is for with \`release goal ${quoteId(id)} "..."\``)
  if (!fill) {
    console.log(`  put a card in it with \`update <id> --release ${quoteId(id)}\``)
    return
  }
  // --fill: one line per card it moved, and one for every high-priority card it left out,
  // with the test that card failed — nothing is dropped silently.
  const { fill: moved, skipped } = fillRelease(id)
  if (!moved.length && !skipped.length) {
    console.log('  no card without a release is high priority — the release starts empty')
    return
  }
  for (const card of moved) console.log(`  in    #${card.id} ${card.title}`)
  for (const card of skipped) console.log(`  left  #${card.id} ${card.title} — ${card.reason}`)
}

// Say what a release is for, or change it later (#164). The goal is one line on disk
// whatever is typed, and an empty one clears it — a release with no goal is a state the
// board works over, so unsaying it has to be possible too.
function releaseGoalCmd(rest) {
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
  if (goal) console.log(`${id} is for: ${goal}`)
  else console.log(`${id} now says what it is for nowhere — its goal is cleared`)
  console.log(`  ${rel(RELEASES)}`)
}

function releaseClose(rest) {
  if (rest.length > 1) die(`release close takes one version id (got "${rest.join(' ')}") — quote it if it has spaces`)
  const { id, shipped, left, summary, remaining } = closeRelease(rest[0])
  console.log(`closed release ${id} — its line is off ${rel(RELEASES)}`)
  console.log(`  shipped      ${plural(shipped.length, 'card')}${shipped.length ? `: ${shipped.map((c) => `#${c.id}`).join(', ')}` : ''}`)
  console.log(
    `  no release   ${plural(left.length, 'card')} still open${left.length ? `: ${left.map((c) => `#${c.id}`).join(', ')}` : ''}`,
  )
  console.log(`  summary      ${rel(summary)}`)
  console.log(`  ship order: ${remaining.join(' → ') || '(no releases left)'}`)
  // A card with every box ticked looks shipped but never was — and the close can't be run
  // again to pick it up, so it's named here while the user can still act on it.
  const looksDone = left.filter((c) => c.done)
  if (looksDone.length) {
    console.log('')
    console.log(`${plural(looksDone.length, 'card')} had every todo ticked but was never archived, so it counts as not shipped:`)
    for (const card of looksDone) console.log(`  #${card.id} ${card.title}`)
    console.log(`  archive the ones that really shipped, then move their line by hand in ${rel(summary)}`)
  }
}

function releaseDrop(rest) {
  if (rest.length > 1) die(`release drop takes one version id (got "${rest.join(' ')}") — quote it if it has spaces`)
  const { id, archived, left, remaining } = dropRelease(rest[0])
  console.log(`dropped release ${id} — its line is off ${rel(RELEASES)}; nothing shipped`)
  console.log(
    `  archived under it  ${plural(archived.length, 'card')}${archived.length ? `: ${archived.map((c) => `#${c.id}`).join(', ')}` : ''}`,
  )
  console.log(
    `  no release         ${plural(left.length, 'card')} still open${left.length ? `: ${left.map((c) => `#${c.id}`).join(', ')}` : ''}`,
  )
  console.log(`  ship order: ${remaining.join(' → ') || '(no releases left)'}`)
}

function releaseList() {
  const entries = readReleaseEntries()
  const known = entries.map((e) => e.id)
  const counts = countByRelease()
  // The cards in no release are counted too, as a trailing `(no release)` row — they are
  // the pool a fill or a top-up draws from, so the list says how big it is.
  const rows = entries.map((e) => ({ id: e.id, label: e.id, goal: e.goal, ...(counts.get(e.id) || { cards: 0, ready: 0 }) }))
  rows.push({ id: NO_RELEASE, label: '(no release)', goal: '', ...(counts.get(NO_RELEASE) || { cards: 0, ready: 0 }) })
  const width = Math.max(...rows.map((r) => r.label.length))

  if (!hasReleaseList()) {
    console.log(`no releases yet — \`release new v1\` makes the first one (writes ${rel(RELEASES)}).`)
  } else if (!known.length) {
    console.log(`no releases on the list in ${rel(RELEASES)} — \`release new v1\` adds one.`)
  } else {
    console.log(`releases in ${rel(RELEASES)}, in ship order:`)
  }
  for (const r of rows) {
    console.log(`  ${r.label.padEnd(width)}  ${plural(r.cards, 'card')}, ${r.ready} ready`)
    // What the version is for, under the counts — a release made before goals existed, or
    // made without one, simply has no second line.
    if (r.goal) console.log(`  ${' '.repeat(width)}  ${r.goal}`)
  }

  // A card may name a release the list doesn't have — after a hand edit, or on a board
  // that carried the field before the list existed. Naming those ids is the whole repair
  // path: add the release, or move the cards.
  const strays = new Map()
  for (const card of openCards()) {
    if (card.release === NO_RELEASE || known.includes(card.release)) continue
    strays.set(card.release, [...(strays.get(card.release) || []), card.id])
  }
  if (strays.size) {
    console.log('')
    console.log('cards naming a release that is not on the list:')
    for (const [id, ids] of strays) {
      console.log(`  ${id} — ${ids.map((n) => `#${n}`).join(', ')}`)
    }
    const [first] = strays.keys()
    console.log(
      `  put it back with \`release new ${quoteId(first)}\`, or move the cards with \`update <id> --release <known>\``,
    )
  }
}
