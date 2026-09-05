import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { LIMITS } from '../contract.ts'
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
  it('sweeps what expired, writes the open days, and settles the one that closed', async () => {
    const env = fakeEnv()
    await put(env, TODAY, 'a1')
    await put(env, shift(TODAY, -3), 'a2')
    await put(env, shift(TODAY, -200), 'old')

    const run = await runDaily(env, NOW)
    assert.equal(run.swept, 1)
    assert.equal(run.carried, 0)
    assert.equal(run.summarised.length, CLOSES + 1)

    const rows = env.DB.sqlite.prepare('SELECT day, settled, numbers FROM daily ORDER BY day').all()
    assert.equal(rows.length, CLOSES + 1)
    assert.equal(rows[0].settled, 1)
    assert.equal(rows.at(-1).settled, 0)
    assert.equal(JSON.parse(rows.at(-1).numbers).installs, 1)
  })

  it('leaves a settled day alone on the next run', async () => {
    const env = fakeEnv()
    await runDaily(env, NOW)
    const again = await runDaily(env, NOW)
    assert.equal(again.summarised.length, CLOSES)
    assert.ok(!again.summarised.includes(shift(TODAY, -CLOSES)))
  })

  it('stays inside the free plan\'s fifty queries a run and carries the rest', async () => {
    const env = fakeEnv()
    // A service that has been running a while and missed a long stretch of days: the most
    // work one run can ever be asked for.
    env.DB.sqlite
      .prepare("INSERT INTO daily (day, numbers, settled, written_at) VALUES (?, '{}', 1, 'x')")
      .run(shift(TODAY, -LIMITS.retentionDays))
    let queries = 0
    const real = env.DB.prepare.bind(env.DB)
    env.DB.prepare = (sql) => {
      queries += 1
      return real(sql)
    }

    const run = await runDaily(env, NOW)
    // One more request goes to the usage gauge, which is a subrequest like every query here.
    assert.ok(queries + 1 <= 50, `${queries + 1} queries`)
    assert.ok(run.carried > 0, 'the rest is carried to the next run, not dropped')
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

  it('writes the summaries even when the sweep fails', async () => {
    const env = fakeEnv()
    const real = env.DB.prepare.bind(env.DB)
    env.DB.prepare = (sql) => {
      if (sql.includes('DELETE FROM events')) {
        return { bind: () => ({ run: async () => { throw new Error('read-only') } }) }
      }
      return real(sql)
    }
    const run = await runDaily(env, NOW)
    assert.equal(run.swept, 0)
    assert.equal(run.summarised.length, CLOSES + 1)
  })
})

async function put(env, day, id) {
  const taken = take(
    { v: 1, install: A, events: [{ id, name: 'app_day', day, surface: 'app', version: '0.8.1' }] },
    day,
    () => id,
  )
  await store(env.DB, taken.install, 'US', taken.rows)
}
