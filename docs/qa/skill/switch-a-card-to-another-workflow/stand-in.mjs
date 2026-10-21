// Stand-in for Claude Code: takes the prompt on stdin, says which agent it is, then idles for a minute.
let prompt = ''
process.stdin.on('data', (d) => (prompt += d)).on('end', () => {})
setTimeout(() => {
  const who = prompt.match(/You are the `?([\w-]+)`? agent/)?.[1] ?? 'the board'
  process.stdout.write(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: `stand-in for ${who}: idling` }] } }) + '\n')
}, 500)
setTimeout(() => process.exit(0), 60000)
