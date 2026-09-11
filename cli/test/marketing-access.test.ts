// Who may make a Marketing board (#582).
//
// The board is an alpha, so it is open only to an account Cloud has JUST said is admitted.
// What is asked here: an admitted account makes one, one we have not admitted does not, an
// unreachable Cloud refuses rather than leaving the alpha standing for an account that was
// never invited — and none of it is in the way of an Engineering board.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { setBoardRoot } from '../src/lib/paths.ts'
import { writeSession, type CloudSession } from '../src/lib/cloud/session.ts'
import { allowedSolution } from '../src/lib/cloud/admission.ts'

const SUPABASE = 'https://project.supabase.co'
const API = 'https://api.example.test'

let home = ''
let board = ''
const realFetch = globalThis.fetch

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-mktg-access-home-'))
  board = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-mktg-access-board-'))
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
  delete process.env.AI4KANBAN_HOME
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

const refusal = async (name: 'product' | 'marketing'): Promise<string> => {
  try {
    await allowedSolution(name)
    return ''
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

describe('who may make a Marketing board', () => {
  it('lets an admitted account make one', async () => {
    cloudSays({ session: { admitted: true, handle: 'someone' } })
    assert.equal(await refusal('marketing'), '')
  })

  it('refuses an account we have not admitted', async () => {
    cloudSays({ session: { admitted: false, handle: 'someone' } })
    assert.match(await refusal('marketing'), /Marketing board is open to invited Cloud accounts/)
  })

  it('refuses when Cloud cannot be reached to check', async () => {
    globalThis.fetch = (async () => {
      throw new Error('offline')
    }) as typeof fetch
    assert.match(await refusal('marketing'), /could not be reached/)
  })

  it('asks nothing of an Engineering board', async () => {
    globalThis.fetch = (async () => {
      throw new Error('the network must not be touched')
    }) as typeof fetch
    assert.equal(await refusal('product'), '')
    await allowedSolution(undefined)
  })
})
