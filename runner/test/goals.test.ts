import assert from 'node:assert/strict'
import { it } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { shimDir } from '../src/akb'
import { cardFlags } from '../src/flow'
import { goalsOf, writeGoals, readGoals } from '../src/goals'

it('新旧读取协议指向同一组目标，缺失和不一致均拒绝', () => {
  const goals = [{ id: 'idea_old', outcome: '原结果', acceptance: ['原验收'] }]
  assert.deepEqual(goalsOf({ ideas: goals }), goals)
  assert.deepEqual(goalsOf({ goals }), goals)
  assert.deepEqual(goalsOf({ goals, ideas: structuredClone(goals) }), goals)
  assert.throws(() => goalsOf({ goals: null } as never), { message: 'The goals array is missing or invalid.' })
  assert.throws(() => goalsOf({}), { message: 'The goals array is missing or invalid.' })
  assert.throws(() => goalsOf({ goals, ideas: [] }), { message: 'goals and ideas do not match.' })
})

it('讨论元数据跨分页保留目录与已选要点，落卡显式传递空列表', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-previews-'))
  const before = process.env.WILDCRANE_HOME
  process.env.WILDCRANE_HOME = home
  try {
    const goal = { id: 'idea_1', title: 'Goal', outcome: 'Result', acceptance: [], workflow: 'wf_custom', previews: ['custom'] }
    const catalog = [{ agent: 'custom', title: { zh: '审阅' }, when: 'The full trigger.' }]
    const pages: (string | null | undefined)[] = []
    const result = await writeGoals({ id: 'job_1', discussion: { id: 'dsc_1', workspace: 'ws_1', ideas: [goal] } } as never, async (_workspace, after) => {
      pages.push(after)
      return { ok: true, value: { data: [{ id: after ? 'wf_custom' : 'wf_first', name: 'Custom', previews: catalog }], next: after ? null : 'wf_first' } }
    })
    assert.ok('file' in result)
    const data = JSON.parse(fs.readFileSync(result.file, 'utf8'))
    assert.equal(data.workspace, 'ws_1')
    assert.deepEqual(data.workflows[1].previews, catalog)
    assert.deepEqual(pages, [null, 'wf_first'])
    assert.deepEqual(readGoals(result.file), [goal])
    assert.equal(fs.existsSync(result.file), false)
    assert.deepEqual(cardFlags({ number: 1 } as never, { previews: [] }), ['--previews', ''])
    assert.deepEqual(cardFlags({ number: 1 } as never, { previews: ['custom'] }), ['--previews', 'custom'])
  } finally {
    if (before === undefined) delete process.env.WILDCRANE_HOME
    else process.env.WILDCRANE_HOME = before
    fs.rmSync(home, { recursive: true, force: true })
  }
})

it('Windows 插件同时提供 cmd 和 shell 的 akb 入口', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'windows-akb-'))
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!
  try {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    shimDir({ command: 'C:\\Program Files\\node.exe', args: ['C:\\WildCrane\\akb.mjs'], version: 'test', shim: dir })
    assert.match(fs.readFileSync(path.join(dir, 'akb.cmd'), 'utf8'), /%\*\r\n$/)
    assert.match(fs.readFileSync(path.join(dir, 'akb'), 'utf8'), /exec 'C:\/Program Files\/node.exe' 'C:\/WildCrane\/akb.mjs' "\$@"/)
  } finally {
    Object.defineProperty(process, 'platform', platform)
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
