// Writes sample events into a SQLite file with the real migrations, stores them the way the
// Worker does and writes the daily summaries with the Worker's own SQL. Run from telemetry/:
// node <this folder>/seed.mjs <file.sqlite>
import { rmSync } from 'node:fs'

const at = (path) => new URL(`../../../../telemetry/${path}`, import.meta.url).href
const { fakeDatabase } = await import(at('test/fake.mjs'))
const { store } = await import(at('src/store.ts'))
const { take } = await import(at('src/take.ts'))
const { SPREADS, TOTALS, WRITE_SUMMARY, numbersOf } = await import(at('src/summary.ts'))

const day = (back) => new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10)
const A = '0f3a9b1c-2d4e-4f6a-8b1c-2d4e6f8a0b1c'
const B = '11112222-3333-4444-8555-666677778888'
let n = 0
const event = (back, name, fields) => ({ id: `e${n++}`, name, day: day(back), surface: 'app', version: '0.9.9', harness: 'claude-code', ...fields })

const db = fakeDatabase()
const put = (install, events) => store(db, install, 'US', take({ v: 1, install, events }, day(0), () => `r${n++}`).rows)
await put(A, [
  event(1, 'run_finished', { model: 'claude-opus-5-5', cost_micros: 2_400_000 }),
  event(1, 'run_failed', { model: 'claude-opus-5-5', cost_micros: 600_000 }),
  event(1, 'chat_message', { model: 'claude-opus-5-5', cost_micros: 350_000 }),
  event(1, 'chat_message', { model: 'claude-opus-5-5', cost_micros: 410_000 }),
  event(2, 'chat_message', { model: 'gpt-5.5', cost_micros: 120_000 }),
  event(2, 'chat_message', {}),
])
await put(B, [
  event(1, 'run_finished', { model: 'gpt-5.5', cost_micros: 900_000 }),
  event(1, 'chat_message', { model: 'gpt-5.5', cost_micros: 9_500_000 }),
])

const days = [day(1), day(2)]
const list = JSON.stringify(days)
const spreads = []
for (const query of SPREADS) spreads.push(...(await db.prepare(query).bind(list).all()).results)
const totals = await db.prepare(TOTALS).bind(list).all()
const numbers = numbersOf(days, spreads, totals.results, new Map())
const rows = days.map((d) => ({ day: d, numbers: JSON.stringify(numbers.get(d)), settled: 1 }))
await db.prepare(WRITE_SUMMARY).bind(JSON.stringify(rows), new Date().toISOString()).run()

rmSync(process.argv[2], { force: true })
db.sqlite.exec(`VACUUM INTO '${process.argv[2]}'`)
console.log(`${days.join(', ')}: summaries written to ${process.argv[2]}`)
