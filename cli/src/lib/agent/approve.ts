// Approve (#1790): the user accepts the current stage's draft. The board moves the card to its
// next stage, and the workflow's plan lead makes that stage.

import fs from 'node:fs'
import path from 'node:path'

import { locate } from '../cards'
import { parseFrontmatter, serializeFrontmatter } from '../frontmatter'
import { findCard } from '../view/read'
import { awaitingApproval } from '../view/rules'
import { readRuns } from './store'
import { holdsCard } from './types'
import type { AgentRequest, CommandRequest } from './types'

/** The run an Approve starts, or why the card is not waiting on one. Writes nothing:
 *  `advancePhase` moves the card once the run is cleared to start. */
export function approvalRequest(req: CommandRequest): AgentRequest | { error: string } {
  const id = req.id
  const card = id === undefined ? null : findCard(id)
  if (!card) return { error: `task #${id} does not exist` }
  const stage = awaitingApproval(card)
  if (!stage) {
    return {
      error: !card.phases
        ? `#${card.id} has no stages, so there is nothing to approve.`
        : card.phase === card.phases.length
          ? `#${card.id} is on its last stage — archive it once it is delivered.`
          : `#${card.id} has open questions — answer them before approving the stage.`,
    }
  }
  if (readRuns().some((r) => r.status === 'running' && r.cardId === card.id && holdsCard(r.action))) {
    return { error: `#${card.id} has a run in flight — approve once it ends.` }
  }
  return { action: 'approve', id: card.id, title: card.title, notes: req.notes }
}

/** Move the card one stage on, or say why it no longer waits on Approve. */
export function advancePhase(id: number): { error: string } | null {
  const card = findCard(id)
  const found = locate(id)
  if (!card || !found || !awaitingApproval(card)) return { error: `#${id} is no longer waiting on approval.` }
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) return { error: `#${id} has no frontmatter` }
  meta.phase = card.phase! + 1
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n' + body)
  return null
}
