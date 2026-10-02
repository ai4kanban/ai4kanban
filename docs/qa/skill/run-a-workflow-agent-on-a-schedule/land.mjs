// Stands in for a real board landing: commits what is in the scratch project and writes
// the delivery record a landing leaves in docs/kanban/deliveries/, landed right now.
// Run from the project folder: node land.mjs <card id> "<card title>"
import fs from 'node:fs'
import { execSync } from 'node:child_process'

const [cardId, title] = [Number(process.argv[2]), process.argv[3]]
execSync('git add -A')
execSync(`git -c user.name=qa -c user.email=qa@example.com commit -q --allow-empty -m "${title} (#${cardId})"`)
const commit = execSync('git rev-parse HEAD').toString().trim()
const at = Date.now()
const record = {
  deliveryId: `qa${cardId}`,
  cardId,
  title,
  status: 'finished',
  startedAt: at - 600_000,
  endedAt: at,
  sessions: [],
  landing: { status: 'landed', attempts: 0, commit, at },
  workflow: { id: 'coding', name: 'Coding' },
}
fs.mkdirSync('docs/kanban/deliveries', { recursive: true })
fs.writeFileSync(`docs/kanban/deliveries/qa${cardId}.json`, JSON.stringify(record, null, 2) + '\n')
console.log(`landed #${cardId} as ${commit.slice(0, 7)}`)
