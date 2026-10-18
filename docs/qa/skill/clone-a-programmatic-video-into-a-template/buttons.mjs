// Which of Archive / Refine the card page offers, by the board UI's own rules. First bundle them:
// esbuild kanban-ui/lib/format/view/rules.ts --bundle --platform=node --format=esm --outfile=<here>/rules.mjs
// Use: node buttons.mjs <card file> [a line put before the card's <Compare>]
import { readFileSync } from 'node:fs'
import { canRefine, planDeliveryGap } from './rules.mjs'
const [file, extra] = process.argv.slice(2)
const text = readFileSync(file, 'utf8')
let body = text.replace(/^---\n[\s\S]*?\n---\n/, '')
if (extra) body = body.replace('<Compare ', `${extra}\n\n<Compare `)
const boxes = [...body.matchAll(/^- \[([ xX])\]/gm)]
const card = { isGroup: false, status: text.match(/^status: (\w+)/m)[1], deliversIn: 'plan', questions: [], body,
  todos: { total: boxes.length, done: boxes.filter((m) => m[1] !== ' ').length } }
const gap = planDeliveryGap(card)
console.log(`planDeliveryGap: ${gap ?? 'none'}`)
console.log(`Archive button: ${gap === null ? 'shown' : 'hidden'}`)
console.log(`Refine button: ${canRefine(card) ? 'shown' : 'hidden'}`)
