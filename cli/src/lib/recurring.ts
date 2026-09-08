// ---- the recurring folder --------------------------------------------------
//
// `todo/recurring/` holds the jobs that repeat instead of being built once. This module
// owns the one card a fresh board starts with: "Prune the memory".

import fs from 'node:fs'
import path from 'node:path'

import { TODO, boardText, readNextId, writeNextId } from './paths'
import { serializeFrontmatter } from './frontmatter'

export const RECURRING = 'recurring'

const PRUNE_SLUG = 'prune-the-memory'
const PRUNE_TITLE = 'Prune the memory'

// `boardText` because this card names its own board's folders, and a board away from
// `docs/kanban` would otherwise send the job at the OTHER board's memory (#407).
function pruneBody() {
  return boardText(`Squeeze the memory files back down to what helps plan the next task. Delete this
card if you don't want the job — nothing puts it back.

## Run state
None.

## Process
1. Prune the project-wide memory at \`docs/kanban/memory/\` and each module's at
   \`docs/kanban/memory/<module>/\`, following \`akb guide prune-memory\`.
`)
}

/**
 * Seed the "Prune the memory" card on a fresh board, and make the folder it lives in.
 *
 * Only the fresh scaffold calls this — never `init`'s repair pass. Deleting the card is
 * how a board says it doesn't want the job, and that has to stick: a repair that re-added
 * it would undo the user's opt-out every time they re-ran `init`. A board made before this
 * card existed keeps its memory the way it always has, by hand.
 *
 * Not counted in `metrics.csv`: like the setup questions card, it's board furniture, not
 * work anybody planned. Not indexed in the README either — recurring cards never are.
 *
 * Returns `{ id, file }`, or `null` when the file is somehow already there.
 */
export function writePruneMemoryCard() {
  const dir = path.join(TODO, RECURRING)
  fs.mkdirSync(dir, { recursive: true })
  const id = readNextId()
  const file = path.join(dir, `${id}-${PRUNE_SLUG}.md`)
  if (fs.existsSync(file)) return null
  writeNextId(id + 1)
  const meta = {
    title: PRUNE_TITLE,
    priority: 'med',
    roi: 'med',
    status: 'todo',
    release: '',
    blocked_by: [],
    related: [],
    modules: [],
    questions: [],
  }
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n\n' + pruneBody())
  return { id, file }
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
 * It ships with no cadence, so nothing runs on its own until someone sets one — the same
 * bargain "Prune the memory" makes.
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
