import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import worker from '../src/index.ts'
import { cardUrl } from '../src/message.ts'

// The card link a message carries, and the one redirect that answers it.

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }
const BOARD = '22222222-2222-4222-8222-222222222222'
const CTX = { waitUntil() {} }

const ask = (path) => worker.fetch(new Request(`https://api.ai4kanban.dev${path}`), ENV, CTX)

describe('where a card link goes', () => {
  it('sends a board card to the app', async () => {
    assert.equal(cardUrl({ boardId: BOARD, taskId: 364 }), `https://api.ai4kanban.dev/card/${BOARD}/364`)

    // No `fetch` is mocked here at all: a call to the database would throw rather than
    // redirect, which is the whole of the check.
    const local = await ask(`/card/${BOARD}/12`)
    assert.equal(local.status, 302)
    assert.equal(local.headers.get('location'), `ai4kanban://card/${BOARD}/12`)
  })

  it('no longer answers the old workspace link', async () => {
    assert.equal((await ask(`/card/w/${BOARD}/1`)).status, 404)
  })
})
