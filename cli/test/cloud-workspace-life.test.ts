// Which refusals leave a checkout with nowhere to point (#317).
//
// Cloud answers a deleted workspace and one that was never this account's with the same
// code, on purpose. `stranded` is the one bit that tells those apart from a workspace that
// simply could not be reached — and the two lead to opposite moves: leaving a stranded
// workspace only takes the pointer off, while leaving a reachable one writes the board back
// first. Getting it the wrong way round either drops a pointer on a network blip or refuses
// the way out of a workspace that is gone.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

import { writeSession } from '../src/lib/cloud/session.ts'
import { readCloudWorkspace } from '../src/lib/cloud/workspace-life.ts'

const SUPABASE = 'https://cloud.test'
const API = 'https://api.test'

let home = ''

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-wslife-home-'))
  process.env.AI4KANBAN_HOME = home
  process.env.AI4KANBAN_SUPABASE_URL = SUPABASE
  process.env.AI4KANBAN_SUPABASE_ANON_KEY = 'anon'
  process.env.AI4KANBAN_CLOUD_URL = API
  writeSession({
    version: 1,
    supabaseUrl: SUPABASE,
    accessToken: 'a-token',
    refreshToken: 'r-token',
    expiresAt: Date.now() + 60 * 60_000,
    subject: '11111111-1111-4111-8111-111111111111',
  })
})

afterEach(() => {
  mock.restoreAll()
  fs.rmSync(home, { recursive: true, force: true })
  delete process.env.AI4KANBAN_HOME
  delete process.env.AI4KANBAN_SUPABASE_URL
  delete process.env.AI4KANBAN_SUPABASE_ANON_KEY
  delete process.env.AI4KANBAN_CLOUD_URL
})

const answers = (make: () => Response | Promise<never>): void => {
  mock.method(globalThis, 'fetch', async () => await make())
}

const refusal = (status: number, code: string, message: string): Response =>
  new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'content-type': 'application/json' },
  })

describe('reading the workspace a checkout points at', () => {
  it('calls a workspace that is not this account’s stranded', async () => {
    answers(() => refusal(403, 'not_yours', 'That belongs to another account.'))
    const read = await readCloudWorkspace('ws-1')
    assert.equal(read.ok, false)
    assert.equal(read.ok === false && read.stranded, true)
  })

  it('calls a workspace Cloud has no record of stranded too', async () => {
    answers(() => refusal(404, 'not_found', 'No such workspace.'))
    const read = await readCloudWorkspace('ws-1')
    assert.equal(read.ok === false && read.stranded, true)
  })

  it('does not, when Cloud could not be reached at all', async () => {
    answers(() => Promise.reject(new Error('getaddrinfo ENOTFOUND')))
    const read = await readCloudWorkspace('ws-1')
    assert.equal(read.ok, false)
    // The workspace is still there; leaving it must still write the board back.
    assert.equal(read.ok === false && read.stranded, false)
  })

  it('does not, when the service refused for its own reasons', async () => {
    answers(() => refusal(429, 'rate_limited', 'Too many requests.'))
    const read = await readCloudWorkspace('ws-1')
    assert.equal(read.ok === false && read.stranded, false)
  })

  it('answers with the workspace when the read lands', async () => {
    answers(
      () =>
        new Response(JSON.stringify({ workspace: { id: 'ws-1', name: 'rocket', revision: '7' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )
    const read = await readCloudWorkspace('ws-1')
    assert.equal(read.ok && read.value.name, 'rocket')
  })
})
