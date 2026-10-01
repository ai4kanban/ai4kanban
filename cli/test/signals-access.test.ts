// Who may sort triage (#453, #1296, #1299): Pro only, and each refusal says why.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { setBoardRoot } from '../src/lib/paths.ts'
import { sessionFile, writeSession, type CloudSession } from '../src/lib/cloud/session.ts'
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

/** Cloud answers every call with `body`. */
const cloudSays = (body: unknown, status = 200) => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
}

const why = async (): Promise<string> => {
  const access = await signalsAccess()
  assert.equal(access.open, false)
  return access.open ? '' : access.why
}

describe('who may sort triage', () => {
  it('opens for a Pro account', async () => {
    cloudSays({ billing: { plan: 'pro', periodEnd: null } })
    assert.deepEqual(await signalsAccess(), { open: true })
  })

  it('stays shut for a free account', async () => {
    cloudSays({ billing: { plan: 'free' } })
    assert.equal(await why(), 'Sorting triage needs Pro.')
  })

  it('stays shut when signed out', async () => {
    fs.rmSync(sessionFile())
    assert.equal(await why(), 'Sorting triage needs Pro. Sign in first.')
  })

  it('stays shut when Cloud cannot be reached to confirm', async () => {
    globalThis.fetch = (async () => {
      throw new Error('offline')
    }) as typeof fetch
    assert.equal(await why(), "Couldn't confirm your Pro plan. Reconnect and retry.")
  })
})
