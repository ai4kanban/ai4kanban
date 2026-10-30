// A workspace's board files (#2081, #2114): the `Board` object on a real SQLite.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { assetsFile, cardFront, groupOfCard, isBoardPath, numberOfCard, workflowFolder } from '../src/board-files.ts'
import { workflowFor } from '../src/v1/workflows.ts'
import { followEntries, indexEntries, renumbered } from '../src/v1/board.ts'
import { fakeBoards } from './fake-board.mjs'

describe('the board object', () => {
  it('numbers each write once, hands back what changed since a number, and keeps deletions as such', () => {
    const board = fakeBoards().of('prj_1')
    const one = board.commit([{ path: 'todo/1-a.md', content: 'A', base_seq: 0 }, { path: 'memory/readme.md', content: 'M', base_seq: 0 }])
    assert.deepEqual(one, { ok: true, head_seq: 1, files: [{ path: 'todo/1-a.md', seq: 1 }, { path: 'memory/readme.md', seq: 1 }] })
    const two = board.commit([{ path: 'todo/1-a.md', content: null, base_seq: 1 }])
    assert.equal(two.head_seq, 2)
    assert.deepEqual(board.diff(1).files, [{ path: 'todo/1-a.md', content: null, seq: 2 }])
    assert.deepEqual(board.diff(null), { head_seq: 2, files: [{ path: 'memory/readme.md', content: 'M', seq: 1 }] })
    assert.deepEqual(board.read(['todo/1-a.md', 'memory/readme.md']).map((r) => r.path), ['memory/readme.md'])
    assert.deepEqual(board.list('memory/').map((r) => r.content), ['M'])
  })

  it('refuses the whole write when one file moved on, naming it with what it holds now', () => {
    const board = fakeBoards().of('prj_1')
    board.commit([{ path: 'todo/1-a.md', content: 'A', base_seq: 0 }, { path: 'todo/2-b.md', content: 'B', base_seq: 0 }])
    board.commit([{ path: 'todo/1-a.md', content: 'A2', base_seq: 1 }])
    const refused = board.commit([{ path: 'todo/1-a.md', content: 'A3', base_seq: 1 }, { path: 'todo/2-b.md', content: 'B2', base_seq: 1 }])
    assert.deepEqual(refused, { ok: false, files: [{ path: 'todo/1-a.md', content: 'A2', seq: 2 }] })
    assert.equal(board.read(['todo/2-b.md'])[0].content, 'B', 'a refused write saved a file')
    assert.equal(board.commit([{ path: 'todo/9-new.md', content: 'x', base_seq: 4 }]).ok, false, 'a new file on a made-up seq')
  })

  it('takes a write that already matches, a deleted file made again, and a delete of nothing', () => {
    const board = fakeBoards().of('prj_1')
    board.commit([{ path: 'todo/1-a.md', content: 'A', base_seq: 0 }])
    board.commit([{ path: 'todo/1-a.md', content: null, base_seq: 1 }])
    assert.deepEqual(board.commit([{ path: 'todo/1-a.md', content: null, base_seq: 0 }]), { ok: true, head_seq: 2, files: [{ path: 'todo/1-a.md', seq: 2 }] })
    assert.equal(board.commit([{ path: 'todo/1-a.md', content: 'again', base_seq: 0 }]).ok, true)
    assert.deepEqual(board.commit([{ path: 'todo/1-a.md', content: 'again', base_seq: 0 }]).files, [{ path: 'todo/1-a.md', seq: 3 }])
  })

  it('hands back only the prefixes asked for, and drops one prefix’s files alone', () => {
    const board = fakeBoards().of('ws_1')
    board.commit([{ path: 'projects/prj_1/todo/1-a.md', content: 'A', base_seq: 0 }, { path: 'projects/prj_2/todo/2-b.md', content: 'B', base_seq: 0 },
      { path: 'memory/tone.md', content: 'M', base_seq: 0 }])
    board.commit([{ path: 'projects/prj_2/todo/2-b.md', content: 'B2', base_seq: 1 }])
    assert.deepEqual(board.diff(null, ['projects/prj_1/', 'memory/']).files.map((f) => f.path), ['memory/tone.md', 'projects/prj_1/todo/1-a.md'])
    assert.deepEqual(board.diff(1, ['projects/prj_1/', 'memory/']), { head_seq: 2, files: [] })
    assert.deepEqual(board.drop('projects/prj_2/'), { dropped: 1 })
    assert.deepEqual(board.diff(null).files.map((f) => f.path), ['memory/tone.md', 'projects/prj_1/todo/1-a.md'])
    assert.throws(() => board.drop('projects/prj_1'))
  })

  it('keeps each project apart, and forgets everything when its project goes', async () => {
    const boards = fakeBoards()
    boards.of('prj_1').commit([{ path: 'todo/1-a.md', content: 'A', base_seq: 0 }])
    assert.deepEqual(boards.of('prj_2').diff(null).files, [])
    await boards.of('prj_1').destroy()
    assert.deepEqual(boards.of('prj_1').diff(null), { head_seq: 0, files: [] })
  })
})

describe('what of a board Cloud keeps', () => {
  it('keeps the board folders and leaves generated files and anything outside', () => {
    for (const p of ['todo/1-a.md', 'todo/12-group/root.md', '.archive/3-b.md', 'memory/agents/planner/decisions.md',
      'workflows/wf-x/WORKFLOW.md', 'triage/x.md', 'assets/task_1.json', 'memory/style/README.md',
      'modules.md', 'config.md', 'rules/builder.md', 'rules/workflows/coding.md']) assert.ok(isBoardPath(p), p)
    for (const p of ['todo/README.md', 'next-id', 'metrics.csv', '.sync/task_1.json', 'todo/.sync/x', 'agents/a/AGENT.md',
      'setup-checklist.md', 'schedules.md', 'rules/a/b.md', 'rules/workflows/a/b.md', 'rules/a.txt', 'memory/config.md/x', '/todo/a.md', 'todo/../next-id', 'todo//a.md', 'todo/hero.png', 'triage/files/a.pdf', 'assets/x.png']) assert.ok(!isBoardPath(p), p)
  })

  it('finds the task a card file belongs to, and reads its title, status and round', () => {
    assert.equal(numberOfCard('todo/12-pricing.md'), 12)
    assert.equal(numberOfCard('.archive/7-grp/12-copy.md'), 12)
    assert.equal(numberOfCard('todo/7-grp/root.md'), 7)
    assert.equal(numberOfCard('todo/7-grp/notes.md'), null)
    assert.equal(groupOfCard('todo/7-grp/12-copy.md'), 7)
    assert.equal(groupOfCard('todo/7-grp/root.md'), null)
    assert.equal(groupOfCard('todo/12-pricing.md'), null)
    assert.equal(renumbered('todo/12-pricing.md', 3), 'todo/3-pricing.md')
    assert.equal(renumbered('todo/12-pricing/root.md', 3), 'todo/3-pricing/root.md')
    assert.equal(assetsFile('task_1'), 'assets/task_1.json')
    assert.equal(workflowFolder('wf_builtin_coding'), 'wf-builtin-coding')
    assert.deepEqual(cardFront('---\ntitle: "Pricing: tiers"\nstatus: planning\nphase: 2\nmodules: [web]\n---\nBody'),
      { title: 'Pricing: tiers', status: 'planning', phase: 2 })
    assert.deepEqual(cardFront('No frontmatter'), {})
  })

  it('reads what a task follows of each card written: archived, rejected, workflow and open question (#59)', () => {
    const card = (front) => `---\ntitle: A\n${front}---\nBody`
    assert.deepEqual(followEntries([
      { path: 'todo/1-a.md', content: card('workflow: wf-mine\nquestions:\n  - "[user] Plain?"\n  - question: "[user] Which?"\n    mode: single\n    options:\n      - Red\n      - Blue\n') },
      { path: '.archive/2-b.md', content: card('rejected: true\n') },
      { path: 'todo/3-c.md', content: null },
      { path: 'todo/4-d.md', content: card('workflow: coding\n') },
      { path: 'memory/readme.md', content: 'x' },
    ]), [
      { number: 1, archived: false, rejected: false, reason: null, workflow: { name: 'wf-mine' }, review: { question: 'Which?', options: ['Red', 'Blue'], position: 2 } },
      { number: 2, archived: true, rejected: true, reason: null, review: null },
      { number: 4, archived: false, rejected: false, reason: null, workflow: { name: 'coding', definition: workflowFor('wf_builtin_coding') }, review: null },
    ])
  })

  it('indexes cards by number, deletions first, a subtask with its group, and assets by task', () => {
    const entries = indexEntries([
      { path: '.archive/1-a.md', content: '---\ntitle: A\nblocked_by: [3]\nrelated: [2, 3]\nschedule:\n  action: revise\n  notes: "Check #3"\n---\n', seq: 5 },
      { path: 'todo/1-a.md', content: null, seq: 5 },
      { path: 'todo/4-grp/5-b.md', content: '---\ntitle: B\n---\n', seq: 6 },
      { path: 'assets/task_aa.json', content: '{"a.png": {"artifact": "art_1"}}', seq: 5 },
      { path: 'assets/task_bb.json', content: 'not json', seq: 5 },
      { path: 'memory/readme.md', content: 'x', seq: 5 },
    ])
    assert.deepEqual(entries, [
      { number: 1, path: 'todo/1-a.md', deleted: true },
      { number: 1, path: '.archive/1-a.md', seq: 5, front: { title: 'A' },
        links: { blocked_by: [3], related: [2, 3], schedule: { action: 'revise', notes: 'Check #3' } } },
      { number: 5, path: 'todo/4-grp/5-b.md', seq: 6, front: { title: 'B' }, links: { blocked_by: [], related: [], schedule: null }, parent: 4 },
      { task: 'task_aa', assets: { 'a.png': { artifact: 'art_1' } } },
      { task: 'task_bb', assets: {} },
    ])
  })
})
