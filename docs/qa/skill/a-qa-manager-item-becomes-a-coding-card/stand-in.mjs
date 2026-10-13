// Stands in for qa-manager's agent: no account, no model. Reads its prompt the way Claude Code
// does (the first user message on stdin). The scheduled pass reports one item and hands
// "Check dark mode" to a sub-run; the sub-run reports what it found. Both with `akb triage add`.
// Use: the board's agent command is `node <this file>`; `akb` must be on PATH.
import readline from 'node:readline'
import { execFileSync } from 'node:child_process'

const out = (ev) => console.log(JSON.stringify(ev))
const akb = (...args) => execFileSync('akb', args, { encoding: 'utf8' }).trim()
readline.createInterface({ input: process.stdin }).once('line', (line) => {
  const content = JSON.parse(line).message?.content
  const prompt = typeof content === 'string' ? content : (content ?? []).map((c) => c.text ?? '').join('\n')
  const said = []
  if (prompt.includes('Check dark mode')) {
    said.push(akb('triage', 'add', '--title', 'Dark mode toggle does nothing', '--text', 'Settings → Appearance → Dark: the page stays light.', '--source', 'qa-manager'))
  } else {
    said.push(akb('triage', 'add', '--title', 'Settings page has no QA case', '--text', 'No case under docs/qa covers the settings page.', '--source', 'qa-manager'))
    said.push(akb('run', 'start', 'Check dark mode in Settings and report what fails with akb triage add.'))
    said.push(akb('run', 'wait'))
  }
  out({ type: 'assistant', message: { content: [{ type: 'text', text: said.join('\n') }] } })
  out({ type: 'result', subtype: 'success', is_error: false, result: 'Reported.' })
  process.exit(0)
})
