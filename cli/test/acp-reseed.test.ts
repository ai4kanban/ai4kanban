// Resuming a dsh session the agent no longer holds (#395). The whole reason for resuming is
// to carry work on, so a `session/load` refused because the session is gone opens a fresh
// one and restarts the task there. Everything else about a refused load still fails the run.
//
// The peer below is scripted rather than real: `dsh-acp` answers `session/load` for a
// forgotten session with `-32602` and `session not found: <id>`, and that pair is what the
// client keys on.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { restartPrompt } from '../src/lib/agent/prompts.ts'
import { createAcpClient } from '../src/lib/agent/wire/acp.ts'
import type { TurnEnd } from '../src/lib/agent/wire/client.ts'
import { obj, str, type Json } from '../src/lib/agent/wire/json.ts'

type Answer = { result?: unknown; error?: { code: number; message: string } }

interface Turn {
  end: TurnEnd
  /** Every request the client made, in order. */
  asked: { method: string; params: Json }[]
  /** What reached the run's log. */
  log: string
  /** Each `gotResumeId`, with the flag that says it replaces a dead one. */
  ids: { id: string; restarted: boolean }[]
}

// One turn against an agent that answers each request by method.
async function turn(io: { resumeId?: string; restartPrompt?: string }, reply: (method: string) => Answer): Promise<Turn> {
  const toAgent = new PassThrough()
  const toClient = new PassThrough()
  const asked: { method: string; params: Json }[] = []
  let log = ''
  const ids: { id: string; restarted: boolean }[] = []

  let buf = ''
  toAgent.on('data', (chunk: Buffer) => {
    buf += chunk.toString()
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      const msg = JSON.parse(line)
      if (msg.id === undefined) continue
      asked.push({ method: msg.method, params: obj(msg.params) })
      toClient.write(`${JSON.stringify({ jsonrpc: '2.0', id: msg.id, ...reply(msg.method) })}\n`)
    }
  })

  const end = await createAcpClient().turn({
    stdout: toClient,
    stdin: toAgent,
    prompt: 'carry on',
    cwd: '/work',
    ...io,
    log: (text) => (log += text),
    gotResumeId: (id, restarted) => ids.push({ id, restarted: restarted === true }),
    gotModel: () => {},
  })
  return { end, asked, log, ids }
}

const GONE: Answer = { error: { code: -32602, message: 'session not found: dead' } }
const OK: Record<string, Answer> = {
  initialize: { result: { protocolVersion: 1 } },
  'session/new': { result: { sessionId: 'fresh' } },
  'session/load': { result: {} },
  'session/prompt': { result: { stopReason: 'end_turn' } },
}
// The words that actually went to the agent: the one text part of the prompt it was sent.
const sent = (t: Turn): string => {
  const parts = t.asked.find((a) => a.method === 'session/prompt')?.params.prompt
  return str(obj(Array.isArray(parts) ? parts[0] : undefined).text)
}
const methods = (t: Turn) => t.asked.map((a) => a.method)

describe('a resume against a session the agent no longer holds', () => {
  it('opens a fresh one and sends the restart prompt', async () => {
    const t = await turn({ resumeId: 'dead', restartPrompt: 'do the task from the top' }, (m) =>
      m === 'session/load' ? GONE : OK[m],
    )
    assert.equal(t.end.ok, true)
    assert.deepEqual(methods(t), ['initialize', 'session/load', 'session/new', 'session/prompt'])
    assert.equal(sent(t), 'do the task from the top')
  })

  it('writes the new id over the dead one', async () => {
    const t = await turn({ resumeId: 'dead', restartPrompt: 'do the task from the top' }, (m) =>
      m === 'session/load' ? GONE : OK[m],
    )
    assert.deepEqual(t.ids, [{ id: 'fresh', restarted: true }])
  })

  it('says in the log that the task was restarted, not resumed', async () => {
    const t = await turn({ resumeId: 'dead', restartPrompt: 'do the task from the top' }, (m) =>
      m === 'session/load' ? GONE : OK[m],
    )
    assert.match(t.log, /^\[board\] that conversation is gone/m)
    assert.doesNotMatch(t.log, /\[error\]/)
  })

  it('fails, as it always did, when the caller supplied no restart prompt', async () => {
    const t = await turn({ resumeId: 'dead' }, (m) => (m === 'session/load' ? GONE : OK[m]))
    assert.equal(t.end.ok, false)
    assert.equal(t.end.error, 'session not found: dead')
    assert.deepEqual(methods(t), ['initialize', 'session/load'])
    assert.deepEqual(t.ids, [])
  })
})

describe('a resume refused for any other reason', () => {
  it('fails on a different message under the same code', async () => {
    const t = await turn({ resumeId: 'dead', restartPrompt: 'do the task from the top' }, (m) =>
      m === 'session/load' ? { error: { code: -32602, message: 'cwd must be an absolute path' } } : OK[m],
    )
    assert.equal(t.end.ok, false)
    assert.equal(t.end.error, 'cwd must be an absolute path')
    assert.deepEqual(methods(t), ['initialize', 'session/load'])
  })

  it('fails on the same message under a different code', async () => {
    const t = await turn({ resumeId: 'dead', restartPrompt: 'do the task from the top' }, (m) =>
      m === 'session/load' ? { error: { code: -32603, message: 'session not found: dead' } } : OK[m],
    )
    assert.equal(t.end.ok, false)
    assert.deepEqual(methods(t), ['initialize', 'session/load'])
  })

  it('fails when the handshake itself is refused', async () => {
    const t = await turn({ resumeId: 'dead', restartPrompt: 'do the task from the top' }, (m) =>
      m === 'initialize' ? { error: { code: -32602, message: 'session not found: dead' } } : OK[m],
    )
    assert.equal(t.end.ok, false)
    assert.deepEqual(methods(t), ['initialize'])
  })
})

describe('a resume the agent still holds', () => {
  it('carries the conversation on, and keeps its id', async () => {
    const t = await turn({ resumeId: 'live', restartPrompt: 'do the task from the top' }, (m) => OK[m])
    assert.equal(t.end.ok, true)
    assert.deepEqual(methods(t), ['initialize', 'session/load', 'session/prompt'])
    assert.equal(sent(t), 'carry on')
    assert.deepEqual(t.ids, [])
  })

  it('a first run still opens its own session and reports the id once', async () => {
    const t = await turn({}, (m) => OK[m])
    assert.equal(t.end.ok, true)
    assert.deepEqual(methods(t), ['initialize', 'session/new', 'session/prompt'])
    assert.deepEqual(t.ids, [{ id: 'fresh', restarted: false }])
  })
})

// And what a restarted run is TOLD. The prompt has to stand on its own — the fresh session
// holds nothing of the conversation — and it has to be the ask for the job the run was
// actually doing. A delivery carries three of those jobs, and only the build is the one its
// resume prompt describes.

describe('the prompt a restarted run is given', () => {
  let home = ''

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-restart-'))
    process.env.AI4KANBAN_HOME = home
  })

  afterEach(() => {
    delete process.env.AI4KANBAN_HOME
    fs.rmSync(home, { recursive: true, force: true })
  })

  it("restarts a delivery's build by re-entering the delivery", () => {
    const prompt = restartPrompt({ action: 'implement', id: 12 }, 'abc123')
    assert.match(prompt ?? '', /Continue delivery abc123/)
    assert.match(prompt ?? '', /implement 12 --print/)
  })

  it('restarts a review of that same delivery as a review, not as a build', () => {
    const prompt = restartPrompt({ action: 'review', id: 12 }, 'abc123')
    assert.match(prompt ?? '', /akb guide review/)
    assert.match(prompt ?? '', /review 12 --print/)
    assert.doesNotMatch(prompt ?? '', /implement 12 --print/)
  })

  it("restarts a landing's conflict run as a conflict run", () => {
    const prompt = restartPrompt({ action: 'conflict', id: 12 }, 'abc123')
    assert.match(prompt ?? '', /conflict 12 --print/)
    assert.doesNotMatch(prompt ?? '', /implement 12 --print/)
  })

  it('says the task is being done again, not carried on', () => {
    assert.match(restartPrompt({ action: 'clarify', id: 12 }) ?? '', /is gone, and this one holds nothing of it/)
  })

  it('comes back with nothing for a run whose ask was the words the user typed', () => {
    assert.equal(restartPrompt({ action: 'reject', id: 12, reason: 'not worth it' }), undefined)
    assert.equal(restartPrompt({ action: 'edit', id: 12, notes: 'say it differently' }), undefined)
    assert.equal(restartPrompt({ action: 'create', id: 12, description: 'a new card' }), undefined)
  })

  it('comes back with nothing for a run that names no card', () => {
    assert.equal(restartPrompt({ action: 'propose' }), undefined)
    assert.equal(restartPrompt({ action: 'setup' }), undefined)
  })
})
