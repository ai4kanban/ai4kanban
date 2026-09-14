// Which open cards run on one workflow (#715).
//
// Its own file rather than a function on ./workflows.ts: answering it means walking every
// card on the board, and `workflows.ts` is read by the agent roster — a module that walks the
// board to be read would be a board walk on every prompt.

import fs from 'node:fs'
import path from 'node:path'

import { walkMd } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { idPrefix } from '../board/assemble'
import { TODO } from '../paths'
import { deleteWorkflow, DEFAULT_WORKFLOW } from './workflows'

/** The ids of the open cards that run on one workflow, lowest first. A card carrying no
 *  `workflow:` key counts as the default one — which is what every flow reading it does. */
export function cardsOnWorkflow(id: string): number[] {
  const wanted = id || DEFAULT_WORKFLOW
  const ids: number[] = []
  let files: string[]
  try {
    files = walkMd(TODO)
  } catch {
    return []
  }
  for (const file of files) {
    // A group's root is `<id>-<slug>/root.md`, so its id is on the folder rather than on the
    // filename. Everything else carries its own.
    const base = path.basename(file)
    const card = base === 'root.md' ? idPrefix(path.basename(path.dirname(file))) : idPrefix(base)
    if (card === null) continue
    let meta
    try {
      meta = parseFrontmatter(fs.readFileSync(file, 'utf8')).meta
    } catch {
      continue
    }
    if (!meta) continue
    if ((meta.workflow || DEFAULT_WORKFLOW) === wanted) ids.push(card)
  }
  return [...new Set(ids)].sort((a, b) => a - b)
}

/** Drop one of the board's own, refused while an open card still runs on it — a card left
 *  naming a workflow nobody has is a card that cannot start (agent/start.ts). A card's
 *  workflow is fixed once it is created (#744), so the way through is to finish or drop
 *  those cards. The one place that rule lives, so the pane and `akb workflow delete` turn
 *  down the same delete. */
export function removeWorkflow(id: string): { ok: boolean; error?: string; cards?: number[] } {
  const held = cardsOnWorkflow(id)
  if (held.length) {
    return {
      ok: false,
      cards: held,
      error:
        `${held.length} open card${held.length === 1 ? '' : 's'} (${held.map((n) => `#${n}`).join(', ')}) ` +
        `still ${held.length === 1 ? 'runs' : 'run'} on this workflow — finish or drop ${held.length === 1 ? 'it' : 'them'} first.`,
    }
  }
  return deleteWorkflow(id)
}
