// Stands in for the board UI's once-a-minute timer (kanban-ui/lib/dispatcher.ts): asks the
// board's rules what they would start right now and prints it, starting nothing.
// Run from the project folder: node tick.mjs <path to cli/dist/kanban.mjs>
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const rules = await import(pathToFileURL(path.resolve(process.argv[2])).href)
await rules.openBoard?.(process.cwd())
console.log(JSON.stringify(await rules.nextWork()))
