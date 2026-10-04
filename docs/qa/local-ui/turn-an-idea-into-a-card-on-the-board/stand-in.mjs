// Stands in for the board's agent: no account, no model. It does what each run's flow ends
// on, the way a real agent would from the same prompt:
//   - in a discussion, it saves the user's words as a plan with `raw plan new`;
//   - asked to add tasks from a plan, it creates one card from it with `--source`;
//   - asked to plan a card, it writes one summary line and asks the user one question;
//   - anything else (the board's own describe-product, …) changes nothing.
//
// Use: set the board's agent command to `node <this file> <path to cli/bin/ai4kanban.mjs>` in
// <project>/.akb/boards/docs/kanban/ui.config.json.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const prompt = process.argv.at(-1) ?? ''
if (process.env.STAND_IN_TRACE) writeFileSync(`${process.env.STAND_IN_TRACE}/${Date.now()}.txt`, process.argv.slice(3).join('\n---\n'))
const akb = (...args) => execFileSync(process.execPath, [process.argv[2], ...args], { encoding: 'utf8' })
const say = (text) => console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } }))
const end = (result) => {
  console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result }))
  process.exit(0)
}

const fromPlan = prompt.match(/Add task\(s\) from the plan at `([^`]+)`/)?.[1]
const plan = prompt.match(/Plan task (\d+)/)?.[1]

if (fromPlan) {
  const board = JSON.parse(akb('raw', 'list', '--json')).board
  const text = readFileSync(resolve(board, fromPlan), 'utf8')
  const title = text.match(/^# (.+)$/m)?.[1] ?? 'New task'
  say(akb('raw', 'create', '--title', title, '--source', fromPlan).trim())
  end('Added one card.')
}
if (plan) {
  const list = JSON.parse(akb('raw', 'list', '--json'))
  const card = list.cards?.find((c) => String(c.id) === plan)
  if (card) {
    const path = resolve(list.board, '../..', card.file)
    const text = readFileSync(path, 'utf8')
    writeFileSync(path, text.replace(/^<one short paragraph[^\n]*>$/m, 'The card page gets an Export to PDF button that saves the card as a one-page PDF.'))
  }
  akb('raw', 'update-questions', plan, '--append', '[user] Which page size is the default?', '--recommended-option', 'A4', '--option', 'US Letter')
  say(`Planned #${plan} and asked one question.`)
  end('Planned, one question left for you.')
}
if (process.env.KANBAN_DISCUSSION) {
  const draft = join(mkdtempSync(join(tmpdir(), 'plan-')), 'draft.md')
  writeFileSync(draft, '# Export a card as PDF\n\nPeople want to hand a card to someone outside the board.\n\n- A card can be saved as a one-page PDF from its page.\n')
  const out = akb('raw', 'plan', 'new', '--title', 'Export a card as PDF', '--body-file', draft).trim()
  say(`Saved a plan: ${out}. Press Plan tasks to turn it into a card.`)
  end('Saved a plan.')
}
end('Nothing to do here.')
