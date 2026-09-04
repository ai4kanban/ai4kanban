// ---- the recurring folder --------------------------------------------------
//
// `todo/recurring/` holds the jobs that repeat instead of being built once. This module
// owns the one card a fresh board starts with: "Prune the memory".

import fs from 'node:fs'
import path from 'node:path'

import { TODO, readNextId, writeNextId } from './paths'
import { serializeFrontmatter } from './frontmatter'

export const RECURRING = 'recurring'

const PRUNE_SLUG = 'prune-the-memory'
const PRUNE_TITLE = 'Prune the memory'

function pruneBody() {
  return `Squeeze the memory files back down to what helps plan the next task. Delete this
card if you don't want the job — nothing puts it back.

## Run state
None.

## Process
1. Prune the project-wide memory at \`docs/kanban/memory/\` and each module's at
   \`docs/kanban/memory/<module>/\`, following \`akb guide prune-memory\`.
`
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
