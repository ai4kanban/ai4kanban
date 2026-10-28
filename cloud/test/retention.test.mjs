// The plans' keep (#2017): each account expires on its own plan's days, files leave R2 before
// their rows, and a failed R2 delete leaves the rows for the next hour.

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { expire } from '../src/retention.ts'
import { stampOf } from '../src/triage-files.ts'
import { fakeBoards } from './fake-board.mjs'

const FREE = 'a0000000-0000-4000-8000-000000000001'
const PRO = 'a0000000-0000-4000-8000-000000000002'
const realFetch = globalThis.fetch
let calls
let order
let env

beforeEach(() => {
  calls = []
  order = []
  const answers = {
    v1_expiring_accounts: () => [FREE, PRO],
    subscriptions_for: ({ p_user_id }) =>
      p_user_id === PRO ? [{ id: 's', customer_id: 'c', period: 'monthly', status: 'active', current_period_end: null }] : [],
    seed_grant_for: () => null,
    trial_for: () => null,
    v1_expired: ({ p_account }) => ({ tasks: [`task_${p_account.slice(-1)}`], files: [`f_${p_account.slice(-1)}`], multipart: [], jobs: [`j${p_account.slice(-1)}`] }),
    v1_delete_expired: ({ p_tasks }) => {
      order.push(`rows ${p_tasks[0]}`)
      return { tasks: 1, events: 2, jobs: 0 }
    },
    v1_abandoned_uploads: () => [{ id: 'upl_1', key: 'u1', multipart_id: null, uploaded: true }],
    v1_drop_uploads: ({ p_ids }) => p_ids.length,
    v1_account_workspaces: ({ p_account }) => (env.BOARDS ? [p_account === FREE ? 'ws_free' : 'ws_pro'] : []),
  }
  globalThis.fetch = async (url, init) => {
    const fn = String(url).split('/rest/v1/rpc/')[1]
    const body = JSON.parse(init.body)
    calls.push({ fn, body })
    return new Response(JSON.stringify(answers[fn](body)), { headers: { 'content-type': 'application/json' } })
  }
  env = {
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    ARTIFACTS: {
      async delete(keys) {
        if (env.failDelete) throw new Error('R2 down')
        order.push(`files ${[keys].flat().join(',')}`)
      },
      resumeMultipartUpload: () => ({ abort: async () => {} }),
    },
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('expiry', () => {
  it('keeps each account for its own plan’s days, deleting files before rows', async () => {
    const done = await expire(env)
    const days = calls.filter((c) => c.fn === 'v1_expired').map((c) => [c.body.p_account, c.body.p_days])
    assert.deepEqual(days, [[FREE, 7], [PRO, 30]])
    assert.equal(calls.find((c) => c.fn === 'v1_expiring_accounts').body.p_days, 7)
    assert.deepEqual(order, ['files f_1', 'rows task_1', 'files f_2', 'rows task_2', 'files u1'])
    assert.deepEqual(done, { tasks: 2, events: 4, jobs: 0, files: 2, uploads: 1, triage: 0 })
  })

  it('leaves the rows when R2 refuses, for the next hour to retry', async () => {
    env.failDelete = true
    const done = await expire(env).catch((e) => e)
    assert.ok(!calls.some((c) => c.fn === 'v1_delete_expired'))
    assert.ok(!calls.some((c) => c.fn === 'v1_drop_uploads'))
    assert.ok(done instanceof Error)
  })

  it('drops sorted triage items past the plan’s keep, and waits for a dismissal still to learn (#2107)', async () => {
    const boards = fakeBoards()
    env.BOARDS = boards
    const ago = (days) => stampOf(new Date(Date.now() - days * 86_400_000))
    const item = (fields) => `---\ntitle: x\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n\nWords\n`
    const write = (ws, files) => boards.project('prj_1', ws).commit(Object.entries(files).map(([path, content]) => ({ path, content, base_seq: 0 })))
    write('ws_free', {
      'triage/dismissed/sorted.md': item({ dismissed_at: `"${ago(10)}"`, dismissed_by: 'agent' }),
      'triage/dismissed/learned.md': item({ dismissed_at: `"${ago(10)}"`, dismissed_by: 'user', reviewed_at: `"${ago(9)}"` }),
      'triage/dismissed/unlearned.md': item({ dismissed_at: `"${ago(10)}"`, dismissed_by: 'user' }),
      'triage/archived/old.md': item({ archived_at: `"${ago(10)}"` }),
      'triage/archived/new.md': item({ archived_at: `"${ago(3)}"` }),
      'triage/waiting.md': item({ imported_at: `"${ago(40)}"` }),
    })
    write('ws_pro', { 'triage/archived/old.md': item({ archived_at: `"${ago(10)}"` }) })
    const done = await expire(env)
    assert.equal(done.triage, 3)
    assert.deepEqual(boards.project('prj_1', 'ws_free').list('triage/').map((r) => r.path),
      ['triage/archived/new.md', 'triage/dismissed/unlearned.md', 'triage/waiting.md'])
    assert.equal(boards.project('prj_1', 'ws_pro').list('triage/').length, 1)
    const diff = boards.of('ws_free').diff(1)
    assert.equal(diff.files.filter((f) => f.content === null).length, 3, 'the drop is a board write a Runner pulls')
  })
})
