// ---- the recurring folder --------------------------------------------------
//
// `todo/recurring/` holds the jobs that repeat instead of being built once. This module
// owns the cards the board seeds into it, and the one it takes back out.

import fs from 'node:fs'
import path from 'node:path'

import { adoptMemoryPruneCadence } from './agent/settings'
import { parseFrontmatter, serializeFrontmatter } from './frontmatter'
import { TODO, boardText, readNextId, rel, writeNextId } from './paths'

export const RECURRING = 'recurring'

const PRUNE_SLUG = 'prune-the-memory'

/**
 * Take the old "Prune the memory" card off a board, once (#514).
 *
 * Pruning is an agent now, not a card: it is started from Configuration → Agents → Memory
 * pruner and repeats on the cadence set there. A board upgrading into that would otherwise
 * carry two prune schedules — the card's and the agent's — so the card goes, and whatever
 * cadence it carried is kept as a preference beside the agent.
 *
 * The preference is never switched on. A pass rewrites every memory file, and a job that
 * started itself the day a board upgraded is not one anybody chose.
 *
 * Returns the file it removed, or null when this board has no such card — which is also
 * what every run after the first one answers.
 */
export function migratePruneMemoryCard(): string | null {
  const dir = path.join(TODO, RECURRING)
  let names: string[]
  try {
    names = fs.readdirSync(dir)
  } catch {
    return null // no recurring folder — nothing was ever seeded here
  }
  const name = names.find((entry) => entry.endsWith(`-${PRUNE_SLUG}.md`))
  if (!name) return null
  const file = path.join(dir, name)
  try {
    const { meta } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
    if (meta?.cadence) adoptMemoryPruneCadence(String(meta.cadence))
  } catch {
    // an unreadable card still goes: what is being removed is the job, not the file's words
  }
  fs.rmSync(file, { force: true })
  return rel(file)
}

// ---- the inbox pull (#453) -------------------------------------------------

const SIGNALS_SLUG = 'fill-the-inbox'
const SIGNALS_TITLE = 'Fill the inbox'

function signalsBody() {
  return boardText(`Pull what the board is pointed at into
\`docs/kanban/triage/inbox/\`. Set a cadence to have it run on its own; without one it runs
only when you run it. Delete this card if you don't want the job — nothing puts it back.

## Run state
None.

## Process
1. Run \`akb signals fetch\`.
`)
}

/**
 * Seed the "Fill the inbox" card, the first time a pull lands.
 *
 * Not part of `init`'s scaffold: the inbox itself is made by the first fetch, and a board
 * that never pulls should carry neither the folder nor a card about it. The caller
 * only asks on the pull that MAKES the inbox, so deleting the card sticks — that is how a
 * board says it doesn't want the job.
 *
 * It ships with no cadence, so nothing runs on its own until someone sets one.
 *
 * Returns `{ id, file }`, or `null` when the folder already holds one.
 */
export function writeSignalsFetchCard() {
  const dir = path.join(TODO, RECURRING)
  fs.mkdirSync(dir, { recursive: true })
  if (fs.readdirSync(dir).some((name) => name.endsWith(`-${SIGNALS_SLUG}.md`))) return null
  const id = readNextId()
  writeNextId(id + 1)
  const file = path.join(dir, `${id}-${SIGNALS_SLUG}.md`)
  const meta = {
    title: SIGNALS_TITLE,
    priority: 'med',
    roi: 'med',
    status: 'todo',
    release: '',
    blocked_by: [],
    related: [],
    modules: [],
    questions: [],
  }
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n\n' + signalsBody())
  return { id, file }
}
