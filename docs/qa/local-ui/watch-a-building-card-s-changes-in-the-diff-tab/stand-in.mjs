// Stands in for the board's agent: no account, no model. Asked to build a card, it does what a
// real build leaves mid-way — edits README.md and writes a new file, commits nothing — then
// keeps working until a file named `finish` appears next to this script, and ends; anything
// else (the board's own describe-product, …) changes nothing.
//
// Use: set the board's agent command to `node <this file>` in
// <project>/.akb/boards/docs/kanban/ui.config.json.
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'

const prompt = process.argv.at(-1) ?? ''
const say = (text) => console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } }))
const end = (result) => {
  console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result }))
  process.exit(0)
}

const id = prompt.match(/Implement task (\d+)/)?.[1]
if (!id) end('Nothing to do here.')
const finish = new URL('finish', import.meta.url)
say(`Working on #${id}…`)
await new Promise((r) => setTimeout(r, 20000))
appendFileSync('README.md', '\n## Export\n\nOpen a list and press **Export CSV**.\n')
mkdirSync('src', { recursive: true })
writeFileSync('src/export-csv.js', 'export function toCsv(rows) {\n  const head = Object.keys(rows[0] ?? {})\n  return [head, ...rows.map((r) => head.map((k) => r[k]))].map((l) => l.join(",")).join("\\n")\n}\n')
say('Edited README.md and wrote src/export-csv.js.')
while (!existsSync(finish)) await new Promise((r) => setTimeout(r, 2000))
end(`Built #${id}.`)
