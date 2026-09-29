// A card's chat picks up the discussion it was written from (#1213).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import {
  clearChat,
  handOffToCards,
  pickChatRuntime,
  readChat,
  readChatView,
  sendChatMessage,
} from '../src/lib/agent/chat.ts'
import { CHATS_DIR, setBoardRoot } from '../src/lib/paths.ts'

const DISCUSSION = 'discussion-00000000-0000-0000-0000-000000000001'

let root = ''
let home = ''
let realHome: string | undefined
let calls = ''

// A stand-in CLI: writes down every command line it was given, and fails a fork when told to.
function board(harness = 'claude-code', failFork = false): void {
  const file = path.join(root, 'agent.mjs')
  fs.writeFileSync(
    file,
    `import fs from 'node:fs'
const args = process.argv.slice(2)
fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + '\\n')
const forking = args.includes('--fork-session') || args.includes('fork') || args.includes('--fork')
if (${failFork} && forking) { process.stderr.write('No conversation found\\n'); process.exit(1) }
`,
  )
  const kanban = path.join(root, 'docs', 'kanban')
  fs.mkdirSync(kanban, { recursive: true })
  fs.writeFileSync(
    path.join(kanban, 'ui.config.json'),
    JSON.stringify({
      runtimes: [
        { id: 'global', name: 'Global default', harness, settings: { command: `node ${file}` } },
        { id: 'other', name: 'other', harness: harness === 'codex' ? 'claude-code' : 'codex', settings: { command: `node ${file}` } },
      ],
    }),
  )
  setBoardRoot(root)
}

function discussion(extra: Record<string, unknown> = {}): void {
  fs.mkdirSync(CHATS_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(CHATS_DIR, `${DISCUSSION}.json`),
    JSON.stringify({
      cardId: DISCUSSION,
      harness: 'claude-code',
      resumeId: 'handoff-session',
      messages: [
        { role: 'you', text: 'make the card chat remember', at: 1 },
        { role: 'agent', text: '⏺ Read plan.md\nit can fork the session', at: 2 },
      ],
      startedAt: 1,
      updatedAt: 2,
      ...extra,
    }),
  )
}

const said = (): string[][] =>
  fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-card-from-'))
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-card-from-home-'))
  realHome = process.env.HOME
  process.env.HOME = home
  calls = path.join(root, 'calls.jsonl')
})

afterEach(() => {
  if (realHome === undefined) delete process.env.HOME
  else process.env.HOME = realHome
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(home, { recursive: true, force: true })
})

describe('the handoff', () => {
  it('points each new card at the discussion, and leaves a chat already going alone', () => {
    board()
    discussion()
    fs.writeFileSync(
      path.join(CHATS_DIR, 'card-8.json'),
      JSON.stringify({ cardId: 8, harness: 'claude-code', messages: [{ role: 'you', text: 'hi', at: 3 }] }),
    )
    handOffToCards(DISCUSSION, [7, 8])
    assert.deepEqual(readChat(7)?.from, {
      discussion: DISCUSSION,
      resumeId: 'handoff-session',
      harness: 'claude-code',
      runtime: 'global',
      messages: 2,
    })
    assert.equal(readChat(8)?.from, undefined)
    assert.equal(readChatView(7).discussion?.length, 2)
  })

  it('closes the discussion once it became cards', () => {
    board()
    discussion({ plans: [{ path: 'plans/1-x.md', done: true, cards: [7] }] })
    assert.equal(readChatView(DISCUSSION).blockedRefusal?.reason, 'chatClosed')
  })
})

describe("a card chat's first message", () => {
  it('forks the handoff session and says what it continues', async () => {
    board()
    discussion()
    handOffToCards(DISCUSSION, [7])
    await sendChatMessage(7, 'go on', { title: 'Remember' })
    const [args] = said()
    assert.ok(args.includes('--fork-session'))
    assert.equal(args[args.indexOf('--resume') + 1], 'handoff-session')
    assert.match(args.at(-1)!, /continues the discussion this card was written from/)
    assert.doesNotMatch(args.at(-1)!, /up to the handoff/)
  })

  it('opens a fresh session with the discussion in words when the fork fails', async () => {
    board('claude-code', true)
    discussion()
    handOffToCards(DISCUSSION, [7])
    const reply = await sendChatMessage(7, 'go on')
    const [, fresh] = said()
    assert.ok(!fresh.includes('--resume'))
    assert.match(fresh.at(-1)!, /up to the handoff:\n\nMe: make the card chat remember\n\nYou: it can fork the session/)
    assert.ok('text' in reply && !reply.text.includes('No conversation found'))
  })

  it('keeps the discussion when switched to another agent first, and opens with it in words', async () => {
    board()
    discussion()
    handOffToCards(DISCUSSION, [7])
    pickChatRuntime(7, 'other')
    assert.equal(readChat(7)?.from?.discussion, DISCUSSION)
    await sendChatMessage(7, 'go on')
    const [args] = said()
    assert.ok(!args.includes('fork'))
    assert.match(args.at(-1)!, /up to the handoff/)
  })

  it('opens a plain fresh session once the discussion is gone and it cannot fork', async () => {
    board()
    discussion()
    handOffToCards(DISCUSSION, [7])
    pickChatRuntime(7, 'other')
    clearChat(DISCUSSION)
    await sendChatMessage(7, 'go on')
    const [args] = said()
    assert.doesNotMatch(args.at(-1)!, /continues the discussion|up to the handoff/)
  })

  it('forgets the discussion when the chat is cleared', () => {
    board()
    discussion()
    handOffToCards(DISCUSSION, [7])
    clearChat(7)
    assert.equal(readChatView(7).discussion, undefined)
  })
})
