import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { SWEEP } from '../src/daily.ts'
import { store } from '../src/store.ts'
import { D1_COMPOUND_TERMS, SPREADS, TOTALS, WRITE_SUMMARY, numbersOf } from '../src/summary.ts'
import { take } from '../src/take.ts'
import { compoundTerms, fakeDatabase } from './fake.mjs'

// The half of this service that is SQL, run against a real SQLite with the real migration
// applied. Everything here is what the free plan's per-run limits are the reason for: one
// statement to store a batch however many events it carries, and counting done in the
// database rather than by reading rows out of it.

const A = '0f3a9b1c-2d4e-4f6a-8b1c-2d4e6f8a0b1c'
const B = '11112222-3333-4444-8555-666677778888'
const BOARD = 'aaaabbbb-cccc-4ddd-8eee-ffff00001111'
const TODAY = '2026-09-05'
const YESTERDAY = '2026-09-04'

async function put(db, install, day, events, country = 'US') {
  const batch = install ? { v: 1, install, events } : { v: 1, events }
  const taken = take(batch, day, () => Math.random().toString(36).slice(2))
  return store(db, taken.install, country, taken.rows)
}

const open = (id, day, over = {}) => ({
  id,
  name: 'app_open',
  day,
  surface: 'app',
  version: '0.8.1',
  os: 'darwin',
  arch: 'arm64',
  first_run: true,
  ...over,
})

describe('storing a batch', () => {
  it('takes any number of events in one statement', async () => {
    const db = fakeDatabase()
    const events = Array.from({ length: 120 }, (_, n) => open(`e${n}`, TODAY))
    const stored = await put(db, A, TODAY, events)
    assert.equal(stored.stored, true)
    assert.equal(rows(db, 'SELECT COUNT(*) AS n FROM events')[0].n, 120)
  })

  it("ignores an event id already stored for that install, and keeps another install's", async () => {
    const db = fakeDatabase()
    await put(db, A, TODAY, [open('e1', TODAY)])
    await put(db, A, TODAY, [open('e1', TODAY)])
    await put(db, B, TODAY, [open('e1', TODAY)])
    assert.equal(rows(db, 'SELECT COUNT(*) AS n FROM events')[0].n, 2)
  })

  it('stores the day the sender said, and the country but never the address', async () => {
    const db = fakeDatabase()
    await put(db, A, TODAY, [open('e1', YESTERDAY)], 'DE')
    const [row] = rows(db, 'SELECT day, country FROM events')
    assert.equal(row.day, YESTERDAY)
    assert.equal(row.country, 'DE')
    const columns = rows(db, "SELECT name FROM pragma_table_info('events')").map((c) => c.name)
    assert.ok(!columns.some((column) => /ip|address/i.test(column)), columns.join(','))
  })
})

describe("a day's summary", () => {
  it('counts installs, returning installs and every spread the command prints', async () => {
    const db = fakeDatabase()
    // B was here yesterday, so today it is a returning install. A is new today.
    await put(db, B, YESTERDAY, [open('b0', YESTERDAY)], 'DE')
    await put(db, A, TODAY, [open('a1', TODAY)], 'US')
    await put(db, B, TODAY, [open('b1', TODAY, { first_run: false, version: '0.8.0' })], 'DE')
    await put(
      db,
      B,
      TODAY,
      [{ id: 'b2', name: 'run_started', day: TODAY, surface: 'command', version: '0.8.0', harness: 'claude-code' }],
      'DE',
    )
    await put(db, null, TODAY, [
      { name: 'page_view', day: TODAY, page: '/', language: 'en' },
      { name: 'page_view', day: TODAY, page: '/download', language: 'zh' },
      { name: 'download_press', day: TODAY, page: '/download', language: 'zh', place: 'download', os: 'macos', arch: 'arm', version: '0.8.1' },
    ])

    const numbers = await summaryOf(db, TODAY)
    assert.equal(numbers.installs, 2)
    assert.equal(numbers.returning_installs, 1)
    assert.deepEqual(numbers.events, { app_open: 2, download_press: 1, page_view: 2, run_started: 1 })
    assert.deepEqual(numbers.install_version, { '0.8.0': 1, '0.8.1': 1 })
    assert.deepEqual(numbers.install_country, { DE: 1, US: 1 })
    assert.deepEqual(numbers.install_surface, { app: 2, command: 1 })
    assert.deepEqual(numbers.first_run_surface, { app: 1 })
    assert.deepEqual(numbers.first_run_version, { '0.8.1': 1 })
    assert.deepEqual(numbers.run_harness, { 'claude-code': 1 })
    // Page and language in one key, so the rate divides cell by cell.
    assert.deepEqual(numbers.page_view_seen, { '/ en': 1, '/download zh': 1 })
    assert.deepEqual(numbers.download_press_seen, { '/download zh': 1 })
    // What a press carried, so it outlives the events behind it.
    assert.deepEqual(numbers.download_press_place, { download: 1 })
    assert.deepEqual(numbers.download_press_os, { macos: 1 })
    assert.deepEqual(numbers.download_press_arch, { arm: 1 })
    // The version a press named is a site number, never an install's.
    assert.deepEqual(numbers.download_press_version, { '0.8.1': 1 })
    assert.equal(numbers.usage, null)
  })

  it('adds up the board counts and says how many boards reported', async () => {
    const db = fakeDatabase()
    const counts = {
      cards_created: 4,
      cards_created_asked: 3,
      cards_created_proposed: 1,
      questions_closed: 2,
      questions_closed_board: 2,
    }
    await put(db, A, TODAY, [{ id: 'n1', name: 'board_numbers', day: TODAY, surface: 'app', version: '0.8.1', board: BOARD, ...counts }])
    await put(db, B, TODAY, [{ id: 'n2', name: 'board_numbers', day: TODAY, surface: 'app', version: '0.8.1', board: A, cards_created: 6 }])

    const numbers = await summaryOf(db, TODAY)
    assert.equal(numbers.boards, 2)
    assert.equal(numbers.board.cards_created, 10)
    assert.equal(numbers.board.cards_created_asked, 3)
    assert.equal(numbers.board.questions_closed_board, 2)
  })

  it('asks for the spreads in statements D1 will take, and names its columns in each', () => {
    // One 25-branch query was refused by D1 every night for nine days and passed here, where
    // SQLite takes 500 (#801). A branch that starts a query is where its column names come
    // from, so every one of them carries all four — `day` included, since #804 reads the
    // whole window in one statement.
    assert.ok(SPREADS.length > 1)
    for (const query of SPREADS) {
      assert.ok(compoundTerms(query) <= D1_COMPOUND_TERMS, query)
      assert.match(query.split('UNION ALL')[0], /AS day,[\s\S]*AS dim,[\s\S]*AS key,[\s\S]*AS n/)
    }
  })

  it('answers a whole window in one pass, and a zero day with a row of its own', async () => {
    const db = fakeDatabase()
    await put(db, A, YESTERDAY, [open('a0', YESTERDAY)], 'US')
    await put(db, null, TODAY, [{ name: 'page_view', day: TODAY, page: '/', language: 'en' }])
    const quiet = shift(TODAY, 1)

    const window = await windowOf(db, [YESTERDAY, TODAY, quiet])
    assert.deepEqual([...window.keys()], [YESTERDAY, TODAY, quiet])
    assert.equal(window.get(YESTERDAY).installs, 1)
    assert.deepEqual(window.get(YESTERDAY).events, { app_open: 1 })
    // A day of site events only: an installs count of zero, not a day missing from the answer.
    assert.equal(window.get(TODAY).installs, 0)
    assert.deepEqual(window.get(TODAY).events, { page_view: 1 })
    // A day with nothing at all still gets an object, so the run writes it a `daily` row.
    assert.deepEqual(window.get(quiet), {
      installs: 0,
      returning_installs: 0,
      boards: 0,
      usage: null,
    })
  })

  it('reads a day the same whether it is asked for alone or inside a window', async () => {
    const db = fakeDatabase()
    await put(db, B, YESTERDAY, [open('b0', YESTERDAY)], 'DE')
    await put(db, A, TODAY, [open('a1', TODAY)], 'US')
    await put(db, B, TODAY, [open('b1', TODAY, { first_run: false, version: '0.8.0' })], 'DE')
    await put(db, null, TODAY, [
      { name: 'download_press', day: TODAY, page: '/', language: 'en', place: 'hero', os: 'macos', arch: 'arm', version: '0.8.1' },
    ])

    const window = await windowOf(db, [YESTERDAY, TODAY])
    for (const day of [YESTERDAY, TODAY]) {
      assert.deepEqual(window.get(day), await summaryOf(db, day), day)
    }
  })

  it('rewrites the day it already holds rather than adding a second row', async () => {
    const db = fakeDatabase()
    await write(db, TODAY, { installs: 1 }, false)
    await write(db, TODAY, { installs: 2 }, true)
    const [row] = rows(db, 'SELECT day, numbers, settled FROM daily')
    assert.equal(rows(db, 'SELECT COUNT(*) AS n FROM daily')[0].n, 1)
    assert.equal(JSON.parse(row.numbers).installs, 2)
    assert.equal(row.settled, 1)
  })
})

describe('what leaves the database', () => {
  it('sweeps one day in chunks and leaves the other days and the summaries alone', async () => {
    const db = fakeDatabase()
    await put(db, A, '2026-06-01', [open('old1', '2026-06-01'), open('old2', '2026-06-01')])
    await put(db, A, TODAY, [open('new1', TODAY)])
    await write(db, '2026-06-01', { installs: 1 }, true)

    const swept = await db.prepare(SWEEP).bind('2026-06-01', 1).run()
    assert.equal(swept.meta.changes, 1)
    await db.prepare(SWEEP).bind('2026-06-01', 100).run()

    assert.deepEqual(rows(db, 'SELECT event_id FROM events').map((r) => r.event_id), ['new1'])
    assert.equal(rows(db, 'SELECT COUNT(*) AS n FROM daily')[0].n, 1)
  })

  it('forgets one install and nobody else, board id and all', async () => {
    const db = fakeDatabase()
    await put(db, A, TODAY, [
      open('a1', TODAY),
      { id: 'a2', name: 'board_numbers', day: TODAY, surface: 'app', board: BOARD, cards_created: 1 },
    ])
    await put(db, B, TODAY, [open('b1', TODAY)])

    db.sqlite.prepare(`DELETE FROM events WHERE install_id = '${A}'`).run()
    const left = rows(db, 'SELECT install_id, board_id FROM events')
    assert.equal(left.length, 1)
    assert.equal(left[0].install_id, B)
    assert.equal(left[0].board_id, '')
  })
})

// --- helpers ------------------------------------------------------------------

const rows = (db, sql) => db.sqlite.prepare(sql).all()

const shift = (day, days) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

/** The summaries as the daily job reads them: one pass over the whole window. */
async function windowOf(db, days) {
  const list = JSON.stringify(days)
  const spreads = []
  for (const query of SPREADS) spreads.push(...(await db.prepare(query).bind(list).all()).results)
  const totals = await db.prepare(TOTALS).bind(list).all()
  return numbersOf(days, spreads, totals.results, new Map())
}

const summaryOf = async (db, day) => (await windowOf(db, [day])).get(day)

const write = (db, day, numbers, settled) =>
  db
    .prepare(WRITE_SUMMARY)
    .bind(JSON.stringify([{ day, numbers: JSON.stringify(numbers), settled: settled ? 1 : 0 }]), 'now')
    .run()
