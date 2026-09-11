// Who the inbox is open to (#453, #555).
//
// The inbox UI is a Cloud preview, so it is drawn only for an account Cloud has just said is
// admitted. What is asked here: an admitted account opens it, one we have not admitted does
// not, and a sign-in this machine still holds but cannot prove does not either — an
// unreachable Cloud must not leave the feature standing for an account that was never
// invited.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { setBoardRoot } from '../src/lib/paths.ts'
import { writeSession, type CloudSession } from '../src/lib/cloud/session.ts'
import { signalsAccess } from '../src/lib/signals/access.ts'
import { restoreMachineHome } from './helpers/board.ts'

const SUPABASE = 'https://project.supabase.co'
const API = 'https://api.example.test'

let home = ''
let board = ''
const realFetch = globalThis.fetch

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-inbox-access-home-'))
  board = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-inbox-access-board-'))
  process.env.AI4KANBAN_HOME = home
  process.env.AI4KANBAN_SUPABASE_URL = SUPABASE
  process.env.AI4KANBAN_SUPABASE_ANON_KEY = 'anon-key'
  process.env.AI4KANBAN_CLOUD_URL = API
  setBoardRoot(board)
  writeSession({
    version: 1,
    supabaseUrl: SUPABASE,
    accessToken: 'token-1',
    refreshToken: 'refresh-1',
    expiresAt: Date.now() + 60 * 60 * 1000,
    subject: '11111111-1111-4111-8111-111111111111',
    handle: 'someone',
    name: 'Someone',
  } satisfies CloudSession)
})

afterEach(() => {
  globalThis.fetch = realFetch
  fs.rmSync(home, { recursive: true, force: true })
  fs.rmSync(board, { recursive: true, force: true })
  restoreMachineHome()
  delete process.env.AI4KANBAN_SUPABASE_URL
  delete process.env.AI4KANBAN_SUPABASE_ANON_KEY
  delete process.env.AI4KANBAN_CLOUD_URL
})

/** Cloud answers the session call with `body`, and nothing else is asked of the network. */
const cloudSays = (body: unknown, status = 200) => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
}

describe('who the inbox is open to', () => {
  it('opens for an admitted account', async () => {
    cloudSays({ session: { admitted: true, handle: 'someone' } })
    assert.deepEqual(await signalsAccess(), { open: true })
  })

  it('stays shut for an account we have not admitted', async () => {
    cloudSays({ session: { admitted: false, handle: 'someone' } })
    const access = await signalsAccess()
    assert.equal(access.open, false)
    assert.match(access.open ? '' : access.why, /invited Cloud accounts/)
  })

  it('stays shut when Cloud cannot be reached to check', async () => {
    globalThis.fetch = (async () => {
      throw new Error('offline')
    }) as typeof fetch
    const access = await signalsAccess()
    assert.equal(access.open, false)
    assert.match(access.open ? '' : access.why, /could not be reached/)
  })
})
