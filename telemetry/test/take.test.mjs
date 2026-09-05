import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { BadBatch, take } from '../src/take.ts'

// What a sender posts, taken as rows. Nothing here is trusted, and nothing dropped is ever
// reported back — a sender that learnt what we dropped would retry it.

const TODAY = '2026-09-05'
const INSTALL = '0f3a9b1c-2d4e-4f6a-8b1c-2d4e6f8a0b1c'
const BOARD = '11112222-3333-4444-8555-666677778888'
const ids = () => 'made-here'

const appBatch = (events) => ({ v: 1, install: INSTALL, events })
const siteBatch = (events) => ({ v: 1, events })

describe('take', () => {
  it('takes an app batch under its install id', () => {
    const { install, rows } = take(
      appBatch([{ id: 'e1', name: 'app_open', day: TODAY, surface: 'app', version: '0.8.1', os: 'darwin', arch: 'arm64', first_run: true }]),
      TODAY,
      ids,
    )
    assert.equal(install, INSTALL)
    assert.deepEqual(rows, [
      { e: 'e1', d: TODAY, n: 'app_open', s: 'app', v: '0.8.1', b: '', f: '{"os":"darwin","arch":"arm64","first_run":true}' },
    ])
  })

  it('takes a site batch with no install id at all, making an id it never has to keep', () => {
    const { install, rows } = take(
      siteBatch([{ name: 'page_view', day: TODAY, page: '/download', language: 'zh' }]),
      TODAY,
      ids,
    )
    assert.equal(install, '')
    assert.equal(rows[0].e, 'made-here')
    assert.equal(rows[0].s, 'site')
  })

  it('drops an event name it does not know', () => {
    const { rows } = take(appBatch([{ id: 'e1', name: 'card_title', day: TODAY }]), TODAY, ids)
    assert.deepEqual(rows, [])
  })

  it('drops an app event sent without an install id, and a site event sent with one', () => {
    assert.deepEqual(take(siteBatch([{ name: 'app_open', day: TODAY }]), TODAY, ids).rows, [])
    assert.deepEqual(
      take(appBatch([{ id: 'e1', name: 'page_view', day: TODAY }]), TODAY, ids).rows,
      [],
    )
  })

  it('drops a field the contract does not name, and one of the wrong shape', () => {
    const { rows } = take(
      appBatch([
        { id: 'e1', name: 'run_started', day: TODAY, harness: 'claude-code', card: 'Ship the thing', version: 12 },
      ]),
      TODAY,
      ids,
    )
    assert.equal(rows[0].f, '{"harness":"claude-code"}')
    assert.equal(rows[0].v, '')
  })

  it('drops an event older than the backfill window and one dated ahead', () => {
    const old = { id: 'e1', name: 'app_day', day: '2026-08-28' }
    const ahead = { id: 'e2', name: 'app_day', day: '2026-09-07' }
    const edge = { id: 'e3', name: 'app_day', day: '2026-08-29' }
    const { rows } = take(appBatch([old, ahead, edge]), TODAY, ids)
    assert.deepEqual(rows.map((row) => row.e), ['e3'])
  })

  it('keeps a board id on the row it belongs to, so forgetting the install takes it too', () => {
    const { rows } = take(
      appBatch([{ id: 'e1', name: 'board_numbers', day: TODAY, board: BOARD, cards_created: 4, cards_created_asked: -1 }]),
      TODAY,
      ids,
    )
    assert.equal(rows[0].b, BOARD)
    assert.equal(rows[0].f, '{"cards_created":4}')
  })

  it('refuses a batch that is not one', () => {
    assert.throws(() => take(null, TODAY, ids), BadBatch)
    assert.throws(() => take({ v: 2, events: [] }, TODAY, ids), BadBatch)
    assert.throws(() => take({ v: 1 }, TODAY, ids), BadBatch)
    assert.throws(() => take({ v: 1, install: 'nope', events: [] }, TODAY, ids), BadBatch)
    assert.throws(
      () => take({ v: 1, events: Array.from({ length: 201 }, () => ({})) }, TODAY, ids),
      BadBatch,
    )
  })
})
