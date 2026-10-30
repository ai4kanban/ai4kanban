// A task that ended (#2064): its project's cards rewritten as a local board's archive and reject
// do — cli's blocker-leaves-revise, blocked-refine-schedule and group-close, on Cloud's boards.

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { restoreCard, settleEndings } from '../src/v1/endings.ts'
import { fakeBoards } from './fake-board.mjs'

const SUPABASE_URL = 'https://project.supabase.co'
const realFetch = globalThis.fetch

const card = (title, { blockedBy = [], related = [], schedule = null, todo = '' } = {}) =>
  [
    '---',
    `title: ${title}`,
    'priority: high',
    'roi: high',
    'status: todo',
    `blocked_by: [${blockedBy.join(', ')}]`,
    `related: [${related.join(', ')}]`,
    'modules: []',
    ...(schedule ? ['schedule:', `  action: ${schedule}`] : []),
    'questions: []',
    '---',
    '',
    `# ${title}`,
    ...(todo ? ['', '## Todo', todo] : []),
    '',
  ].join('\n')

let calls
let db
let boards
let env

beforeEach(() => {
  calls = []
  boards = fakeBoards()
  env = { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'service-role', BOARDS: boards }
  globalThis.fetch = async (url, init) => {
    const fn = String(url).split('/rest/v1/rpc/')[1]
    const body = init?.body ? JSON.parse(init.body) : {}
    calls.push({ fn, body })
    if (!(fn in db)) throw new Error(`unexpected call to ${fn}`)
    const answer = await db[fn](body)
    return new Response(answer === undefined ? '' : JSON.stringify(answer), { headers: { 'content-type': 'application/json' } })
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
})

/** One project's tasks; `end(task, status)` files the ending the database would. */
function project(tasks) {
  const queue = []
  db = {
    v1_take_endings: () => queue.splice(0),
    v1_ending_done: () => undefined,
    v1_ending: ({ p_task }) => {
      const t = tasks.find((x) => x.task === p_task)
      return {
        task: t.task, key: `WC-${t.number}`, number: t.number, title: t.title, status: t.status, project: 'prj_1', account: 'acct',
        path: t.path, parent: t.parent ?? null,
        cards: tasks.map((x) => ({ task: x.task, number: x.number, status: x.status, path: x.path, busy: !!x.busy })),
      }
    },
    v1_index_cards: ({ p_cards }) => ({ indexed: p_cards.length }),
    v1_board_of: () => 'ws_1',
    v1_release_task: () => ({ started: true }),
    v1_close_group: ({ p_task }) => {
      const root = tasks.find((x) => x.task === p_task)
      root.status = 'done'
      queue.push({ task: p_task, closing: true })
      return { closed: true }
    },
  }
  const board = boards.project('prj_1')
  board.commit(tasks.filter((t) => t.body).map((t) => ({ path: t.path, content: t.body, base_seq: 0 })))
  return {
    end: (task, status) => {
      tasks.find((x) => x.task === task).status = status
      queue.push({ task, closing: false })
    },
    read: (path) => board.read([path])[0]?.content,
  }
}

const callsTo = (fn) => calls.filter((c) => c.fn === fn)

describe('a task that ends', () => {
  it('queues a revise on the cards waiting on it, drops every reference, and starts the one it no longer blocks', async () => {
    const p = project([
      { task: 'task_a', number: 1, title: 'A', status: 'running', path: 'todo/1-task-a.md', body: card('A') },
      { task: 'task_b', number: 2, title: 'B', status: 'queued', path: 'todo/2-task-b.md', body: card('B', { blockedBy: [1], related: [1, 3] }) },
      { task: 'task_c', number: 3, title: 'C', status: 'waiting_review', path: 'todo/3-task-c.md', body: card('C', { related: [1] }) },
    ])
    p.end('task_a', 'done')
    assert.equal(await settleEndings(env), 1)

    assert.match(p.read('todo/3-task-c.md'), /^related: \[\]$/m)
    assert.doesNotMatch(p.read('todo/3-task-c.md'), /schedule:/)
    const release = callsTo('v1_release_task')
    assert.equal(release.length, 1)
    assert.equal(release[0].body.p_task, 'task_b')
    assert.equal(release[0].body.p_action, 'revise')
    assert.match(release[0].body.p_notes, /^#1 "A" was archived \(todo\/1-task-a\.md\)\. Check this card/)
    // Handed over: the mark comes off, and the references stay gone.
    const b = p.read('todo/2-task-b.md')
    assert.doesNotMatch(b, /schedule:/)
    assert.match(b, /^blocked_by: \[\]$/m)
    assert.match(b, /^related: \[3\]$/m)
    assert.deepEqual(callsTo('v1_ending_done').map((c) => c.body.p_task), ['task_a'])
  })

  it('keeps a schedule a card already had, adds the outcome to its notes, and keeps it while another blocker is open', async () => {
    const p = project([
      { task: 'task_a', number: 1, title: 'A', status: 'running', path: 'todo/1-task-a.md', body: card('A') },
      { task: 'task_x', number: 4, title: 'X', status: 'running', path: 'todo/4-task-x.md', body: card('X') },
      { task: 'task_b', number: 2, title: 'B', status: 'queued', path: 'todo/2-task-b.md', body: card('B', { blockedBy: [1, 4], schedule: 'implement' }) },
    ])
    db.v1_release_task = () => ({ started: false })
    p.end('task_a', 'cancelled')
    await settleEndings(env)
    const b = p.read('todo/2-task-b.md')
    assert.match(b, /^blocked_by: \[4\]$/m)
    assert.match(b, /^ {2}action: implement$/m)
    assert.match(b, /#1 \\"A\\" was rejected/)
  })

  it('leaves a busy card’s schedule to the step running on it', async () => {
    const p = project([
      { task: 'task_a', number: 1, title: 'A', status: 'running', path: 'todo/1-task-a.md', body: card('A') },
      { task: 'task_b', number: 2, title: 'B', status: 'running', busy: true, path: 'todo/2-task-b.md', body: card('B', { blockedBy: [1] }) },
    ])
    db.v1_release_task = () => ({ started: false })
    p.end('task_a', 'done')
    await settleEndings(env)
    const b = p.read('todo/2-task-b.md')
    assert.match(b, /^blocked_by: \[\]$/m)
    assert.doesNotMatch(b, /schedule:/)
  })
})

describe('a group', () => {
  const group = (todo, extra = {}) => [
    { task: 'task_r', number: 10, title: 'Root', status: 'waiting_review', path: 'todo/10-task-r.md', body: card('Root', { todo, ...extra }) },
    { task: 'task_s', number: 11, title: 'S', status: 'running', path: 'todo/11-task-s.md', parent: 'task_r', body: card('S') },
    { task: 'task_t', number: 12, title: 'T', status: 'done', path: '.archive/12-task-t.md', parent: 'task_r' },
  ]

  it('ticks the subtask’s line and closes the root with its last one', async () => {
    const p = project(group('- [ ] S #11\n- [x] T #12'))
    p.end('task_s', 'done')
    assert.equal(await settleEndings(env), 2)
    assert.match(p.read('todo/10-task-r.md'), /^- \[x\] S #11$/m)
    assert.deepEqual(callsTo('v1_close_group').map((c) => c.body.p_task), ['task_r'])
    // The root's own ending runs, and does not chase a group above it.
    assert.deepEqual(callsTo('v1_ending_done').map((c) => c.body.p_task), ['task_s', 'task_r'])
  })

  it('strikes a cancelled subtask, and keeps a group that shipped nothing', async () => {
    const p = project(group('- [ ] S #11\n- [ ] ~~T #12~~'))
    p.end('task_s', 'cancelled')
    await settleEndings(env)
    assert.match(p.read('todo/10-task-r.md'), /^- \[ \] ~~S #11~~$/m)
    assert.equal(callsTo('v1_close_group').length, 0)
  })

  it('keeps a root with an unticked todo of its own', async () => {
    const p = project(group('- [ ] S #11\n- [x] T #12\n- [ ] Write the launch note'))
    p.end('task_s', 'done')
    await settleEndings(env)
    assert.equal(callsTo('v1_close_group').length, 0)
  })

  it('closes a root the Runner’s own archive already moved', async () => {
    const tasks = group('')
    tasks[0].path = '.archive/10-task-r.md'
    const p = project(tasks)
    p.end('task_s', 'done')
    await settleEndings(env)
    assert.deepEqual(callsTo('v1_close_group').map((c) => c.body.p_task), ['task_r'])
  })
})

describe('a restored task', () => {
  const rejected = (title) => card(title).replace('questions: []', 'archived: 2026-10-28\nrejected: true\nrejected_reason: Too broad\nrejected_at: 2026-10-28T00:00:00Z\nrejected_by: user\nquestions: []')

  it('puts its card back in its group’s folder, unrejected, and unstrikes the root’s line', async () => {
    const p = project([
      { task: 'task_r', number: 10, title: 'Root', status: 'waiting_review', path: 'todo/10-root/root.md', body: card('Root', { todo: '- [ ] ~~S #11~~\n- [ ] T #12' }) },
      { task: 'task_s', number: 11, title: 'S', status: 'stopped', path: '.archive/11-task-s.md', parent: 'task_r', body: rejected('S') },
    ])
    await restoreCard(env, 'task_s')
    assert.ok(!p.read('.archive/11-task-s.md'))
    const s = p.read('todo/10-root/11-task-s.md')
    assert.equal(s, card('S'))
    assert.match(p.read('todo/10-root/root.md'), /^- \[ \] S #11$/m)
    const indexed = callsTo('v1_index_cards').flatMap((c) => c.body.p_cards)
    assert.deepEqual(indexed.filter((e) => e.number === 11).map((e) => [e.path, !!e.deleted]),
      [['.archive/11-task-s.md', true], ['todo/10-root/11-task-s.md', false]])
  })

  it('takes a group root’s folder back with it', async () => {
    const p = project([
      { task: 'task_r', number: 10, title: 'Root', status: 'stopped', path: '.archive/10-root/root.md', body: rejected('Root') },
      { task: 'task_s', number: 11, title: 'S', status: 'cancelled', path: '.archive/10-root/11-task-s.md', parent: 'task_r', body: rejected('S') },
    ])
    await restoreCard(env, 'task_r')
    assert.equal(p.read('todo/10-root/root.md'), card('Root'))
    assert.equal(p.read('todo/10-root/11-task-s.md'), rejected('S'))
    assert.ok(!p.read('.archive/10-root/root.md'))
  })

  it('leaves a card removed on the web where it is, and never overwrites one already back', async () => {
    const p = project([
      { task: 'task_r', number: 10, title: 'Root', status: 'running', path: 'todo/10-root/root.md', body: card('Root', { todo: '- [ ] ~~S #11~~' }) },
      { task: 'task_s', number: 11, title: 'S', status: 'stopped', path: 'todo/10-root/11-task-s.md', parent: 'task_r', body: card('S') },
      { task: 'task_a', number: 1, title: 'A', status: 'stopped', path: '.archive/1-task-a.md', body: rejected('A') },
      { task: 'task_b', number: 2, title: 'B', status: 'running', path: 'todo/1-task-a.md', body: card('Other') },
    ])
    await restoreCard(env, 'task_s')
    assert.equal(p.read('todo/10-root/11-task-s.md'), card('S'))
    assert.match(p.read('todo/10-root/root.md'), /^- \[ \] S #11$/m)
    await restoreCard(env, 'task_a')
    assert.equal(p.read('todo/1-task-a.md'), card('Other'))
    assert.equal(p.read('.archive/1-task-a.md'), rejected('A'))
  })
})
