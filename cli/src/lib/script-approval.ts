// The one approval a workflow that finishes in planning waits on (#1057): the user approves
// the plan lead's section — a product video's script — before anything is produced.
//
// An approval binds a VERSION, a hash of that section as it read when the question was asked.
// Editing the section moves the version, so an old approval stops counting without anybody
// having to withdraw it, and a question asked about an older script cannot approve a newer one.
// An `<Asset>` line is media, not script: embedding the film never voids the approval.

import crypto from 'node:crypto'

import { specSection } from './agents'
import { parseQuestion } from './view/rules'
import type { Question } from './view/types'

/** The version of the plan lead's section as the body now reads, or empty when there is none. */
export function scriptVersion(body: string, lead: string): string {
  const section = lead ? specSection(body, lead) : null
  if (!section) return ''
  const words = section
    .split('\n')
    .filter((line) => !/^\s*<Asset\s/.test(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return crypto.createHash('sha256').update(words).digest('hex').slice(0, 12)
}

/** Whether the user approved the script as it now reads. */
export const scriptApproved = (approved: string, body: string, lead: string): boolean =>
  !!approved && approved === scriptVersion(body, lead)

/** Whether a resolve run's answers pick this question's first option — its "approve" — and
 *  nothing else: no second pick and no words of the user's own, which would be a change asked
 *  for alongside the approval. The answers are the text `answerNotes` composes. */
export function pickedApproval(notes: string, q: Question): boolean {
  const approve = q.options?.[0]
  if (!approve) return false
  const asked = `Q: ${parseQuestion(q.text).text}`
  const block = notes.split('\n\n').find((b) => b.split('\n')[0] === asked)
  if (!block) return false
  return block.split('\n').slice(1).join('\n') === `Picked:\n- ${approve}`
}
