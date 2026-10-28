import assert from 'node:assert/strict'
import { afterEach, describe, it, mock } from 'node:test'

import { DiffCall, FILE_BYTES, answerDiff, diffAnswer, readTaskDiff } from '../src/diff.ts'
import { Refusal } from '../src/errors.ts'
import { report } from '../src/runners.ts'

// Where a task landed and its diff (#2109): the Runner's report, and the diff handed from the
// Runner to the waiting page with nothing stored on the way.

const OWNER = '11111111-1111-4111-8111-111111111111'
const MACHINE = '44444444-4444-4444-8444-444444444444'
const COMMIT = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
const LANDING = { commit: COMMIT, project: 'prj_1', owner: OWNER, machine: MACHINE, online: true }

/** One `DiffCall` per name, as the namespace keeps them. */
function namespace(env) {
  const held = new Map()
  return {
    idFromName: (name) => name,
    get: (name) => {
      if (!held.has(name)) held.set(name, new DiffCall({}, env))
      const call = held.get(name)
      return { fetch: (url, init) => call.fetch(new Request(url, init)) }
    },
  }
}

/** The database answering `v1_task_landing` with `landing`; a hint runs `runner` with its request. */
function setUp(landing, runner) {
  const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }
  env.DIFF_CALLS = namespace(env)
  const calls = []
  mock.method(globalThis, 'fetch', async (url, init) => {
    const fn = String(url).split('/rpc/')[1]
    const args = JSON.parse(init.body)
    calls.push({ fn, args })
    if (fn === 'hint_runner_diff') {
      setTimeout(() => void runner?.(env, args.p_request), 0)
      return new Response('', { status: 200 })
    }
    return new Response(JSON.stringify(landing), { status: 200 })
  })
  return { env, calls }
}

const refusal = async (promise) => {
  try {
    await promise
  } catch (e) {
    if (e instanceof Refusal) return `${e.status} ${e.code}`
    throw e
  }
  assert.fail('no refusal')
}

afterEach(() => {
  mock.restoreAll()
  mock.timers.reset()
})

describe('the landing a build reports', () => {
  it('keeps a full commit and its branch, and drops a malformed one', () => {
    assert.deepEqual(report({ landing: { commit: COMMIT, branch: 'main' } }).landing, { commit: COMMIT, branch: 'main' })
    assert.deepEqual(report({ landing: { commit: COMMIT, branch: 'a\nb' } }).landing, { commit: COMMIT, branch: '' })
    assert.equal(report({ landing: { commit: 'abc1234', branch: 'main' } }).landing, undefined)
    assert.equal(report({ landing: 'x' }).landing, undefined)
  })
})

describe('a landed commit’s diff', () => {
  const files = [{ path: 'src/a.ts', status: 'modified', added: 1, removed: 1, patch: '@@ -1 +1 @@\n-a\n+b\n' }]

  it('hints the computer it landed on and hands its answer to the page', async () => {
    const { env, calls } = setUp(LANDING, (e, request) => answerDiff(e, OWNER, request, { machineId: MACHINE, files, truncated: false }))
    const response = await readTaskDiff(env, OWNER, 'task_1')
    assert.deepEqual(await response.json(), { object: 'diff', commit: COMMIT, files, truncated: false })
    const hint = calls.find((c) => c.fn === 'hint_runner_diff').args
    assert.deepEqual({ ...hint, p_request: undefined }, { p_owner: OWNER, p_request: undefined, p_project: 'prj_1', p_commit: COMMIT })
    assert.ok(!calls.some((c) => !['v1_task_landing', 'hint_runner_diff'].includes(c.fn)), 'something was written')
  })

  it('says the commit is gone when the computer no longer has it', async () => {
    const { env } = setUp(LANDING, (e, request) => answerDiff(e, OWNER, request, { machineId: MACHINE, gone: true }))
    assert.equal(await refusal(readTaskDiff(env, OWNER, 'task_1')), '404 commit_gone')
  })

  it('says the computer is offline when it is not connected, and asks nothing', async () => {
    const { env, calls } = setUp({ ...LANDING, online: false })
    assert.equal(await refusal(readTaskDiff(env, OWNER, 'task_1')), '503 machine_offline')
    assert.ok(!calls.some((c) => c.fn === 'hint_runner_diff'))
  })

  it('refuses a task that landed nothing', async () => {
    const { env } = setUp(null)
    assert.equal(await refusal(readTaskDiff(env, OWNER, 'task_1')), '404 not_found')
  })

  it('takes no answer from another computer, and counts a silent one offline', async () => {
    let answered
    const { env } = setUp(LANDING, async (e, request) => {
      answered = await answerDiff(e, OWNER, request, { machineId: '55555555-5555-4555-8555-555555555555', files, truncated: false })
    })
    mock.timers.enable({ apis: ['setTimeout'] })
    const waiting = refusal(readTaskDiff(env, OWNER, 'task_1'))
    for (let i = 0; i < 20 && !answered; i++) {
      mock.timers.tick(0)
      await new Promise((resolve) => setImmediate(resolve))
    }
    assert.deepEqual(answered, { answered: false })
    mock.timers.tick(15_000)
    assert.equal(await waiting, '503 machine_offline')
  })
})

describe('checking a Runner’s diff', () => {
  it('drops the patches past 256 KB a file', () => {
    const big = diffAnswer({ files: [{ path: 'a', status: 'added', added: 1, removed: 0, patch: 'x'.repeat(FILE_BYTES + 1) }] })
    assert.deepEqual(big, { files: [{ path: 'a', status: 'added', added: 1, removed: 0 }], truncated: true })
  })

  it('refuses a file with no path or status', () => {
    assert.throws(() => diffAnswer({ files: [{ path: '', status: 'added' }] }), Refusal)
    assert.throws(() => diffAnswer({ files: [{ path: 'a', status: 'renamed' }] }), Refusal)
    assert.throws(() => diffAnswer({}), Refusal)
  })
})
