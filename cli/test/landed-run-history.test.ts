// A landed card takes its unfinished runs with it (#673).
//
// A run that failed, was cut off or was stopped is work somebody still owes — until the
// card it names lands, which settles everything left open on it. The run is marked here,
// off the archive rather than off the live delivery record, so a card that landed long ago
// answers the same as one that landed this minute. Nothing is deleted: the mark is what
// Runs reads to keep the record out of Unfinished.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { listRuns } from '../src/lib/agent/sessions.ts'
import { logPathOf, withStore } from '../src/lib/agent/store.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState } from './helpers/board.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')

/** A card on the board, or one the archive kept after it landed. */
function card(where: 'todo' | '.archive', id: number): void {
  const dir = path.join(kanban(), where)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${id}-thing.md`), `---\ntitle: thing\n---\n\nA thing.\n`)
}

/** One run in the record, with the log `prune` insists on. */
function run(sessionId: string, cardId: number | null, status: 'done' | 'error'): void {
  withStore((store) => {
    const logPath = logPathOf(sessionId)
    fs.mkdirSync(path.dirname(logPath), { recursive: true })
    fs.writeFileSync(logPath, 'ran\n')
    store.runs.push({
      sessionId,
      cardId,
      action: 'resolve',
      status,
      startedAt: 1,
      endedAt: 2,
      ok: status === 'done',
      harness: 'claude-code',
      logPath,
    })
  })
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-landed-runs-'))
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  forgetMachineState(root)
  setBoardRoot(root)
})

afterEach(() => {
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('a run that stopped short', () => {
  it('is marked landed once its card is in the archive', async () => {
    card('.archive', 399)
    run('a', 399, 'error')
    const [only] = await listRuns()
    assert.equal(only.cardLanded, true)
  })

  it('is not marked while its card is still on the board', async () => {
    card('todo', 400)
    run('b', 400, 'error')
    const [only] = await listRuns()
    assert.equal(only.cardLanded, undefined)
  })

  it('is not marked when it names no card at all', async () => {
    run('c', null, 'error')
    const [only] = await listRuns()
    assert.equal(only.cardLanded, undefined)
  })
})

describe('a run that finished cleanly', () => {
  it('is never marked, archived card or not', async () => {
    card('.archive', 399)
    run('d', 399, 'done')
    const [only] = await listRuns()
    assert.equal(only.cardLanded, undefined)
  })
})
