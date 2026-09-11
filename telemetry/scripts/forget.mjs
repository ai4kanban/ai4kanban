#!/usr/bin/env node
// Delete one install's events, on request.
//
//   npm run forget -- <install-id>          the real endpoint
//   npm run forget -- <install-id> --dev    the development copy
//
// The id is the one the user reads on their own machine, which #293 shows while reporting is
// on. Reporting has to be switched off after asking, not before: switching off forgets the
// id, and then there is nothing left to name.
//
// What goes is the raw events and the feedback that install sent (#603), and with the events
// that install's place in every day still open for late events — the next daily run rewrites those summaries without it. A day already
// settled keeps the counts it reported: no summary names an install, its events are gone,
// and rewriting settled history would change numbers already read.
//
// The archive is the second place those events live, so every archived day is read back and
// rewritten without them. It holds only days between `archiveFrom` and the retention edge, so
// the range is known without listing the bucket, and every file in it has to be read anyway
// to know whether it carried the install. A request years out reads a few hundred megabytes
// and takes minutes, which is what a command run by hand can afford.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { LIMITS, UUID } from '../contract.ts'
import { keyOf, linesOf } from '../src/archive.ts'
import { shift } from '../src/take.ts'
import { copyFrom, statement, wrangler } from './copies.mjs'

const id = process.argv.slice(2).find((argument) => !argument.startsWith('--'))
if (!id || !UUID.test(id)) {
  process.stderr.write('forget: give the install id the user read on their own machine.\n')
  process.exit(1)
}

/** What wrangler says for a key the bucket has none of, and nothing else it fails on says.
 *  A day read as never written is a day not forgotten, so every other failure is loud. */
const NO_FILE = /The specified key does not exist/

const copy = copyFrom(process.argv)
// Before anything is deleted: a bucket that answers nothing looks exactly like a bucket of
// days never written, so prove it is reachable while the rows are all still in the database.
wrangler(['r2', 'bucket', 'info', copy.bucket])

const [answer] = statement(copy, `DELETE FROM events WHERE install_id = '${id}'`)
const gone = answer?.meta?.changes ?? 0

// And the feedback that install sent (#603), body and attachments alike. It is in no
// archive file, so these two statements are the whole of it.
const [files] = statement(copy, `DELETE FROM feedback_files WHERE install_id = '${id}'`)
const [bodies] = statement(copy, `DELETE FROM feedback WHERE install_id = '${id}'`)
const feedbackGone = bodies?.meta?.changes ?? 0
const attachmentsGone = files?.meta?.changes ?? 0

// The rows go first: an archive file rewritten while the events are still stored would be
// undone by nothing, but a run that dies here leaves the files to a second `forget`.
const scratch = mkdtempSync(join(tmpdir(), 'forget-'))
const file = join(scratch, 'day.jsonl')
let read = 0
let rewritten = 0
let absent = 0
try {
  const last = shift(new Date().toISOString().slice(0, 10), -LIMITS.retentionDays - 1)
  for (let day = LIMITS.archiveFrom; day <= last; day = shift(day, 1)) {
    const object = `${copy.bucket}/${keyOf(day)}`
    rmSync(file, { force: true })
    const got = wrangler(['r2', 'object', 'get', object, '--remote', '--file', file], {
      absentIf: NO_FILE,
    })
    if (got === null) {
      absent += 1
      continue
    }
    read += 1
    const lines = linesOf(readFileSync(file, 'utf8'))
    const kept = lines.filter((line) => JSON.parse(line).install_id !== id)
    if (kept.length === lines.length) continue
    writeFileSync(file, kept.length === 0 ? '' : `${kept.join('\n')}\n`)
    wrangler([
      'r2', 'object', 'put', object,
      '--remote', '--file', file, '--content-type', 'application/x-ndjson',
    ])
    rewritten += 1
  }
} finally {
  rmSync(scratch, { recursive: true, force: true })
}

process.stdout.write(
  `forget: ${gone} event(s) deleted from ${copy.database}.\n` +
    `forget: ${feedbackGone} piece(s) of feedback and ${attachmentsGone} attachment(s) deleted.\n` +
    `forget: ${read} archive file(s) read in ${copy.bucket}, ${rewritten} rewritten` +
    (absent > 0 ? `, ${absent} day(s) the archive has not written yet` : '') +
    '.\n' +
    'The next daily run drops this install out of every day still open for late events.\n',
)
