// ---- workflow --------------------------------------------------------------
//
// The workflows this board runs, from a terminal (#715). They are Cloud's (#409) and edited on
// the web; only a Workflow builder task's draft is written here.

import fs from 'node:fs'
import path from 'node:path'

import { findSpecAgent } from '../lib/agents'
import { locate } from '../lib/cards'
import { say } from '../lib/io'
import { ASSETS, die } from '../lib/paths'
import { workflowDiagram } from '../lib/agent/workflow-diagram'
import { NEEDS_CLOUD, workflowsOffline, workflowsReachable } from '../lib/agent/cloud-workflows'
import {
  workflowPurpose,
  workflowWhen,
  agentAfter,
  previewMembers,
  scheduledMembers,
  listedScheduled,
  renameWorkflow,
  workflowById,
  workflowFileProblems,
  workflowProblems,
  workflows,
  type WorkflowHelper,
} from '../lib/agent/workflows'
import type { MoveResult } from '../lib/types'

const found = (id: string) => {
  const flow = workflowById(id)
  if (!flow) {
    die(`no workflow called "${id}" here. There are: ${workflows().map((w) => w.id).join(', ')}.`, {
      kind: 'no-such-workflow',
      workflow: id,
    })
  }
  return flow!
}

const done = (res: { ok: boolean; error?: string; reason?: string }): void => {
  if (!res.ok) die(res.error ?? 'the board refused that change', res.reason === 'workflowReadOnly' ? 'workflow-read-only' : undefined)
}

const names = (rows: WorkflowHelper[]): string => rows.map((h) => `${h.agent}${h.off ? ' (off)' : ''}`).join(', ')

// A preview with the approvals it waits on (#2154).
const previewNames = (rows: WorkflowHelper[]): string =>
  rows.map((h) => `${names([h])}${agentAfter(h.agent).length ? ` (after ${agentAfter(h.agent).join(', ')})` : ''}`).join(', ')

export function cmdWorkflowList(): MoveResult {
  if (!workflowsReachable().ok) die(NEEDS_CLOUD, 'needs-cloud')
  const offline = workflowsOffline()
  const rows = workflows()
  for (const flow of rows) {
    const previews = previewNames(previewMembers(flow))
    const land = names(flow.land)
    const line = [flow.id, flow.name, ...(previews ? [`previews: ${previews}${land ? ` → land: ${land}` : ''}`] : land ? [`land: ${land}`] : [])]
    say(`${line.join('  ')}${offline ? '  (offline)' : ''}`)
    for (const agent of listedScheduled(flow)) say(`  scheduled: ${agent}`)
    for (const problem of workflowProblems(flow.id)) say(`  ! ${problem}`)
  }
  const fileProblems = workflowFileProblems()
  for (const problem of fileProblems) say(`! ${problem}`)
  return {
    workflows: rows.map((flow) => ({
      ...flow,
      previews: previewMembers(flow).map((h) => ({ ...h, after: agentAfter(h.agent) })),
      scheduled: listedScheduled(flow),
      description: workflowPurpose(flow),
      when: workflowWhen(flow),
      problems: workflowProblems(flow.id),
    })),
    problems: fileProblems,
    ...(offline ? { offline } : {}),
  }
}

export function cmdWorkflowRename(id: string, name: string): MoveResult {
  done(renameWorkflow(id, name))
  say(`renamed ${id} to "${name.trim()}"`)
  return { id, name: name.trim() }
}

export function cmdWorkflowDiagram(id: string, card: string): MoveResult {
  const flow = found(id)
  const cardId = Number(card)
  if (!Number.isInteger(cardId) || !locate(cardId)) die(`no card #${card} on this board`, 'no-such-card')
  const diagram = workflowDiagram({ previews: previewMembers(flow), land: flow.land, scheduled: scheduledMembers(flow) }, (name) => {
    const agent = findSpecAgent(name)
    return agent ? { ...agent, after: agentAfter(name) } : null
  })
  const file = path.join(ASSETS, String(cardId), 'workflow.json')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(diagram, null, 2)}\n`)
  const tag = `<Workflow src=".assets/${cardId}/workflow.json" label="${flow.name.replace(/"/g, '')}" />`
  say(tag)
  return { file, tag, diagram }
}
