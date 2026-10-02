// Stands in for the chat agent: no account, no model. It starts the two commands a real
// agent would have left running mid-reply, writes their pids to `pids.json` in the project
// folder, and then keeps "replying" until something ends it.
//
// Use: set the board's agent command to `node <this file>`, then send any chat message.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const IDLE = 'setTimeout(() => {}, 600000)'

// A background command, in a process group of its own — what a coding agent's shell tool
// gives `npm test &`. A signal sent to the board's group never reaches it.
const background = spawn(process.execPath, ['-e', IDLE], { detached: true, stdio: 'ignore' })
background.unref()
// A foreground command the agent is still waiting on.
const foreground = spawn('sleep', ['600'], { stdio: 'ignore' })

fs.writeFileSync(
  path.join(process.cwd(), 'pids.json'),
  JSON.stringify({ agent: process.pid, background: background.pid, foreground: foreground.pid }),
)
setTimeout(() => {}, 600000)
