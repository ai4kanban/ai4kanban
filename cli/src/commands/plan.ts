// ---- `akb raw plan` — the file one discussion is writing (#427) -------------
//
// One move, about the board's own conversation. `new` takes the next id and names the file;
// the words in it are the agent's to write. Nothing here says when to offer the handoff:
// Discuss stands Start planning, Build now and Not yet under the last reply on its own,
// whenever there is a plan and the conversation is not answering.

import { setChatPlan } from '../lib/agent/chat'
import { say } from '../lib/io'
import { die } from '../lib/paths'
import { newPlan, planPathInText } from '../lib/plans'
import type { MoveResult } from '../lib/types'

export interface PlanOptions {
  title?: string
  slug?: string
}

export function cmdPlan(args: string[], opts: PlanOptions): MoveResult {
  const sub = (args[0] ?? '').trim()
  if (sub === 'new') return planNew(opts)
  die(`\`plan ${sub || '<move>'}\` is not a plan move. Try \`plan new\`.`, {
    kind: 'unknown-move',
    move: `plan ${sub}`,
  })
}

function planNew(opts: PlanOptions): MoveResult {
  const title = (opts.title ?? '').trim()
  if (!title) die('--title must not be empty')
  const plan = newPlan(title, opts.slug)
  const held = setChatPlan(null, plan.path)
  if ('error' in held) die(held.error)
  say(planPathInText(plan.path))
  say(`  #${plan.id} is this plan's — write a short outcome-focused plan and revise it as the discussion moves`)
  return { id: plan.id, file: planPathInText(plan.path), path: plan.path }
}
