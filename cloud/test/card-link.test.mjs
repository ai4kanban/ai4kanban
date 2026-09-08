import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CLOUD_UI_ORIGIN } from '../src/config.ts'
import worker from '../src/index.ts'
import { cardUrl } from '../src/message.ts'

// The card link a message carries, and the one redirect that answers it (#364).
//
// It branches on where the event LIVES, never on the device asking: a redirect cannot tell
// whether the machine behind it has the app, and guessing wrong on a phone is the failure the
// hosted card page exists to remove.

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }
const BOARD = '22222222-2222-4222-8222-222222222222'
const WORKSPACE = '44444444-4444-4444-8444-444444444444'
const CTX = { waitUntil() {} }

const ask = (path) => worker.fetch(new Request(`https://api.ai4kanban.dev${path}`), ENV, CTX)

describe('where a card link goes', () => {
  it('sends a workspace card to the hosted page, and a board card to the app', () => {
    assert.equal(
      cardUrl({ boardId: '', workspaceId: WORKSPACE, taskId: 364 }),
      `https://api.ai4kanban.dev/card/w/${WORKSPACE}/364`,
    )
    assert.equal(
      cardUrl({ boardId: BOARD, workspaceId: '', taskId: 364 }),
      `https://api.ai4kanban.dev/card/${BOARD}/364`,
    )
  })

  it('redirects each of them to the place that can open it', async () => {
    const hosted = await ask(`/card/w/${WORKSPACE}/364`)
    assert.equal(hosted.status, 302)
    assert.equal(hosted.headers.get('location'), `${CLOUD_UI_ORIGIN}/${WORKSPACE}/364`)

    // A Local board is untouched: it has no page to land on, and keeps the app link it has
    // always had.
    const local = await ask(`/card/${BOARD}/12`)
    assert.equal(local.status, 302)
    assert.equal(local.headers.get('location'), `ai4kanban://card/${BOARD}/12`)
  })

  it('answers both without reading anything, so it tells nobody a workspace exists', async () => {
    // No `fetch` is mocked here at all: a call to the database would throw rather than
    // redirect, which is the whole of the check.
    assert.equal((await ask(`/card/w/${WORKSPACE}/1`)).status, 302)
  })
})
