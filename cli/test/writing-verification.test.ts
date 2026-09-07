import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { RUN_ENV } from '../src/lib/agent/env'
import { buildPrompt } from '../src/lib/agent/prompts'
import { agentForRun } from '../src/lib/agent/runner'
import { openRun, patch, peekRun } from '../src/lib/agent/sessions'
import { readRuns } from '../src/lib/agent/store'
import type { AgentRequest, RunRecord } from '../src/lib/agent/types'
import { watchRun } from '../src/lib/agent/watch'
import { afterWritingVerification, writingVerification } from '../src/lib/agent/writing-verification'
import { setBoardProvider } from '../src/lib/board'
import { setBoardRoot, SESSIONS_DIR } from '../src/lib/paths'
import { run } from './helpers/board'

let root: string
let board: string
let oldRun: string | undefined
const write = (name: string, text: string): void => {
  const file = path.join(board, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}
const memory = (count: number): void => {
  for (let i = 0; i < count; i++) write(`memory/writing/${i}.md`, `Rule ${i}`)
}
const record = (overrides: Partial<RunRecord> = {}): RunRecord => ({
  sessionId: 'reader', cardId: 1, action: 'marketing-verify', channel: 'x', status: 'done',
  startedAt: 1, logPath: '', harness: 'claude-code', flowId: 'job', verification: writingVerification(), ...overrides,
})
const closed = (req: AgentRequest, result = 'Still fails'): RunRecord => record({
  action: req.action, verification: req.verification, channel: req.channel, flowId: req.flowId, result,
})

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-writing-verify-'))
  board = path.join(root, 'docs/kanban')
  setBoardRoot(root)
  setBoardProvider(null)
  oldRun = process.env[RUN_ENV]
  delete process.env[RUN_ENV]
  write('config.md', '# Project\n\n- **Solution** — marketing\n')
  write('todo/1-topic.md', '---\ntitle: A topic\nstatus: todo\nblocked_by: []\nrelated: []\nmodules: []\nchannels:\n  - name: x\n    status: draft\n---\n')
  write('todo/README.md', '# Tasks\n\n- [ ] #1 [A topic](1-topic.md)\n')
  write('next-id', '2\n')
  write('memory/writing.md', 'Shared rule')
  write('content/1-topic/x.md', 'Draft')
})
afterEach(() => {
  if (oldRun === undefined) delete process.env[RUN_ENV]
  else process.env[RUN_ENV] = oldRun
  fs.rmSync(root, { recursive: true, force: true })
})

describe('writing verification', () => {
  it('uses one reader through six files and balanced groups beyond six', () => {
    assert.deepEqual(writingVerification().groups, [[]])
    memory(6)
    assert.equal(writingVerification().groups.length, 1)
    memory(13)
    write('memory/writing/ignored.txt', 'Not memory')
    const groups = writingVerification().groups
    assert.deepEqual(groups.map((g) => g.length), [5, 4, 4])
    assert.equal(new Set(groups.flat()).size, 13)
    assert.ok(groups.flat().every((f) => !f.endsWith('/writing.md')))
  })

  it('keeps readers independent, combines findings and gives fixes the writer rule', () => {
    memory(7)
    write('rules/reviewer.md', 'Reviewer-only instruction')
    write('rules/writer.md', 'Writer-only instruction')
    const nextReader = afterWritingVerification(record({ result: 'First failure' })).next!
    assert.equal(nextReader.action, 'marketing-verify')
    assert.equal(nextReader.flowId, 'job')
    assert.equal(agentForRun(nextReader), 'reviewer')
    const prompt = buildPrompt(nextReader)
    assert.match(prompt, /memory\/writing.md/)
    assert.match(prompt, /Reviewer-only instruction/)
    assert.doesNotMatch(prompt, /First failure|Writer-only instruction/)
    const nextFix = afterWritingVerification(closed(nextReader, 'Second failure')).next!
    assert.equal(nextFix.action, 'marketing-fix')
    assert.equal(nextFix.notes, 'First failure\n\nSecond failure')
    assert.equal(agentForRun(nextFix), 'writer')
    assert.match(buildPrompt(nextFix), /Edit only docs\/kanban\/content\/1-topic\/x.md/)
    assert.match(buildPrompt(nextFix), /Writer-only instruction/)
    assert.doesNotMatch(buildPrompt(nextFix), /Reviewer-only instruction/)
  })

  it('ends after three verify passes, leaving the last report', () => {
    let step = afterWritingVerification(record({ result: 'First failure' }))
    const actions = ['marketing-verify']
    while (step.next) {
      actions.push(step.next.action)
      step = afterWritingVerification(closed(step.next))
    }
    assert.deepEqual(actions, ['marketing-verify', 'marketing-fix', 'marketing-verify', 'marketing-fix', 'marketing-verify'])
    assert.equal(step.report, 'Still fails')
  })

  it('ends on stop, interruption, PASS or silence and carries failed readers onward', () => {
    for (const status of ['stopped', 'interrupted'] as const) {
      assert.deepEqual(afterWritingVerification(record({ status, result: 'Failure' })), {})
    }
    for (const result of ['PASS', '', '   ', undefined]) {
      assert.equal(afterWritingVerification(record({ result })).next, undefined)
      assert.equal(afterWritingVerification(record({ result, status: 'error' })).next, undefined)
    }
    assert.equal(afterWritingVerification(record({ status: 'error', result: 'Failure' })).next?.action, 'marketing-fix')
    assert.equal(afterWritingVerification(record({ action: 'marketing-fix', status: 'error' })).next, undefined)
    assert.equal(afterWritingVerification(record({ action: 'channel' })).next, undefined)
  })

  it('retains earlier reports when a later reader fails without a report', () => {
    memory(7)
    const next = afterWritingVerification(record({ result: 'First failure' })).next!
    const step = afterWritingVerification({ ...closed(next, ''), status: 'error' })
    assert.equal(step.next?.notes, 'First failure')
    assert.equal(step.report, 'First failure')
  })

  it('refuses product boards, inline runs, unknown channels and missing drafts through the command', async () => {
    await assert.rejects(() => run(root, ['marketing', 'verify', 'x', '1', '--print']), /no --print/)
    await assert.rejects(() => run(root, ['marketing', 'verify', 'source', '1']), /Unknown channel/)
    await assert.rejects(() => run(root, ['marketing', 'verify', 'linkedin', '1']), /does not go/)
    await assert.rejects(() => run(root, ['marketing', 'verify', 'x', '9']), /No topic/)
    fs.rmSync(path.join(board, 'content/1-topic/x.md'))
    await assert.rejects(() => run(root, ['marketing', 'verify', 'x', '1']), /No draft/)
    process.env[RUN_ENV] = 'some-run'
    await assert.rejects(() => run(root, ['marketing', 'verify', 'x', '1']), /cannot start verification/)
    delete process.env[RUN_ENV]
    write('config.md', '# Project\n')
    await assert.rejects(() => run(root, ['marketing', 'verify', 'x', '1']), /requires a marketing board/)
  })

  it('the watcher keeps the merged third-pass report in its record and log without starting a fix', async () => {
    memory(7)
    const verification = writingVerification(3)
    verification.index = 1
    verification.reports = ['Earlier reader failure']
    const req: AgentRequest = { action: 'marketing-verify', id: 1, channel: 'x', verification }
    const script = path.join(root, 'reader.cjs')
    fs.writeFileSync(script, 'console.log(JSON.stringify({type:"result",result:"Last reader failure"}));process.exitCode=1;')
    write('ui.config.json', JSON.stringify({ harness: 'claude-code', harnessSettings: { 'claude-code': { command: `${process.execPath} ${script}` } } }))
    const opened = openRun(req, buildPrompt(req), [])
    assert.ok(!('error' in opened))
    opened.spec.plan.argv = [process.execPath, script]
    opened.spec.plan.harness = 'claude-code'
    fs.writeFileSync(path.join(SESSIONS_DIR, `${opened.run.sessionId}.plan.json`), JSON.stringify(opened.spec))
    patch(opened.run.sessionId, (r) => { r.pid = process.pid })
    assert.deepEqual(readRuns()[0].verification, verification)
    const requests: AgentRequest[] = []
    const start = async (next: AgentRequest) => {
      assert.equal(peekRun(opened.run.sessionId)?.status, 'error')
      requests.push(next)
      return { run: record(), spawned: true }
    }
    await watchRun(opened.run.sessionId, undefined, start)
    assert.equal(requests.length, 0)
    const ended = peekRun(opened.run.sessionId)!
    assert.equal(ended.result, 'Earlier reader failure\n\nLast reader failure')
    assert.match(fs.readFileSync(ended.logPath, 'utf8'), /Earlier reader failure\n\nLast reader failure/)
    assert.equal(fs.readFileSync(path.join(board, 'content/1-topic/x.md'), 'utf8'), 'Draft')
  })

  it('the watcher starts fresh verify/fix sessions under one job, including after a reader error', async () => {
    const requests: AgentRequest[] = []
    const ids: string[] = []
    const script = path.join(root, 'agent.cjs')
    fs.writeFileSync(script, 'console.log(JSON.stringify({type:"result",result:"Rule failure"}));process.exitCode=Number(process.argv[2]);')
    write('ui.config.json', JSON.stringify({ harness: 'claude-code', harnessSettings: { 'claude-code': { command: `${process.execPath} ${script}` } } }))
    const start = async (req: AgentRequest): Promise<{ run: RunRecord; spawned: boolean }> => {
      const previous = ids.at(-1)
      if (previous) assert.notEqual(peekRun(previous)?.status, 'running')
      requests.push(req)
      const opened = openRun(req, buildPrompt(req), [])
      assert.ok(!('error' in opened))
      assert.equal(opened.run.resumeId, undefined)
      ids.push(opened.run.sessionId)
      opened.spec.plan.argv = [process.execPath, script, ids.length === 1 ? '1' : '0']
      opened.spec.plan.harness = 'claude-code'
      fs.writeFileSync(path.join(SESSIONS_DIR, `${opened.run.sessionId}.plan.json`), JSON.stringify(opened.spec))
      patch(opened.run.sessionId, (r) => { r.pid = process.pid })
      await watchRun(opened.run.sessionId, undefined, start)
      return { run: opened.run, spawned: true }
    }
    await start({ action: 'marketing-verify', id: 1, channel: 'x', verification: writingVerification() })
    assert.deepEqual(requests.map((r) => r.action), ['marketing-verify', 'marketing-fix', 'marketing-verify', 'marketing-fix', 'marketing-verify'])
    assert.equal(new Set(ids).size, 5)
    assert.deepEqual([...new Set(readRuns().map((r) => r.flowId))], [peekRun(ids[0])!.flowId])
    assert.deepEqual(readRuns().map((r) => r.agent), ['reviewer', 'writer', 'reviewer', 'writer', 'reviewer'])
    assert.equal(requests[1].notes, 'Rule failure')
    assert.equal(requests[2].notes, undefined)
  })

})
