// `akb raw case` — the two moves the `feedback` agent makes on a partner submission (#628).
//
// It is called from inside the discussion turn it is answering, so it never spells an id:
// `KANBAN_DISCUSSION` says which submission this is, the same way `akb raw plan new` knows
// which discussion to file a plan under. An agent that cannot settle which refine the user
// means calls neither move and asks its question in the conversation instead — nothing is
// collected until `submit`, and nothing is sent until it succeeds.

import fs from 'node:fs'

import { insideDiscussion } from '../lib/agent/env'
import { caseOffered, readCase, refinesOf, submitCase, type CaseFindings } from '../lib/case'
import { say } from '../lib/io'
import { die } from '../lib/paths'
import type { MoveResult } from '../lib/types'

export interface CaseOptions {
  file?: string
}

export async function cmdCase(args: string[], opts: CaseOptions): Promise<MoveResult> {
  const sub = args[0] ?? ''
  if (sub !== 'refines' && sub !== 'submit') die('Use case refines <card-id> or case submit --file <path>.')

  const discussion = insideDiscussion()
  if (!discussion) die('`case` only runs inside the discussion turn it is answering.')
  const held = readCase(discussion)
  if (!held) die('This discussion has no shared submission — the user did not tick share, so collect nothing.')

  if (sub === 'refines') {
    const cardId = Number(args[1])
    if (!Number.isInteger(cardId) || cardId <= 0) die('Give the card id: case refines <card-id>.')
    const refines = refinesOf(cardId)
    // Printed as JSON, because what follows it is reading fields and not prose: the clues are
    // the whole input to finding that harness's own trace.
    say(JSON.stringify({ card: cardId, refines }, null, 2))
    return { card: cardId, refines }
  }

  if (!caseOffered()) die('Partner feedback is switched off on this machine, so nothing may be collected.')
  if (!opts.file) die('--file is required; write the findings to a temporary JSON file first.')
  const found = read(opts.file)
  const record = await submitCase(discussion, found)
  if (!record) die('This discussion has no shared submission to submit.')
  if (record.status === 'sent') {
    say(`Submitted as ${record.id}.`)
  } else {
    // Said, not thrown: the pack is on disk and the screen offers the retry, so a submission
    // that did not land must not read to the agent as work it should do over.
    say(`Not submitted (${record.reason ?? 'unreachable'}). The user can retry from the discussion.`)
  }
  return { id: record.id, status: record.status, gaps: record.gaps ?? [] }
}

/** The findings file, as the agent wrote it. A `flowId` is the whole requirement: everything
 *  else is optional, because a refine whose traces are gone is still a case worth sending
 *  with the gaps saying so. */
function read(file: string): CaseFindings {
  let raw: unknown
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    die(`--file could not be read as JSON: ${String(err)}`)
  }
  const found = raw as Partial<CaseFindings> | null
  if (!found || typeof found.flowId !== 'string' || !found.flowId) {
    die('The findings must name the refine: {"flowId": "…"}. Settle which refine it is before submitting.')
  }
  return {
    flowId: found.flowId,
    ...(typeof found.analysis === 'string' ? { analysis: found.analysis } : {}),
    ...(Array.isArray(found.gaps) ? { gaps: found.gaps.map(String) } : {}),
    ...(Array.isArray(found.runs) ? { runs: found.runs } : {}),
    ...(Array.isArray(found.reads) ? { reads: found.reads } : {}),
  }
}
