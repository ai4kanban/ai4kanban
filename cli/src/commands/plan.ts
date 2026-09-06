// ---- `akb raw plan` — the file one discussion is writing (#427) -------------
//
// Two moves, both about the board's own conversation. `new` takes the next id and names the
// file; the words in it are the agent's to write. `ask` says the outcome is settled, which
// is what stands the two answers under the last message on the Discuss screen.

import { askChatPlan, setChatPlan } from '../lib/agent/chat'
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
  if (sub === 'ask') return planAsk()
  die(`\`plan ${sub || '<move>'}\` is not a plan move. Try \`plan new\` or \`plan ask\`.`, {
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
  say(`  #${plan.id} is this plan's — write the file yourself, 30–50 lines, and rewrite it as the discussion moves`)
  return { id: plan.id, file: planPathInText(plan.path), path: plan.path }
}

function planAsk(): MoveResult {
  const asked = askChatPlan(null)
  if ('error' in asked) die(asked.error)
  say('the discussion now offers Start planning and Not yet under your last message')
  return { path: asked.path }
}
