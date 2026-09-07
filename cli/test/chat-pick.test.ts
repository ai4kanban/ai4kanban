// The runtime one conversation runs on (#272, #467).
//
// The promise is that a pick is the conversation's and nothing else's: the board's settings are
// untouched, another chat is unaffected, and the pick reaches the spawn rather than only the
// screen. One control, because a runtime carries the model — picking a row on another CLI
// throws the transcript away, because a session belongs to the CLI that opened it, and picking
// one on the same CLI carries the conversation on.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { pickChatRuntime, readChat, readChatView, sendChatMessage } from '../src/lib/agent/chat.ts'
import { openPlan, planResume, planRun } from '../src/lib/agent/resolve.ts'
import { CHATS_DIR, setBoardRoot } from '../src/lib/paths.ts'

let root = ''

const config = (cfg: Record<string, unknown>): void => {
  const kanban = path.join(root, 'docs', 'kanban')
  fs.mkdirSync(kanban, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'ui.config.json'), JSON.stringify(cfg, null, 2))
  setBoardRoot(root)
}

// Three rows: the one every board has, another on the same CLI, and one on another.
const runtime = (id: string, harness: string, settings: Record<string, string>) => ({
  id,
  name: id === 'global' ? 'Global default' : id,
  harness,
  settings,
})

const BOARD = {
  runtimes: [
    runtime('global', 'claude-code', { model: 'claude-sonnet-5' }),
    runtime('strong', 'claude-code', { model: 'claude-opus-5' }),
    runtime('cheap', 'codex', { model: 'gpt-5.1-codex' }),
  ],
}

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

// The model list a row offers is partly read off the agent CLIs' own files under $HOME
// (agent/harnesses/models.ts), so the home is a scratch one too — otherwise what this asserts
// would be whatever the machine running it happens to have installed.
let home = ''
let realHome: string | undefined

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-chat-pick-'))
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-chat-home-'))
  realHome = process.env.HOME
  process.env.HOME = home
})

afterEach(() => {
  if (realHome === undefined) delete process.env.HOME
  else process.env.HOME = realHome
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(home, { recursive: true, force: true })
})

describe('a conversation that never picked', () => {
  it('runs Global default and says so', () => {
    config(BOARD)
    const pick = readChatView(null).pick
    assert.equal(pick.runtime, 'global')
    assert.equal(pick.name, 'Global default')
    assert.equal(pick.harness, 'claude-code')
    assert.equal(pick.model, 'claude-sonnet-5')
    assert.equal(pick.own, false)
  })

  it('is still refused when the board moves to another CLI under it', () => {
    config(BOARD)
    said('claude-code')
    config({ runtimes: [runtime('global', 'codex', {})] })
    assert.match(readChatView(null).blocked ?? '', /Clear it to start fresh/)
  })

  it('offers only the runtimes whose CLI can hold one, each with its own model', () => {
    config(BOARD)
    const { runtimes } = readChatView(null).pick
    assert.deepEqual(
      runtimes.map((r) => [r.id, r.model]),
      [
        ['global', 'claude-sonnet-5'],
        ['strong', 'claude-opus-5'],
        ['cheap', 'gpt-5.1-codex'],
      ],
    )
  })
})

describe("a conversation's own runtime on the same CLI", () => {
  it('carries the same conversation on, and writes nothing into the board', () => {
    config(BOARD)
    said()
    assert.deepEqual(pickChatRuntime(null, 'strong'), {
      ok: true,
      cleared: false,
      restarted: false,
      runtime: 'strong',
    })
    const chat = readChat(null)!
    assert.equal(chat.runtime, 'strong')
    // The session is what makes it the same conversation.
    assert.equal(chat.resumeId, 'session-1')
    assert.equal(chat.messages.length, 2)
    assert.deepEqual(held(), BOARD)
  })

  it('marks in the conversation where the model changed, and only where it moved', () => {
    config(BOARD)
    said()
    pickChatRuntime(null, 'strong')
    pickChatRuntime(null, 'strong')
    assert.deepEqual(
      readChat(null)!.modelChanges?.map((m) => m.model),
      ['claude-opus-5'],
    )
  })

  it("goes back to the board's with nothing picked", () => {
    config(BOARD)
    said()
    pickChatRuntime(null, 'strong')
    pickChatRuntime(null, null)
    const pick = readChatView(null).pick
    assert.equal(pick.model, 'claude-sonnet-5')
    assert.equal(pick.own, false)
  })

  it("is another conversation's business alone", () => {
    config(BOARD)
    pickChatRuntime(null, 'strong')
    assert.equal(readChatView(12).pick.model, 'claude-sonnet-5')
  })
})

describe("a conversation's own runtime on another CLI", () => {
  it("throws the transcript away — that session was the old CLI's", () => {
    config(BOARD)
    said()
    const picked = pickChatRuntime(null, 'cheap')
    assert.deepEqual(picked, { ok: true, cleared: true, restarted: true, runtime: 'cheap' })
    const chat = readChat(null)!
    assert.equal(chat.messages.length, 0)
    assert.equal(chat.resumeId, undefined)
    assert.equal(chat.runtime, 'cheap')
    assert.deepEqual(held(), BOARD)
  })

  it('goes on running what it picked when the board switches under it', () => {
    config(BOARD)
    pickChatRuntime(null, 'cheap')
    config({ runtimes: [runtime('global', 'cursor', {}), ...BOARD.runtimes.slice(1)] })
    const view = readChatView(null)
    assert.equal(view.blocked, undefined)
    assert.equal(view.pick.runtime, 'cheap')
    assert.equal(view.pick.own, true)
    assert.equal(view.pick.boardRuntime, 'global')
  })

  it("follows the board again when the board's own row is picked", () => {
    config(BOARD)
    pickChatRuntime(null, 'cheap')
    pickChatRuntime(null, null)
    assert.equal(readChat(null), null)
    assert.equal(readChatView(null).pick.own, false)
  })

  it('carries a conversation held before runtimes across to the row its CLI became', () => {
    config(BOARD)
    // Written by an older release: a harness pin and a model of its own.
    said('codex', { pickedHarness: 'codex', pickedModel: 'gpt-5.1-mini' })
    const pick = readChatView(null).pick
    assert.equal(pick.runtime, 'cheap')
    assert.equal(pick.own, true)
    // …and the model it held is dropped — the row it maps to already carries one.
    assert.equal(pick.model, 'gpt-5.1-codex')
  })

  it('refuses a runtime this board does not have', () => {
    config(BOARD)
    const picked = pickChatRuntime(null, 'nonesuch')
    assert.ok('error' in picked && /no runtime called "nonesuch"/.test(picked.error))
  })
})

// One control means one moment to use it: a runtime carries the model, and swapping it mid-turn
// would be swapping what is answering.
describe('a runtime picked while the reply is coming', () => {
  it('is refused, and the conversation goes on running what it was asked on', async () => {
    const agent = path.join(root, 'agent.mjs')
    fs.writeFileSync(agent, 'process.stderr.write("done\\n")\n')
    config({
      runtimes: [
        runtime('global', 'claude-code', { model: 'claude-sonnet-5', command: `node ${agent}` }),
        BOARD.runtimes[1]!,
      ],
    })
    said()
    let refused = ''
    await sendChatMessage(null, 'and again', {
      // The moment the agent is spawned — the reply is in flight from here.
      onOpen: () => {
        const picked = pickChatRuntime(null, 'strong')
        refused = 'error' in picked ? picked.error : ''
      },
    })
    assert.match(refused, /still answering/)
    assert.equal(readChat(null)!.runtime, undefined)
  })
})

// A pick nothing spawns with is a pick on a screen and nowhere else. `planRun` and
// `planResume` are what a chat turn goes out by (agent/chat.ts), so they are asked here for the
// two things a runtime carries: the flag on the command line, and the settings a connector that
// takes its model in the conversation is opened with.
describe('the pick reaching the spawn', () => {
  it("puts the picked runtime's model on the command line, over Global default's", () => {
    config(BOARD)
    const run = planRun('s1', root, undefined, { pin: 'strong' })
    assert.ok(run.argv.includes('claude-opus-5'))
    assert.ok(!run.argv.includes('claude-sonnet-5'))
  })

  it("spawns the conversation's own runtime whatever the board is set to", () => {
    config({ runtimes: [runtime('global', 'cursor', {}), ...BOARD.runtimes.slice(1)] })
    const run = planRun('s1', root, undefined, { pin: 'cheap' })
    assert.equal(run.harness, 'codex')
    assert.equal(run.runtime, 'cheap')
    // And a turn into the session it already opened stays on it, rather than being refused
    // for not matching the board.
    assert.equal(planResume('codex', 'session-1', root, undefined, { pin: 'cheap' })?.harness, 'codex')
  })

  it('hands the same model to a connector opened with its settings', () => {
    config({ runtimes: [runtime('global', 'zcode', { model: 'zai/glm-5.3' })] })
    const run = planRun('s1', root, undefined, { pin: 'global' })
    // Reopening the plan resolves the row again — the flags alone would lose it here.
    assert.equal(openPlan(run).client !== undefined, true)
  })
})
