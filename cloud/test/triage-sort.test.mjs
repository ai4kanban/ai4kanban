// Sorting triage in Cloud (#2124): who is judged, what Jev is given, and where each answer
// lands. What the database does with a landing is test/sql/checks.sql's.

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { boardFor } from '../src/board.ts'
import { DECISIONS_URL } from '../src/judge.ts'
import worker from '../src/index.ts'
import { reasonWords, sortTriage, sortWaitingTriage, verdictOf } from '../src/triage-sort.ts'
import { sha256 } from '../src/v1/http.ts'
import { BUILTIN_WORKFLOWS } from '../src/v1/workflows.ts'
import { fakeBoards } from './fake-board.mjs'

const SUPABASE_URL = 'https://project.supabase.co'
const OWNER = '11111111-1111-4111-8111-111111111111'
const KEY = 'wck_live-key-for-tests'
const PRO = { id: 'sub_1', customer_id: 'c', period: 'yearly', status: 'active', current_period_end: null }
const ID = 'tri_1_dark-mode'
const CONTEXT = { owner: OWNER, installed: ['wf_builtin_coding'], workflows: [] }
/** The item, as a file in `prj_1`'s `triage/`. */
const itemFile = (fields = {}) =>
  `---\nsource_id: derived-1\ntitle: Dark mode\nimported_at: "2026-10-26 08:00"\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n\nAdd it\n`

const yesOf = (p) => ({ choice: p >= 0.5 ? 'yes' : 'no', confidence: Math.max(p, 1 - p), probabilities: { yes: p, no: 1 - p } })

const realFetch = globalThis.fetch
const realLog = console.log
const realError = console.error
let db
let calls
let asked
let jev
let env
let boards

const board = () => boards.project('prj_1')
/** The item where it now sits, by its file. */
const triage = () => Object.fromEntries(board().list('triage/').map((r) => [r.path, r.content]))
function seed(fields = {}, path = 'triage/dark-mode.md') {
  board().commit([{ path, content: itemFile(fields), base_seq: board().read([path])[0]?.seq ?? 0 }])
}

beforeEach(() => {
  console.log = () => {}
  console.error = () => {}
  BUILTIN_WORKFLOWS.push({ id: 'wf_builtin_coding', name: 'Coding', names: { en: 'Coding', zh: '软件开发' }, description: 'Changes code.', lands: true, hash: 'h', files: {} })
  calls = []
  asked = []
  jev = () => json({
    answers: {
      worth: yesOf(0.9), rejected: yesOf(0.1), duplicate: { choice: 'none', confidence: 0.9, probabilities: { none: 0.9 } },
      needsUser: yesOf(0.1), workflow: { choice: 'wf_builtin_coding', confidence: 0.8 },
    },
  })
  db = {
    subscriptions_for: () => [PRO],
    seed_grant_for: () => null,
    trial_for: () => null,
    record_ai_call: () => undefined,
    v1_sort_context: () => CONTEXT,
    v1_board_of: () => 'ws_1',
    v1_create_task: () => ({ id: 'task_1', key: 'WC-3', project: 'prj_1' }),
    v1_triage_emit: () => undefined,
    v1_card_tasks: () => [],
    v1_sort_workspaces: () => ['ws_1'],
    v1_triage_write: () => ({ workspace: 'ws_1', project: 'prj_1' }),
    v1_task_workflow: () => new Response(JSON.stringify({ code: 'AKB20', message: 'gone' }), { status: 400 }),
    v1_audience: () => [],
    v1_take_endings: () => [],
    v1_account_for_key: async ({ p_hash }) =>
      p_hash === (await sha256(KEY)) ? { account_id: OWNER, handle: 'lin', key_id: 'key_1', key_name: 'CI' } : null,
    v1_claim_idempotency: () => ({ claimed: true }),
    v1_finish_idempotency: () => undefined,
  }
  boards = fakeBoards()
  env = { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'service-role', OPENROUTER_API_KEY: 'or-key', BOARDS: boards }
  seed()
  globalThis.fetch = async (url, init) => {
    const address = String(url)
    const body = init?.body ? JSON.parse(init.body) : {}
    if (address === DECISIONS_URL) {
      asked.push(body)
      return jev()
    }
    const fn = address.split('/rest/v1/rpc/')[1]
    calls.push({ fn, body })
    if (!(fn in db)) throw new Error(`unexpected call to ${fn}`)
    const answer = await db[fn](body)
    if (answer instanceof Response) return answer
    return answer === undefined ? new Response(null, { status: 204 }) : json(answer)
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
  console.log = realLog
  console.error = realError
  BUILTIN_WORKFLOWS.length = 0
})

const made = () => calls.filter((c) => c.fn === 'v1_create_task').map((c) => c.body)

describe('verdictOf', () => {
  const answers = (worth, extra = {}) => ({ worth: yesOf(worth), rejected: yesOf(0), needsUser: yesOf(0), ...extra })

  it('reads the facts first, then the user, then the worth', () => {
    assert.equal(verdictOf(answers(0.95, { rejected: yesOf(0.92) })).reason, 'rejected')
    const dup = verdictOf(answers(0.95, { duplicate: { choice: '#7', confidence: 0.95, probabilities: { none: 0.05 } } }))
    assert.deepEqual([dup.verdict, dup.reason, dup.card], ['skip', 'duplicate', 7])
    assert.equal(verdictOf(answers(0.95, { needsUser: yesOf(0.6) })).reason, 'needs-user')
    assert.deepEqual([verdictOf(answers(0.1)).verdict, verdictOf(answers(0.1)).reason], ['skip', 'low-value'])
    assert.equal(verdictOf(answers(0.85)).verdict, 'plan')
    assert.deepEqual([verdictOf(answers(0.5)).verdict, verdictOf(answers(0.5)).reason], ['human-review', 'unsure'])
    assert.equal(verdictOf(answers(0.95, { rejected: yesOf(0.89) })).verdict, 'plan')
  })

  it('never dismisses a proposer’s item', () => {
    assert.equal(verdictOf({ needsUser: yesOf(0.6) }, true).verdict, 'human-review')
    assert.equal(verdictOf({ needsUser: yesOf(0.1) }, true).verdict, 'plan')
  })

  it('names the task an item duplicates', () => {
    assert.match(reasonWords({ reason: 'duplicate', card: 7 }, [{ id: 7, title: 'Night theme' }]), /Night theme/)
  })
})

describe('sortTriage', () => {
  it('makes a task of a worthy item, on the workflow Jev is sure of', async () => {
    await (await boardFor(env, 'prj_1')).commit([
      { path: 'memory/project.md', content: 'A kanban app.', base_seq: 0 },
      { path: 'memory/agents/planner/decisions.md', content: '- keep it simple', base_seq: 0 },
      { path: 'memory/agents/planner/cloud/rejected.md', content: '- no themes', base_seq: 0 },
      { path: 'todo/7-task-0190ab.md', content: '---\ntitle: Night theme\n---\n', base_seq: 0 },
    ])
    assert.equal(await sortTriage(env, ID), 'card')
    const { state, questions } = asked[0]
    assert.deepEqual(Object.keys(state).sort(), ['decisions', 'item', 'memory/agents/planner/cloud/rejected.md', 'product'])
    assert.deepEqual(Object.keys(questions).sort(), ['duplicate', 'needsUser', 'rejected', 'workflow', 'worth'])
    assert.equal(questions.duplicate.criteria['#7'], 'Night theme')
    assert.equal(questions.workflow.criteria.wf_builtin_coding, 'Changes code.')
    const [task] = made()
    assert.deepEqual([task.p_account, task.p_workflow.id], [OWNER, 'wf_builtin_coding'])
    assert.deepEqual(task.p_fields, { title: 'Dark mode', request: 'Add it', run: true, project: 'prj_1', source_context: { agent: 'triage-sort' } })
    const carded = triage()['triage/archived/dark-mode.md']
    assert.match(carded, /card_id: 3/)
    assert.match(carded, /task: task_1/)
    assert.match(carded, /judged_at: /)
    assert.equal(triage()['triage/dark-mode.md'], undefined)
    assert.equal(calls.filter((c) => c.fn === 'record_ai_call')[0].body.p_user_id, OWNER)
    assert.equal(calls.find((c) => c.fn === 'v1_triage_emit').body.p_data.state, 'carded')
  })

  it('asks a proposer’s item only whether it needs the user, without what was turned down', async () => {
    seed({ source_task: 'task_9' })
    await (await boardFor(env, 'prj_1')).commit([{ path: 'memory/agents/planner/rejected.md', content: '- no themes', base_seq: 0 }])
    jev = () => json({ answers: { needsUser: yesOf(0.1), workflow: { choice: 'wf_builtin_coding', confidence: 0.8 } } })
    assert.equal(await sortTriage(env, ID), 'card')
    assert.deepEqual(Object.keys(asked[0].questions).sort(), ['needsUser', 'workflow'])
    assert.deepEqual(Object.keys(asked[0].state), ['item'])
  })

  it('makes the task the proposing agent’s, from its source task (#95)', async () => {
    seed({ source_task: 'task_9', agent: 'qa-manager' })
    jev = () => json({ answers: { needsUser: yesOf(0.1), workflow: { choice: 'wf_builtin_coding', confidence: 0.8 } } })
    assert.equal(await sortTriage(env, ID), 'card')
    assert.deepEqual(made()[0].p_fields.source_context, { agent: 'qa-manager', task: 'task_9' })
  })

  it('makes a task on the workflow the item names, without asking for one (#2139)', async () => {
    seed({ workflow: 'coding' })
    jev = () => json({ answers: { worth: yesOf(0.9), rejected: yesOf(0), needsUser: yesOf(0) } })
    assert.equal(await sortTriage(env, ID), 'card')
    assert.equal('workflow' in asked[0].questions, false)
    assert.equal(made()[0].p_workflow.id, 'wf_builtin_coding')
  })

  it('dismisses with its reason, nothing for the review to learn', async () => {
    jev = () => json({ answers: { worth: yesOf(0.1), rejected: yesOf(0), needsUser: yesOf(0), workflow: { choice: 'none', confidence: 0.9 } } })
    assert.equal(await sortTriage(env, ID), 'dismiss')
    const dismissed = triage()['triage/dismissed/dark-mode.md']
    assert.match(dismissed, /dismissed_reason: .*Too little worth/)
    assert.match(dismissed, /dismissed_by: agent/)
  })

  it('leaves an unsure workflow to the user, judged', async () => {
    jev = () => json({ answers: { worth: yesOf(0.9), rejected: yesOf(0), needsUser: yesOf(0), workflow: { choice: 'wf_builtin_coding', confidence: 0.5 } } })
    assert.equal(await sortTriage(env, ID), 'open')
    assert.match(triage()['triage/dark-mode.md'], /judged_at: /)
    assert.equal(made().length, 0)
  })

  it('asks nothing for an owner without Pro, and marks the item judged', async () => {
    db.subscriptions_for = () => []
    assert.equal(await sortTriage(env, ID), 'open')
    assert.equal(asked.length, 0)
    assert.match(triage()['triage/dark-mode.md'], /judged_at: /)
  })

  it('does nothing without the key', async () => {
    assert.equal(await sortTriage({ ...env, OPENROUTER_API_KEY: undefined }, ID), null)
    assert.equal(calls.length, 0)
  })

  it('leaves a failed judgement open, judged once', async () => {
    jev = () => json({ error: 'down' }, 500)
    assert.equal(await sortTriage(env, ID), 'open')
    assert.equal(calls.find((c) => c.fn === 'record_ai_call').body.p_ok, false)
    assert.equal(await sortTriage(env, ID), null)
    assert.equal(asked.length, 1)
  })

  it('leaves the item open when no task can be made', async () => {
    db.v1_create_task = () => new Response(JSON.stringify({ code: 'AKB23', message: 'over quota' }), { status: 400 })
    assert.equal(await sortTriage(env, ID), 'open')
    assert.ok(triage()['triage/dark-mode.md'])
  })

  it('drops the end when the user got there first', async () => {
    seed({ dismissed_at: '"2026-10-26 09:00"', dismissed_by: 'user' }, 'triage/dismissed/dark-mode.md')
    board().commit([{ path: 'triage/dark-mode.md', content: null, base_seq: board().read(['triage/dark-mode.md'])[0].seq }])
    assert.equal(await sortTriage(env, ID), null)
    assert.equal(asked.length, 0)
  })

  it('the hourly run judges what is waiting', async () => {
    seed({}, 'triage/second.md')
    seed({ judged_at: '"2026-10-26 08:01"' }, 'triage/third.md')
    assert.equal(await sortWaitingTriage(env), 2)
    assert.equal(calls.find((c) => c.fn === 'v1_sort_workspaces').body.p_limit, 50)
  })
})

describe('POST /v1/triage', () => {
  const pending = []
  const ctx = { waitUntil: (p) => pending.push(p), passThroughOnException: () => {} }
  const post = () => worker.fetch(new Request('https://api.ai4kanban.dev/v1/triage', {
    method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: JSON.stringify({ title: 'Dark mode', workflow: 'wf_builtin_coding' }),
  }), env, ctx)
  const settle = async () => {
    while (pending.length) await Promise.all(pending.splice(0))
  }

  it('judges a new item off the response, and never one already kept', async () => {
    board().commit([{ path: 'triage/dark-mode.md', content: null, base_seq: board().read(['triage/dark-mode.md'])[0].seq }])
    const first = await post()
    assert.equal(first.status, 201)
    const item = await first.json()
    assert.equal(item.created, undefined)
    assert.deepEqual([item.id, item.state, item.workflow], ['tri_1_dark-mode', 'open', 'wf_builtin_coding'])
    await settle()
    assert.equal(made().length, 1)

    const again = await (await post()).json()
    await settle()
    assert.equal(again.id, item.id)
    assert.equal(again.state, 'carded')
    assert.equal(made().length, 1)
    assert.deepEqual(calls.filter((c) => c.fn === 'v1_triage_emit').map((c) => c.body.p_type), ['triage.created', 'triage.updated'])
  })
})

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
