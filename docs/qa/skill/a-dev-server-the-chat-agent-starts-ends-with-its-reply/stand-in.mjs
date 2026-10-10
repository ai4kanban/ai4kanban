// Stands in for Claude Code: no account, no model. On each stdin message it starts a "dev
// server" the way an agent's `nohup npm run dev &` does — detached, its own process group,
// outliving the agent — writes the pids to `pids.json` in the project folder, replies, and
// exits when stdin closes, as Claude Code does at the end of a turn.
// Use: the board's agent command is `node <this file>`.
import { spawn } from 'node:child_process'
import fs from 'node:fs'

const out = (ev) => process.stdout.write(JSON.stringify(ev) + '\n')
process.stdin.once('data', () => {
  const server = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' })
  server.unref()
  fs.writeFileSync('pids.json', JSON.stringify({ agent: process.pid, server: server.pid }))
  const text = `Started the dev server (pid ${server.pid}) and left it running.`
  out({ type: 'system', subtype: 'init', model: 'stand-in' })
  out({ type: 'assistant', message: { content: [{ type: 'text', text }] } })
  out({ type: 'result', result: text, total_cost_usd: 0, usage: { input_tokens: 1, output_tokens: 1 } })
})
process.stdin.on('end', () => process.exit(0))
