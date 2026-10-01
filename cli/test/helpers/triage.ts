// Adding to triage in a test, with triage shut (#1296).
//
// An add starts a sort when triage is open, and in a test bundle the sort's watcher is the
// test file itself (src/lib/agent/launch.ts's `SELF`): detached, it runs the tests again,
// which add again. So every add in a test goes through here.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { machineHome } from '../../src/lib/machine/home.ts'

/** Run `add` where no account can read as Pro: the kept Pro answer is set aside and Cloud is
 *  unreachable, then both are put back. */
export async function triageShut<T>(add: () => Promise<T>): Promise<T> {
  assert.ok(process.env.AI4KANBAN_HOME, 'a test never adds to triage against the real machine home')
  const held = path.join(machineHome(), 'pro.json')
  const aside = `${held}.aside`
  const fetched = globalThis.fetch
  const kept = fs.existsSync(held)
  if (kept) fs.renameSync(held, aside)
  globalThis.fetch = (() => Promise.reject(new Error('triage is shut while a test adds'))) as typeof fetch
  try {
    return await add()
  } finally {
    globalThis.fetch = fetched
    if (kept) fs.renameSync(aside, held)
  }
}
