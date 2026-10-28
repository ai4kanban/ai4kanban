// Approve (#1790, #2154): the user accepts the current stage's previews. Before the last stage
// the board moves the card to the next one, and planning makes its previews; on the last, the
// card is built and landed when its workflow lands anything, and archived when it does not.

import fs from 'node:fs'
import path from 'node:path'

import { locate } from '../cards'
import { parseFrontmatter, serializeFrontmatter } from '../frontmatter'
import { findCard } from '../view/read'
import { awaitingApproval, openOf } from '../view/rules'
import { readRuns } from './store'
import { holdsCard } from './types'
import type { AgentRequest, CommandRequest } from './types'
import { archivesOnApproval, workflowFor } from './workflows'

/** The run an Approve starts, or why the card is not waiting on one. Writes nothing:
 *  `advancePhase` moves the card once an `approve` run is cleared to start. */
export function approvalRequest(req: CommandRequest): AgentRequest | { error: string } {
  const id = req.id
  const card = id === undefined ? null : findCard(id)
  if (!card) return { error: `task #${id} does not exist` }
  if (openOf(card.questions).length) return { error: `#${card.id} has open questions — answer them before approving it.` }
  if (readRuns().some((r) => r.status === 'running' && r.cardId === card.id && holdsCard(r.action))) {
    return { error: `#${card.id} has a run in flight — approve once it ends.` }
  }
  const ask = { id: card.id, title: card.title, notes: req.notes }
  if (awaitingApproval(card)) return { action: 'approve', ...ask }
  if (card.stages && card.stage! < card.stages) return { error: `#${card.id} is still planning stage ${card.stage} — approve it once its previews are ready.` }
  return archivesOnApproval(workflowFor(card.workflow)) ? { action: 'archive', ...ask } : { action: 'implement', ...ask }
}

/** Move the card one stage on, or say why it no longer waits on Approve. */
export function advancePhase(id: number): { error: string } | null {
  const card = findCard(id)
  const found = locate(id)
  if (!card || !found || !awaitingApproval(card)) return { error: `#${id} is no longer waiting on approval.` }
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) return { error: `#${id} has no frontmatter` }
  meta.phase = card.stage! + 1
  // The next stage is planned afresh.
  meta.status = 'todo'
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n' + body)
  return null
}
