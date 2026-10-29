// Tells the model this Claude session's id, which clarify-idea keeps its ideas under.

let input = ''
process.stdin.on('data', (d) => (input += d))
process.stdin.on('end', () => {
  if (process.env.WILDCRANE_JOB) return
  const session = JSON.parse(input || '{}').session_id
  if (!session) return
  const additionalContext = `WildCrane: this Claude Code session's id is ${session}. clarify-idea passes it to wildcrane_draft_read as sessionId.`
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } }))
})
