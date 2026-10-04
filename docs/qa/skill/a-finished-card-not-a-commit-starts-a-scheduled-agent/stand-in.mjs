// Stands in for the board's agent: no account, no model.
//   - asked to describe the project, it writes a one-section description to
//     docs/kanban/memory/project.md;
//   - started as a scheduled agent, it lists the cards landed since its last run and adds one
//     line to CHANGELOG.md in the folder it was started in;
//   - started for anything else, it changes nothing and ends cleanly.
//
// Use: set the board's agent command to `node <this file> <path to cli/bin/ai4kanban.mjs>` in
// <project>/.akb/boards/docs/kanban/ui.config.json.
import { execFileSync } from 'node:child_process'
import { appendFileSync, writeFileSync } from 'node:fs'

const prompt = process.argv.at(-1) ?? ''
const board = prompt.match(/The board is at `([^`]+)`/)?.[1]
const say = (text) => console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } }))
const end = (result) => {
  console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result }))
  process.exit(0)
}

if (/Describe this project/.test(prompt)) {
  writeFileSync('docs/kanban/memory/project.md', '# Project\n\n## What it is\n\n一个记录读书笔记的小工具。\n')
  end('Described the project.')
}
if (!board || !/^You are the `[^`]+` agent of the /.test(prompt)) end('Nothing to do.')
let landed = ''
try {
  landed = execFileSync(process.execPath, [process.argv[2], 'raw', 'list', '--archived', '--since', 'last-run'], { encoding: 'utf8' })
} catch (e) {
  landed = `${e.stdout ?? ''}${e.stderr ?? ''}`
}
say(`$ akb raw list --archived --since last-run\n${landed.trim()}`)
appendFileSync('CHANGELOG.md', `- scheduled run at ${new Date().toISOString().slice(0, 16)}Z\n`)
end('Added one line to CHANGELOG.md.')
