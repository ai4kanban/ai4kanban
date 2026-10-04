// Stands in for the board UI's timer: starts the reflection the board's rules would start now.
// Run from the project folder: node start-reflect.mjs <path to cli/dist/kanban.mjs> [card ids]
// With card ids it starts that reflection without waiting out the hour between two of them.
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const rules = await import(pathToFileURL(path.resolve(process.argv[2])).href)
await rules.openBoard?.(process.cwd())
const ids = process.argv.slice(3).map(Number)
const reqs = ids.length ? [{ action: 'reflect', cards: ids }] : await rules.nextWork()
for (const req of reqs) {
  if (req.action !== 'reflect') continue
  const started = await rules.startRun(req)
  console.log('error' in started ? started.error : `reflect ${JSON.stringify(req.cards)} — run ${started.run.sessionId}`)
}
