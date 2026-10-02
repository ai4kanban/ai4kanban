// Stands in for real builds: a build needs an agent run, so this writes the delivery rows a
// build would have left in the board's live record, each stopped or waiting at a different
// point, with a real worktree and branch behind it.
// Run from the project folder, with the board UI stopped: node seed.mjs
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const state = '.akb/boards/docs/kanban'
const git = (args, cwd = '.') =>
  execSync(`git -c user.name=qa -c user.email=qa@example.com ${args}`, { cwd, stdio: 'pipe' }).toString().trim()

const base = git('rev-parse HEAD')
const now = Date.now()

// [delivery, card (null = a build with no card), title, what it stopped or waits on]
const rows = [
  ['qa01hook', 2, '导出为 PDF', { stopped: { reason: 'hook', why: 'the `release-checker` hook failed after the build, so nothing was delivered', hook: { agent: 'release-checker', how: 'failed' } } }],
  ['qa02lock', 3, '深色模式跟随系统', { stopped: { reason: 'uncommitted', why: "fatal: Unable to create '.git/worktrees/qa02lock/index.lock': File exists" } }],
  ['qa03held', 4, '每周邮件摘要', { landing: true }],
  ['qa04cant', 5, '看板支持自定义字体', { stopped: { reason: 'hook', why: 'the `release-checker` hook could not start after the build (spawn claude ENOENT), so nothing was delivered', hook: { agent: 'release-checker', how: 'unstarted', error: 'spawn claude ENOENT' } } }],
  ['qa05left', 6, '手机端看板', { landing: true, leftover: 'notes.txt' }],
  ['qa07work', 7, '导入 CSV', {}],
  ['qa06typed', null, '给 README 加一节安装说明', { stopped: { reason: 'uncommitted', why: "fatal: Unable to create '.git/worktrees/qa06typed/index.lock': File exists" } }],
]

const runs = []
const deliveries = rows.map(([deliveryId, cardId, title, at], i) => {
  const worktree = `.akb/worktrees/${cardId ?? deliveryId}/${deliveryId}`
  const branch = cardId === null ? `build/${deliveryId}` : `card/${cardId}/${deliveryId}`
  git(`worktree add -q -b ${branch} ${worktree} ${base}`)
  fs.writeFileSync(path.join(worktree, `${deliveryId}.txt`), `${title}\n`)
  git(`add ${deliveryId}.txt`, worktree)
  git(`commit -q -m "${title}"`, worktree)
  if (at.leftover) fs.writeFileSync(path.join(worktree, at.leftover), 'left by hand\n')

  const startedAt = now - (rows.length - i) * 600_000
  const sessionId = `${deliveryId}-run`
  const logPath = path.resolve(state, 'sessions', `${sessionId}.log`)
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  fs.writeFileSync(logPath, '')
  runs.push({
    sessionId,
    cardId,
    action: 'implement',
    status: 'done',
    ok: true,
    startedAt,
    endedAt: startedAt + 300_000,
    deliveryId,
    logPath,
    ...(cardId === null ? { input: title } : {}),
  })
  return {
    deliveryId,
    cardId,
    title,
    status: 'active',
    startedAt,
    sessions: [sessionId],
    approved: title,
    steps: [],
    base,
    commitMode: 'auto',
    targetBranch: 'main',
    worktree,
    branch,
    ...(at.stopped ? { review: { stopped: { ...at.stopped, at: startedAt + 300_000 } } } : {}),
    ...(at.landing ? { landing: { status: 'waiting', attempts: 0, at: startedAt + 300_000 } } : {}),
  }
})

fs.writeFileSync(path.join(state, 'sessions.json'), JSON.stringify({ runs, deliveries, marks: {} }, null, 2) + '\n')
