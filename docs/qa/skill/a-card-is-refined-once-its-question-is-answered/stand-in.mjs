// Stands in for the board's agent: no account, no model.
//   - asked to apply the user's answers, it does the one thing the real agent's run ends on:
//     it takes the answered questions off the card;
//   - asked to plan, it changes nothing and ends cleanly — a refine that settles nothing.
//
// Use: set the board's agent command to `node <this file> <path to cli/bin/ai4kanban.mjs>` in
// <project>/.akb/boards/docs/kanban/ui.config.json.
import { execFileSync } from 'node:child_process'

const prompt = process.argv.at(-1) ?? ''
const answered = prompt.match(/Apply my answers to the open questions on task (\d+)/)?.[1]
let said = 'Nothing to plan here.'
if (answered) {
  execFileSync(process.execPath, [process.argv[2], 'raw', 'update-questions', answered, '--clear'])
  said = `Applied the answers to #${answered}.`
}
console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: said }] } }))
console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: said }))
