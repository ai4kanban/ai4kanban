// One rule per flow, in the user's own words (#306).
//
// Every board wants something slightly different from a flow — run these tests before
// landing, install dependencies this way, ask a second model. The flows themselves ship
// inside the command, so a convention a project depends on had nowhere to live. A rule is
// plain words appended to the END of a flow's built-in prompt, after everything else the
// board writes into it, so nothing of the board's follows the user's words. It is not a
// command the board runs: what it actually causes is up to the agent reading it.
//
// The files sit in docs/kanban/rules/, named by the command a user types — `revise.md` for
// `akb revise`, whose action the board keeps under the name `edit`. They are versioned in
// git so a team shares them, and they are inside docs/kanban/, which every delivery
// worktree leaves out — which is why a run is given the WORDS and never the path.
//
// Nothing is created up front: a missing or empty file means the flow runs unchanged.

import fs from 'node:fs'
import path from 'node:path'

import { RULES } from '../paths'
import type { WriteResult } from '../view/types'
import { DELIVERY_FLOWS, FLOWS, flowByAction, flowByCommand } from './flows'
import type { AgentRequest, FlowRuleView } from './types'

const rulePath = (command: string): string => path.join(RULES, `${command}.md`)

/** One flow's rule as it stands on disk — empty when there is no file, it can't be read,
 *  or it holds nothing but whitespace. */
export function readRule(command: string): string {
  try {
    return fs.readFileSync(rulePath(command), 'utf8').trim()
  } catch {
    return ''
  }
}

/** Save one flow's rule. An empty rule deletes the file rather than leaving a blank one
 *  behind: a flow with no rule and a flow with an empty rule are the same flow. */
export function setFlowRule(command: string, text: string): WriteResult {
  if (!flowByCommand(command)) return { ok: false, error: `no flow is started by \`akb ${command}\`` }
  const rule = String(text ?? '').trim()
  try {
    if (!rule) {
      fs.rmSync(rulePath(command), { force: true })
      return { ok: true }
    }
    fs.mkdirSync(RULES, { recursive: true })
    fs.writeFileSync(rulePath(command), `${rule}\n`)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Every flow the board has, with the rule it carries — what the Rules pane draws. The
 *  list is the board's own, so a flow shipped later appears here without further work. */
export function readFlowRules(): FlowRuleView[] {
  return FLOWS.map((flow) => ({
    command: flow.command,
    gloss: flow.gloss,
    note: flow.ruleNote,
    rule: readRule(flow.command),
  }))
}

/** The rules a delivery freezes when it starts: the flows a delivery is made of, read once,
 *  the way it reads the card it was approved to build. Editing a rule afterwards changes
 *  the next delivery, never one in flight. */
export function deliveryRules(): Record<string, string> {
  const rules: Record<string, string> = {}
  for (const flow of FLOWS) {
    if (!DELIVERY_FLOWS.has(flow.action)) continue
    const rule = readRule(flow.command)
    if (rule) rules[flow.command] = rule
  }
  return rules
}

/** The rule one run is given: the delivery's frozen copy when the run is part of one,
 *  and the file otherwise.
 *
 *  `frozen` is the caller's read of the delivery in flight — the caller's, because a
 *  delivery reads its rules from here and would otherwise read them through itself. A
 *  build that OPENS a delivery has none: the delivery does not exist yet, and the copy it
 *  is about to freeze is this same read. An action that is not a flow (a spec run) has no
 *  rule at all. */
export function ruleFor(req: AgentRequest, frozen?: Record<string, string>): string {
  const flow = flowByAction(req.action)
  if (!flow) return ''
  if (frozen && DELIVERY_FLOWS.has(req.action)) return frozen[flow.command] ?? ''
  return readRule(flow.command)
}

/** The rule as a run is given it: the user's words, and one line of the board's before them
 *  saying whose they are. Empty when the flow has no rule. */
export function ruleBlock(req: AgentRequest, frozen?: Record<string, string>): string {
  const rule = ruleFor(req, frozen)
  if (!rule) return ''
  const flow = flowByAction(req.action)
  return [
    `This board adds one rule of its own to every \`${flow?.command}\` run. It is the user's, it applies here, and nothing of the board's follows it:`,
    rule,
  ].join('\n\n')
}
