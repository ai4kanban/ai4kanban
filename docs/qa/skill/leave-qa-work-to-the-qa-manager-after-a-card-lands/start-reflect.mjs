// Stands in for the board UI's timer: starts the reflection the board's rules would start now.
// Run from the project folder: node start-reflect.mjs <path to cli/dist/kanban.mjs> [--later <hours>] [card ids]
// --later only says what the timer would start were it that many hours later. With card ids it starts that
// reflection without waiting out the six hours between two of them.
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const args = process.argv.slice(3)
const later = args[0] === '--later' ? Number(args.splice(0, 2)[1]) * 3_600_000 : 0
if (later) {
  const Real = Date
  globalThis.Date = class extends Real {
    constructor(...a) {
      super(...(a.length ? a : [Real.now() + later]))
    }
    static now = () => Real.now() + later
  }
}
const rules = await import(pathToFileURL(path.resolve(process.argv[2])).href)
await rules.openBoard?.(process.cwd())
const ids = args.map(Number)
const reqs = ids.length ? [{ action: 'reflect', cards: ids }] : await rules.nextWork()
const reflects = reqs.filter((req) => req.action === 'reflect')
if (!reflects.length) console.log('(the board would start no reflection now)')
for (const req of reflects) {
  if (later) {
    console.log(`would start reflect ${JSON.stringify(req.cards)}`)
    continue
  }
  const started = await rules.startRun(req)
  console.log('error' in started ? started.error : `reflect ${JSON.stringify(req.cards)} — run ${started.run.sessionId}`)
}
