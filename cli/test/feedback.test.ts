// Feedback on a landed task (#603) — the four attachments a card has to offer, and the
// sender's two rules: it reads the install id and never makes one, and it says what came of
// the submission instead of dropping it.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, afterEach, beforeEach, describe, it } from 'node:test'

import { LIMITS } from '../../telemetry/contract.ts'
import { sendFeedback } from '../src/lib/machine/feedback.ts'
import { CHATS_DIR, SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import { readFeedbackDiagnostics } from '../src/lib/view/feedback.ts'
import { forgetMachineState, restoreMachineHome } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-feedback-'))
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-feedback-home-'))
const kanban = () => path.join(root, 'docs', 'kanban')
const archive = () => path.join(kanban(), '.archive')

const INSTALL = '0f3a9b1c-2d4e-4f6a-8b1c-2d4e6f8a0b1c'

// The machine home goes in first: the chats and the run logs live under it now (#590), and
// `setBoardRoot` works those paths out once, off whatever home is set when it is called.
beforeEach(() => {
  process.env.AI4KANBAN_HOME = home
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(archive(), { recursive: true })
  setBoardRoot(root)
  fs.rmSync(path.join(home, 'settings.json'), { force: true })
})

after(() => {
  for (const dir of [root, home]) fs.rmSync(dir, { recursive: true, force: true })
  restoreMachineHome()
  delete process.env.AI4KANBAN_FEEDBACK_URL
})

/** One archived card, with a body worth attaching. */
function archived(id: number, body = 'What it did.'): void {
  const frontmatter = [
    '---',
    `title: Card ${id}`,
    'priority: med',
    'roi: med',
    'status: todo',
    'release: ""',
    'blocked_by: []',
    'related: []',
    'modules: []',
    'questions: []',
    'archived: 2026-09-01',
    '---',
  ].join('\n')
  fs.writeFileSync(path.join(archive(), `${id}-a-card.md`), `${frontmatter}\n\n${body}\n`)
}

/** The conversation held on that card, where the board keeps it. */
function conversation(id: number, said: string): void {
  fs.mkdirSync(CHATS_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(CHATS_DIR, `card-${id}.json`),
    JSON.stringify({
      cardId: id,
      harness: 'claude-code',
      messages: [{ role: 'you', text: said, at: 1 }],
    }),
  )
}

/** The permanent record of one delivery on that card, and the log it points at. The record
 *  is the board's and stays in git; the log is machine state, so what a delivery writes down
 *  is the whole path (#590). */
function delivery(id: number, log: string): void {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  const file = path.join(SESSIONS_DIR, 'r1.log')
  fs.writeFileSync(file, log)
  recordDelivery(id, file)
}

/** The same record as a board older than the move wrote it: the log under the board folder,
 *  named from the project root. Those records are still in git and still have to read. */
function legacyDelivery(id: number, log: string): void {
  const logs = path.join(kanban(), '.sessions')
  fs.mkdirSync(logs, { recursive: true })
  fs.writeFileSync(path.join(logs, 'r1.log'), log)
  recordDelivery(id, 'docs/kanban/.sessions/r1.log')
}

function recordDelivery(id: number, log: string): void {
  const dir = path.join(kanban(), 'deliveries')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'd1.json'),
    JSON.stringify({
      deliveryId: 'd1',
      cardId: id,
      startedAt: 1,
      sessions: [{ sessionId: 'r1', action: 'implement', status: 'done', harness: 'claude-code', log }],
    }),
  )
}

/** This machine, with usage reporting on and an id already made. */
function reportingOn(): void {
  fs.mkdirSync(home, { recursive: true })
  fs.writeFileSync(
    path.join(home, 'settings.json'),
    JSON.stringify({ usageReporting: true, usageInstallId: INSTALL }),
  )
}

const partsOf = (id: number) => readFeedbackDiagnostics(id).attachments.map((a) => a.part)

describe('what one landed task has to attach', () => {
  it('offers only the parts this machine actually holds', () => {
    archived(91)
    assert.deepEqual(partsOf(91), ['card', 'environment'])
    conversation(91, 'This is still wrong.')
    delivery(91, 'the agent ran')
    assert.deepEqual(partsOf(91), ['card', 'chat', 'trace', 'environment'])
  })

  it('offers nothing about a card the archive does not hold', () => {
    assert.deepEqual(partsOf(91), ['environment'])
  })

  it('hands back exactly the text it would send, so the preview is the submission', () => {
    archived(91, 'It landed wrong.')
    conversation(91, 'Please undo it.')
    const read = readFeedbackDiagnostics(91)
    const card = read.attachments.find((a) => a.part === 'card')!
    assert.match(card.text, /# 91 Card 91/)
    assert.match(card.text, /It landed wrong\./)
    assert.match(read.attachments.find((a) => a.part === 'chat')!.text, /Please undo it\./)
    assert.equal(card.cut, false)
    assert.equal(card.bytes, Buffer.byteLength(card.text))
  })

  it('carries no path, project name or branch in the environment part', () => {
    archived(91)
    const env = readFeedbackDiagnostics(91).attachments.find((a) => a.part === 'environment')!
    assert.match(env.text, /^os: /m)
    assert.match(env.text, /^arch: /m)
    assert.match(env.text, /^version: /m)
    assert.equal(env.text.includes(root), false)
  })

  it('cuts on a character boundary, so the preview is never half a character', () => {
    archived(91, '\u4e00'.repeat(LIMITS.feedbackPartBytes))
    delivery(91, `${'\u4e00'.repeat(LIMITS.feedbackPartBytes)}\u672b\n`)
    const read = readFeedbackDiagnostics(91).attachments
    for (const part of ['card', 'trace'] as const) {
      const cut = read.find((a) => a.part === part)!
      assert.equal(cut.cut, true)
      assert.equal(cut.text.includes('\ufffd'), false)
      assert.ok(Buffer.byteLength(cut.text) <= LIMITS.feedbackPartBytes)
    }
  })

  it('reads a run log a delivery recorded from the project root, from before the move', () => {
    archived(91)
    legacyDelivery(91, 'what it said back then')
    const trace = readFeedbackDiagnostics(91).attachments.find((a) => a.part === 'trace')!
    assert.match(trace.text, /what it said back then/)
  })

  it('cuts a run log to what can be sent, keeps its tail, and says it was cut', () => {
    archived(91)
    delivery(91, `${'x'.repeat(LIMITS.feedbackPartBytes)}the last thing it said\n`)
    const trace = readFeedbackDiagnostics(91).attachments.find((a) => a.part === 'trace')!
    assert.equal(trace.cut, true)
    assert.ok(trace.bytes > LIMITS.feedbackPartBytes)
    assert.equal(Buffer.byteLength(trace.text), LIMITS.feedbackPartBytes)
    assert.match(trace.text, /the last thing it said/)
  })
})

describe('sending one piece of feedback', () => {
  let taken: Record<string, unknown>[] = []
  let answer = 202
  let server: http.Server

  beforeEach(async () => {
    taken = []
    answer = 202
    server = http.createServer((request, response) => {
      let body = ''
      request.on('data', (chunk) => (body += chunk))
      request.on('end', () => {
        taken.push(JSON.parse(body) as Record<string, unknown>)
        response.writeHead(answer, { 'content-type': 'application/json' })
        response.end('{"ok":true}')
      })
    })
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
    const { port } = server.address() as { port: number }
    process.env.AI4KANBAN_FEEDBACK_URL = `http://127.0.0.1:${port}/v1/feedback`
  })

  afterEach(async () => {
    await new Promise<void>((done) => server.close(() => done()))
  })

  it('carries the install id this machine already has', async () => {
    reportingOn()
    const sent = await sendFeedback({ text: 'The fix broke something else.', source: 'task', cardId: 91 })
    assert.equal(sent.ok, true)
    assert.equal(taken[0]!.install, INSTALL)
    assert.equal(taken[0]!.card, 91)
    assert.equal(taken[0]!.source, 'task')
  })

  it('goes without one from a machine with reporting off, and never makes one', async () => {
    fs.writeFileSync(path.join(home, 'settings.json'), JSON.stringify({ usageReporting: false }))
    const sent = await sendFeedback({ text: 'The installer hung.', source: 'board' })
    assert.equal(sent.ok, true)
    assert.equal(taken[0]!.install, undefined)
    const held = JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8')) as Record<string, unknown>
    assert.equal(held.usageInstallId, undefined)
  })

  it('makes no install id on a machine that has never had one', async () => {
    const sent = await sendFeedback({ text: 'A word reads wrong.', source: 'board' })
    assert.equal(sent.ok, true)
    assert.equal(taken[0]!.install, undefined)
    const settings = path.join(home, 'settings.json')
    const held = fs.existsSync(settings)
      ? (JSON.parse(fs.readFileSync(settings, 'utf8')) as Record<string, unknown>)
      : {}
    assert.equal(held.usageInstallId, undefined)
  })

  it('sends only the attachments it was handed', async () => {
    reportingOn()
    await sendFeedback({
      text: 'Here is what happened.',
      source: 'task',
      cardId: 91,
      parts: [{ part: 'card', text: '# 91' }],
    })
    assert.deepEqual((taken[0]!.parts as { part: string }[]).map((p) => p.part), ['card'])
  })

  it('sends none at all when none were authorised', async () => {
    reportingOn()
    await sendFeedback({ text: 'Just the sentence.', source: 'task' })
    assert.equal(taken[0]!.parts, undefined)
    assert.equal(taken[0]!.card, undefined)
  })

  it('says what a refusal was rather than dropping it', async () => {
    reportingOn()
    answer = 500
    assert.deepEqual(await sendFeedback({ text: 'x', source: 'board' }), {
      ok: false,
      reason: 'refused',
      detail: '500',
    })
  })

  it('says when the endpoint could not be reached', async () => {
    reportingOn()
    process.env.AI4KANBAN_FEEDBACK_URL = 'http://127.0.0.1:1/v1/feedback'
    const sent = await sendFeedback({ text: 'x', source: 'board' })
    assert.equal(sent.ok, false)
    assert.equal(sent.reason, 'unreachable')
  })

  it('refuses an empty one before it reaches the network', async () => {
    reportingOn()
    const sent = await sendFeedback({ text: '   ', source: 'board' })
    assert.deepEqual(sent, { ok: false, reason: 'empty' })
    assert.equal(taken.length, 0)
  })
})
