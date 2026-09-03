// What the Run dialog can still show, which is whatever pruning left on disk.
//
// The record drops a finished run whose log is gone (store.ts), so this budget is the real
// ceiling on the history. It is counted in RUNS: a run leaves a `.watch.log` beside its
// `.log`, and sometimes a `.plan.json` or `.asks.json`, so counting files would keep half
// the runs asked for and could delete a run's log while leaving its sidecars behind.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { KEEP_LOGS, pruneLogs } from '../src/lib/agent/log.ts'
import { SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'

let root = ''

// One run's files, dated so the newest run sorts first however the filesystem lists them.
const writeRun = (id: string, minutesAgo: number, sidecars: string[] = ['.watch.log']): void => {
  const when = new Date(Date.now() - minutesAgo * 60_000)
  for (const suffix of ['.log', ...sidecars]) {
    const file = path.join(SESSIONS_DIR, `${id}${suffix}`)
    fs.writeFileSync(file, `${id}${suffix}\n`)
    fs.utimesSync(file, when, when)
  }
}

const runIds = (): string[] =>
  fs
    .readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith('.log') && !f.endsWith('.watch.log'))
    .map((f) => f.slice(0, -'.log'.length))
    .sort()

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-prune-'))
  setBoardRoot(root)
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('what pruning leaves for the Run dialog', () => {
  it('keeps KEEP_LOGS runs, not KEEP_LOGS files', () => {
    // Every run here has a watch log too, which is the case that used to halve the history.
    for (let i = 0; i < KEEP_LOGS + 5; i++) writeRun(`run-${String(i).padStart(3, '0')}`, i)
    pruneLogs()
    assert.equal(runIds().length, KEEP_LOGS)
  })

  it('drops the oldest runs and keeps the newest', () => {
    for (let i = 0; i < KEEP_LOGS + 3; i++) writeRun(`run-${String(i).padStart(3, '0')}`, i)
    pruneLogs()
    const kept = runIds()
    assert.equal(kept[0], 'run-000')
    assert.equal(kept.at(-1), `run-${String(KEEP_LOGS - 1).padStart(3, '0')}`)
  })

  it('takes a dropped run whole — its sidecars go with its log', () => {
    writeRun('newest', 0)
    for (let i = 0; i < KEEP_LOGS; i++) {
      writeRun(`old-${String(i).padStart(3, '0')}`, i + 10, ['.watch.log', '.plan.json', '.asks.json'])
    }
    pruneLogs()
    // The one run past the budget is the oldest, and nothing of it is left.
    const gone = `old-${String(KEEP_LOGS - 1).padStart(3, '0')}`
    for (const suffix of ['.log', '.watch.log', '.plan.json', '.asks.json']) {
      assert.equal(fs.existsSync(path.join(SESSIONS_DIR, `${gone}${suffix}`)), false, `${gone}${suffix} survived`)
    }
    assert.ok(fs.existsSync(path.join(SESSIONS_DIR, 'newest.log')))
    assert.ok(fs.existsSync(path.join(SESSIONS_DIR, 'newest.watch.log')))
  })

  it('leaves everything alone while under the budget', () => {
    for (let i = 0; i < KEEP_LOGS; i++) writeRun(`run-${String(i).padStart(3, '0')}`, i)
    const before = fs.readdirSync(SESSIONS_DIR).sort()
    pruneLogs()
    assert.deepEqual(fs.readdirSync(SESSIONS_DIR).sort(), before)
  })
})
