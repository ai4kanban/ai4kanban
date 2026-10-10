// Writes what a discussion leaves once its plan was written into card #2: the discussion's record,
// and the card's own empty chat pointing back at it (the "from discussion" handoff).
// Usage: node seed-chat.mjs <board state folder>/chats
import fs from 'node:fs'
import path from 'node:path'

const dir = process.argv[2]
const id = 'discussion-0a5e0c1d-2b3c-4d5e-8f90-a1b2c3d4e5f6'
const at = Date.now() - 3600_000
const said = [
  ['you', '用户想把列表导出来，CSV、Excel、PDF 都有人提。先做哪个？'],
  ['agent', '先做 CSV：几乎所有表格软件都能打开，实现最简单。Excel 要处理多工作表和格式，PDF 要排版分页，都比 CSV 重得多。'],
  ['you', '导出的范围呢？全部数据还是当前页？'],
  ['agent', '按当前筛选导出全部结果，不只是当前页。用户筛选出来的就是他想要的；只导出当前页会让人以为数据少了。'],
  ['you', '列太多的时候怎么办？'],
  ['agent', '先导出界面上看得到的列，顺序和界面一致。隐藏列以后再说，可以加一个「导出全部列」的选项。'],
  ['you', '中文在 Excel 里打开会乱码吗？'],
  ['agent', '会，Windows 上的 Excel 默认不按 UTF-8 读。文件开头加 BOM 就能正常显示，这一条写进待办。'],
  ['you', '可以，写成一张卡。'],
  ['agent', '好，写成一张卡「导出 CSV」：列表右上角加「导出」按钮，按当前筛选导出可见列，文件带 BOM。'],
]
const messages = said.map(([role, text], i) => ({ role, text, at: at + i * 60_000 }))
const write = (key, chat) => fs.writeFileSync(path.join(dir, `${key}.json`), JSON.stringify(chat, null, 2) + '\n')
fs.mkdirSync(dir, { recursive: true })
write(id, {
  cardId: id,
  harness: 'claude-code',
  resumeId: '11111111-2222-4333-8444-555555555555',
  title: '列表导出',
  plans: [{ path: 'plans/5-export-csv.md', run: 'run-5', answer: 'plan', done: true, workflow: 'coding', title: '导出 CSV', cards: [2] }],
  messages,
  startedAt: at,
  updatedAt: at + 600_000,
})
write('card-2', {
  cardId: 2,
  harness: 'claude-code',
  from: { harness: 'claude-code', resumeId: '11111111-2222-4333-8444-555555555555', discussion: id, messages: messages.length },
  messages: [],
  startedAt: at + 660_000,
  updatedAt: at + 660_000,
})
