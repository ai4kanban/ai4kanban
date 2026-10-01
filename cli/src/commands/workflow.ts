// ---- workflow --------------------------------------------------------------
//
// The workflows this board runs, from a terminal (#715).
//
// The board UI writes the same three things: which workflows there are, who leads each of
// their three stages, and which of their agents are enabled. Everything is checked in one
// place (lib/agent/workflows.ts), so the terminal and the pane refuse the same moves — a
// built-in cannot be renamed here either, and an agent cannot lead a stage it does not
// declare.

import { say } from '../lib/io'
import { die } from '../lib/paths'
import { agentRoster } from '../lib/agent/roles'
import {
  agentWorkflow,
  builtinDescription,
  createWorkflow,
  duplicateWorkflowIfAllowed,
  liveStage,
  renameWorkflow,
  setWorkflowHelperExtra,
  setWorkflowLead,
  setWorkflowWorktree,
  stageCandidates,
  switchWorkflowAgent,
  workflowById,
  workflowProblems,
  workflows,
  WORKFLOW_STAGES,
  type WorkflowStage,
} from '../lib/agent/workflows'
import { removeWorkflow } from '../lib/agent/workflow-cards'
import { proAccess } from '../lib/cloud/pro'
import type { MoveResult } from '../lib/types'

/** `akb workflow`, as its command declares it (lib/cli/agent.ts). */
export interface WorkflowOptions {
  name?: string
  stage?: string
  lead?: string
  on?: string
  off?: string
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

export async function cmdWorkflowList(): Promise<MoveResult> {
  const rows = workflows()
  // Asked only on a board with a Pro workflow, so a free board lists offline as before.
  const access = rows.some((flow) => flow.pro) ? await proAccess() : 'pro'
  const locked = access === 'free' || access === 'signed-out'
  const roster = agentRoster()
  const titleOf = (name: string) => roster.find((a) => a.name === name)?.name ?? name
  const undeclared = (name: string) => roster.some((a) => a.name === name && !a.canLead)
  for (const flow of rows) {
    const pro = flow.pro ? (locked ? '  (Pro · locked)' : '  (Pro)') : ''
    say(`${flow.id}  ${flow.name}${flow.builtIn ? '  (built-in)' : ''}${pro}${flow.needsArtifact ? '  (no worktree)' : ''}`)
    const description = flow.builtIn ? builtinDescription(flow.id) : undefined
    if (description) say(`  ${description}`)
    for (const stage of WORKFLOW_STAGES) {
      const setup = liveStage(flow, stage)
      const hooks = setup.helpers.map((h) => `${titleOf(h.agent)}${h.off ? ' (off)' : ''}`).join(', ')
      const lead = setup.lead ? `${titleOf(setup.lead)}${undeclared(setup.lead) ? ' (not declared to lead)' : ''}` : '(nobody)'
      say(`  ${stage.padEnd(8)}${lead}${hooks ? `  → hooks: ${hooks}` : ''}`)
    }
    for (const problem of workflowProblems(flow.id)) say(`  ! ${problem}`)
  }
  return {
    workflows: rows.map((flow) => ({
      ...flow,
      ...(flow.builtIn ? { description: builtinDescription(flow.id) } : {}),
      ...(flow.pro ? { locked } : {}),
    })),
  }
}

export function cmdWorkflowNew(name: string): MoveResult {
  const res = createWorkflow(name)
  done(res)
  say(`added the "${res.name}" workflow (${res.id}) — all three stages are empty, and it runs without a worktree`)
  return { id: res.id, name: res.name }
}

export async function cmdWorkflowDuplicate(id: string): Promise<MoveResult> {
  const res = await duplicateWorkflowIfAllowed(found(id).id)
  done(res)
  say(`copied it to "${res.name}" (${res.id}) — each of its agents was copied with it`)
  return { id: res.id, name: res.name }
}

export function cmdWorkflowRename(id: string, name: string): MoveResult {
  const flow = found(id)
  done(renameWorkflow(flow.id, name))
  say(`renamed ${flow.id} to "${name.trim()}" — every card on it is unmoved`)
  return { id: flow.id, name: name.trim() }
}

export function cmdWorkflowWorktree(id: string, state: string): MoveResult {
  const flow = found(id)
  if (state !== 'on' && state !== 'off') die('say `on` or `off`', { kind: 'needs-input' })
  done(setWorkflowWorktree(flow.id, state === 'on'))
  say(
    state === 'on'
      ? `"${flow.name}" now builds on a branch of its own in a worktree, and lands the result`
      : `"${flow.name}" now works in the project and delivers the files its card records`,
  )
  return { id: flow.id, worktree: state === 'on' }
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
  for (const name of res.agents ?? []) say(`deleted its agent ${name}`)
  for (const name of res.failed ?? []) say(`couldn't delete its agent ${name} — its files are still in the project`)
  return { id: flow.id, agents: res.agents ?? [], ...(res.failed ? { failed: res.failed } : {}) }
}

export function cmdWorkflowStage(id: string, flags: WorkflowOptions): MoveResult {
  const flow = found(id)
  const stage = asStage(flags.stage)
  const changes: string[] = []
  if (flags.lead !== undefined) {
    done(setWorkflowLead(flow.id, stage, flags.lead))
    changes.push(`lead→${flags.lead.trim() || '(nobody)'}`)
  }
  if (flags.on !== undefined) {
    done(switchWorkflowAgent(flow.id, stage, flags.on, true))
    changes.push(`${flags.on.trim()} on`)
  }
  if (flags.off !== undefined) {
    done(switchWorkflowAgent(flow.id, stage, flags.off, false))
    changes.push(`${flags.off.trim()} off`)
  }
  if (flags.extra !== undefined) {
    const who = (flags.on ?? flags.off ?? '').trim()
    if (!who) die('--extra says what one agent is asked for here, so name it: --on <agent> --extra "…"')
    done(setWorkflowHelperExtra(flow.id, stage, who, flags.extra))
    changes.push(`${who}: extra requirements`)
  }
  if (!changes.length) {
    const setup = liveStage(flow, stage)
    const on = setup.helpers.filter((h) => !h.off).map((h) => h.agent)
    const off = setup.helpers.filter((h) => h.off).map((h) => h.agent)
    // The leads it could pick: roles, and agents no other workflow has.
    const leads = stageCandidates(stage)
      .filter((a) => a.canLead && [flow.id, ''].includes(agentWorkflow(a.name)))
      .map((a) => a.name)
    say(`${flow.name} · ${stage}`)
    say(`  lead: ${setup.lead || '(nobody)'}${flow.builtIn ? ' — built in; duplicate the workflow to pick another' : ''}`)
    say(`  hooks on: ${on.join(', ') || '(none)'}`)
    if (off.length) say(`  hooks off: ${off.join(', ')}`)
    if (!flow.builtIn) say(`  can lead: ${leads.join(', ') || '(none)'}`)
    return { id: flow.id, stage, lead: setup.lead, on, off, leads }
  }
  say(`${flow.name} · ${stage}: ${changes.join(', ')}`)
  return { id: flow.id, stage, changes }
}
