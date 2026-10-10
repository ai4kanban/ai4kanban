// Stands in for the board's agent: no account, no model. It reads its prompt the way Claude
// Code does (the first user message on stdin), says the opening line, changes nothing, ends.
// Use: the board's agent command is `node <this file>`.
import readline from 'node:readline'

const out = (ev) => console.log(JSON.stringify(ev))
readline.createInterface({ input: process.stdin }).once('line', (line) => {
  const content = JSON.parse(line).message?.content
  const prompt = typeof content === 'string' ? content : (content ?? []).map((c) => c.text ?? '').join('\n')
  out({ type: 'assistant', message: { content: [{ type: 'text', text: `I was told: ${prompt.split('\n')[0]}` }] } })
  out({ type: 'result', subtype: 'success', is_error: false, result: 'Nothing to change.' })
  process.exit(0)
})
