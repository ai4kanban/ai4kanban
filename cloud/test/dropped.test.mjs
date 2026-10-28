// What deleted rows left behind (#2089): only what was cleared leaves the queue.

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { clearDroppedBoards, clearDroppedFiles } from '../src/dropped.ts'

const realFetch = globalThis.fetch
let calls
let env

beforeEach(() => {
  calls = []
  const answers = {
    v1_dropped_boards: () => ['prj_ok', 'prj_bad'],
    v1_forget_boards: ({ p_ids }) => p_ids.length,
    v1_dropped_files: () => [
      { key: 'f1', multipart_id: null },
      { key: 'jobs/j1/log.json', multipart_id: null },
      { key: 'u_gone', multipart_id: 'm_gone' },
      { key: 'u_bad', multipart_id: 'm_bad' },
    ],
    v1_forget_files: ({ p_keys }) => p_keys.length,
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
    BOARDS: {
      idFromName: (name) => name,
      get: (id) => ({ fetch: async () => new Response('{"destroyed": true}', { status: id === 'prj_bad' ? 500 : 200 }) }),
    },
    ARTIFACTS: {
      async delete(keys) {
        if (env.failDelete) throw new Error('R2 down')
      },
      resumeMultipartUpload: (key, id) => ({
        abort: async () => {
          if (id === 'm_gone') throw new Error('abortMultipartUpload: The specified multipart upload does not exist. (10024)')
          if (id === 'm_bad') throw new Error('R2 down')
        },
      }),
    },
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
})

const forgot = (fn) => calls.find((c) => c.fn === fn)?.body

describe('dropped boards and files', () => {
  it('forgets only the boards destroyed', async () => {
    assert.equal(await clearDroppedBoards(env), 1)
    assert.deepEqual(forgot('v1_forget_boards').p_ids, ['prj_ok'])
  })

  it('forgets deleted files and gone uploads, and keeps an abort that failed', async () => {
    assert.equal(await clearDroppedFiles(env), 3)
    assert.deepEqual(forgot('v1_forget_files').p_keys.sort(), ['f1', 'jobs/j1/log.json', 'u_gone'])
  })

  it('keeps every file when R2 refuses the delete', async () => {
    env.failDelete = true
    await clearDroppedFiles(env)
    assert.deepEqual(forgot('v1_forget_files').p_keys, ['u_gone'])
  })

  it('skips a build with no board or file storage', async () => {
    assert.equal(await clearDroppedBoards({ ...env, BOARDS: undefined }), 0)
    assert.equal(await clearDroppedFiles({ ...env, ARTIFACTS: undefined }), 0)
    assert.deepEqual(calls, [])
  })
})
