// ---- closing a group root with its last subtask (#299) ----------------------
//
// A group is over the moment its pieces are, so nothing about the root's archive is a
// judgment call — this file is the arithmetic that says so. It only decides; the archive
// itself is `cmdRemove`'s, so the root leaves the board by exactly the path a hand-pressed
// Archive takes.

import fs from 'node:fs'

import { subtaskLines } from './cards'
import { parseFrontmatter } from './frontmatter'

/** Whether this root closes now. `held` carries a line for the receipt in the one case
 *  worth reporting: the group looks finished and a rule is keeping it on the board anyway.
 *  A group still being worked stays with `held: null` — the ordinary case, and silent. */
export type GroupCloseCall = { close: boolean; held: string | null }

const stay = (held: string | null): GroupCloseCall => ({ close: false, held })

// A todo of the root's own: an unticked box naming no subtask. Work no subtask covers, so
// a person finishes it before the group is over.
const OWN_TODO = /^[ \t]*[-*]\s+\[ \]\s*(.*)$/

export function groupCloseCall(rootFile: string): GroupCloseCall {
  let text: string
  try {
    text = fs.readFileSync(rootFile, 'utf8')
  } catch {
    return stay(null)
  }
  const { meta, body } = parseFrontmatter(text)
  const { total, resolved, ticked } = subtaskLines(body)
  // A root that lists no subtasks is a group only a person closes. Silent rather than
  // reported: getting here means the subtask wasn't on the root either, which `archive`
  // and `reject` already warn about in their own words.
  if (total === 0) return stay(null)
  if (resolved < total) return stay(null)
  // A rejection note is written from the card's own words, so a group that shipped nothing
  // is one a person closes.
  if (ticked === 0) return stay('they were all struck out by reject, so the group shipped nothing')
  if (meta && meta.questions.length > 0) return stay('it carries an open question of its own')
  const own = body.split('\n').some((line) => {
    const m = line.match(OWN_TODO)
    return !!m && !/#\d+/.test(m[1]!)
  })
  if (own) return stay('it has an unticked todo of its own')
  return { close: true, held: null }
}
