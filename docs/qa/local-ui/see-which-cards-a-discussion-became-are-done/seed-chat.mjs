// Writes the record a discussion leaves once its plans were written into cards: four plans,
// each into one card — #2, #3, #4 and #9 (a card whose file no longer exists).
// Usage: node seed-chat.mjs <board state folder>/chats
import fs from 'node:fs'
import path from 'node:path'

const dir = process.argv[2]
const at = Date.now() - 3600_000
const plan = (id, slug, card, title) => ({ path: `plans/${id}-${slug}.md`, run: `run-${id}`, answer: 'plan', done: true, workflow: 'coding', title, cards: [card] })
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'discussion-0a5e0c1d-2b3c-4d5e-8f90-a1b2c3d4e5f6.json'), JSON.stringify({
  cardId: 'discussion-0a5e0c1d-2b3c-4d5e-8f90-a1b2c3d4e5f6',
  harness: 'claude-code',
  title: '列表导出',
  plans: [
    plan(5, 'export-csv', 2, '导出 CSV'),
    plan(6, 'csv-header', 3, '导出时带上表头'),
    plan(7, 'export-excel', 4, '导出为 Excel'),
    plan(8, 'export-pdf', 9, '导出为 PDF'),
  ],
  messages: [
    { role: 'you', text: '用户想把列表导出来，CSV、Excel、PDF 都有人提。', at },
    { role: 'agent', text: '先做 CSV 和表头，Excel 与 PDF 各写一张卡，之后再看要不要。', at: at + 60_000 },
  ],
  startedAt: at,
  updatedAt: at + 60_000,
}, null, 2) + '\n')
