// Stands in for Claude Code (no account, no model), speaking its `--input-format stream-json
// --output-format stream-json` protocol. Every user message gets a slow reply: one sentence
// every 3 s for 60 s, then `result`. Exits when stdin closes or on SIGTERM.
//
// Use: set the board's agent command to `node <this file>` in
// <project>/.akb/boards/docs/kanban/ui.config.json. With STAND_IN_LOG set, it logs what it
// sends and how it ends there.
import fs from 'node:fs'

const log = (line) => process.env.STAND_IN_LOG && fs.appendFileSync(process.env.STAND_IN_LOG, `${new Date().toISOString().slice(11, 19)} [${process.pid}] ${line}\n`)
log('start')
const out = (ev) => process.stdout.write(JSON.stringify(ev) + '\n')

function reply() {
  out({ type: 'system', subtype: 'init', model: 'stand-in' })
  let n = 0
  const timer = setInterval(() => {
    n++
    const text = `第 ${n} 段：导出 CSV 要考虑编码、分隔符和大文件分页。`
    out({ type: 'assistant', message: { model: 'stand-in', content: [{ type: 'text', text }] } })
    log(`out sentence ${n}`)
    if (n < 20) return
    clearInterval(timer)
    out({ type: 'result', subtype: 'success', is_error: false, result: '', total_cost_usd: 0.01, usage: { input_tokens: 100, output_tokens: 200 } })
    log('out result')
  }, 3000)
}

let buf = ''
process.stdin.on('data', (d) => {
  buf += d
  let end
  while ((end = buf.indexOf('\n')) >= 0) {
    buf = buf.slice(end + 1)
    log('in  user message')
    reply()
  }
})
process.stdin.on('end', () => {
  log('stdin closed, exit')
  process.exit(0)
})
process.on('SIGTERM', () => {
  log('SIGTERM, exit')
  process.exit(143)
})
