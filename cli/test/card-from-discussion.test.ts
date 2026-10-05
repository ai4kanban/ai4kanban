// A card's chat picks up the session it was created in: a discussion (#1213), or an agent in a
// terminal (#1222).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import {
  chatRunEnded,
  clearChat,
  handOff,
  handOffToCards,
  pickChatRuntime,
  readChat,
  readChatView,
  sendChatMessage,
} from '../src/lib/agent/chat.ts'
import { DISCUSSION_ENV, RUN_ENV } from '../src/lib/agent/env.ts'
import { agentOf, currentSession, opencodeSessionOf, probes, terminalSession } from '../src/lib/agent/origin.ts'
import { withStore } from '../src/lib/agent/store.ts'
import { CHATS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import { move, uiConfigOf } from './helpers/board.ts'
import { PROMPT_OF } from './helpers/fake-agent.ts'

const DISCUSSION = 'discussion-00000000-0000-0000-0000-000000000001'

let root = ''
let home = ''
let realHome: string | undefined
let calls = ''
const SESSION_VARS = ['CLAUDE_CODE_SESSION_ID', 'CODEX_THREAD_ID', RUN_ENV, DISCUSSION_ENV]
const realEnv: Record<string, string | undefined> = {}
const realProbes = { ...probes }

// A stand-in CLI: writes down every command line it was given, and fails a fork when told to.
function board(harness = 'claude-code', failFork = false): void {
  const file = path.join(root, 'agent.mjs')
  fs.writeFileSync(
    file,
    `import fs from 'node:fs'
${PROMPT_OF}
const args = [...process.argv.slice(2), await promptOf()]
fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + '\\n')
const forking = args.includes('--fork-session') || args.includes('fork') || args.includes('--fork')
if (${failFork} && forking) { process.stderr.write('No conversation found\\n'); process.exit(1) }
console.log(JSON.stringify({ type: 'result', result: '' }))
`,
  )
  const kanban = path.join(root, 'docs', 'kanban')
  fs.mkdirSync(kanban, { recursive: true })
  fs.writeFileSync(
    uiConfigOf(kanban),
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
  for (const name of SESSION_VARS) {
    realEnv[name] = process.env[name]
    delete process.env[name]
  }
  probes.chain = () => ['-zsh']
  probes.opencode = () => undefined
})

afterEach(() => {
  if (realHome === undefined) delete process.env.HOME
  else process.env.HOME = realHome
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(home, { recursive: true, force: true })
  for (const name of SESSION_VARS) {
    if (realEnv[name] === undefined) delete process.env[name]
    else process.env[name] = realEnv[name]
  }
  Object.assign(probes, realProbes)
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
      cwd: root,
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
    assert.match(args.at(-1)!, /continues the conversation this card was created in/)
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
    assert.doesNotMatch(args.at(-1)!, /continues the conversation|up to the handoff/)
  })

  it('forgets the discussion when the chat is cleared', () => {
    board()
    discussion()
    handOffToCards(DISCUSSION, [7])
    clearChat(7)
    assert.equal(readChatView(7).discussion, undefined)
  })
})

// A terminal where Claude Code is the nearest agent, in session `terminal-session`.
function inClaude(): void {
  process.env.CLAUDE_CODE_SESSION_ID = 'terminal-session'
  probes.chain = () => ['/bin/zsh -c akb raw create', 'claude --dangerously-skip-permissions', 'iTerm2']
}

describe('the session a card is created in', () => {
  it('knows each agent by the name it was started under', () => {
    assert.equal(agentOf('claude -p'), 'claude-code')
    assert.equal(agentOf('node /usr/lib/node_modules/@anthropic-ai/claude-code/cli.js'), 'claude-code')
    assert.equal(agentOf('/opt/homebrew/bin/codex'), 'codex')
    assert.equal(agentOf('node /x/bin/codex.js exec'), 'codex')
    assert.equal(agentOf('cursor-agent'), 'cursor')
    assert.equal(agentOf('/bin/zsh'), undefined)
  })

  it('reads the nearest agent only', () => {
    const env = { CLAUDE_CODE_SESSION_ID: 'outer', CODEX_THREAD_ID: 'thread-1' }
    const none = () => undefined
    assert.deepEqual(terminalSession(['zsh', 'codex', 'claude'], env, none, '/p'), { harness: 'codex', resumeId: 'thread-1', cwd: '/p' })
    assert.equal(terminalSession(['zsh', 'cursor-agent -p', 'claude'], env, none, '/p'), undefined)
    assert.equal(terminalSession(['zsh', 'login'], env, none, '/p'), undefined)
    assert.equal(terminalSession(['claude'], {}, none, '/p'), undefined)
  })

  it("asks OpenCode for this folder's latest session", () => {
    const out = JSON.stringify([{ id: 'ses_1', directory: '/p', updated: 2 }])
    assert.equal(opencodeSessionOf(out), 'ses_1')
    assert.equal(opencodeSessionOf('[]'), undefined)
    assert.equal(opencodeSessionOf('not json'), undefined)
    assert.deepEqual(terminalSession(['opencode'], {}, () => opencodeSessionOf(out), '/p'), {
      harness: 'opencode',
      resumeId: 'ses_1',
      cwd: '/p',
    })
  })

  it("takes a board run's recorded origin, never the run's own session", () => {
    board()
    inClaude()
    process.env[RUN_ENV] = 'run-1'
    const run = { sessionId: 'run-1', cardId: null, action: 'create' as const, status: 'running' as const, startedAt: 1, harness: 'claude-code', logPath: '' }
    withStore((s) => void s.runs.push(run))
    assert.equal(currentSession(), undefined)
    withStore((s) => void (s.runs[0]!.origin = { harness: 'codex', resumeId: 'typed-in' }))
    assert.equal(currentSession()?.resumeId, 'typed-in')
  })

  it('takes the discussion over the terminal the board was started from', () => {
    board()
    discussion()
    inClaude()
    process.env[DISCUSSION_ENV] = DISCUSSION
    assert.equal(currentSession()?.discussion, DISCUSSION)
    assert.equal(currentSession()?.resumeId, 'handoff-session')
  })

  it('hands every card `raw create` writes the session it was typed in', async () => {
    board()
    fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo'), { recursive: true })
    fs.writeFileSync(path.join(root, 'docs', 'kanban', 'next-id'), '7\n')
    inClaude()
    await move(root, ['create', '--title', 'From the terminal'])
    assert.equal(readChat(7)?.from?.resumeId, 'terminal-session')
  })
})

describe('a card created in a discussion turn', () => {
  it('forks the discussion, and falls back to it in words up to the card', async () => {
    board('claude-code', true)
    discussion()
    const file = path.join(CHATS_DIR, `${DISCUSSION}.json`)
    const chat = JSON.parse(fs.readFileSync(file, 'utf8'))
    chat.messages.push({ role: 'you', text: 'make a card for it', at: 3 })
    fs.writeFileSync(file, JSON.stringify(chat))
    process.env[DISCUSSION_ENV] = DISCUSSION
    handOff(currentSession()!, [7])
    chat.messages.push({ role: 'agent', text: 'made #7', at: 4 }, { role: 'you', text: 'something later', at: 5 })
    fs.writeFileSync(file, JSON.stringify(chat))
    await sendChatMessage(7, 'go on')
    const [fork, fresh] = said()
    assert.equal(fork[fork.indexOf('--resume') + 1], 'handoff-session')
    assert.match(fresh.at(-1)!, /Me: make a card for it/)
    assert.doesNotMatch(fresh.at(-1)!, /something later|made #7/)
  })

  it('gets the session once the first turn that made it ends', () => {
    board()
    discussion({ resumeId: undefined })
    process.env[DISCUSSION_ENV] = DISCUSSION
    handOff(currentSession()!, [7])
    assert.equal(readChat(7)?.from?.resumeId, undefined)
    assert.deepEqual(readChat(DISCUSSION)?.pendingCards, [7])
    chatRunEnded(DISCUSSION, 'first-turn')
    assert.equal(readChat(7)?.from?.resumeId, 'first-turn')
    assert.equal(readChat(DISCUSSION)?.pendingCards, undefined)
  })
})

describe('a card created in a terminal', () => {
  it("forks that agent's session", async () => {
    board()
    inClaude()
    handOff(currentSession()!, [7])
    await sendChatMessage(7, 'go on')
    const [args] = said()
    assert.ok(args.includes('--fork-session'))
    assert.equal(args[args.indexOf('--resume') + 1], 'terminal-session')
    assert.match(args.at(-1)!, /continues the conversation this card was created in/)
    assert.equal(readChatView(7).discussion, undefined)
  })

  it('opens a plain fresh session when the fork fails', async () => {
    board('claude-code', true)
    inClaude()
    handOff(currentSession()!, [7])
    const reply = await sendChatMessage(7, 'go on')
    const [, fresh] = said()
    assert.ok(!fresh.includes('--resume'))
    assert.doesNotMatch(fresh.at(-1)!, /continues the conversation|up to the handoff/)
    assert.ok('text' in reply && !reply.text.includes('No conversation found'))
  })

  it("opens a plain fresh session on the board's agent when this board cannot run the terminal's", async () => {
    board()
    handOff({ harness: 'opencode', resumeId: 'ses_1', cwd: root }, [7])
    await sendChatMessage(7, 'go on')
    const [args] = said()
    assert.ok(!args.includes('--resume') && !args.includes('--fork-session'))
    assert.doesNotMatch(args.at(-1)!, /continues the conversation/)
  })

  it('leaves a card chat already going alone', () => {
    board()
    fs.mkdirSync(CHATS_DIR, { recursive: true })
    fs.writeFileSync(
      path.join(CHATS_DIR, 'card-7.json'),
      JSON.stringify({ cardId: 7, harness: 'claude-code', resumeId: 'own', messages: [{ role: 'you', text: 'hi', at: 3 }] }),
    )
    inClaude()
    handOff(currentSession()!, [7])
    assert.equal(readChat(7)?.from, undefined)
  })

  it('links nothing when the nearest agent cannot fork', () => {
    board()
    process.env.CLAUDE_CODE_SESSION_ID = 'outer'
    probes.chain = () => ['zsh', 'cursor-agent', 'claude']
    assert.equal(currentSession(), undefined)
  })
})
