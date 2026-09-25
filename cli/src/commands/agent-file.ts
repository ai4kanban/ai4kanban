// ---- agent-file ------------------------------------------------------------
//
// Print one file from an agent's own folder (#860).
//
// Every run is told which files its agent has, by path and nothing more, and opens one when
// the work calls for it. A project agent's files are on disk and are opened there; a built-in
// agent's ship inside the built command, where there is no path to open — this is the door
// onto those. A path the agent does not offer is refused, so nothing reads past its folder.

import { insideRun } from '../lib/agent/env'
import { readRuns } from '../lib/agent/store'
import { cardWorkflowId, scriptApprovedOn, workflowFor } from '../lib/agent/workflows'
import { findSpecAgent, specAgentNamesOnBoard } from '../lib/agents'
import { say } from '../lib/io'
import { die } from '../lib/paths'
import type { MoveResult } from '../lib/types'

export function cmdAgentFile(askedName: string, askedFile: string): MoveResult {
  const name = askedName.trim()
  const agent = findSpecAgent(name)
  if (!agent) {
    die(`"${name}" is not an agent on this board. It has: ${specAgentNamesOnBoard().join(', ')}.`, {
      kind: 'no-such-agent',
      agent: name,
    })
  }
  const file = askedFile.trim().replace(/^\.\//, '')
  // Checked against the list the run was given rather than against the filesystem: a path
  // that climbs out of the folder is simply not one of them.
  if (!agent.files.includes(file)) {
    const has = agent.files.length ? `Its files are: ${agent.files.join(', ')}.` : 'It has none.'
    die(`the \`${agent.name}\` agent has no \`${file}\`. ${has}`, { kind: 'no-such-agent-file', agent: agent.name, file })
  }
  refuseUnapprovedProduction(agent.name)
  const text = agent.file(file)
  if (text === null) die(`can't read \`${file}\` from the \`${agent.name}\` agent`, { kind: 'no-such-agent-file', agent: agent.name, file })
  say(text)
  return { agent: agent.name, file, text }
}

// A production tool is not handed to a run on a card whose script the user has not approved
// (#1057) — the recorder is how footage gets made.
function refuseUnapprovedProduction(agent: string): void {
  const inside = insideRun()
  const cardId = inside ? readRuns().find((r) => r.sessionId === inside)?.cardId : null
  if (typeof cardId !== 'number') return
  const flow = workflowFor(cardWorkflowId(cardId))
  if (flow?.delivers !== 'plan' || agent === flow.stages.plan.lead) return
  if (!scriptApprovedOn(cardId, flow.stages.plan.lead)) {
    die(`#${cardId}'s script is not approved yet, so nothing is produced for it.`, { kind: 'script-unapproved', agent })
  }
}
