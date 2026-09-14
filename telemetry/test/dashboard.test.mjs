import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DEFAULT_RANGE, RANGES, READ_DAYS, dashboardOf, rangeOf } from '../scripts/dashboard.mjs'
import { pageOf } from '../scripts/page.mjs'
import { report } from '../scripts/report.mjs'

// What the page shows. The two things it must never do: turn a day it has no summary for
// into a zero, and read a headline number off the day that is still taking events.

const TODAY = '2026-09-14'

const summary = (over = {}) => ({
  installs: 300,
  returning_installs: 250,
  boards: 190,
  events: { run_started: 1_000, run_finished: 940, run_failed: 60 },
  page_view_seen: { '/ en': 300, '/download en': 50, '/blog en': 12 },
  download_press_seen: { '/ en': 15, '/download en': 14 },
  first_run_surface: { app: 40, command: 7 },
  install_surface: { app: 180, command: 100 },
  install_version: { '0.9.3': 170 },
  install_country: { CN: 130 },
  board: { cards_created: 340, cards_completed: 298, questions_closed: 412 },
  ...over,
})

const entry = (numbers, settled = true) => ({ numbers, settled, writtenAt: '2026-09-14 04:07' })

/** Every day in the range but the ones named, each with the same summary. */
function board({ days = 14, today = TODAY, without = [], open = [] } = {}) {
  const held = new Map()
  for (const day of rangeOf(today, days + days)) {
    if (without.includes(day)) continue
    held.set(day, entry(summary(), !open.includes(day)))
  }
  return held
}

const view = (over = {}) =>
  dashboardOf({
    endpoint: 'https://t.ai4kanban.dev',
    today: TODAY,
    days: 14,
    held: board(),
    readAt: '08:12',
    ...over,
  })

describe('what the page shows', () => {
  it('leaves a day it has no summary for unknown rather than counting it as zero', () => {
    const one = view({ held: board({ without: ['2026-09-10'] }) })
    const row = one.daily.find((day) => day.day === '2026-09-10')
    assert.equal(row.known, false)
    for (const cell of row.cells) assert.equal(cell.value, null)
    const spark = one.overview[0].series.find((point) => point.day === '2026-09-10')
    assert.equal(spark.value, null)
  })

  it('says unknown for a range with no summary at all, and prints no zero doing it', () => {
    const empty = view({ held: new Map() })
    assert.equal(empty.through, null)
    for (const tile of empty.overview) {
      assert.equal(tile.value, null)
      assert.equal(tile.delta, null)
    }
    // The two pages that carry a button are still listed — a missing row would read as a
    // page nobody opened.
    assert.deepEqual(
      empty.site.rows.map((row) => row.page),
      ['/', '/download', 'all'],
    )
    for (const row of empty.site.rows) assert.equal(row.views, null)
    assert.equal(empty.spread, null)

    const page = pageOf(empty)
    assert.match(page, /unknown/)
    assert.ok(!/>0</.test(page), 'a zero reached the page')
  })

  it('reads its headline off the last whole day, never off the one still taking events', () => {
    const one = view({ held: board({ open: [TODAY] }) })
    assert.equal(one.through, '2026-09-13')
    assert.equal(one.openToday, true)
    // Today is a quarter of the way through, and must not drag the headline down with it.
    const partial = board({ open: [TODAY] })
    partial.set(TODAY, entry(summary({ installs: 40 }), false))
    assert.equal(view({ held: partial }).overview[0].value, 300)
  })

  it('still draws the open day, so a part-finished day is seen rather than missed', () => {
    const one = view({ held: board({ open: [TODAY] }) })
    assert.equal(one.overview[0].series.at(-1).day, TODAY)
    assert.match(pageOf(one), /class="open"/)
  })

  it('counts first runs as the day itself, not as one line per surface', () => {
    const tile = view().overview.find((one) => one.key === 'first_runs')
    assert.equal(tile.value, 47)
  })

  it('says how many days its site total was added up from, not how many were asked for', () => {
    // Ninety days asked for, twenty with a summary: the total is those twenty, and a block
    // labelled 90 days would read as a collapse.
    const held = board({ days: 10, today: TODAY })
    const one = view({ days: 90, held })
    assert.equal(one.site.knownDays, 20)
    assert.match(pageOf(one), /20 of 90 days have a summary/)
  })

  it('reads a spread off one day, because installs cannot be added across days', () => {
    const one = view()
    // The newest day with a summary, which is the day the numbers command reads its own
    // spread off — a shape is still a shape half a day in.
    assert.equal(one.spread.day, TODAY)
    const surface = one.spread.columns.find((column) => column.label === 'Surface')
    assert.deepEqual(
      surface.bars.map((bar) => [bar.key, bar.n]),
      [
        ['app', 180],
        ['command', 100],
      ],
    )
  })

  it('divides the same views by the same presses the numbers command does', () => {
    const held = board()
    const all = view({ held }).site.rows.find((row) => row.page === 'all')
    const printed = report(
      'https://t.ai4kanban.dev',
      rangeOf(TODAY, 14),
      new Map([...held].map(([day, one]) => [day, one.numbers])),
    )
    assert.match(printed, new RegExp(`all.*${all.views.toLocaleString('en-US')}`))
    assert.match(printed, new RegExp(`${all.rate.toFixed(1)}%`))
    // The blog's views are in neither: a docs reader who did not download is not a failed
    // download.
    assert.equal(all.views, 14 * 350)
  })

  it('reads the same day as the numbers command does, number for number', () => {
    const held = board()
    const one = view({ held })
    const day = '2026-09-13'
    const row = report(
      'https://t.ai4kanban.dev',
      rangeOf(TODAY, 14),
      new Map([...held].map(([at, entry]) => [at, entry.numbers])),
    )
      .split('\n')
      .find((line) => line.startsWith(day))

    // The day table's `installs`, `returning` and `boards` columns, in that order.
    const printed = row.trim().split(/\s+/).slice(1)
    const tiles = new Map(one.overview.map((tile) => [tile.key, tile]))
    for (const [key, column] of [
      ['installs', 4],
      ['returning', 5],
      ['boards', 6],
    ]) {
      const series = tiles.get(key).series.find((point) => point.day === day)
      assert.equal(String(series.value), printed[column], `${key} on ${day}`)
    }
  })

  it('says the production copy and offers no way to ask for another', () => {
    const page = pageOf(view())
    assert.match(page, /Production/)
    assert.ok(!page.includes('t-dev.ai4kanban.dev'), page)
    assert.ok(!/development/i.test(page), page)
  })

  it('says the read failed rather than showing the numbers as zero', () => {
    const page = pageOf(view({ held: new Map(), readFailed: true }))
    assert.match(page, /Could not read the production summaries/)
    assert.match(page, /restarted/)
  })

  it('offers its ranges shortest first, and reads far enough back for the longest', () => {
    assert.deepEqual(RANGES, [7, 14, 30, 90])
    assert.ok(RANGES.includes(DEFAULT_RANGE))
    assert.equal(READ_DAYS, Math.max(...RANGES))
    const page = pageOf(view())
    for (const days of RANGES) assert.match(page, new RegExp(`href="/\\?days=${days}"`))
  })
})
