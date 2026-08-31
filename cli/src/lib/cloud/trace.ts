// A line per Cloud send, and per thing this board decided NOT to send (#372).
//
// The publisher drops work in three places without a word: an action recorded against a
// record that is no longer actionable, a delivery state parked because its event has no
// action to report against, and a refusal Cloud calls terminal. Each is correct on its own
// and invisible together — a card built on this machine can go quiet in a channel and stay
// quiet, and nothing on disk says which of the three did it.
//
// Diagnostic only. Nothing reads this file; it is here to be read by a person after a run
// that went wrong, and it never fails a send.

import fs from 'node:fs'
import path from 'node:path'

import { ensureAkbDir } from '../paths'

/** How large the trace grows before it starts again. A run writes a handful of lines, so
 *  this is weeks of ordinary use — and a board left running for a month must not fill a
 *  repository with a file nobody asked for. */
const MAX_BYTES = 256 * 1024

export function traceCloud(line: string): void {
  try {
    const file = path.join(ensureAkbDir(), 'cloud-trace.log')
    if ((fs.statSync(file, { throwIfNoEntry: false })?.size ?? 0) > MAX_BYTES) fs.rmSync(file)
    fs.appendFileSync(file, `${new Date().toISOString()}  ${line}\n`)
  } catch {
    // A trace that cannot be written changes nothing about the send it was describing.
  }
}
