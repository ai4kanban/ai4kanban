import fs from 'node:fs'

import { insideDiscussion } from '../lib/agent/env'
import { asDiscussion } from '../lib/agent/discussions'
import { savePlan } from '../lib/agent/save-plan'
import { clearChatPlan } from '../lib/agent/chat'
import { migratePlans } from '../lib/agent/migrate-plans'
import { workflowById } from '../lib/agent/workflows'
import { say } from '../lib/io'
import { die } from '../lib/paths'
import { newPlan, planFromText, planPathInText } from '../lib/plans'
import type { MoveResult } from '../lib/types'

export interface PlanOptions {
  title?: string
  slug?: string
  bodyFile?: string
  path?: string
  workflow?: string
}

export async function cmdPlan(args: string[], opts: PlanOptions): Promise<MoveResult> {
  const sub = args[0] ?? ''
  if (sub === 'migrate') return { migrated: migratePlans() }
  if (sub === 'drop') return dropPlan(opts.path)
  if (sub !== 'new' && sub !== 'save') die('Use plan new, save, drop, or migrate.')
  if (!opts.bodyFile) die('--body-file is required; write the draft in a writable temporary file first.')
  const text = fs.readFileSync(opts.bodyFile, 'utf8')
  if (!text.trim()) die('The plan body must not be empty.')
  const title = opts.title?.trim()
  if (sub === 'new' && !title) die('--title must not be empty')
  const existing = opts.path ? planFromText(opts.path) : null
  if (sub === 'save' && !existing) die('--path must name an existing plan of this board.')
  const plan = sub === 'new' ? newPlan(title!, opts.slug) : { path: existing!, id: Number(/(\d+)-/.exec(existing!)?.[1]) }
  const target = discussionHere()
  // An id this board lacks is dropped, not fatal: the plan matters more than the pick.
  const workflow = opts.workflow?.trim() || undefined
  const known = !workflow || !!workflowById(workflow)
  try { savePlan(target, plan.path, text, title, known ? workflow : undefined) }
  catch (err) { die(`Plan was not saved: ${String(err)}. Retry plan save --path ${plan.path}.`) }
  say(planPathInText(plan.path))
  if (!known) say(`No workflow \`${workflow}\` on this board; the plan was saved without one. See akb workflow list.`)
  return { id: plan.id, file: planPathInText(plan.path), path: plan.path, ...(known ? { workflow } : { unknownWorkflow: workflow }) }
}

// The discussion this command runs inside, or the board's own conversation.
function discussionHere() {
  const discussion = insideDiscussion()
  return (discussion ? asDiscussion(discussion) : null) ?? null
}

// Withdraw one plan from the handoff (#917). The file stays; the discussion lets it go.
function dropPlan(named: string | undefined): MoveResult {
  const rel = named ? planFromText(named) : null
  if (!rel) die('--path must name an existing plan of this board.')
  if (!clearChatPlan(discussionHere(), rel)) die(`${named} is not an open plan of this discussion.`)
  say(`Withdrew ${planPathInText(rel)}; it will not be handed off.`)
  return { path: rel, file: planPathInText(rel) }
}
