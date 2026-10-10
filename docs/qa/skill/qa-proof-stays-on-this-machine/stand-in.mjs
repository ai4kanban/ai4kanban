// Stands in for the board's agent on a `qa-manager` run: no account, no model. It keeps the
// prompt it got in <folder>/prompt.txt, writes one case where it works and its proof where
// the prompt's Proof rule says, then ends. Any other run ends cleanly with nothing done.
// Use: the board's agent command is `node <this file> <folder to keep the prompt in>`.
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

const say = (text) => console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } }))
const end = (result) => {
  console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result }))
  process.exit(0)
}

readline.createInterface({ input: process.stdin }).once('line', (line) => {
  const content = JSON.parse(line).message?.content
  const prompt = typeof content === 'string' ? content : (content ?? []).map((c) => c.text ?? '').join('\n')
  if (!/the `qa-manager` agent/.test(prompt)) end('Not a QA run: nothing to do.')
  fs.writeFileSync(path.join(process.argv[2], 'prompt.txt'), prompt)
  const project = prompt.match(/in the project at `([^`]+)`/)?.[1]
  if (!project) end('No project folder in the prompt.')
  fs.mkdirSync('docs/qa/demo/open-the-app', { recursive: true })
  fs.writeFileSync('docs/qa/demo/open-the-app/case.md', '# Open the app\n\n## Steps\n\n1. Run `app`.\n   It starts.\n   [01-start.log](01-start.log)\n\n## Feedback\n\n- Fine.\n')
  const proof = path.join(project, '.akb/qa/demo/open-the-app')
  fs.rmSync(proof, { recursive: true, force: true })
  fs.mkdirSync(proof, { recursive: true })
  fs.writeFileSync(path.join(proof, '01-start.log'), `$ app\nstarted at ${new Date().toISOString()}\n`)
  say(`Wrote docs/qa/demo/open-the-app/case.md here (${process.cwd()}), and its proof in ${proof}.`)
  end('One case written.')
})
