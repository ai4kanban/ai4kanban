// A partner's refine case (#628) — which refines a card offers, what the pack is allowed to
// hold, and the submission id that survives every attempt.
//
// The whole file is about the split: the agent says what it found, and nothing it says is
// believed without a check. A path outside the project, a trace file that is not there and a
// run with no version recorded all become gaps — never a field quietly left out.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, afterEach, beforeEach, describe, it } from 'node:test'

import { chatPrompt } from '../src/lib/agent/chat.ts'
import { buildCase, refinesOf, textOnlyCase } from '../src/lib/case/collect.ts'
import { retryCase, submitCase } from '../src/lib/case/index.ts'
import { closeCase, openCase, readCase, savePack } from '../src/lib/case/state.ts'
import { CASES, SESSIONS, setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, restoreMachineHome } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-case-'))
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-case-home-'))
const kanban = () => path.join(root, 'docs', 'kanban')

beforeEach(() => {
  process.env.AI4KANBAN_HOME = home
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(kanban(), { recursive: true })
  setBoardRoot(root)
})

after(() => {
  for (const dir of [root, home]) fs.rmSync(dir, { recursive: true, force: true })
  restoreMachineHome()
  delete process.env.AI4KANBAN_CASE_URL
})

/** This machine's answer about partner feedback. Absent is off, which is the default and
 *  the answer every test below starts from unless it says otherwise. */
function takingPart(on: boolean): void {
  fs.mkdirSync(home, { recursive: true })
  fs.writeFileSync(path.join(home, 'settings.json'), JSON.stringify({ partnerFeedback: on }))
}

/** The board's run record, written the way a board on disk holds it. */
function runs(...records: Record<string, unknown>[]): void {
  fs.mkdirSync(path.dirname(SESSIONS), { recursive: true })
  fs.writeFileSync(SESSIONS, JSON.stringify({ runs: records, deliveries: [] }))
}

const run = (over: Record<string, unknown>) => ({
  sessionId: 's1',
  cardId: 7,
  action: 'clarify',
  status: 'done',
  startedAt: 1_000,
  harness: 'claude-code',
  logPath: 'x.log',
  ...over,
})

const opened = () => openCase('d-1', 7, '归档卡片也要能按编号搜索，规格里漏了。')

describe('the refines a card offers', () => {
  it('groups one refine by its flow, and offers no flow that refined nothing', () => {
    runs(
      run({ sessionId: 'a', flowId: 'f1', action: 'clarify', startedAt: 10 }),
      run({ sessionId: 'b', flowId: 'f1', action: 'spec', startedAt: 20, endedAt: 25 }),
      run({ sessionId: 'c', flowId: 'f1', action: 'writing', startedAt: 30, endedAt: 40 }),
      // A build on the same card is a job of its own, not a refine.
      run({ sessionId: 'd', flowId: 'f2', action: 'implement', startedAt: 50 }),
    )
    const found = refinesOf(7)
    assert.deepEqual(found.map((r) => r.flowId), ['f1'])
    assert.deepEqual(found[0]!.runs.map((r) => r.sessionId), ['a', 'b', 'c'])
    assert.equal(found[0]!.startedAt, 10)
    assert.equal(found[0]!.endedAt, 40)
  })

  it('offers every refine, newest first, and none from another card', () => {
    runs(
      run({ sessionId: 'a', flowId: 'f1', startedAt: 10 }),
      run({ sessionId: 'b', flowId: 'f2', startedAt: 900 }),
      run({ sessionId: 'c', flowId: 'f3', startedAt: 500, cardId: 8 }),
    )
    assert.deepEqual(refinesOf(7).map((r) => r.flowId), ['f2', 'f1'])
  })

  it('hands over the clues for finding a raw trace, and nothing it has to guess', () => {
    runs(
      run({
        sessionId: 'a',
        flowId: 'f1',
        harness: 'codex',
        runtime: 'row-1',
        resumeId: 'thread-9',
        cwd: '/work/here',
        argv: ['codex', 'exec'],
        version: '0.9.4',
        input: 'sharpen it',
      }),
    )
    const [clue] = refinesOf(7)[0]!.runs
    assert.equal(clue!.harness, 'codex')
    assert.equal(clue!.resumeId, 'thread-9')
    assert.equal(clue!.cwd, '/work/here')
    assert.deepEqual(clue!.argv, ['codex', 'exec'])
    assert.equal(clue!.version, '0.9.4')
  })
})

describe('what the pack is allowed to hold', () => {
  it('takes a trace the agent found, and names a missing one as a gap', () => {
    runs(run({ sessionId: 'a', flowId: 'f1', version: '0.9.4' }), run({ sessionId: 'b', flowId: 'f1', version: '0.9.4' }))
    const trace = path.join(root, 'trace.jsonl')
    fs.writeFileSync(trace, '{"read":"cards.ts"}\n')
    const built = buildCase(opened(), {
      flowId: 'f1',
      runs: [{ sessionId: 'a', traceFile: trace }, { sessionId: 'b', traceFile: path.join(root, 'gone.jsonl') }],
    })
    assert.match(built.pack.runs![0]!.trace!, /cards\.ts/)
    assert.equal(built.pack.runs![1]!.trace, undefined)
    assert.ok(built.gaps.some((g) => g.includes('gone.jsonl')))
  })

  it('sends a trace whole, however far past the old 4 MiB cut it runs (#685)', () => {
    runs(run({ sessionId: 'a', flowId: 'f1', version: '0.9.4' }))
    const huge = path.join(root, 'huge.jsonl')
    const text = `THE START${'x'.repeat(5 * 1024 * 1024)}THE END`
    fs.writeFileSync(huge, text)
    const built = buildCase(opened(), { flowId: 'f1', runs: [{ sessionId: 'a', traceFile: huge }] })
    assert.equal(built.pack.runs![0]!.trace, text)
    assert.ok(!built.gaps.some((g) => g.includes('only the last')))
  })

  it('leaves a run the agent did not select without a trace, and without a gap (#685)', () => {
    runs(run({ sessionId: 'a', flowId: 'f1', version: '0.9.4' }), run({ sessionId: 'b', flowId: 'f1', version: '0.9.4' }))
    const trace = path.join(root, 'one.jsonl')
    fs.writeFileSync(trace, '{"read":"cards.ts"}\n')
    const built = buildCase(opened(), { flowId: 'f1', runs: [{ sessionId: 'a', traceFile: trace }] })
    assert.match(built.pack.runs![0]!.trace!, /cards\.ts/)
    // Run `b` was read and ruled out. It is still listed — that is the refine's shape — but
    // nothing about it is reported as material the pack could not get.
    assert.equal(built.pack.runs![1]!.sessionId, 'b')
    assert.equal(built.pack.runs![1]!.trace, undefined)
    assert.ok(!built.gaps.some((g) => g.includes('no raw trace')))
  })

  it('names a run with no version recorded, rather than letting the gap pass', () => {
    runs(run({ sessionId: 'a', flowId: 'f1' }))
    const built = buildCase(opened(), { flowId: 'f1' })
    assert.ok(built.gaps.some((g) => g.includes('no akb version')))
  })

  it('refuses a path outside the project, and takes a repeated one once', () => {
    runs(run({ sessionId: 'a', flowId: 'f1', version: '0.9.4' }))
    fs.writeFileSync(path.join(root, 'one.ts'), 'export {}')
    const built = buildCase(opened(), {
      flowId: 'f1',
      reads: [
        { path: 'one.ts', evidence: 'Read one.ts' },
        { path: 'one.ts' },
        { path: '../outside.ts' },
      ],
    })
    assert.deepEqual(built.pack.files!.map((f) => f.path), ['one.ts'])
    assert.ok(built.gaps.some((g) => g.includes('outside this project')))
  })

  it('never collects the board’s own .env, whatever the agent says it read', () => {
    runs(run({ sessionId: 'a', flowId: 'f1', version: '0.9.4' }))
    fs.writeFileSync(path.join(kanban(), '.env'), 'ANTHROPIC_API_KEY=secret')
    const built = buildCase(opened(), { flowId: 'f1', reads: [{ path: 'docs/kanban/.env' }] })
    assert.deepEqual(built.pack.files, [])
    assert.ok(built.gaps.some((g) => g.includes('API keys')))
    assert.ok(!JSON.stringify(built.pack).includes('secret'))
  })

  it('marks a file that only went as this checkout’s copy, and one that is gone', () => {
    runs(run({ sessionId: 'a', flowId: 'f1', version: '0.9.4' }))
    fs.writeFileSync(path.join(root, 'here.ts'), 'export {}')
    const built = buildCase(opened(), {
      flowId: 'f1',
      reads: [{ path: 'here.ts' }, { path: 'vanished.ts' }],
    })
    assert.deepEqual(
      built.pack.files!.map((f) => [f.path, f.version]),
      [['here.ts', 'current'], ['vanished.ts', 'missing']],
    )
    assert.equal(built.pack.files![1]!.text, '')
    assert.ok(built.gaps.some((g) => g.includes('no longer on this machine')))
  })

  it('says so when no refine answers to the flow the agent named', () => {
    runs(run({ sessionId: 'a', flowId: 'f1', version: '0.9.4' }))
    const built = buildCase(opened(), { flowId: 'nope' })
    assert.ok(built.gaps.some((g) => g.includes('no refine on #7')))
    assert.deepEqual(built.pack.runs, [])
  })

  it('carries a long conversation whole, and a long project file with it (#685)', () => {
    runs(run({ sessionId: 'a', flowId: 'f1', version: '0.9.4' }))
    // Both past a ceiling the pack used to hold: 4,000 characters of conversation, and 512 kB
    // of one collected file.
    const words = 'x'.repeat(20_000)
    const big = 'y'.repeat(600 * 1024)
    fs.writeFileSync(path.join(root, 'big.ts'), big)
    const built = buildCase(openCase('d-long', 7, words), { flowId: 'f1', reads: [{ path: 'big.ts' }] })
    assert.equal(built.pack.text, words)
    assert.equal(built.pack.files![0]!.text, big)
    assert.equal(built.pack.files![0]!.bytes, big.length)
    assert.equal(built.pack.files![0]!.version, 'current')
    assert.ok(!built.gaps.some((g) => g.includes('left out whole')))
  })

  it('sends the question description whole too', () => {
    const pack = textOnlyCase(openCase('d-long', 7, 'x'.repeat(20_000)))
    assert.equal(pack.text.length, 20_000)
  })

  it('sends the question description alone with nothing collected beside it', () => {
    const pack = textOnlyCase(opened())
    assert.match(pack.text, /归档卡片/)
    assert.equal(pack.runs, undefined)
    assert.equal(pack.files, undefined)
    assert.ok(pack.gaps!.length > 0)
  })
})

describe('the submission id', () => {
  it('is minted once and kept by every attempt, so a retry is not a second case', () => {
    const first = opened()
    assert.match(first.id, /^fb_[0-9a-z]{8}$/)
    closeCase('d-1', { status: 'failed', reason: 'unreachable' })
    assert.equal(openCase('d-1', 7, 'said again').id, first.id)
    assert.equal(readCase('d-1')!.status, 'collecting')
  })

  it('starts a fresh one once the last one landed, so a second end is its own case (#685)', () => {
    const first = opened()
    const pack = savePack({ v: 1, id: first.id, day: '2026-09-14', submittedAt: '', surface: 'app', version: '0', card: 7, text: 'x' })
    closeCase('d-1', { status: 'sent', packFile: pack })
    const again = openCase('d-1', 7, 'a second thing went wrong on the same card')
    assert.notEqual(again.id, first.id)
    assert.equal(again.status, 'collecting')
    assert.equal(again.text, 'a second thing went wrong on the same card')
    assert.equal(again.sentAt, undefined)
    // The pack the first one left behind goes with it: it was sent, and nothing on this
    // machine sends it again.
    assert.equal(again.packFile, undefined)
    assert.equal(fs.existsSync(pack), false)
  })

  it('keeps the id of one still collecting, which is not a second end at all', () => {
    const first = opened()
    assert.equal(openCase('d-1', 7, 'said again').id, first.id)
  })

  it('is this discussion’s alone', () => {
    const one = opened()
    const two = openCase('d-2', 7, 'somewhere else')
    assert.notEqual(one.id, two.id)
    assert.ok(fs.existsSync(path.join(CASES, 'd-1.json')))
  })
})

describe('what the turn is told', () => {
  it('points the submitting turn at the brief, naming the card and nothing else', () => {
    const said = chatPrompt('discussion-d1', 'the spec missed archived search', {
      resuming: true,
      role: 'feedback',
      guide: 'feedback',
      feedback: { cardId: 603, share: true },
    })
    assert.match(said, /akb guide feedback/)
    assert.match(said, /task #603/)
    assert.match(said, /it has ended/)
    assert.match(said, /shared it/)
  })

  it('tells every other turn to collect nothing, rather than saying nothing at all', () => {
    const said = chatPrompt('discussion-d1', 'the spec missed archived search', {
      resuming: true,
      role: 'feedback',
      guide: 'feedback',
      feedback: { cardId: 603, share: false },
    })
    assert.match(said, /Nothing has been shared/)
    assert.match(said, /collect nothing and submit nothing/)
  })

  it('says nothing about a card in an ordinary discussion', () => {
    const said = chatPrompt('discussion-d1', 'what should we build next', { resuming: true })
    assert.ok(!said.includes('AI4Kanban team'))
  })
})

describe('sending one', () => {
  let taken: Record<string, unknown>[] = []
  let answer = 202
  let server: http.Server

  beforeEach(async () => {
    takingPart(true)
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
    process.env.AI4KANBAN_CASE_URL = `http://127.0.0.1:${port}/v1/case`
  })

  afterEach(async () => {
    await new Promise<void>((done) => server.close(() => done()))
  })

  it('sends the pack and records the number the user is shown', async () => {
    runs(run({ sessionId: 'a', flowId: 'f1', version: '0.9.4' }))
    const held = opened()
    const sent = await submitCase('d-1', { flowId: 'f1', analysis: '澄清里说过归档。' })
    assert.equal(sent!.posted, true)
    assert.equal(sent!.record.status, 'sent')
    assert.equal(sent!.record.id, held.id)
    assert.equal(taken.length, 1)
    assert.equal(taken[0]!.id, held.id)
    assert.equal(taken[0]!.card, 7)
    assert.ok(typeof taken[0]!.submittedAt === 'string')
  })

  it('keeps the failure and sends the same pack again under the same id', async () => {
    runs(run({ sessionId: 'a', flowId: 'f1', version: '0.9.4' }))
    const held = opened()
    answer = 500
    const failed = await submitCase('d-1', { flowId: 'f1' })
    assert.equal(failed!.record.status, 'failed')
    assert.equal(failed!.record.reason, 'refused')
    answer = 202
    const again = await retryCase('d-1')
    assert.equal(again!.status, 'sent')
    assert.equal(again!.id, held.id)
    // Two attempts, one id — the service writes one object, so a retry is never a second case.
    assert.deepEqual(taken.map((body) => body.id), [held.id, held.id])
  })

  it('says nothing went when the submission had already landed (#685)', async () => {
    runs(run({ sessionId: 'a', flowId: 'f1', version: '0.9.4' }))
    opened()
    await submitCase('d-1', { flowId: 'f1' })
    assert.equal(taken.length, 1)
    // A second `case submit` in the same turn. The record stands, and nothing about it may
    // read back as a send that happened here.
    const again = await submitCase('d-1', { flowId: 'f1' })
    assert.equal(again!.posted, false)
    assert.equal(taken.length, 1)
  })

  it('sends a pack past the old 24 MiB ceiling rather than refusing it here (#685)', async () => {
    runs(run({ sessionId: 'a', flowId: 'f1', version: '0.9.4' }))
    opened()
    const analysis = 'x'.repeat(25 * 1024 * 1024)
    const sent = await submitCase('d-1', { flowId: 'f1', analysis })
    assert.equal(sent!.record.status, 'sent')
    assert.equal(taken.length, 1)
    assert.equal((taken[0]!.analysis as string).length, analysis.length)
  })

  it('reports a platform that will not carry it, rather than cutting it down', async () => {
    runs(run({ sessionId: 'a', flowId: 'f1', version: '0.9.4' }))
    opened()
    answer = 413
    const sent = await submitCase('d-1', { flowId: 'f1' })
    assert.equal(sent!.record.status, 'failed')
    assert.equal(sent!.record.reason, 'too-large')
  })

  it('says nothing is holding a submission once the link was cancelled', async () => {
    runs(run({ sessionId: 'a', flowId: 'f1', version: '0.9.4' }))
    assert.equal(await submitCase('d-1', { flowId: 'f1' }), null)
    assert.equal(taken.length, 0)
  })
})
