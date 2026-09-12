import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'

import { insideDiscussion } from '../lib/agent/env'
import { asDiscussion } from '../lib/agent/discussions'
import { report, reportSession, outboxDir } from '../lib/agent/outbox'
import { savePlan } from '../lib/agent/save-plan'
import { migratePlans } from '../lib/agent/migrate-plans'
import { say } from '../lib/io'
import { die } from '../lib/paths'
import { newPlan, planFromText, planPathInText } from '../lib/plans'
import type { MoveResult } from '../lib/types'

export interface PlanOptions {
  title?: string
  slug?: string
  bodyFile?: string
  path?: string
}

export async function cmdPlan(args: string[], opts: PlanOptions): Promise<MoveResult> {
  const sub = args[0] ?? ''
  if (sub === 'migrate') return { migrated: migratePlans() }
  if (sub !== 'new' && sub !== 'save') die('Use plan new, save, or migrate.')
  if (!opts.bodyFile) die('--body-file is required; write the draft in a writable temporary file first.')
  const text = fs.readFileSync(opts.bodyFile, 'utf8')
  if (!text.trim()) die('The plan body must not be empty.')
  const title = opts.title?.trim()
  if (sub === 'new' && !title) die('--title must not be empty')
  const existing = opts.path ? planFromText(opts.path) : null
  if (sub === 'save' && !existing) die('--path must name an existing plan of this board.')
  const plan = sub === 'new' ? newPlan(title!, opts.slug) : { path: existing!, id: Number(/(\d+)-/.exec(existing!)?.[1]) }
  const discussion = insideDiscussion()
  const target = (discussion ? asDiscussion(discussion) : null) ?? null
  const session = reportSession()
  if (session) {
    const request = randomUUID()
    if (!report({ kind: 'plan', path: plan.path, title, target, text, request })) die(`Plan was not saved. Retry with plan save --path ${plan.path}.`)
    const ack = path.join(outboxDir(session), `${request}.ack`)
    const deadline = Date.now() + 30_000
    while (!fs.existsSync(ack) && Date.now() < deadline) await setTimeout(50)
    if (!fs.existsSync(ack)) die(`Save is unconfirmed. Keep the draft; inspect or retry plan save --path ${plan.path}.`)
    const result = JSON.parse(fs.readFileSync(ack, 'utf8')) as { error?: string }
    fs.rmSync(ack)
    if (result.error) die(`Plan was not saved: ${result.error}. Retry plan save --path ${plan.path}.`)
  } else {
    try { savePlan(target, plan.path, text, title) }
    catch (err) { die(`Plan was not saved: ${String(err)}. Retry plan save --path ${plan.path}.`) }
  }
  say(planPathInText(plan.path))
  return { id: plan.id, file: planPathInText(plan.path), path: plan.path }
}
