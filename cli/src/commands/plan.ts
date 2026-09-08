// ---- `akb raw plan` — the file one discussion is writing (#427) -------------
//
// One move. `new` takes the next id and names the file; the words in it are the agent's to
// write. Nothing here says when to offer the handoff: Discuss stands Start planning, Build
// now and Not yet under the last reply on its own, whenever there is a plan and the
// conversation is not answering.
//
// Which discussion it lands on is read off the environment (#496), never spelled: a chat turn
// puts the discussion it is answering on the agent it spawns, so two discussions planning at
// once each get their own file and the agent can never stamp the wrong one.

import { setChatPlan } from '../lib/agent/chat'
import { insideDiscussion } from '../lib/agent/env'
import { asDiscussion } from '../lib/agent/discussions'
import { say } from '../lib/io'
import { die } from '../lib/paths'
import { newPlan, planPathInText } from '../lib/plans'
import type { ChatTarget } from '../lib/agent/types'
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
  // The title names the discussion too: it is what the agent called this subject once it had
  // read the exchange, which is a better row than the line the user opened on.
  const held = setChatPlan(discussionHere(), plan.path, title)
  if ('error' in held) die(held.error)
  say(planPathInText(plan.path))
  say(`  #${plan.id} is this plan's — write a short outcome-focused plan and revise it as the discussion moves`)
  return { id: plan.id, file: planPathInText(plan.path), path: plan.path }
}

/** The discussion this plan belongs to. Outside a chat turn — a terminal, a run — there is
 *  none, and the plan lands on the board's own conversation the way it always did. */
function discussionHere(): ChatTarget {
  const id = insideDiscussion()
  return (id ? asDiscussion(id) : null) ?? null
}
