// Stands in for Claude Code with a background task: no account, no model. One turn per
// stdin message, the way Claude Code takes them with `--input-format stream-json`. A message
// ending in "ping" is answered at once; any other puts a task in the background, replies
// "Started the tests in the background.", and after <ms> (first argument) reports the task
// done as a turn of its own. It exits when stdin closes.
// Use: the board's agent command is `node <this file> <ms>`.
const after = Number(process.argv[2])
const out = (ev) => process.stdout.write(JSON.stringify(ev) + '\n')
const turn = (text, tasks) => {
  out({ type: 'system', subtype: 'init', model: 'stand-in' })
  if (tasks !== undefined) out({ type: 'system', subtype: 'background_tasks_changed', tasks })
  out({ type: 'assistant', message: { content: [{ type: 'text', text }] } })
  out({ type: 'result', result: text, total_cost_usd: 0, usage: { input_tokens: 1, output_tokens: 1 } })
}
let buf = ''
process.stdin.on('data', (d) => {
  buf += d
  let end
  while ((end = buf.indexOf('\n')) >= 0) {
    const said = JSON.parse(buf.slice(0, end)).message.content
    buf = buf.slice(end + 1)
    const text = typeof said === 'string' ? said : said.map((c) => c.text ?? '').join('\n')
    if (text.trim().endsWith('ping')) turn('pong')
    else {
      out({ type: 'system', subtype: 'task_started', task_id: 't1', is_backgrounded: true })
      turn('Started the tests in the background.', [{ task_id: 't1' }])
      setTimeout(() => {
        out({ type: 'system', subtype: 'background_tasks_changed', tasks: [] })
        out({ type: 'system', subtype: 'task_notification', task_id: 't1', summary: 'npm test finished' })
        turn('The tests passed: 42 of 42.')
      }, after)
    }
  }
})
process.stdin.on('end', () => process.exit(0))
