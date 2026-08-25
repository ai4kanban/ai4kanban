// ---- review-verdict --------------------------------------------------------
//
// The one door a review run answers through (#302).
//
// A review's last message is prose, and prose is not a decision — the delivery has to know
// whether to finish or stop and ask, and it has to know it after the
// run's process is gone. So the verdict is a move: it lands on the delivery's record,
// where the loop reads it, and it is the ONLY thing that counts as a review having
// happened. A run that ends without calling this stops the delivery and asks the user,
// because a delivery that reads silence as a pass has no review in it.

import fs from 'node:fs'

import { insideRun } from '../lib/agent/env'
import { recordVerdict } from '../lib/agent/deliveries'
import { VERDICTS } from '../lib/agent/review'
import type { ReviewVerdict } from '../lib/agent/types'
import { say } from '../lib/io'
import { die } from '../lib/paths'
import type { MoveResult } from '../lib/types'
import { parseFlags } from '../lib/validate'

export function cmdReviewVerdict(args: string[]): MoveResult {
  const { flags, positional } = parseFlags(args, ['verdict', 'file', 'text'])
  const id = Number(positional[0])
  if (!Number.isInteger(id)) die('need a numeric task id: review-verdict <id> --verdict pass|ask')
  const verdict = readVerdict(flags.verdict)
  const findings = readFindings(flags.file, flags.text, verdict)

  // The run recording it. A review run always has one; a person typing this by hand does
  // not, and the empty string is a truthful answer — it belongs to no run, so the loop
  // treats it as a verdict the delivery's own review never gave and stops to ask.
  const sessionId = insideRun() ?? ''
  const out = recordVerdict(id, sessionId, verdict, findings)
  if (!out.ok) die(out.error, { kind: 'no-delivery', id })

  const review = out.delivery.review
  const rounds = review?.rounds.length ?? 1
  say(`#${id}: review ${rounds} recorded "${verdict}" on delivery ${out.delivery.deliveryId}`)
  return { id, deliveryId: out.delivery.deliveryId, verdict, rounds }
}

function readVerdict(raw: unknown): ReviewVerdict {
  if (raw === undefined || raw === true) die(`--verdict needs a value: ${VERDICTS.join(', ')}`)
  const value = String(raw).trim().toLowerCase()
  if (!(VERDICTS as string[]).includes(value)) {
    die(`--verdict takes ${VERDICTS.join(', ')} (got "${String(raw)}")`, { kind: 'bad-option' })
  }
  return value as ReviewVerdict
}

// What the review found, from a file or straight off the command line. A file is what the
// flow asks for: findings are markdown, and a shell eats markdown.
function readFindings(file: unknown, text: unknown, verdict: ReviewVerdict): string {
  if (file !== undefined && text !== undefined) die('pass --file or --text, not both')
  if (file === undefined && text === undefined) {
    if (verdict === 'pass') return ''
    die(`a "${verdict}" verdict has to say what was found: --file <path>, or --text ".." for a one-liner`)
  }
  if (verdict === 'pass') die('a "pass" verdict carries no findings — there was nothing to send back')
  if (file !== undefined) {
    if (file === true) die('--file needs a path after it')
    try {
      return fs.readFileSync(String(file), 'utf8')
    } catch {
      die(`can't read ${String(file)} — write your findings to a file, then pass its path`)
    }
  }
  return text === true ? '' : String(text)
}
