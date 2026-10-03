// Stands in for the board UI's timer: starts the reflection the board's rules would start now.
// Run from the project folder: node start-reflect.mjs <path to cli/dist/kanban.mjs>
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const rules = await import(pathToFileURL(path.resolve(process.argv[2])).href)
await rules.openBoard?.(process.cwd())
for (const req of await rules.nextWork()) {
  if (req.action !== 'reflect') continue
  const started = await rules.startRun(req)
  console.log('error' in started ? started.error : `reflect ${JSON.stringify(req.cards)} — run ${started.run.sessionId}`)
}
