// Stands in for the board's agent: no account, no model. Asked to archive a card, it does what
// "Finish a task" ends on — `akb raw archive <id>`; anything else changes nothing.
//
// Use: set the board's agent command to `node <this file> <path to cli/bin/ai4kanban.mjs>` in
// <project>/.akb/boards/docs/kanban/ui.config.json.
import { execFileSync } from 'node:child_process'

const prompt = process.argv.at(-1) ?? ''
const say = (text) => console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } }))
const end = (result) => {
  console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result }))
  process.exit(0)
}

const id = prompt.match(/Archive task (\d+)/)?.[1]
if (id) {
  say(execFileSync(process.execPath, [process.argv[2], 'raw', 'archive', id], { encoding: 'utf8' }).trim())
  end(`Archived #${id}.`)
}
end('Nothing to do here.')
