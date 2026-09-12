// A card whose own chat is writing a reply is held (#633).
//
// The promise is that the card cannot be built, refined, answered, archived or rejected while
// what it should say is still being talked about — and that the hold is exactly as long as
// the turn: the marker goes when the reply lands, is stopped, or its process disappears, so
// nothing here can freeze a card for good.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { cardsDiscussing, noteChatMessage } from '../src/lib/agent/chat.ts'
import { listConversations } from '../src/lib/agent/discussions.ts'
import { openResume, openRun, patch, peekRun } from '../src/lib/agent/sessions.ts'
import { CHATS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import { findCard, readBoard } from '../src/lib/view/read.ts'
import { forgetMachineState, move } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-discussing-'))
const kanban = path.join(root, 'docs', 'kanban')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(path.join(kanban, 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '1\n')
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

/** A reply being written on this card, as `sendChatMessage` marks one: a folder beside the
 *  transcript naming the process writing it. `owner` is what says the marker is still live. */
function answering(cardId: number, owner = process.pid): void {
  const dir = path.join(CHATS_DIR, `card-${cardId}.answering`)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'owner'), `${owner}\n`)
}

const card = async (title = 'A card being discussed'): Promise<number> =>
  (await move(root, ['create', '--title', title])).id as number

describe('a card reads as being discussed while its chat answers', () => {
  it('is free before anything is said', async () => {
    const id = await card()
    assert.equal(findCard(id)?.discussing, undefined)
    assert.deepEqual([...cardsDiscussing()], [])
  })

  it('is discussing while a live process holds the marker', async () => {
    const id = await card()
    answering(id)
    assert.equal(findCard(id)?.discussing, true)
    assert.deepEqual([...cardsDiscussing()], [id])
  })

  // The board card wears the mark too, so a reader scanning the column sees the freeze
  // without opening the card.
  it('says so on the board card as well as the card page', async () => {
    const id = await card()
    answering(id)
    const onBoard = readBoard().columns.flatMap((column) => column.cards)
    assert.equal(onBoard.find((c) => c.id === id)?.discussing, true)
  })

  it('frees the card when the process writing the reply is gone', async () => {
    const id = await card()
    answering(id, 2 ** 30)
    assert.equal(findCard(id)?.discussing, undefined)
    assert.ok(
      !fs.existsSync(path.join(CHATS_DIR, `card-${id}.answering`)),
      'the dead marker is cleared rather than left holding the card',
    )
  })

  it('frees the card the moment the marker goes', async () => {
    const id = await card()
    answering(id)
    fs.rmSync(path.join(CHATS_DIR, `card-${id}.answering`), { recursive: true })
    assert.equal(findCard(id)?.discussing, undefined)
  })

  it('holds one card and not its neighbour', async () => {
    const held = await card('The one being talked about')
    const free = await card('The one beside it')
    answering(held)
    assert.equal(findCard(held)?.discussing, true)
    assert.equal(findCard(free)?.discussing, undefined)
  })
})

describe('the runs a discussed card refuses', () => {
  // `unstick` is here because it rewrites the card or drops it (#118) — both are moves on
  // words the reply in flight is about to change.
  const refused = ['implement', 'clarify', 'writing', 'resolve', 'decide', 'archive', 'reject', 'unstick'] as const

  for (const action of refused) {
    it(`refuses ${action}, and says what frees it`, async () => {
      const id = await card()
      answering(id)
      const out = openRun({ action, id }, 'a prompt')
      assert.ok('error' in out, `${action} should be refused`)
      assert.match(out.error, /is being discussed/)
      assert.match(out.error, /the reply lands or is stopped/)
    })
  }

  // The user typed `refine`; `clarify` and `writing` are the passes it runs, and a refusal
  // naming one of those is a refusal about a command nobody typed.
  it('names refine, not the pass refine would have run', async () => {
    const id = await card()
    answering(id)
    const out = openRun({ action: 'clarify', id }, 'a prompt')
    assert.ok('error' in out)
    assert.match(out.error, /`refine` is refused/)
  })

  // The hold is about what the card SAYS. A review judges code the delivery already wrote,
  // and holding it would leave a delivery stuck on a conversation it knows nothing about.
  it('lets a review through', async () => {
    const id = await card()
    answering(id)
    const out = openRun({ action: 'review', id }, 'a prompt')
    if ('error' in out) {
      assert.doesNotMatch(
        out.error,
        /is being discussed/,
        'a review is not a judgment about what the card should say',
      )
    }
  })

  it('starts the same run once the reply has landed', async () => {
    const id = await card()
    answering(id)
    assert.ok('error' in openRun({ action: 'clarify', id }, 'a prompt'))
    fs.rmSync(path.join(CHATS_DIR, `card-${id}.answering`), { recursive: true })
    assert.ok(!('error' in openRun({ action: 'clarify', id }, 'a prompt')))
  })
})

describe('the rail lists a card conversation beside the discussions', () => {
  it('lists a card the moment something has been said about it', async () => {
    const id = await card('Shorten the rail')
    assert.deepEqual(listConversations(), [])

    noteChatMessage(id, 'the rail is too long')
    const rows = listConversations()
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.cardId, id)
    assert.equal(rows[0]?.target, id)
    assert.equal(rows[0]?.name, 'Shorten the rail', 'a card conversation is named by its card')
    assert.equal(rows[0]?.messages, 1)
  })

  it('says which conversation is answering', async () => {
    const id = await card()
    noteChatMessage(id, 'change the scope')
    assert.equal(listConversations()[0]?.answering, false)
    answering(id)
    assert.equal(listConversations()[0]?.answering, true)
  })

  it('drops the row when the card leaves the board', async () => {
    const id = await card()
    noteChatMessage(id, 'change the scope')
    assert.equal(listConversations().length, 1)
    await move(root, ['reject', String(id), '--discard'])
    assert.deepEqual(listConversations(), [], 'the row would open a page that is no longer there')
  })
})

// A delivery carrying its own run on is not the card being talked about (`Decided by the
// agent`): its build was approved before the conversation started, and a refused resume
// would strand it on a conversation it knows nothing about.
describe('a run picked up again while the card is discussed', () => {
  /** A run of `action` stopped short, with everything `openResume` needs to pick it up: the
   *  id its own CLI comes back by, and a log — the record drops a finished run without one. */
  const stopped = (id: number, action: 'implement' | 'clarify'): string => {
    const opened = openRun({ action, id }, 'a prompt')
    assert.ok(!('error' in opened), `${action} has to start before it can be picked up`)
    const sessionId = opened.run.sessionId
    fs.mkdirSync(path.dirname(opened.run.logPath), { recursive: true })
    fs.writeFileSync(opened.run.logPath, '')
    patch(sessionId, (run) => {
      run.status = 'stopped'
      run.harness = 'claude-code'
      run.resumeId = sessionId
    })
    return sessionId
  }

  it('refuses one no delivery is carrying', async () => {
    const id = await card()
    const sessionId = stopped(id, 'clarify')
    answering(id)
    const out = await openResume(sessionId)
    assert.ok('error' in out)
    assert.match(out.error, /is being discussed/)
  })

  it('lets a delivery carry its own run on', async () => {
    const id = await card()
    const sessionId = stopped(id, 'implement')
    assert.ok(peekRun(sessionId)?.deliveryId, 'the build opened the delivery this resume belongs to')
    answering(id)
    const out = await openResume(sessionId)
    if ('error' in out) {
      assert.doesNotMatch(
        out.error,
        /is being discussed/,
        'the delivery builds what it froze, not the words being talked about now',
      )
    }
  })
})
