// ---- workflow --------------------------------------------------------------
//
// The workflows this board runs, from a terminal (#715).
//
// The board UI writes the same things: which workflows there are and which of their agents
// are enabled. Everything is checked in one place (lib/agent/workflows.ts), so the terminal
// and the pane refuse the same moves — a built-in cannot be renamed here either.

import { say } from '../lib/io'
import { die } from '../lib/paths'
import {
  workflowPurpose,
  createWorkflow,
  agentAfter,
  duplicateWorkflow,
  previewMembers,
  renameWorkflow,
  scheduledMembers,
  setWorkflowAgentExtra,
  setWorkflowScheduledCadence,
  setWorkflowScheduledExtra,
  switchWorkflowScheduled,
  setWorkflowWorktree,
  switchWorkflowAgent,
  workflowById,
  workflowFileProblems,
  workflowProblems,
  workflows,
  type WorkflowHelper,
} from '../lib/agent/workflows'
import { removeWorkflow } from '../lib/agent/workflow-cards'
import { formatStamp, isAuto } from '../lib/cadence'
import type { DueAnswer } from '../lib/agent/due'
import { scheduledNext, scheduledRequest } from '../lib/agent/scheduled'
import type { WorkflowScheduled } from '../lib/agent/types'
import { startRun } from '../lib/agent/start'
import type { MoveResult } from '../lib/types'

const cadenceLine = (one: WorkflowScheduled): string => (one.off ? 'off' : isAuto(one.cadence) ? 'auto' : `every ${one.cadence}`)

const WAITS = { tooSoon: '', retrying: 'retrying after a failed run', nothingNew: 'nothing new yet', building: 'waits for the build to finish' }

const nextLine = (due: DueAnswer | null): string =>
  !due ? '' : ` · next after ${formatStamp(due.next)}${due.wait && WAITS[due.wait] ? ` (${WAITS[due.wait]})` : ''}`

/** `akb workflow`, as its command declares it (lib/cli/agent.ts). */
export interface WorkflowOptions {
  name?: string
  on?: string
  off?: string
  extra?: string
  cadence?: string
  run?: string
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

const names = (rows: WorkflowHelper[]): string => rows.map((h) => `${h.agent}${h.off ? ' (off)' : ''}`).join(', ')

// A preview with the approvals it waits on (#2154).
const previewNames = (rows: WorkflowHelper[]): string =>
  rows.map((h) => `${names([h])}${agentAfter(h.agent).length ? ` (after ${agentAfter(h.agent).join(', ')})` : ''}`).join(', ')

export function cmdWorkflowList(): MoveResult {
  const rows = workflows()
  for (const flow of rows) {
    say(`${flow.id}  ${flow.name}${flow.builtIn ? '  (built-in)' : ''}${flow.needsArtifact ? '  (no worktree)' : ''}`)
    const description = workflowPurpose(flow)
    if (description !== flow.name) say(`  ${description}`)
    say(`  previews    ${previewNames(previewMembers(flow)) || '(none)'}`)
    say(`  land        ${names(flow.land) || '(none) — the last approval archives the card'}`)
    for (const one of scheduledMembers(flow)) {
      const due = scheduledNext(flow.id, one)
      const ran = one.lastRun ? `last run ${one.lastRun}` : 'never run'
      say(`  scheduled   ${one.agent}  ${cadenceLine(one)} · ${ran}${nextLine(due)}`)
    }
    for (const problem of workflowProblems(flow.id)) say(`  ! ${problem}`)
  }
  const fileProblems = workflowFileProblems()
  for (const problem of fileProblems) say(`! ${problem}`)
  return {
    workflows: rows.map((flow) => ({
      ...flow,
      previews: previewMembers(flow).map((h) => ({ ...h, after: agentAfter(h.agent) })),
      scheduled: scheduledMembers(flow),
      description: workflowPurpose(flow),
      problems: workflowProblems(flow.id),
    })),
    problems: fileProblems,
  }
}

export function cmdWorkflowNew(name: string): MoveResult {
  const res = createWorkflow(name)
  done(res)
  say(`added the "${res.name}" workflow (${res.id}) — it lists no agents yet, and it runs without a worktree`)
  return { id: res.id, name: res.name }
}

export function cmdWorkflowDuplicate(id: string): MoveResult {
  const res = duplicateWorkflow(found(id).id)
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

/** `akb workflow agent`: switch one of a workflow's previews or land agents, or say what it is
 *  asked for here. With no change asked for, it lists them. */
export function cmdWorkflowAgent(id: string, flags: WorkflowOptions): MoveResult {
  const flow = found(id)
  const changes: string[] = []
  if (flags.on !== undefined) {
    done(switchWorkflowAgent(flow.id, flags.on, true))
    changes.push(`${flags.on.trim()} on`)
  }
  if (flags.off !== undefined) {
    done(switchWorkflowAgent(flow.id, flags.off, false))
    changes.push(`${flags.off.trim()} off`)
  }
  if (flags.extra !== undefined) {
    const who = (flags.on ?? flags.off ?? '').trim()
    if (!who) die('--extra says what one agent is asked for here, so name it: --on <agent> --extra "…"')
    done(setWorkflowAgentExtra(flow.id, who, flags.extra))
    changes.push(`${who}: extra requirements`)
  }
  if (!changes.length) {
    const now = workflowById(flow.id) ?? flow
    const previews = previewMembers(now)
    say(now.name)
    say(`  previews: ${previewNames(previews) || '(none)'}`)
    say(`  land: ${names(now.land) || '(none)'}`)
    return { id: now.id, previews, land: now.land }
  }
  say(`${flow.name}: ${changes.join(', ')}`)
  return { id: flow.id, changes }
}

/** `akb workflow schedule`: a workflow's scheduled agents (#1401) — switch one, set how often it
 *  runs, or start a pass now. With no change asked for, it lists them. */
export async function cmdWorkflowSchedule(id: string, flags: WorkflowOptions): Promise<MoveResult> {
  const flow = found(id)
  const changes: string[] = []
  if (flags.on !== undefined) {
    done(switchWorkflowScheduled(flow.id, flags.on, true))
    changes.push(`${flags.on.trim()} on`)
  }
  if (flags.off !== undefined) {
    done(switchWorkflowScheduled(flow.id, flags.off, false))
    changes.push(`${flags.off.trim()} off`)
  }
  const who = (flags.on ?? flags.off ?? flags.run ?? '').trim()
  if (flags.cadence !== undefined) {
    if (!who) die('--cadence says how often one agent runs, so name it: --on <agent> --cadence 1d')
    done(setWorkflowScheduledCadence(flow.id, who, flags.cadence))
    changes.push(`${who}: every ${flags.cadence.trim()}`)
  }
  if (flags.extra !== undefined) {
    if (!who) die('--extra says what one agent is asked for here, so name it: --on <agent> --extra "…"')
    done(setWorkflowScheduledExtra(flow.id, who, flags.extra))
    changes.push(`${who}: extra requirements`)
  }
  if (flags.run !== undefined) {
    const started = await startRun(scheduledRequest({ workflow: flow.id, agent: flags.run.trim() }))
    if ('error' in started) die(started.error)
    say(`${flow.name}: started ${flags.run.trim()} — run ${started.run.sessionId.slice(0, 8)}`)
    return { id: flow.id, changes, sessionId: started.run.sessionId }
  }
  if (!changes.length) {
    const rows = scheduledMembers(workflowById(flow.id) ?? flow)
    say(`${flow.name} · scheduled`)
    if (!rows.length) say('  (none) — an agent no workflow lists can be switched on here')
    for (const one of rows) {
      const due = scheduledNext(flow.id, one)
      const ran = one.lastRun ? `last run ${one.lastRun}` : 'never run'
      say(`  ${one.agent}  ${cadenceLine(one)} · ${ran}${nextLine(due)}`)
    }
    return { id: flow.id, scheduled: rows }
  }
  say(`${flow.name} · scheduled: ${changes.join(', ')}`)
  return { id: flow.id, changes }
}
