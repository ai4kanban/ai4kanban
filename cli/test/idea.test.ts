import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, it } from 'node:test'

import { cmdGoal, cmdGoalPreviews } from '../src/commands/goal.ts'
import { findGuide } from '../src/lib/guide.ts'

import { cmdIdea, cmdIdeaWorkflows, splitBody } from '../src/commands/idea.ts'

let dir = ''
let file = ''
const read = () => JSON.parse(fs.readFileSync(file, 'utf8'))
const draft = (text: string) => {
  const at = path.join(dir, 'draft.md')
  fs.writeFileSync(at, text)
  return at
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-idea-'))
  file = path.join(dir, 'ideas.json')
  fs.writeFileSync(file, JSON.stringify({
    workflows: [{ id: 'wf_builtin_coding', name: 'Coding' }, { id: 'wf_builtin_slide_deck', name: 'Slide deck' }],
    ideas: [{ id: 'idea_a', title: 'Started', outcome: '', acceptance: [], workflow: 'wf_builtin_coding', task: 'task_1' }],
  }))
  process.env.KANBAN_IDEAS = file
})
afterEach(() => {
  delete process.env.KANBAN_IDEAS
  fs.rmSync(dir, { recursive: true, force: true })
})

it('splits the outcome from what counts as done', () => {
  assert.deepEqual(splitBody('Visitors see prices.\n\n## Done when\n- /pricing shows both\n- [ ] toggling works\n'), {
    outcome: 'Visitors see prices.',
    acceptance: ['/pricing shows both', 'toggling works'],
  })
  assert.deepEqual(splitBody('Just an outcome.'), { outcome: 'Just an outcome.', acceptance: [] })
})

it('drafts, saves, drops and starts ideas in the file the Runner reads back', () => {
  cmdIdea(['new'], { title: 'Pricing page', bodyFile: draft('Prices.\n\n## Done when\n- shown') })
  assert.deepEqual(read().ideas[1], { id: 'new_1', title: 'Pricing page', outcome: 'Prices.', acceptance: ['shown'], workflow: 'wf_builtin_coding', previews: [], task: null })
  cmdIdea(['save'], { id: 'new_1', workflow: 'slide-deck' })
  assert.equal(read().ideas[1].workflow, 'wf_builtin_slide_deck')
  cmdIdea(['new'], { title: 'Blog', bodyFile: draft('A post.') })
  cmdIdea(['drop'], { id: 'new_2' })
  cmdIdea(['start'], { id: 'new_1' })
  const ideas = read().ideas
  assert.equal(ideas[2].dropped, true)
  assert.equal(ideas[1].start, true)
  assert.throws(() => cmdIdea(['save'], { id: 'idea_a', title: 'x' }), /already a task/)
  assert.throws(() => cmdIdea(['save'], { id: 'new_2', title: 'x' }), /--id must name/)
  assert.throws(() => cmdIdea(['new'], { title: 'x', bodyFile: draft('y'), workflow: 'video' }), /No workflow `video`/)
})

it('lists the workspace workflows by their short ids', () => {
  assert.deepEqual((cmdIdeaWorkflows().workflows as { id: string }[]).map((w) => w.id), ['coding', 'slide-deck'])
})

it('refuses outside an idea conversation', () => {
  delete process.env.KANBAN_IDEAS
  assert.throws(() => cmdIdea(['new'], { title: 'x' }), /only inside/)
})

it('新旧命令共用草稿且保存不会开始任务', () => {
  process.env.KANBAN_GOALS = file
  try {
    cmdGoal(['new'], { title: '目标', bodyFile: draft('结果。\n\n## Done when\n- 验收') })
    assert.equal(read().ideas[1].start, undefined)
    cmdIdea(['save'], { id: 'new_1', title: '更新' })
    cmdGoal(['start'], { id: 'new_1' })
    assert.equal(read().ideas.length, 2)
    assert.equal(read().ideas[1].title, '更新')
    assert.equal(read().ideas[1].start, true)
    assert.equal(findGuide('discuss-goal')?.text, findGuide('discuss-idea')?.text)
  } finally { delete process.env.KANBAN_GOALS }
})

it('新旧命令拒绝缺失、无效或不一致的目标数组', () => {
  for (const cmd of [cmdGoal, cmdIdea]) {
    for (const held of [{}, { goals: null }, { ideas: 'invalid' }]) {
      fs.writeFileSync(file, JSON.stringify(held))
      assert.throws(() => cmd(['save'], { id: 'idea_a' }), { message: 'The goals array is missing or invalid.' })
    }
    fs.writeFileSync(file, JSON.stringify({ goals: [], ideas: [{ id: 'idea_a' }] }))
    assert.throws(() => cmd(['save'], { id: 'idea_a' }), { message: 'goals and ideas do not match.' })
    fs.writeFileSync(file, JSON.stringify({ goals: [] }))
    assert.throws(() => cmd(['new'], { title: '目标', bodyFile: draft('结果') }), { message: 'Install a workflow first.' })
    const workflows = [{ id: 'wf_builtin_blog_post', name: 'Blog post' }]
    for (const held of [{ goals: [], workflows }, { goals: [], ideas: [], workflows }]) {
      fs.writeFileSync(file, JSON.stringify(held))
      cmd(['new'], { title: '目标', bodyFile: draft('结果') })
      assert.equal(read().ideas.length, 1)
      assert.equal(read().ideas[0].workflow, 'wf_builtin_blog_post')
    }
  }
})

it('保存独立审阅选择，按工作流去重；省略保留，清空与切换工作流不互相污染', () => {
  const held = read()
  held.workflows[0].previews = [{ agent: 'ui-designer', when: 'UI' }, { agent: 'api-designer', when: 'API' }]
  held.workflows[1].previews = []
  fs.writeFileSync(file, JSON.stringify(held))
  cmdGoal(['new'], { title: 'Review', bodyFile: draft('Deliver.'), previews: 'api,ui,api' })
  assert.deepEqual(read().ideas[1].previews, ['ui-designer', 'api-designer'])
  cmdGoal(['new'], { title: 'Other', bodyFile: draft('Other.') })
  cmdGoal(['save'], { id: 'new_1', title: 'Changed' })
  assert.deepEqual(read().ideas.map((i: { previews?: string[] }) => i.previews), [undefined, ['ui-designer', 'api-designer'], []])
  const before = fs.readFileSync(file, 'utf8')
  assert.throws(() => cmdGoal(['save'], { id: 'new_1', title: 'Invalid', workflow: 'slide-deck', previews: 'ui' }), /Preview agent ui-designer is not enabled/)
  assert.equal(fs.readFileSync(file, 'utf8'), before)
  cmdGoal(['save'], { id: 'new_1', previews: '' })
  assert.deepEqual(read().ideas[1].previews, [])
  cmdGoal(['save'], { id: 'new_1', previews: 'api' })
  cmdGoal(['save'], { id: 'new_1', workflow: 'slide-deck' })
  assert.deepEqual(read().ideas[1].previews, [])
})

it('查询使用当前工作流的完整触发条件，旧 Runner 缺少目录时明确拒绝', () => {
  assert.throws(() => cmdGoalPreviews('coding'), /Preview agents are unavailable/)
  const held = read()
  held.workflows.push({ id: 'wf_custom', name: 'Custom', previews: [{ agent: 'custom', when: 'First.\nExcept second.' }] })
  fs.writeFileSync(file, JSON.stringify(held))
  assert.deepEqual(cmdGoalPreviews('wf_custom').agents, [{ name: 'custom', when: 'First.\nExcept second.' }])
})
