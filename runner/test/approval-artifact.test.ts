import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'node:test'

for (const [phase, status, expectedPhase, action] of [
  [1, 'ready', 2, 'approve'],
  [2, 'todo', 2, 'clarify'],
] as const) {
  it(`the packaged CLI handles ${action} at stage ${phase} without approving its active Cloud job again`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-approval-artifact-'))
    try {
      const board = path.join(root, '.akb', 'kanban')
      fs.mkdirSync(path.join(board, 'todo'), { recursive: true })
      fs.writeFileSync(path.join(board, 'config.md'), '# Config\n')
      const file = path.join(board, 'todo', '3-pricing.md')
      fs.writeFileSync(file, `---\ntitle: Pricing\nworkflow: blog-post\npreviews: [blog-planner, blog-illustrator, blog-writer]\nphase: ${phase}\nstatus: ${status}\nquestions: []\n---\n\nPlan.\n`)
      fs.writeFileSync(path.join(root, '.akb', 'base.json'), JSON.stringify({
        layout: 'workspace', head_seq: 1,
        files: { 'projects/prj_1/todo/3-pricing.md': { seq: 1, content: '' } },
      }))
      assert.ok(process.env.RUNNER_DIST, 'test the actual Runner build')
      const result = spawnSync(process.execPath, [
        path.join(process.env.RUNNER_DIST, 'akb', 'bin', 'ai4kanban.mjs'),
        'card', 'approve', '3', '--board', board, '--print', '--json',
      ], {
        cwd: root, encoding: 'utf8', timeout: 15_000,
        env: { ...process.env, KANBAN_RUN: '', AI4KANBAN_TASK: 'task_3',
          AI4KANBAN_HOME: path.join(root, 'home'), WILDCRANE_HOME: path.join(root, 'home') },
      })
      assert.equal(result.status, 0, result.stderr || result.stdout)
      const answer = JSON.parse(result.stdout.trim())
      assert.equal(answer.ok, true)
      assert.match(answer.output, new RegExp(`${action} #3`))
      assert.match(fs.readFileSync(file, 'utf8'), new RegExp(`phase: ${expectedPhase}\\n`))
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
}
