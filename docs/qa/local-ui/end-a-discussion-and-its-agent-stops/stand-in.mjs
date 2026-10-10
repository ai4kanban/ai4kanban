// Stands in for Claude Code (no account, no model), speaking its `--input-format stream-json
// --output-format stream-json` protocol: one turn per user message on stdin, exit when stdin closes.
// Every message starts a small HTTP server on a free port, detached the way `nohup … &` would leave
// it, and names the port in the reply. A message containing 后台 also reports a background task
// that never finishes on its own, so the agent stays alive after the reply.
//
// Use: set the board's agent command to `node <this file>` in
// <project>/.akb/boards/docs/kanban/ui.config.json. With STAND_IN_LOG set, it logs its pid, the
// server's pid and port, and how it ended.
import fs from 'node:fs'
import net from 'node:net'
import { spawn } from 'node:child_process'

const log = (line) => process.env.STAND_IN_LOG && fs.appendFileSync(process.env.STAND_IN_LOG, `${new Date().toISOString().slice(11, 19)} [${process.pid}] ${line}\n`)
log('agent start')
const out = (ev) => process.stdout.write(JSON.stringify(ev) + '\n')
let cost = 0

const turn = (text) => {
  out({ type: 'system', subtype: 'init', model: 'stand-in' })
  out({ type: 'assistant', message: { model: 'stand-in', content: [{ type: 'text', text }] } })
  cost += 0.01
  out({ type: 'result', subtype: 'success', is_error: false, result: text, total_cost_usd: cost, usage: { input_tokens: 100, output_tokens: 20 } })
}

const freePort = () =>
  new Promise((ok) => {
    const s = net.createServer().listen(0, () => {
      const { port } = s.address()
      s.close(() => ok(port))
    })
  })

async function serve() {
  const port = await freePort()
  const server = spawn(process.execPath, ['-e', `require('http').createServer((q,s)=>s.end('dev server up\\n')).listen(${port})`], {
    detached: true,
    stdio: 'ignore',
  })
  server.unref()
  log(`dev server pid ${server.pid} on port ${port}`)
  return port
}

const textOf = (content) =>
  typeof content === 'string' ? content : (content ?? []).map((b) => b.text ?? '').join('\n')

let buf = ''
process.stdin.on('data', async (d) => {
  buf += d
  let end
  while ((end = buf.indexOf('\n')) >= 0) {
    const said = textOf(JSON.parse(buf.slice(0, end)).message?.content)
    buf = buf.slice(end + 1)
    const port = await serve()
    if (said.includes('后台')) {
      out({ type: 'system', subtype: 'task_started', task_id: 'b1', is_backgrounded: true, description: 'npm run dev' })
      out({ type: 'system', subtype: 'background_tasks_changed', tasks: [{ task_id: 'b1', description: 'npm run dev' }] })
      turn(`dev server 已在后台启动：http://localhost:${port}`)
    } else turn(`dev server 已启动：http://localhost:${port}`)
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
