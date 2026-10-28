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
import { deleteAgent } from '../agents/roster'
import { die } from '../paths'
import type { Meta } from '../types'
import { heldByDelivery } from './deliveries'
import { readRuns, runIsLive } from './store'
import { deleteWorkflow, DEFAULT_WORKFLOW, knownWorkflow, workflowOwnAgents } from './workflows'

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

/** Move card `id` to workflow `asked` (`""` is the default) by editing `meta` in place; the
 *  caller writes it. Refused while a run or a delivery is on the card (#1849). A switch drops
 *  the old workflow's plan: back to `todo`, its previews cleared, a refine scheduled. Shared by
 *  `akb raw update --workflow` and the card page. Answers whether anything changed. */
export function switchWorkflow(id: number, meta: Meta, asked: string): boolean {
  const wanted = asked.trim()
  const next = !wanted || wanted === DEFAULT_WORKFLOW ? '' : knownWorkflow(wanted)
  if (next === meta.workflow) return false
  if (readRuns().some((r) => r.cardId === id && runIsLive(r))) {
    die(`#${id} has a run in progress — stop it before switching its workflow.`, { kind: 'card-held', id })
  }
  const held = heldByDelivery(id)
  if (held) die(held, { kind: 'card-held', id })
  meta.workflow = next
  meta.status = 'todo'
  delete meta.previews
  meta.stages = 0
  meta.phase = 0
  meta.schedule = { action: 'refine', notes: '' }
  return true
}

/** Drop one of the board's own, with the agents it owns (#1248), refused while an open card
 *  still runs on it — a card left naming a workflow nobody has is a card that cannot start
 *  (agent/start.ts). The one place that rule lives, so the pane and `akb workflow delete`
 *  turn down the same delete.
 *
 *  An agent that fails to go leaves the workflow deleted and is named in `failed`. */
export function removeWorkflow(id: string): {
  ok: boolean
  error?: string
  cards?: number[]
  agents?: string[]
  failed?: string[]
} {
  const held = cardsOnWorkflow(id)
  if (held.length) {
    return {
      ok: false,
      cards: held,
      error:
        `${held.length} open card${held.length === 1 ? '' : 's'} (${held.map((n) => `#${n}`).join(', ')}) ` +
        `still ${held.length === 1 ? 'runs' : 'run'} on this workflow — move ${held.length === 1 ? 'it' : 'them'} to another one first.`,
    }
  }
  // Read before the workflow goes: ownership goes with it.
  const own = workflowOwnAgents(id)
  const res = deleteWorkflow(id)
  if (!res.ok) return res
  const agents: string[] = []
  const failed: string[] = []
  for (const name of own) (deleteAgent(name).ok ? agents : failed).push(name)
  return { ok: true, agents, ...(failed.length ? { failed } : {}) }
}
