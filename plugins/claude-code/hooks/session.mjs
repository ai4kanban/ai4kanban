// Tells the model this Claude session's id, which discuss-goal keeps its goals under, and puts
// the plugin's `akb` first on the PATH of a session started by hand.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function putAkbOnPath() {
  const file = process.env.CLAUDE_ENV_FILE
  if (!file) return
  const dir = path.join(process.env.WILDCRANE_HOME || path.join(os.homedir(), '.wildcrane'), 'bin', 'akb')
  try {
    // The name the flows print: the running copy's own path otherwise, and "no `akb` on this machine".
    fs.appendFileSync(file, `export PATH='${dir.replaceAll("'", `'\\''`)}':"$PATH"\nexport AI4KANBAN_COMMAND=akb\n`)
  } catch {
    // The session runs on without it.
  }
}

let input = ''
process.stdin.on('data', (d) => (input += d))
process.stdin.on('end', () => {
  if (process.env.WILDCRANE_JOB) return
  putAkbOnPath()
  const session = JSON.parse(input || '{}').session_id
  if (!session) return
  if (process.env.CLAUDE_ENV_FILE) {
    try { fs.appendFileSync(process.env.CLAUDE_ENV_FILE, `export CLAUDE_CODE_SESSION_ID='${session.replaceAll("'", "'\\''")}'\n`) } catch {}
  }
  const additionalContext = `WildCrane: this Claude Code session's id is ${session}. Use the plugin’s bundled akb for discuss-goal.`
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } }))
})
