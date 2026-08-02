// ---- the recurring folder --------------------------------------------------
//
// `todo/recurring/` holds the jobs that repeat instead of being built once. This module
// owns the one card a fresh board starts with: "Prune the memory".

import fs from 'node:fs'
import path from 'node:path'

import { TODO, readNextId, writeNextId } from './paths.mjs'
import { serializeFrontmatter } from './frontmatter.mjs'

export const RECURRING = 'recurring'

const PRUNE_SLUG = 'prune-the-memory'
const PRUNE_TITLE = 'Prune the memory'

function pruneBody(id) {
  return `Squeeze the memory files back down to what helps plan the next task. Memory grows
every time a task finishes, and a memory nobody reads is one that stops catching a
repeated proposal or a design mistake we already made.

This card has no cadence, so it runs only when you run it. Give it one to have it prune on
its own — the skill's \`references/recurring-task.md\` says how. Don't want the job at all?
Delete this card. Nothing puts it back.

## Process
- [agent] Prune every memory set — the project-wide one at \`docs/kanban/memory/\` and each
  module's at \`docs/kanban/memory/<module>/\` — following the skill's
  \`references/prune-memory.md\`.

## Runs
What a run still needed a human for goes in \`recurring/${id}-${PRUNE_SLUG}/runs/\`, beside
this card. Nothing there yet — the first run that has to ask something creates it.
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
    track: RECURRING,
    priority: 'med',
    roi: 'med',
    status: 'todo',
    release: '',
    blocked_by: [],
    related: [],
    modules: [],
    questions: [],
  }
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n\n' + pruneBody(id))
  return { id, file }
}
