import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { INSTALLS_HEADER, LIMITS } from '../contract.ts'
import { READ_INSTALLS, WRITE_INSTALLS, badgeOf } from '../src/installs.ts'
import worker from '../src/index.ts'
import { fakeEnv } from './fake.mjs'

// The one number this service answers a request with. What matters: it is the days added up
// rather than a counter that was only ever added to, and a number it cannot read is unknown
// rather than zero — a badge reading 0 would say nobody has ever installed it.

/** Every key shields.io's endpoint schema names. It refuses a body carrying any other. */
const SHIELDS_KEYS = new Set([
  'schemaVersion',
  'label',
  'message',
  'color',
  'labelColor',
  'isError',
  'namedLogo',
  'logoSvg',
  'logoColor',
  'logoSize',
  'style',
  'cacheSeconds',
  'logoPosition',
  'logoWidth',
])

const summary = (firstRuns) => JSON.stringify({ first_run_surface: firstRuns })

function seed(env, days) {
  const put = env.DB.sqlite.prepare(
    'INSERT INTO daily (day, numbers, settled, written_at) VALUES (?, ?, 1, ?)',
  )
  for (const [day, numbers] of days) put.run(day, numbers, '2026-09-14T04:00:00.000Z')
}

const count = async (env) => {
  await env.DB.prepare(WRITE_INSTALLS).bind('2026-09-14T23:45:00.000Z').run()
  return env.DB.sqlite.prepare('SELECT day, first_runs, total FROM installs ORDER BY day').all()
}

const get = (env, path = '/v1/installs', method = 'GET') =>
  worker.fetch(new Request(`https://t.ai4kanban.dev${path}`, { method }), env)

describe('the installs total', () => {
  it('adds the days up, and counts a day with no first run as none of them', async () => {
    const env = fakeEnv()
    seed(env, [
      ['2026-09-01', summary({ app: 3, command: 1 })],
      ['2026-09-02', JSON.stringify({ installs: 9 })],
      ['2026-09-03', summary({ app: 5 })],
    ])
    assert.deepEqual(
      (await count(env)).map((row) => [row.day, row.first_runs, row.total]),
      [
        ['2026-09-01', 4, 4],
        ['2026-09-02', 0, 4],
        ['2026-09-03', 5, 9],
      ],
    )
  })

  it('carries a corrected day through to the days after it', async () => {
    const env = fakeEnv()
    seed(env, [
      ['2026-09-01', summary({ app: 3 })],
      ['2026-09-02', summary({ app: 5 })],
    ])
    await count(env)
    // The backfill window rewrote the first day; a counter only ever added to would keep the
    // correction out for good.
    env.DB.sqlite
      .prepare('UPDATE daily SET numbers = ? WHERE day = ?')
      .run(summary({ app: 30 }), '2026-09-01')
    assert.deepEqual(
      (await count(env)).map((row) => row.total),
      [30, 35],
    )
  })

  it('fills the history in on its own, from every summary the database holds', async () => {
    const env = fakeEnv()
    seed(env, Array.from({ length: 40 }, (_, n) => [`2026-08-${String(n + 1).padStart(2, '0')}`, summary({ app: 2 })]).slice(0, 20))
    const written = await count(env)
    assert.equal(written.length, 20)
    assert.equal(written.at(-1).total, 40)
  })
})

describe('the installs route', () => {
  it('answers the badge shields.io asks for, and says which day it counts through', async () => {
    const env = fakeEnv()
    seed(env, [['2026-09-01', summary({ app: 1_234 })]])
    await count(env)

    const answer = await get(env)
    assert.equal(answer.status, 200)
    assert.equal(answer.headers.get(INSTALLS_HEADER), '2026-09-01')
    assert.match(answer.headers.get('cache-control'), /max-age=3600/)
    const body = await answer.json()
    assert.equal(body.schemaVersion, 1)
    assert.equal(body.label, 'installs')
    assert.equal(body.message, '1,234')
    for (const key of Object.keys(body)) assert.ok(SHIELDS_KEYS.has(key), `${key} is not shields'`)
  })

  it('says unknown rather than zero when there is no total to read', async () => {
    const env = fakeEnv()
    const answer = await get(env)
    assert.equal(answer.status, 200)
    assert.equal(answer.headers.get(INSTALLS_HEADER), null)
    assert.equal((await answer.json()).message, 'unknown')
    assert.equal(badgeOf(null).message, 'unknown')
  })

  it('still answers unknown when the read itself fails', async () => {
    const env = fakeEnv()
    env.DB.sqlite.exec('DROP TABLE installs')
    const answer = await get(env)
    assert.equal(answer.status, 200)
    assert.equal((await answer.json()).message, 'unknown')
  })

  it('takes no parameter and answers nothing but a GET', async () => {
    const env = fakeEnv()
    seed(env, [['2026-09-01', summary({ app: 7 })]])
    await count(env)
    assert.equal((await get(env, '/v1/installs', 'POST')).status, 405)
    // A parameter changes nothing: there is no second number to ask this route for.
    const asked = await get(env, '/v1/installs?days=90&copy=development')
    assert.equal((await asked.json()).message, '7')
  })

  it('says unknown rather than nothing once the address is over its hour', async () => {
    const env = fakeEnv()
    seed(env, [['2026-09-01', summary({ app: 7 })]])
    await count(env)
    const from = (address) =>
      worker.fetch(
        new Request('https://t.ai4kanban.dev/v1/installs', {
          headers: { 'cf-connecting-ip': address },
        }),
        env,
      )
    for (let n = 0; n <= LIMITS.requestsPerHour; n += 1) await from('203.0.113.7')

    // shields.io draws an error badge for anything but a 200, so a refusal here would put
    // "inaccessible" in the README rather than the unknown the card asks for.
    const over = await from('203.0.113.7')
    assert.equal(over.status, 200)
    assert.equal((await over.json()).message, 'unknown')
    // Another address is unaffected, and still gets the number.
    assert.equal((await (await from('203.0.113.8')).json()).message, '7')
  })

  it('reads one row and never an event', async () => {
    assert.match(READ_INSTALLS, /FROM installs/)
    assert.ok(!/events/.test(READ_INSTALLS), READ_INSTALLS)
    assert.match(READ_INSTALLS, /LIMIT 1/)
  })
})
