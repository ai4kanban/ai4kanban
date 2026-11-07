import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { openResume, openRun, patch, readSpec, resumeDelivery } from '../src/lib/agent/sessions.ts'
import { endDelivery } from '../src/lib/agent/deliveries.ts'
import { startRun } from '../src/lib/agent/start.ts'
import { readStore, withStore } from '../src/lib/agent/store.ts'
import { watchRun } from '../src/lib/agent/watch.ts'
import type { RunRecord, RunStatus } from '../src/lib/agent/types.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, move, uiConfigOf } from './helpers/board.ts'

let root = ''

function runtime(harness: string): void {
  fs.writeFileSync(uiConfigOf(root, 'docs', 'kanban'), JSON.stringify({
    runtimes: [{ id: 'global', name: 'Global', harness, settings: { command: 'node unused-agent.mjs' } }],
  }))
}

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-build-session-'))
  const todo = path.join(root, 'docs', 'kanban', 'todo')
  fs.mkdirSync(todo, { recursive: true })
  fs.writeFileSync(path.join(todo, 'README.md'), '# Tasks\n')
  setBoardRoot(root)
  runtime('claude-code')
  await move(root, ['create', '--title', '继续构建'])
})

afterEach(() => {
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

function build(status: RunStatus = 'stopped', resumeId?: string): RunRecord {
  const opened = openRun({ action: 'implement', id: 1 }, '原构建', [])
  if ('error' in opened) throw new Error(opened.error)
  fs.writeFileSync(opened.run.logPath, '旧构建日志\n')
  patch(opened.run.sessionId, (r) => {
    r.status = status
    r.endedAt = Date.now()
    if (resumeId) r.resumeId = resumeId
  })
  return { ...opened.run, status, ...(resumeId ? { resumeId } : {}) }
}

describe('交付的构建会话续接（#368）', () => {
  for (const harness of ['claude-code', 'codex', 'kimi', 'opencode', 'cursor', 'dsh', 'grok', 'zcode']) {
    it(`${harness} 使用原构建的真实会话，而非讨论会话或新运行 ID`, async () => {
      runtime(harness)
      const old = build('stopped', harness === 'claude-code' ? undefined : `${harness}-conversation`)
      const started = await startRun({ action: 'implement', id: 1, carry: { resumeId: 'discussion', fork: true } })
      if ('error' in started) throw new Error(started.error)
      assert.equal(started.run.resumeId, old.resumeId ?? old.sessionId)
      assert.equal(started.run.resumedFrom, old.sessionId)
      assert.equal(started.run.deliveryId, old.deliveryId)
      assert.equal(started.run.cwd, old.cwd)
      assert.equal(started.run.harness, harness)
      assert.notEqual(started.run.sessionId, old.sessionId)
      if (harness === 'claude-code') assert.ok(started.run.argv?.includes('--resume'))
      if (harness === 'codex') assert.deepEqual(started.run.argv?.slice(-2), ['resume', old.resumeId])
      assert.equal(readStore().deliveries.length, 1)
    })
  }

  it('恢复已停止的交付后，继续原构建而不创建第二个交付', async () => {
    for (const args of [['init', '-q', '-b', 'main'], ['config', 'user.email', 'test@example.com'], ['config', 'user.name', 'test'], ['add', '.'], ['commit', '-qm', 'initial']]) {
      execFileSync('git', args, { cwd: root })
    }
    const old = build()
    endDelivery(old.deliveryId!, 'failed')
    const resumed = await resumeDelivery(old.deliveryId!)
    assert.equal(resumed.ok, true, resumed.error)
    const started = await startRun({ action: 'implement', id: 1 })
    if ('error' in started) throw new Error(started.error)
    assert.equal(started.run.resumeId, old.sessionId)
    assert.equal(started.run.resumedFrom, old.sessionId)
  })

  it('已完成但尚未落地的构建继续原会话', async () => {
    const old = build('done')
    assert.equal((await openResume(old.sessionId) as { reason: string }).reason, 'runNotResumable')
    const started = await startRun({ action: 'implement', id: 1, notes: '保留已完成的修改' })
    if ('error' in started) throw new Error(started.error)
    assert.equal(started.run.resumeId, old.sessionId)
    assert.equal(started.run.resumedFrom, old.sessionId)
  })

  it('继续构建时只给停下原因，并保留用户补充', async () => {
    const old = build('done')
    const opened = await openResume(old.sessionId, { deliveryId: old.deliveryId!, notes: '保留已完成的修改' })
    if ('error' in opened) throw new Error(opened.error)
    const prompt = readSpec(opened.run.sessionId)!.prompt
    assert.equal(prompt, `Continue delivery ${old.deliveryId}. The delivery has not recorded completion. Finish its unchecked todos, then run akb delivery complete ${old.deliveryId}, with --commit <sha> --branch <name> in a git project.\n\n保留已完成的修改`)
  })

  it('缺失真实会话 ID 时明确拒绝，不重新构建', async () => {
    runtime('codex')
    const old = build()
    const result = await startRun({ action: 'implement', id: 1 })
    assert.equal((result as { reason: string }).reason, 'runNoSession')
    assert.deepEqual(readStore().runs.map((r) => r.sessionId), [old.sessionId])
  })

  it('原会话不存在时保留失败原因，不悄悄从头构建', async () => {
    const agent = path.join(root, 'missing.mjs')
    fs.writeFileSync(agent, `console.log(JSON.stringify({type:'result',subtype:'error_during_execution',is_error:true,errors:['No conversation found with session ID: old']}));process.exit(1)`)
    fs.writeFileSync(uiConfigOf(root, 'docs', 'kanban'), JSON.stringify({
      runtimes: [{ id: 'global', name: 'Global', harness: 'claude-code', settings: { command: `node ${agent}` } }],
    }))
    const old = build()
    const opened = await openResume(old.sessionId, { deliveryId: old.deliveryId! })
    if ('error' in opened) throw new Error(opened.error)
    patch(opened.run.sessionId, (r) => { r.pid = process.pid })
    await watchRun(opened.run.sessionId, async () => ({ error: '不应启动新会话' }))
    const rows = readStore().runs
    assert.equal(rows.length, 1)
    assert.equal(rows[0]!.sessionId, opened.run.sessionId)
    assert.equal(rows[0]!.status, 'error')
    assert.match(rows[0]!.error ?? '', /No conversation found/)
    assert.match(fs.readFileSync(opened.run.logPath, 'utf8'), /不会新建会话/)
  })

  it('修改默认 Agent 后仍使用原构建的 Agent 和运行环境', async () => {
    const old = build()
    const config = uiConfigOf(root, 'docs', 'kanban')
    const cfg = JSON.parse(fs.readFileSync(config, 'utf8'))
    cfg.runtimes.push({ id: 'other', name: 'Other', harness: 'codex', settings: { command: 'node other.mjs' } })
    cfg.agentRuntime = { builder: 'other' }
    fs.writeFileSync(config, JSON.stringify(cfg))
    const started = await startRun({ action: 'implement', id: 1 })
    if ('error' in started) throw new Error(started.error)
    assert.equal(started.run.harness, 'claude-code')
    assert.equal(started.run.runtime, old.runtime)
    assert.equal(started.run.resumeId, old.sessionId)
  })

  it('ACP 原会话丢失时不会调用 session/new', async () => {
    const agent = path.join(root, 'acp.mjs')
    const trace = path.join(root, 'methods.jsonl')
    fs.writeFileSync(agent, `import fs from 'node:fs';import readline from 'node:readline';
readline.createInterface({input:process.stdin}).on('line',line=>{
 const m=JSON.parse(line);fs.appendFileSync(${JSON.stringify(trace)},JSON.stringify(m)+'\\n');
 if(m.id===undefined)return;
 const result=m.method==='initialize'?{protocolVersion:1,agentCapabilities:{loadSession:true}}:m.method==='session/new'?{sessionId:'new-session'}:{stopReason:'end_turn'};
 console.log(JSON.stringify({jsonrpc:'2.0',id:m.id,...(m.method==='session/load'?{error:{code:-32602,message:'session not found: original'}}:{result})}));
});`)
    fs.writeFileSync(uiConfigOf(root, 'docs', 'kanban'), JSON.stringify({
      runtimes: [{ id: 'global', name: 'Global', harness: 'opencode', settings: { command: `node ${agent}` } }],
    }))
    const old = build('stopped', 'original')
    const opened = await openResume(old.sessionId, { deliveryId: old.deliveryId! })
    if ('error' in opened) throw new Error(opened.error)
    patch(opened.run.sessionId, (r) => { r.pid = process.pid })
    await watchRun(opened.run.sessionId, async () => ({ error: '不应启动新会话' }))
    const calls = fs.readFileSync(trace, 'utf8').trim().split('\n').map((s) => JSON.parse(s))
    assert.deepEqual(calls.map((m) => m.method), ['initialize', 'session/load'])
    assert.equal(calls[1].params.sessionId, 'original')
    const rows = readStore().runs
    assert.equal(rows.length, 1)
    assert.equal(rows[0]!.status, 'error')
    assert.match(rows[0]!.error ?? '', /session not found/)
  })

  it('同卡片的旧交付不会被新交付当作续跑来源', async () => {
    const old = build()
    withStore((s) => { s.deliveries[0]!.status = 'cancelled' })
    const started = await startRun({ action: 'implement', id: 1 })
    if ('error' in started) throw new Error(started.error)
    assert.equal(started.run.resumedFrom, undefined)
    assert.notEqual(started.run.deliveryId, old.deliveryId)
  })
})
