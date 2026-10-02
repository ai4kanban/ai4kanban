// Stands in for real board landings: makes one empty commit per landing in the scratch
// project and writes the delivery record a landing leaves in docs/kanban/deliveries/.
// Run from the project folder: node seed.mjs
import fs from 'node:fs'
import { execSync } from 'node:child_process'

const rows = [
  // [card, title, workflow (null = the record names none), local time, left a commit]
  [6, '看板支持自定义字体', null, [2026, 8, 27, 8, 30], true],
  [2, '深色模式跟随系统', 'coding', [2026, 8, 28, 10, 12], true],
  [5, '每周邮件摘要', 'coding', [2026, 8, 29, 11, 0], true],
  [8, '修正首页错别字', 'coding', [2026, 8, 30, 9, 20], false],
  [3, '导出为 PDF', 'coding', [2026, 8, 30, 16, 40], true],
  [4, '更新安装文档', 'wf-2', [2026, 9, 1, 9, 5], true],
  [5, '每周邮件摘要', 'coding', [2026, 9, 1, 15, 30], true],
  [7, '手机端看板', 'coding', [2026, 9, 1, 18, 0], true],
]

fs.mkdirSync('docs/kanban/deliveries', { recursive: true })
rows.forEach(([cardId, title, workflow, t, hasCommit], i) => {
  // 20 seconds past the minute, like a real landing
  const at = new Date(...t).getTime() + 20_000
  let commit
  if (hasCommit) {
    execSync(`git -c user.name=qa -c user.email=qa@example.com commit -q --allow-empty -m "${title} (#${cardId})"`)
    commit = execSync('git rev-parse HEAD').toString().trim()
  }
  const deliveryId = `qa${String(i + 1).padStart(2, '0')}`
  const record = {
    deliveryId,
    cardId,
    title,
    status: 'finished',
    startedAt: at - 600_000,
    endedAt: at,
    sessions: [],
    landing: { status: 'landed', attempts: 0, ...(commit ? { commit } : {}), at },
    ...(workflow ? { workflow: { id: workflow, name: workflow } } : {}),
  }
  fs.writeFileSync(`docs/kanban/deliveries/${deliveryId}.json`, JSON.stringify(record, null, 2) + '\n')
})
