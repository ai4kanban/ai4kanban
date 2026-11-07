// The board's own words on how a run ended, kept by kind beside the English (#1241). The
// screen's side is kanban-ui/test/run-reason.test.mjs.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { SESSIONS, SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import { openRun, patch, peekRun } from '../src/lib/agent/sessions.ts'
import { readStore } from '../src/lib/agent/store.ts'
import { setBoardProvider } from '../src/lib/board/index.ts'
import { watchRun } from '../src/lib/agent/watch.ts'
import { forgetMachineState } from './helpers/board.ts'

let root = ''

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-run-reasons-'))
  forgetMachineState(root)
  setBoardRoot(root)
  setBoardProvider(null)
  fs.mkdirSync(path.join(root, 'docs/kanban/todo'), { recursive: true })
  fs.writeFileSync(path.join(root, 'docs/kanban/next-id'), '1\n')
  fs.writeFileSync(path.join(root, 'docs/kanban/todo/README.md'), '# Tasks\n')
})

afterEach(() => {
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('a run the board ended', () => {
  it('records a missing command by kind beside the English', async () => {
    const opened = openRun({ action: 'prune-memory' }, 'Prune the memory.', [])
    if ('error' in opened) throw new Error(opened.error)
    opened.spec.plan.argv = [path.join(root, 'no-such-agent')]
    opened.spec.plan.harness = 'claude-code'
    fs.writeFileSync(path.join(SESSIONS_DIR, `${opened.run.sessionId}.plan.json`), JSON.stringify(opened.spec))
    patch(opened.run.sessionId, (r) => { r.pid = process.pid })
    fs.writeFileSync(opened.run.logPath, '')
    await watchRun(opened.run.sessionId, async () => ({ error: 'no resume' }))
    const run = peekRun(opened.run.sessionId)!
    assert.equal(run.status, 'error')
    assert.match(run.error ?? '', /isn't installed/)
    assert.equal(run.errorWhy?.[0]?.kind, 'notInstalled')
    assert.match(run.errorWhy?.[0]?.args?.cmd ?? '', /no-such-agent/)
    // No process, so no session to pick up, whatever id the connector takes (#1321).
    assert.equal(run.unspawned, true)
  })

  // A refused sign-in leaves the new card without its sections; the sign-in is what to fix.
  it('leads with the agent\u2019s own failure, before the card it left half-written', async () => {
    fs.writeFileSync(path.join(root, 'docs/kanban/todo/1-page.md'), '---\ntitle: page\nstatus: todo\n---\n\nAdd a page.\n')
    const agent = path.join(root, 'agent.cjs')
    fs.writeFileSync(agent, [
      `require('node:fs').appendFileSync(${JSON.stringify(path.join(root, 'docs/kanban/todo/1-page.md'))}, 'More.\\n')`,
      `console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: true, result: 'Failed to authenticate. API Error: 403' }))`,
    ].join('\n'))
    const opened = openRun({ action: 'clarify', id: 1 }, 'Plan #1.', [])
    if ('error' in opened) throw new Error(opened.error)
    opened.spec.plan.argv = [process.execPath, agent]
    opened.spec.plan.harness = 'claude-code'
    fs.writeFileSync(path.join(SESSIONS_DIR, `${opened.run.sessionId}.plan.json`), JSON.stringify(opened.spec))
    patch(opened.run.sessionId, (r) => { r.pid = process.pid })
    fs.writeFileSync(opened.run.logPath, '')
    await watchRun(opened.run.sessionId, async () => ({ error: 'no resume' }))
    const run = peekRun(opened.run.sessionId)!
    assert.equal(run.status, 'error')
    assert.match(run.error ?? '', /^Failed to authenticate\. API Error: 403\n+Spec format validation failed/)
  })

  it('keeps the kinds through a read of the record', () => {
    const opened = openRun({ action: 'prune-memory' }, 'Prune the memory.', [])
    if ('error' in opened) throw new Error(opened.error)
    fs.writeFileSync(opened.run.logPath, '')
    patch(opened.run.sessionId, (r) => {
      r.errorWhy = [{ kind: 'silent', args: { n: '30' } }]
      r.noteWhy = [{ kind: 'broken', args: { n: '2', more: '0' }, lines: ['a', 'b'] }, { text: 'raw' }]
    })
    const run = readStore().runs.find((r) => r.sessionId === opened.run.sessionId)!
    assert.deepEqual(run.errorWhy, [{ kind: 'silent', args: { n: '30' } }])
    assert.equal(run.noteWhy?.length, 2)
    assert.ok(fs.existsSync(SESSIONS))
  })
})


describe('Codex 后台收尾', () => {
  for (const outcome of ['恢复成功', '最终失败', '退出失败'] as const) {
    it(outcome, async () => {
      const agent = path.join(root, 'codex.cjs')
      const events = [
        { type: 'thread.started', thread_id: 'test-thread' },
        { type: 'error', message: 'Reconnecting... stream disconnected' },
        { type: 'item.completed', item: { type: 'agent_message', text: '已完成' } },
        outcome === '最终失败'
          ? { type: 'turn.failed', error: { message: '401 unauthorized' } }
          : { type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 1 } },
      ]
      fs.writeFileSync(agent, `console.log(${JSON.stringify(events.map((e) => JSON.stringify(e)).join('\n'))}); process.exitCode = ${outcome === '退出失败' ? 1 : 0}`)
      const opened = openRun({ action: 'prune-memory' }, '清理记忆', [])
      if ('error' in opened) throw new Error(opened.error)
      opened.spec.plan.argv = [process.execPath, agent]
      opened.spec.plan.harness = 'codex'
      fs.writeFileSync(path.join(SESSIONS_DIR, `${opened.run.sessionId}.plan.json`), JSON.stringify(opened.spec))
      patch(opened.run.sessionId, (r) => { r.pid = process.pid })
      fs.writeFileSync(opened.run.logPath, '')
      let retries = 0
      await watchRun(opened.run.sessionId, async () => { retries++; return { error: '不得续跑' } })
      const run = peekRun(opened.run.sessionId)!
      assert.equal(run.status, outcome === '恢复成功' ? 'done' : 'error')
      assert.equal(run.ok, outcome === '恢复成功')
      assert.equal(run.retry, undefined)
      assert.equal(retries, 0)
    })
  }
})
