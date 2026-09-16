import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { LIMITS } from '../contract.ts'
import { keyOf, linesOf } from '../src/archive.ts'
import { runDaily, wanted } from '../src/daily.ts'
import { store } from '../src/store.ts'
import { take } from '../src/take.ts'
import { fakeEnv } from './fake.mjs'

// The one job the service runs on a clock. What matters here is which days it writes, that a
// settled day is never rewritten, and that one step failing leaves the rest standing.

const A = '0f3a9b1c-2d4e-4f6a-8b1c-2d4e6f8a0b1c'
const NOW = new Date('2026-09-05T23:45:00Z')
const TODAY = '2026-09-05'
const CLOSES = LIMITS.backfillDays + 1

const shift = (day, days) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

describe('which days a run writes', () => {
  it('rewrites every day still open, settles the one that just closed, oldest first', () => {
    const days = wanted(TODAY, new Set(), new Set())
    const open = days.slice(0, CLOSES + 1)
    assert.equal(open.length, CLOSES + 1)
    assert.equal(open[0].day, shift(TODAY, -CLOSES))
    assert.equal(open[0].settled, true)
    assert.equal(open.at(-1).day, TODAY)
    assert.equal(open.at(-1).settled, false)
  })

  it('closes a day whose last summary was written while it was still open', () => {
    const stale = shift(TODAY, -(CLOSES + 1))
    const days = wanted(TODAY, new Set([stale, shift(TODAY, -CLOSES)]), new Set())
    assert.ok(days.some((day) => day.day === stale && day.settled))
  })

  it('never touches a day it already settled', () => {
    const settled = shift(TODAY, -CLOSES)
    const days = wanted(TODAY, new Set([settled]), new Set([settled]))
    assert.ok(!days.some((day) => day.day === settled))
  })

  it('goes back for a day a run should have written and did not', () => {
    const missed = shift(TODAY, -40)
    const every = Array.from({ length: LIMITS.retentionDays + 1 }, (_, back) => shift(TODAY, -back))
    const held = new Set(every)
    held.delete(missed)
    // Every closed day this service saw is settled but the one no run ever wrote.
    const settled = new Set(every.slice(CLOSES + 1).filter((day) => day !== missed))
    const days = wanted(TODAY, held, settled)
    assert.deepEqual(days.filter((day) => !day.settled).map((day) => day.day).sort(), every.slice(0, CLOSES).sort())
    assert.ok(days.some((day) => day.day === missed && day.settled))
    // Older than the events behind it: nothing to summarise from, so it is never attempted.
    assert.ok(!days.some((day) => day.day === shift(TODAY, -(LIMITS.retentionDays + 1))))
  })

  it('takes the oldest missed day first, before its events are swept', () => {
    // A long outage: more missed days than one run's budget. The oldest is the one the sweep
    // takes next, so a run that starts at the newest end loses it for good.
    const every = Array.from({ length: LIMITS.retentionDays + 1 }, (_, back) => shift(TODAY, -back))
    const held = new Set(every)
    const settled = new Set(every.slice(CLOSES + 1, 40))
    const days = wanted(TODAY, held, settled)
    const missed = days.slice(CLOSES + 1).map((day) => day.day)
    assert.deepEqual(missed, [...missed].sort())
    assert.equal(missed[0], shift(TODAY, -LIMITS.retentionDays))
  })

  it('writes no day from before the service was running', () => {
    // A first run holds no summary at all, so nothing behind the open days was ever missed.
    const days = wanted(TODAY, new Set(), new Set())
    assert.equal(days.length, CLOSES + 1)
  })
})

describe('the daily run', () => {
  it('sweeps what expired, writes every open day, and settles the one that closed', async () => {
    const env = fakeEnv()
    await put(env, TODAY, 'a1')
    await put(env, shift(TODAY, -6), 'a2')
    await put(env, shift(TODAY, -200), 'old')

    const run = await runDaily(env, NOW)
    assert.equal(run.swept, 1)
    // The whole window is one pass now (#804): no open day waits for a later run.
    assert.equal(run.summarised.length, CLOSES + 1)
    assert.deepEqual(run.summarised, [...run.summarised].sort())
    assert.equal(run.summarised[0], shift(TODAY, -CLOSES))
    assert.equal(run.summarised.at(-1), TODAY)

    const rows = env.DB.sqlite.prepare('SELECT day, settled, numbers FROM daily ORDER BY day').all()
    assert.equal(rows.length, run.summarised.length)
    assert.equal(rows[0].settled, 1)
    assert.equal(rows.at(-1).settled, 0)
    const counted = rows.find((row) => row.day === shift(TODAY, -6))
    assert.equal(JSON.parse(counted.numbers).installs, 1)
  })

  it('writes a row for a day with no events at all, and one with site events only', async () => {
    // Nine open days and one install that reported on one of them. Every other day has to get
    // its own row all the same, or it reads as never summarised and comes back every night.
    const env = fakeEnv()
    await put(env, shift(TODAY, -3), 'a1')
    await site(env, TODAY)

    const run = await runDaily(env, NOW)
    const rows = env.DB.sqlite.prepare('SELECT day, settled, numbers FROM daily ORDER BY day').all()
    assert.deepEqual(rows.map((row) => row.day), run.summarised)
    assert.equal(rows.length, CLOSES + 1)
    for (const row of rows) {
      const numbers = JSON.parse(row.numbers)
      assert.equal(typeof numbers.installs, 'number', row.day)
      assert.equal(numbers.returning_installs, 0, row.day)
    }
    // A day of page views only: an installs count of zero, not a day missing from `daily`.
    const today = rows.find((row) => row.day === TODAY)
    assert.equal(JSON.parse(today.numbers).installs, 0)
    assert.deepEqual(JSON.parse(today.numbers).events, { page_view: 1 })
    // A day nothing happened on at all.
    const quiet = rows.find((row) => row.day === shift(TODAY, -1))
    assert.equal(JSON.parse(quiet.numbers).installs, 0)
    assert.equal(JSON.parse(quiet.numbers).events, undefined)
    // Only the day that just closed is settled; the open ones stay open.
    assert.deepEqual(
      rows.filter((row) => row.settled === 1).map((row) => row.day),
      [shift(TODAY, -CLOSES)],
    )
  })

  it("counts the badge's installs total off the summaries it just wrote", async () => {
    const env = fakeEnv()
    const day = shift(TODAY, -CLOSES)
    await put(env, day, 'a1', { ...APP_DAY, name: 'app_open', first_run: true })

    const run = await runDaily(env, NOW)
    assert.equal(run.countedInstalls, true)
    const rows = env.DB.sqlite.prepare('SELECT day, total FROM installs ORDER BY day').all()
    assert.equal(rows[0].day, day)
    assert.equal(rows.at(-1).total, 1)
  })

  it('leaves a settled day alone on the next run', async () => {
    const env = fakeEnv()
    const first = await runDaily(env, NOW)
    const again = await runDaily(env, NOW)
    assert.ok(!again.summarised.includes(shift(TODAY, -CLOSES)))
    assert.equal(first.summarised[0], shift(TODAY, -CLOSES))
    assert.equal(again.summarised[0], shift(TODAY, -CLOSES + 1))
  })

  it('writes the same numbers for a day whether it goes in alone or with the window', async () => {
    // The window is grouped by day in SQL now (#804). A day must come out of the grouped pass
    // exactly as it came out of a pass that held nothing else.
    const alone = fakeEnv()
    const together = fakeEnv()
    const days = Array.from({ length: CLOSES + 1 }, (_, back) => shift(TODAY, -back))
    for (const [n, day] of days.entries()) {
      for (const env of [alone, together]) {
        await put(env, day, `a${n}`)
        await put(env, day, `b${n}`, { ...APP_DAY, name: 'app_open', first_run: true })
        await site(env, day)
      }
    }
    // `alone` is given every day but one as settled, so each run writes a single open day.
    const hold = alone.DB.sqlite.prepare(
      "INSERT INTO daily (day, numbers, settled, written_at) VALUES (?, '{}', 1, 'x')",
    )
    await runDaily(together, NOW)
    const read = (env, day) =>
      JSON.parse(env.DB.sqlite.prepare('SELECT numbers FROM daily WHERE day = ?').get(day).numbers)

    for (const day of days) {
      alone.DB.sqlite.prepare('DELETE FROM daily').run()
      for (const other of days) if (other !== day) hold.run(other)
      const one = await runDaily(alone, NOW)
      assert.deepEqual(one.summarised, [day])
      assert.deepEqual(read(alone, day), read(together, day), day)
    }
  })

  it('writes a day the job missed alongside the open days, before the sweep takes it', async () => {
    // The missed day goes in the same window as the open ones, and the report reads by date,
    // so the oldest day the job owes is the first thing the run says it wrote.
    const env = fakeEnv()
    const missed = shift(TODAY, -40)
    const hold = env.DB.sqlite.prepare(
      "INSERT INTO daily (day, numbers, settled, written_at) VALUES (?, '{}', ?, 'x')",
    )
    for (let back = LIMITS.retentionDays; back > CLOSES; back -= 1) {
      if (shift(TODAY, -back) !== missed) hold.run(shift(TODAY, -back), 1)
    }
    await put(env, missed, 'm1')

    const run = await runDaily(env, NOW)
    assert.equal(run.summarised[0], missed)
    const row = env.DB.sqlite.prepare('SELECT numbers FROM daily WHERE day = ?').get(missed)
    assert.equal(JSON.parse(row.numbers).installs, 1)
  })

  it("writes every waiting day inside the free plan's fifty queries a run", async () => {
    // The most work one run can ever be asked for: a service that has been running a while,
    // has nine open days, and missed every closed day back to the retention edge. Every step
    // before the summaries is given a day's worth of work too, so each spends its full share.
    const env = fakeEnv({ CF_ACCOUNT_ID: 'account', CF_API_TOKEN: 'token' })
    const every = Array.from({ length: LIMITS.retentionDays + 1 }, (_, back) => shift(TODAY, -back))
    const hold = env.DB.sqlite.prepare(
      "INSERT INTO daily (day, numbers, settled, written_at) VALUES (?, '{}', 0, 'x')",
    )
    // Held but never settled: every one of them is a day the job missed.
    for (const day of every) hold.run(day)
    for (const [n, day] of every.entries()) await put(env, day, `m${n}`)
    // Expired days for the archive and the sweep to spend their shares on.
    for (let back = LIMITS.retentionDays + 1; back <= LIMITS.retentionDays + 4; back += 1) {
      await put(env, shift(TODAY, -back), `x${back}`)
    }

    let queries = 0
    const real = env.DB.prepare.bind(env.DB)
    env.DB.prepare = (sql) => {
      queries += 1
      return real(sql)
    }
    const fetched = globalThis.fetch
    let requests = 0
    globalThis.fetch = async () => {
      requests += 1
      return new Response(JSON.stringify({ data: [] }))
    }
    let run
    try {
      run = await runDaily(env, NOW)
    } finally {
      globalThis.fetch = fetched
    }

    // The usage gauge's read is a subrequest like every query here.
    assert.equal(requests, 1)
    assert.ok(queries + requests <= 50, `${queries + requests} queries`)
    // Nothing waits for tomorrow: every day `wanted` named was written tonight.
    assert.deepEqual(run.summarised, [...every].sort())
    const rows = env.DB.sqlite.prepare('SELECT day, settled FROM daily ORDER BY day').all()
    assert.equal(rows.length, every.length)
    // The day that just closed and every missed day behind it are settled for good; the
    // open days stay open, to be rewritten tomorrow.
    assert.deepEqual(
      rows.filter((row) => row.settled === 0).map((row) => row.day),
      every.slice(0, CLOSES).sort(),
    )
  })

  it('gives a day summarised late what it cost, not an unknown', async () => {
    // The gauge is read back as far as a day this run may write. A day the job missed carries
    // the same counters as an open one, or the numbers command reads it as unmeasured.
    const missed = shift(TODAY, -40)
    const every = Array.from({ length: LIMITS.retentionDays + 1 }, (_, back) => shift(TODAY, -back))
    const env = fakeEnv({ CF_ACCOUNT_ID: 'account', CF_API_TOKEN: 'token' })
    const hold = env.DB.sqlite.prepare(
      'INSERT INTO daily (day, numbers, settled, written_at) VALUES (?, \'{}\', ?, \'x\')',
    )
    for (const [back, day] of every.entries()) {
      if (day !== missed) hold.run(day, back > CLOSES ? 1 : 0)
    }

    const cost = { requests: 12, rows_written: 3, rows_read: 4 }
    const real = globalThis.fetch
    // The gauge answers the days the run asked for, so a window too short shows up as a day
    // with no usage rather than as a stub that always obliges.
    globalThis.fetch = async (_url, init) => {
      const since = /index1 >= '([\d-]+)'/.exec(init.body)?.[1] ?? '9999-99-99'
      const data = missed >= since ? [{ day: missed, ...cost }] : []
      return new Response(JSON.stringify({ data }))
    }
    try {
      await runDaily(env, NOW)
    } finally {
      globalThis.fetch = real
    }

    const row = env.DB.sqlite.prepare('SELECT numbers FROM daily WHERE day = ?').get(missed)
    assert.deepEqual(JSON.parse(row.numbers).usage, cost)
  })

  it('writes the summaries even when the sweep fails, and says the run failed', async () => {
    const env = fakeEnv()
    await put(env, shift(TODAY, -200), 'old')
    const real = env.DB.prepare.bind(env.DB)
    env.DB.prepare = (sql) => {
      if (sql.includes('DELETE FROM events')) {
        return { bind: () => ({ run: async () => { throw new Error('read-only') } }) }
      }
      return real(sql)
    }
    const run = await runDaily(env, NOW)
    assert.equal(run.swept, 0)
    assert.deepEqual(run.failed, ['sweep'])
    assert.equal(run.summarised.length, CLOSES + 1)
  })
})

// Far enough on that the archive's own first days have reached the retention edge: the run
// writes 2026-09-08 to 2026-09-10 out and may then sweep them.
const AFTER = new Date('2026-12-10T23:45:00Z')
const EDGE = '2026-09-11'
const FIRST = LIMITS.archiveFrom

describe('the archive, ahead of the sweep', () => {
  it('writes every expiring day out, quiet ones as an empty file, then sweeps them', async () => {
    const env = fakeEnv()
    const open = { name: 'app_open', surface: 'app', version: '0.8.1', os: 'darwin', first_run: true }
    await put(env, FIRST, 'a1', open)
    await put(env, shift(FIRST, 2), 'a2')

    const run = await runDaily(env, AFTER)
    assert.deepEqual(run.archived, [FIRST, shift(FIRST, 1), shift(FIRST, 2)])
    assert.equal(run.archivedRows, 2)
    assert.equal(run.held, 0)
    assert.equal(run.swept, 2)

    const [row] = linesOf(env.ARCHIVE.held.get(keyOf(FIRST))).map((line) => JSON.parse(line))
    assert.equal(row.install_id, A)
    assert.equal(row.day, FIRST)
    // The fields come back as an object, not as the JSON string the column holds.
    assert.deepEqual(row.fields, { os: 'darwin', first_run: true })
    // A day the service saw nothing on still gets its file, so absence means unwritten.
    assert.equal(env.ARCHIVE.held.get(keyOf(shift(FIRST, 1))), '')

    const left = env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM events WHERE day < ?').get(EDGE)
    assert.equal(left.n, 0)
  })

  it('leaves a day whose write failed in the database, and the days behind it', async () => {
    const env = fakeEnv()
    await put(env, FIRST, 'a1')
    await put(env, shift(FIRST, 2), 'a2')
    const real = env.ARCHIVE.put.bind(env.ARCHIVE)
    env.ARCHIVE.put = async (key, value, options) => {
      if (key === keyOf(shift(FIRST, 1))) throw new Error('no bucket')
      return real(key, value, options)
    }

    const run = await runDaily(env, AFTER)
    assert.deepEqual(run.archived, [FIRST])
    // The archived day goes; the one behind the failure stays where it is.
    assert.equal(run.swept, 1)
    assert.equal(run.held, 1)
    const left = env.DB.sqlite
      .prepare('SELECT day FROM events WHERE day < ? ORDER BY day')
      .all(EDGE)
    assert.deepEqual(left.map((row) => row.day), [shift(FIRST, 2)])
  })

  it('sweeps a day from before the archive starts without writing it out', async () => {
    const env = fakeEnv()
    await put(env, shift(FIRST, -30), 'old')

    const run = await runDaily(env, AFTER)
    assert.equal(run.swept, 1)
    assert.equal(run.held, 0)
    assert.ok(!env.ARCHIVE.held.has(keyOf(shift(FIRST, -30))))
  })

  it('never rewrites a file the bucket already holds', async () => {
    // A run that died between writing the file and finishing the delete. The sweep may still
    // take what it left behind, but the full file must not be overwritten with it.
    const whole = '{"install_id":"whole","event_id":"e1"}\n{"install_id":"whole","event_id":"e2"}\n'
    const env = fakeEnv()
    env.ARCHIVE.held.set(keyOf(FIRST), whole)
    await put(env, FIRST, 'a1')

    const run = await runDaily(env, AFTER)
    assert.ok(!run.archived.includes(FIRST))
    assert.equal(env.ARCHIVE.held.get(keyOf(FIRST)), whole)
    assert.equal(run.swept, 1)
  })

  it('sweeps nothing at all when the archive cannot be reached', async () => {
    const env = fakeEnv()
    await put(env, FIRST, 'a1')
    env.ARCHIVE.list = async () => {
      throw new Error('no bucket')
    }

    const run = await runDaily(env, AFTER)
    assert.deepEqual(run.archived, [])
    assert.equal(run.swept, 0)
    assert.equal(run.held, 1)
    assert.ok(run.summarised.length > 0, 'the summaries are written all the same')
  })
})

const APP_DAY = { name: 'app_day', surface: 'app', version: '0.8.1' }

async function put(env, day, id, event = APP_DAY) {
  const taken = take({ v: 1, install: A, events: [{ id, day, ...event }] }, day, () => id)
  await store(env.DB, taken.install, 'US', taken.rows)
}

/** A page view: the site's own events carry no install id, so a day may hold only these. */
async function site(env, day) {
  const taken = take(
    { v: 1, events: [{ name: 'page_view', day, page: '/', language: 'en' }] },
    day,
    () => `p-${day}`,
  )
  await store(env.DB, taken.install, 'US', taken.rows)
}
