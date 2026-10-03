// Stands in for the board's agent: no account, no model. It does the one thing each run's
// flow ends on, the way a real agent would from the same prompt:
//   - asked to add a task, it creates one card titled with the requirement;
//   - asked to plan a card, it writes one summary line and asks the user one question;
//   - asked to apply the user's answers, it takes the answered questions off the card;
//   - asked to build a card, it writes `<id>.txt`; a card whose title says "slow" keeps
//     working for five minutes first, printing a line every few seconds, unless the board
//     resumed the session (`--resume` without `--fork-session`);
//   - asked to continue a delivery, it writes the same `<id>.txt`;
//   - anything else (the board's own describe-product, …) changes nothing.
//
// Use: set the board's agent command to `node <this file> <path to cli/bin/ai4kanban.mjs>` in
// <project>/.akb/boards/docs/kanban/ui.config.json.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const prompt = process.argv.at(-1) ?? ''
if (process.env.STAND_IN_TRACE) writeFileSync(`${process.env.STAND_IN_TRACE}/${Date.now()}.txt`, process.argv.slice(3).join('\n---\n'))
const resumed = process.argv.includes('--resume') && !process.argv.includes('--fork-session')
const akb = (...args) => execFileSync(process.execPath, [process.argv[2], ...args], { encoding: 'utf8' })
const say = (text) => console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } }))
const end = (result) => {
  console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result }))
  process.exit(0)
}

const add = prompt.match(/Add task\(s\) from this requirement: "([^"]+)"/)?.[1]
const plan = prompt.match(/Plan task (\d+)/)?.[1]
const answers = prompt.match(/Apply my answers to the open questions on task (\d+)/)?.[1]
const build = prompt.match(/Implement task (\d+) #\d+ \("([^"]*)"\)/) ?? prompt.match(/^Continue delivery .* card implement (\d+)()/s)

if (add) {
  say(akb('raw', 'create', '--title', add).trim())
  end('Added one card.')
}
if (plan) {
  const list = JSON.parse(akb('raw', 'list', '--json'))
  const card = list.cards?.find((c) => String(c.id) === plan)
  if (card) {
    const path = resolve(list.board, '../..', card.file)
    const text = readFileSync(path, 'utf8')
    writeFileSync(path, text.replace(/^<one short paragraph[^\n]*>$/m, 'A card page gets an Export to PDF button that saves the card as a one-page PDF.'))
  }
  akb('raw', 'update-questions', plan, '--append', '[user] Which page size is the default?', '--recommended-option', 'A4', '--option', 'US Letter')
  say(`Planned #${plan} and asked one question.`)
  end('Planned, one question left for you.')
}
if (answers) {
  akb('raw', 'update-questions', answers, '--clear')
  say(`Applied the answers to #${answers}.`)
  end('Applied your answers.')
}
if (build) {
  const [, id, title] = build
  if (/slow/i.test(title) && !resumed) {
    for (let i = 1; i <= 60; i++) {
      say(`Still working on #${id} (${i * 5}s)…`)
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
  writeFileSync(`${id}.txt`, `${title || 'built'}\n`)
  say(`Wrote ${id}.txt for #${id}.`)
  end(`Built #${id}.`)
}
if (resumed) say('Picking up where I stopped.')
end('Nothing to do here.')
