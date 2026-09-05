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
// What goes is the raw events, and with them that install's place in every day still open
// for late events — the next daily run rewrites those summaries without it. A day already
// settled keeps the counts it reported: no summary names an install, its events are gone,
// and rewriting settled history would change numbers already read.

import { UUID } from '../contract.ts'
import { copyFrom, statement } from './copies.mjs'

const id = process.argv.slice(2).find((argument) => !argument.startsWith('--'))
if (!id || !UUID.test(id)) {
  process.stderr.write('forget: give the install id the user read on their own machine.\n')
  process.exit(1)
}

const copy = copyFrom(process.argv)
const [answer] = statement(copy, `DELETE FROM events WHERE install_id = '${id}'`)
const gone = answer?.meta?.changes ?? 0
process.stdout.write(
  `forget: ${gone} event(s) deleted from ${copy.database}.\n` +
    'The next daily run drops this install out of every day still open for late events.\n',
)
