// Stands in for the board's agent: no account, no model. It does what the `changelog-keeper`
// agent's instructions say, the way a real agent would from the same prompt:
//   - asks the board which cards landed since its last run, and says what it was told;
//   - adds one line to CHANGELOG.md in the folder it was started in;
//   - told "change nothing" in the workflow's extra requirements, it writes nothing;
//   - told "fail", it ends with an error;
//   - started for anything but a scheduled run, it changes nothing and ends cleanly.
//
// Use: set the board's agent command to `node <this file> <path to cli/bin/ai4kanban.mjs>` in
// <project>/.akb/boards/docs/kanban/ui.config.json.
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'

const prompt = process.argv.at(-1) ?? ''
const opening = prompt.split('\n\n')[0]
const board = opening.match(/The board is at `([^`]+)`/)?.[1]
const extra = prompt.match(/——— what this workflow asks of you here ———\n\n([^\n]*)/)?.[1] ?? ''
const say = (text) => console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } }))
const end = (ok, result) => {
  console.log(JSON.stringify({ type: 'result', subtype: ok ? 'success' : 'error', is_error: !ok, result }))
  process.exit(ok ? 0 : 1)
}

if (!board || !/^You are the `[^`]+` agent of the /.test(opening)) end(true, 'Not a scheduled run: nothing to do.')
say(`I was told: ${opening}`)
if (extra) say(`This workflow also asks: ${extra}`)
let landed = ''
try {
  landed = execFileSync(process.execPath, [process.argv[2], 'raw', 'list', '--archived', '--since', 'last-run'], { encoding: 'utf8' })
} catch (e) {
  landed = `${e.stdout ?? ''}${e.stderr ?? ''}`
}
say(`$ akb raw list --archived --since last-run\n${landed.trim()}`)
if (/fail/i.test(extra)) end(false, 'Failed on purpose.')
if (/change nothing/i.test(extra)) end(true, 'Nothing to add.')
appendFileSync('CHANGELOG.md', `- scheduled run at ${new Date().toISOString().slice(0, 16)}Z\n`)
end(true, 'Added one line to CHANGELOG.md.')
