// The agent and the model one conversation runs on (#272).
//
// The promise is that a pick is the conversation's and nothing else's: the board's settings
// are untouched, another chat is unaffected, and the pick reaches the spawn rather than only
// the screen. Switching the agent throws the transcript away, because a session belongs to
// the agent that opened it; switching the model does not.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { pickChatAgent, pickChatModel, readChat, readChatView, sendChatMessage } from '../src/lib/agent/chat.ts'
import { openPlan, planResume, planRun } from '../src/lib/agent/resolve.ts'
import { CHATS_DIR, setBoardRoot } from '../src/lib/paths.ts'

let root = ''

const config = (cfg: Record<string, unknown>): void => {
  const kanban = path.join(root, 'docs', 'kanban')
  fs.mkdirSync(kanban, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'ui.config.json'), JSON.stringify(cfg, null, 2))
  setBoardRoot(root)
}

const BOARD = { harness: 'claude-code', harnessSettings: { 'claude-code': { model: 'claude-sonnet-5' } } }

// A conversation that has already been held, so the rules below have something to lose.
const said = (harness = 'claude-code', extra: Record<string, unknown> = {}): void => {
  fs.mkdirSync(CHATS_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(CHATS_DIR, 'board.json'),
    JSON.stringify({
      cardId: null,
      harness,
      resumeId: 'session-1',
      messages: [
        { role: 'you', text: 'hi', at: 1000 },
        { role: 'agent', text: 'hello', at: 2000 },
      ],
      startedAt: 900,
      updatedAt: 2000,
      ...extra,
    }),
  )
}

const held = (): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(root, 'docs', 'kanban', 'ui.config.json'), 'utf8'))

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-chat-pick-'))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('a conversation that never picked', () => {
  it('runs the board and says so', () => {
    config(BOARD)
    const pick = readChatView(null).pick
    assert.equal(pick.harness, 'claude-code')
    assert.equal(pick.model, 'claude-sonnet-5')
    assert.equal(pick.ownAgent, false)
    assert.equal(pick.ownModel, false)
  })

  it('is still refused when the board moves to another agent under it', () => {
    config(BOARD)
    said('claude-code')
    config({ ...BOARD, harness: 'codex' })
    assert.match(readChatView(null).blocked ?? '', /Clear it to start fresh/)
  })

  it("offers only the agents that can hold one, each with its own model", () => {
    config(BOARD)
    const { agents } = readChatView(null).pick
    assert.ok(agents.length > 1)
    assert.equal(agents.find((a) => a.name === 'claude-code')?.model, 'claude-sonnet-5')
    assert.equal(agents.find((a) => a.name === 'claude-code')?.takesModel, true)
  })
})

describe("a conversation's own model", () => {
  it('carries the same conversation on, and writes nothing into the board', () => {
    config(BOARD)
    said()
    assert.deepEqual(pickChatModel(null, 'claude-opus-5'), { ok: true })
    const chat = readChat(null)!
    assert.equal(chat.pickedModel, 'claude-opus-5')
    // The session is what makes it the same conversation.
    assert.equal(chat.resumeId, 'session-1')
    assert.equal(chat.messages.length, 2)
    assert.deepEqual(held(), BOARD)
  })

  it('marks in the conversation where it changed, and only where it moved', () => {
    config(BOARD)
    said()
    pickChatModel(null, 'claude-opus-5')
    pickChatModel(null, 'claude-opus-5')
    assert.deepEqual(
      readChat(null)!.modelChanges?.map((m) => m.model),
      ['claude-opus-5'],
    )
  })

  it("goes back to the board's with nothing typed in it", () => {
    config(BOARD)
    said()
    pickChatModel(null, 'claude-opus-5')
    pickChatModel(null, null)
    const pick = readChatView(null).pick
    assert.equal(pick.model, 'claude-sonnet-5')
    assert.equal(pick.ownModel, false)
  })

  it("offers the ids typed here lately, the board's among them", () => {
    config(BOARD)
    pickChatModel(null, 'claude-opus-5')
    const { recent } = readChatView(null).pick
    assert.deepEqual(recent, ['claude-opus-5', 'claude-sonnet-5'])
  })

  it("is another conversation's business alone", () => {
    config(BOARD)
    pickChatModel(null, 'claude-opus-5')
    assert.equal(readChatView(12).pick.model, 'claude-sonnet-5')
  })

  it('picked before the first message, it is nobody\'s conversation yet', () => {
    config(BOARD)
    pickChatModel(null, 'claude-opus-5')
    config({ ...BOARD, harness: 'codex' })
    // Nothing has been said, so there is no session for the board's new agent to disagree
    // with — and the first message opens one on it.
    assert.equal(readChatView(null).blocked, undefined)
    assert.equal(readChatView(null).pick.harness, 'codex')
  })
})

describe("a conversation's own agent", () => {
  it("throws the transcript away — that session was the old agent's", () => {
    config(BOARD)
    said()
    const picked = pickChatAgent(null, 'codex')
    assert.deepEqual(picked, { ok: true, cleared: true, harness: 'codex' })
    const chat = readChat(null)!
    assert.equal(chat.messages.length, 0)
    assert.equal(chat.resumeId, undefined)
    assert.equal(chat.pickedHarness, 'codex')
    assert.deepEqual(held(), BOARD)
  })

  it("drops the model with it — an id is one agent's vocabulary", () => {
    config(BOARD)
    said()
    pickChatModel(null, 'claude-opus-5')
    pickChatAgent(null, 'codex')
    assert.equal(readChat(null)!.pickedModel, undefined)
  })

  it('goes on running what it picked when the board switches under it', () => {
    config(BOARD)
    pickChatAgent(null, 'codex')
    config({ ...BOARD, harness: 'cursor' })
    const view = readChatView(null)
    assert.equal(view.blocked, undefined)
    assert.equal(view.pick.harness, 'codex')
    assert.equal(view.pick.ownAgent, true)
    assert.equal(view.pick.boardHarness, 'cursor')
  })

  it("follows the board again when the board's own agent is picked", () => {
    config(BOARD)
    pickChatAgent(null, 'codex')
    pickChatAgent(null, null)
    assert.equal(readChat(null), null)
    assert.equal(readChatView(null).pick.ownAgent, false)
  })

  it('keeps the conversation when the agent picked is the one it already runs', () => {
    config(BOARD)
    said()
    pickChatModel(null, 'claude-opus-5')
    // Pinning what it already runs, and unpinning it again: neither changes the agent, so
    // neither costs the session.
    assert.deepEqual(pickChatAgent(null, 'claude-code'), { ok: true, cleared: false, harness: 'claude-code' })
    assert.equal(readChat(null)!.pickedHarness, 'claude-code')
    assert.deepEqual(pickChatAgent(null, null), { ok: true, cleared: false, harness: 'claude-code' })
    const chat = readChat(null)!
    assert.equal(chat.pickedHarness, undefined)
    assert.equal(chat.messages.length, 2)
    assert.equal(chat.resumeId, 'session-1')
    assert.equal(chat.pickedModel, 'claude-opus-5')
  })

  it('refuses an agent that cannot hold a conversation at all', () => {
    config(BOARD)
    const picked = pickChatAgent(null, 'nonesuch')
    assert.ok('error' in picked && /can't hold a conversation/.test(picked.error))
  })
})

// A reply is answered by a turn that is holding the transcript in memory, and it writes that
// back when the reply lands. A model picked in the meantime is allowed (the card says so), so
// it has to survive that write — and its mark has to sit after the reply, which the model that
// was running when it was asked for wrote.
describe('a model picked while the reply is coming', () => {
  it('survives the reply landing, and marks after it', async () => {
    const agent = path.join(root, 'agent.mjs')
    fs.writeFileSync(agent, 'process.stderr.write("done\\n")\n')
    config({
      ...BOARD,
      harnessSettings: { 'claude-code': { model: 'claude-sonnet-5', command: `node ${agent}` } },
    })
    said()
    await sendChatMessage(null, 'and again', {
      // The moment the agent is spawned — the reply is in flight from here.
      onOpen: () => void pickChatModel(null, 'claude-opus-5'),
    })
    const chat = readChat(null)!
    assert.equal(chat.pickedModel, 'claude-opus-5')
    const reply = chat.messages[chat.messages.length - 1]!
    assert.equal(reply.role, 'agent')
    assert.deepEqual(
      chat.modelChanges?.map((m) => m.model),
      ['claude-opus-5'],
    )
    assert.ok(chat.modelChanges![0]!.at > reply.at)
  })
})

// A pick nothing spawns with is a pick on a screen and nowhere else. `planRun` and
// `planResume` are what a chat turn goes out by (agent/chat.ts), so they are asked here for
// the two things that carry a model: the flag on the command line, and the settings a
// connector that takes its model in the conversation is opened with.
describe('the pick reaching the spawn', () => {
  it("puts the conversation's model on the command line, over the board's", () => {
    config(BOARD)
    const run = planRun('s1', root, undefined, { settings: { model: 'claude-opus-5' } })
    assert.ok(run.argv.includes('claude-opus-5'))
    assert.ok(!run.argv.includes('claude-sonnet-5'))
  })

  it("spawns the conversation's own agent whatever the board is set to", () => {
    config({ ...BOARD, harness: 'cursor' })
    const run = planRun('s1', root, undefined, { pin: 'codex' })
    assert.equal(run.harness, 'codex')
    // And a turn into the session it already opened stays on it, rather than being refused
    // for not matching the board.
    assert.equal(planResume('codex', 'session-1', root, undefined, { pin: 'codex' })?.harness, 'codex')
  })

  it('hands the same model to a connector opened with its settings', () => {
    config({ harness: 'zcode', harnessSettings: { zcode: { model: 'zai/glm-5' } } })
    const run = planRun('s1', root, undefined, { pin: 'zcode', settings: { model: 'zai/glm-5.3' } })
    assert.deepEqual(run.settings, { model: 'zai/glm-5.3' })
    // Reopening the plan resolves it again — the flags alone would lose it here.
    assert.ok(openPlan(run).client)
  })
})
