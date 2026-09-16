// ---- workflow --------------------------------------------------------------
//
// The workflows this board runs, from a terminal (#715).
//
// The board UI writes the same three things: which workflows there are, who leads each of
// their three stages, and which agents each stage may call in. Everything is checked in one
// place (lib/agent/workflows.ts), so the terminal and the pane refuse the same moves — a
// built-in cannot be renamed here either, and an agent cannot lead a stage it does not
// declare.

import { say } from '../lib/io'
import { die } from '../lib/paths'
import { agentRoster } from '../lib/agent/roles'
import {
  addWorkflowHelper,
  createWorkflow,
  duplicateWorkflow,
  liveStage,
  removeWorkflowHelper,
  renameWorkflow,
  setWorkflowHelperExtra,
  setWorkflowLead,
  stageCandidates,
  workflowById,
  workflowProblems,
  workflows,
  WORKFLOW_STAGES,
  type WorkflowStage,
} from '../lib/agent/workflows'
import { removeWorkflow } from '../lib/agent/workflow-cards'
import type { MoveResult } from '../lib/types'

/** `akb workflow`, as its command declares it (lib/cli/agent.ts). */
export interface WorkflowOptions {
  name?: string
  stage?: string
  lead?: string
  addHelper?: string
  dropHelper?: string
  extra?: string
}

const asStage = (asked: string | undefined): WorkflowStage => {
  const wanted = (asked ?? '').trim()
  if (!(WORKFLOW_STAGES as readonly string[]).includes(wanted)) {
    die(`--stage is ${WORKFLOW_STAGES.join(' | ')}`, { kind: 'needs-input' })
  }
  return wanted as WorkflowStage
}

const found = (id: string) => {
  const flow = workflowById(id)
  if (!flow) {
    die(`no workflow called "${id}" on this board. It has: ${workflows().map((w) => w.id).join(', ')}.`, {
      kind: 'no-such-workflow',
      workflow: id,
    })
  }
  return flow!
}

const done = (res: { ok: boolean; error?: string }): void => {
  if (!res.ok) die(res.error ?? 'the board refused that change')
}

export function cmdWorkflowList(): MoveResult {
  const rows = workflows()
  const titleOf = (name: string) => agentRoster().find((a) => a.name === name)?.name ?? name
  for (const flow of rows) {
    say(`${flow.id}  ${flow.name}${flow.builtIn ? '  (built-in)' : ''}`)
    for (const stage of WORKFLOW_STAGES) {
      const setup = liveStage(flow, stage)
      const helpers = setup.helpers.map((h) => titleOf(h.agent)).join(', ')
      say(`  ${stage.padEnd(8)}${setup.lead ? titleOf(setup.lead) : '(nobody)'}${helpers ? `  + ${helpers}` : ''}`)
    }
    for (const problem of workflowProblems(flow.id)) say(`  ! ${problem}`)
  }
  return { workflows: rows }
}

export function cmdWorkflowNew(name: string): MoveResult {
  const res = createWorkflow(name)
  done(res)
  say(`added the "${res.name}" workflow (${res.id}) — all three stages are empty`)
  return { id: res.id, name: res.name }
}

export function cmdWorkflowDuplicate(id: string): MoveResult {
  const res = duplicateWorkflow(found(id).id)
  done(res)
  say(`copied it to "${res.name}" (${res.id}) — its assignments came with it`)
  return { id: res.id, name: res.name }
}

export function cmdWorkflowRename(id: string, name: string): MoveResult {
  const flow = found(id)
  done(renameWorkflow(flow.id, name))
  say(`renamed ${flow.id} to "${name.trim()}" — every card on it is unmoved`)
  return { id: flow.id, name: name.trim() }
}

export function cmdWorkflowDelete(id: string): MoveResult {
  const flow = found(id)
  // A workflow an open card still runs on is refused rather than left to strand the card:
  // the card would keep an id nothing resolves, and a run on it stops. The check is the
  // board's own, so the pane turns down the same delete.
  const res = removeWorkflow(flow.id)
  if (res.cards?.length) {
    die(`"${flow.name}" — ${res.error}`, { kind: 'workflow-in-use', workflow: flow.id, cards: res.cards })
  }
  done(res)
  say(`deleted the "${flow.name}" workflow`)
  return { id: flow.id }
}

export function cmdWorkflowStage(id: string, flags: WorkflowOptions): MoveResult {
  const flow = found(id)
  const stage = asStage(flags.stage)
  const changes: string[] = []
  if (flags.lead !== undefined) {
    done(setWorkflowLead(flow.id, stage, flags.lead))
    changes.push(`lead→${flags.lead.trim() || '(nobody)'}`)
  }
  if (flags.addHelper !== undefined) {
    done(addWorkflowHelper(flow.id, stage, flags.addHelper))
    changes.push(`+${flags.addHelper.trim()}`)
  }
  if (flags.dropHelper !== undefined) {
    done(removeWorkflowHelper(flow.id, stage, flags.dropHelper))
    changes.push(`-${flags.dropHelper.trim()}`)
  }
  if (flags.extra !== undefined) {
    const who = (flags.addHelper ?? flags.dropHelper ?? '').trim()
    if (!who) die('--extra says what one helper is asked for here, so name it: --add-helper <agent> --extra "…"')
    done(setWorkflowHelperExtra(flow.id, stage, who, flags.extra))
    changes.push(`${who}: extra requirements`)
  }
  if (!changes.length) {
    const candidates = stageCandidates(stage).map((a) => a.name)
    say(`${flow.name} · ${stage} — agents that can take it: ${candidates.join(', ') || '(none on this board)'}`)
    // A built-in's lead is the command's, so only the helpers here are open to a change.
    if (flow.builtIn) say(`  its lead is \`${flow.stages[stage].lead}\` and stays that way — duplicate it to pick another`)
    return { id: flow.id, stage, candidates }
  }
  say(`${flow.name} · ${stage}: ${changes.join(', ')}`)
  return { id: flow.id, stage, changes }
}
