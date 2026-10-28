import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, it } from 'node:test'

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
  assert.deepEqual(read().ideas[1], { id: 'new_1', title: 'Pricing page', outcome: 'Prices.', acceptance: ['shown'], workflow: 'wf_builtin_coding', task: null })
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
