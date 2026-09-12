#!/usr/bin/env node
// Delete one partner's refine case, on request (#628).
//
//   npm run forget:case -- <feedback-id>          the real endpoint
//   npm run forget:case -- <feedback-id> --dev    the development copy
//
// The id is the one the app showed the user when the submission landed, and the one they
// quote in their email to support@ai4kanban.dev. It is the whole address: the pack lives at
// `pending/<id>/` and anything that submission was later entered into as an eval case lives
// at `evals/<id>/`, so deleting both prefixes is deleting the case and everything it became.
//
// Unlike `forget`, nothing here touches D1 or the archive. A case is in neither.

import { CASE_ID } from '../contract.ts'
import { copyFrom, wrangler } from './copies.mjs'

const id = process.argv.slice(2).find((argument) => !argument.startsWith('--'))
if (!id || !CASE_ID.test(id)) {
  process.stderr.write('forget:case: give the feedback id the app showed the user, e.g. fb_7k4m2p3q.\n')
  process.exit(1)
}

const copy = copyFrom(process.argv)
// Before anything is deleted: a bucket that answers nothing looks exactly like a submission
// that was never there, and "we deleted it" must never be said on that.
wrangler(['r2', 'bucket', 'info', copy.cases])

/** Every object under one prefix, as wrangler's JSON listing names them. */
function keysUnder(prefix) {
  const out = wrangler(['r2', 'object', 'list', copy.cases, '--remote', '--prefix', prefix, '--json'])
  const listed = JSON.parse(out || '[]')
  const rows = Array.isArray(listed) ? listed : (listed.objects ?? [])
  return rows.map((row) => (typeof row === 'string' ? row : row.key)).filter(Boolean)
}

let deleted = 0
// The pending pack first, then the eval cases it was entered into: a run that dies between
// the two leaves the second to a second `forget:case`, and the request is not finished until
// it reports both.
for (const prefix of [`pending/${id}/`, `evals/${id}/`]) {
  for (const key of keysUnder(prefix)) {
    wrangler(['r2', 'object', 'delete', `${copy.cases}/${key}`, '--remote'])
    deleted += 1
  }
}

process.stdout.write(
  deleted === 0
    ? `forget:case: nothing in ${copy.cases} is filed under ${id}.\n`
    : `forget:case: ${deleted} object(s) deleted from ${copy.cases} — the pending pack and every eval case ${id} became.\n`,
)
