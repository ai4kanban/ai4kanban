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

  it('adds runs and cost by model over the range, and reads installs by cost off one day', () => {
    const runs = { run_model: { 'gpt-5.5 1': 3, 'custom 0': 2 }, model_cost_micros: { 'gpt-5.5': 1_500_000 }, install_daily_cost: { '1-10': 4 } }
    const held = new Map(rangeOf(TODAY, 2).map((day) => [day, entry(summary(runs))]))
    const one = view({ held })
    assert.deepEqual(one.runs.models, [
      { model: 'gpt-5.5', runs: 6, priced: 6, cost: 3, perRun: 0.5 },
      { model: 'custom', runs: 4, priced: 0, cost: 0, perRun: null },
    ])
    const bands = one.runs.columns.at(-1).bars.map((bar) => [bar.key, bar.n])
    assert.deepEqual(bands, [['<$1', 0], ['$1–10', 4], ['$10–100', 0], ['≥$100', 0]])
    const page = pageOf(one)
    assert.match(page, /<h2>Runs<\/h2>/)
    assert.match(page, /\$0\.5/)
    assert.match(report('https://t.ai4kanban.dev', rangeOf(TODAY, 2), new Map([...held].map(([day, one]) => [day, one.numbers]))), /gpt-5\.5\s+6\s+6\s+\$3\.00\s+\$0\.5/)
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

// Cloud's hosted AI calls (#1355). TODAY is 2026-09-14, so 14 days reach back to 09-01.
const call = (day, user, capability, over = {}) => ({
  day,
  user_id: user,
  capability,
  calls: 1,
  failed: 0,
  cost: 0,
  cost_unknown: 0,
  credits: 0,
  ...over,
})
const account = (id, over = {}) => ({
  user_id: id,
  email: `${id}@example.com`,
  period: null,
  renewing: null,
  period_end: null,
  ...over,
})
const AI = {
  rows: [
    call('2026-09-13', 'lin', 'judge', { calls: 40, cost: 0.6 }),
    call('2026-09-12', 'lin', 'speech', { calls: 3, failed: 1, cost: 0.03, cost_unknown: 1, credits: 60 }),
    call('2026-09-12', 'lin', 'image', { cost: 0.04, credits: 320 }),
    call('2026-09-10', 'ana', 'judge', { calls: 5, cost: 0.01 }),
    call('2026-09-09', 'bo', 'judge', { calls: 6, cost: 0.02 }),
    call('2026-08-20', 'ana', 'judge', { calls: 100, cost: 3 }),
  ],
  users: [
    account('lin', { period: 'monthly', renewing: true }),
    account('ana', { period: 'yearly', renewing: false, period_end: '2026-09-05' }),
    account('bo'),
  ],
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`)

describe('what hosted AI calls cost', () => {
  it('adds up each capability over the range and nothing outside it', () => {
    const [judge, speech, image] = view({ ai: AI }).ai.capabilities
    assert.equal(judge.calls, 51)
    near(judge.cost, 0.63)
    assert.equal(judge.perCredit, null)
    assert.deepEqual(
      { calls: speech.calls, failed: speech.failed, unknown: speech.unknown, credits: speech.credits },
      { calls: 3, failed: 1, unknown: 1, credits: 60 },
    )
    near(speech.perCredit, 0.03 / 60)
    near(image.perCredit, 0.04 / 320)

    const wide = view({ ai: AI, days: 30 }).ai
    assert.equal(wide.capabilities[0].calls, 151)
    assert.equal(wide.users[0].user, 'ana@example.com')
  })

  it('lists users by total cost, each with every capability and the credits spent', () => {
    const { users } = view({ ai: AI }).ai
    assert.deepEqual(users.map((one) => one.user), ['lin@example.com', 'bo@example.com', 'ana@example.com'])
    assert.deepEqual(users[0].by.map((use) => use.calls), [40, 3, 1])
    near(users[0].cost, 0.67)
    assert.equal(users[0].credits, 380)
  })

  it('holds cost against revenue accrued over the range, by plan', () => {
    const [lin, bo, ana] = view({ ai: AI }).ai.users
    assert.equal(lin.revenue, (15 * 14) / 30)
    near(lin.ratio, 0.67 / 7)
    // An ended subscription still paid for the days it reached into the range.
    assert.equal(ana.revenue, (10 * 14) / 30)
    assert.equal(bo.revenue, 0)

    const week = view({ ai: AI, days: 7 }).ai.users
    assert.equal(week.find((one) => one.user === 'lin@example.com').revenue, (15 * 7) / 30)
    assert.equal(week.find((one) => one.user === 'ana@example.com').revenue, 0)
  })

  it('draws a dash, not a ratio, for a Pro that was gifted', () => {
    const one = view({ ai: AI })
    assert.equal(one.ai.users[1].ratio, null)
    assert.match(pageOf(one), /bo@example\.com<\/td>.*<td>\$0\.00<\/td><td class="un">—<\/td><\/tr>/)
  })

  it('marks a user whose Jev cost is over five times the median, and only that user', () => {
    const one = view({ ai: AI })
    assert.deepEqual(one.ai.users.map((user) => user.flagged), [true, false, false])
    assert.equal((pageOf(one).match(/high Jev cost/g) ?? []).length, 1)

    const even = { ...AI, rows: AI.rows.map((row) => (row.user_id === 'lin' ? { ...row, cost: 0.02 } : row)) }
    assert.ok(view({ ai: even }).ai.users.every((user) => !user.flagged))
  })

  it('says why Cloud was not read rather than showing its cost as zero', () => {
    const one = view({ ai: { failed: 'SUPABASE_ACCESS_TOKEN is not set.' } })
    assert.equal(one.ai.unavailable, 'SUPABASE_ACCESS_TOKEN is not set.')
    assert.equal(one.ai.capabilities, undefined)
    const page = pageOf(one)
    assert.match(page, /Could not read Cloud's AI cost: SUPABASE_ACCESS_TOKEN is not set\./)
    assert.ok(!page.includes('$0'), 'an unread cost was shown as zero')
    // The rest of the page is untouched.
    assert.match(page, /Runs and cards/)
    assert.ok(view().ai.unavailable)
  })

  it('says no call was recorded for a range that was read and holds none', () => {
    const page = pageOf(view({ ai: { rows: [], users: [] } }))
    assert.match(page, /No hosted AI call was recorded in this range/)
  })
})
