import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import * as api from '../src/api'
import type { RuntimeReport } from '../src/api'
import { startRunner, type Runner } from '../src/connect'
import { keepPresence } from '../src/presence'
import { runnerHome, useRunnerHome } from '../src/home'
import { mcpArgs } from '../src/flow'
import { createAcpClient, createStreamRenderer } from '../../cli/src/lib/agent/wire'
import { toWire, type Deps } from '../src/jobs'
import { akbEnv } from '../src/akb'
import { agentDue } from '../src/agents'
import { sharedMemory } from '../src/memory-files'
import { keptBoard, openTaskFolder, pull, pushBoard, readHead } from '../src/task-folder'
import { watchBoards } from '../src/board-watch'
import { hold } from '../src/cache'
import { FILE_BYTES, diffOf } from '../src/diff'
import { acpModels, claudeModels, codexModels, opencodeModels, plan, type Plan } from '../src/runtimes'
import { FakeCloud, until, writeFakeSession, type FakeJob } from './fake-cloud'

type FakeFlow = FakeJob['flow']

// The Runner against a stand-in Cloud, with a fake runtime: a node child that prints.

const MACHINE = '44444444-4444-4444-8444-444444444444'

let cloud: FakeCloud
let runner: Runner | null = null
let planned: { runtime: string; prompt: string; cwd: string; resume?: string | null; model?: string | null; settings?: unknown }[] = []
let installed: RuntimeReport[] = []
const FAKE_AKB = path.join(process.env.RUNNER_DIST ?? '', '..', 'test', 'fake-akb.mjs')
const cached = (project = 'prj_1') => path.join(runnerHome(), 'cache', project)

function fakeRuntime(script: string) {
  return (runtime: string, prompt: string, cwd: string, resume?: string | null, model?: string | null, settings?: unknown): Plan => {
    planned.push({ runtime, prompt, cwd, resume, model, settings })
    return {
      command: process.execPath,
      args: ['-e', script],
      env: process.env,
      renderer: { push: (s) => s, flush: () => '', result: () => 'Two tiers.', context: () => ({ used: 38_000, limit: 200_000 }) },
      quiet: () => false,
      session: () => resume ?? 'fresh-session',
    }
  }
}

// A node child that answers ACP: one plan, one tool call, one message per prompt.
const ACP_AGENT = `
const rl = require('node:readline').createInterface({ input: process.stdin })
const out = (m) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\\n')
const note = (update) => out({ method: 'session/update', params: { sessionId: 's1', update } })
rl.on('line', (line) => {
  const m = JSON.parse(line)
  if (m.method === 'session/new') return out({ id: m.id, result: { sessionId: 's1' } })
  if (m.method === 'session/prompt') {
    if (process.env.ACP_HANG) return
    if (process.env.ACP_HALF) return note({ sessionUpdate: 'agent_message_chunk', content: { text: 'Two ' } })
    note({ sessionUpdate: 'plan', entries: [{ content: 'Look', status: 'completed' }] })
    note({ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Read a.ts', kind: 'read', locations: [{ path: 'a.ts' }] })
    note({ sessionUpdate: 'agent_message_chunk', content: { text: 'Two ' } })
    note({ sessionUpdate: 'agent_message_chunk', content: { text: 'tiers.' } })
    note({ sessionUpdate: 'usage_update', used: 900, size: 100000 })
    return out({ id: m.id, result: { stopReason: 'end_turn', usage: { inputTokens: 10, outputTokens: 2 } } })
  }
  if (m.id !== undefined) out({ id: m.id, result: {} })
})`

function acpRuntime(env: NodeJS.ProcessEnv = {}) {
  return (runtime: string, prompt: string, cwd: string, resume?: string | null, model?: string | null): Plan => {
    planned.push({ runtime, prompt, cwd, resume, model })
    const client = createAcpClient()
    return {
      command: process.execPath,
      args: ['-e', ACP_AGENT],
      env: { ...process.env, ...env },
      converse: (child, event) => client.turn({
        stdout: child.stdout!, stdin: child.stdin!, prompt, cwd, resumeId: resume ?? undefined,
        log: () => {}, gotResumeId: () => {}, gotModel: () => {}, event,
      }),
      quiet: () => false,
      session: () => resume ?? 's1',
    }
  }
}

function start(script = 'console.log("hello from the runtime")', over: Partial<Deps> = {}, machineId = MACHINE) {
  const deps: Deps = {
    machineId,
    api,
    plan: fakeRuntime(script),
    flushMs: { watched: 50, quiet: 50 },
    endMs: 200,
    renewMs: 50,
    leaseMs: 60_000,
    retryMs: 50,
    testMs: 2_000,
    stopMs: 2_000,
    watchMs: null,
    akb: { command: process.execPath, args: [FAKE_AKB] },
    runtimes: async () => installed,
    ...over,
  }
  runner = startRunner({
    registration: async () => ({ machineId, machineName: 'studio', version: '0.0.0-test', runtimes: [] }),
    kind: 'terminal',
    deps,
    heartbeatMs: 100,
    pollMs: 100,
  })
  return runner
}

beforeEach(async () => {
  useRunnerHome()
  fs.rmSync(runnerHome(), { recursive: true, force: true })
  writeFakeSession(runnerHome())
  planned = []
  installed = [{ name: 'codex', installed: true }, { name: 'claude-code', installed: true }]
  process.env.FAKE_AKB_LOG = path.join(runnerHome(), 'akb.log')
  process.env.FAKE_AKB = '{}'
  cloud = new FakeCloud()
  cloud.others = ['prj_1', 'prj_2'].map((project) => ({ project, name: project, workspace: 'ws_1', workspace_name: 'Mine', personal: true }))
  await cloud.start()
})

afterEach(async () => {
  await runner?.close()
  runner = null
  await cloud.stop()
})

describe('the Runner', () => {
  it('connects, runs a job in its own folder and reports the output', async () => {
    const job = cloud.dispatch({ id: 'j1', prompt: 'Build it', attachments: [{ name: 'brief.md', content: Buffer.from('hi').toString('base64') }] })
    const brief = path.join(runnerHome(), 'attachments', 'j1', 'brief.md')
    start(`console.log("hello from the runtime", require("node:fs").readFileSync(${JSON.stringify(brief)}, "utf8"))`)
    await until(() => job.state === 'finished')
    assert.equal(job.outcome, 'done')
    assert.match(job.events.map((e) => e.text).join(''), /hello from the runtime hi/)
    assert.equal(planned[0]!.cwd, path.join(runnerHome(), 'work', 'j1'))
    assert.equal(/- (.+brief\.md)/.exec(planned[0]!.prompt)![1], brief)
    assert.ok(planned[0]!.prompt.endsWith('\n\n---\n\nBuild it'), "Cloud's prompt was not last")
    // The attachments go with the job (#2133).
    assert.equal(fs.existsSync(path.dirname(brief)), false)
  })

  it('streams the log with the token as a subprotocol, and finishes once the log is stored (#2085)', async () => {
    const job = cloud.dispatch({ id: 'j1' })
    start()
    await until(() => job.state === 'finished')
    assert.equal(cloud.logs[0]!.protocol, 'bearer, t')
    assert.deepEqual(cloud.logs[0]!.sent.at(-1), { type: 'end' })
    assert.equal(job.finishedLogEnded, true)
  })

  it('sends only what the log lacks after a reconnect', async () => {
    const job = cloud.dispatch({ id: 'j1' })
    start('let n = 0; const t = setInterval(() => { console.log("tick " + n++); if (n === 40) clearInterval(t) }, 30)')
    await until(() => job.events.length > 0)
    cloud.logs[0]!.socket.destroy()
    await until(() => job.state === 'finished', 8_000)
    assert.ok(cloud.logs.length >= 2)
    const seqs = job.events.map((e) => e.seq)
    assert.deepEqual(seqs, [...seqs.keys()], 'a seq was lost or sent twice')
    const again = cloud.logs[1]!
    const resent = again.sent.flatMap((m: any) => (m.type === 'events' ? m.events.map((e: { seq: number }) => e.seq) : []))
    assert.ok(again.after >= 0 && resent.every((seq: number) => seq > again.after), 'the log was sent again from the start')
    assert.match(job.events.map((e) => e.text).join(''), /tick 39/)
    assert.ok(cloud.logs.some((l) => l.sent.some((m: any) => m.type === 'alive')), 'a renewal did not keep the log alive')
  })

  it('holds output while nobody watches, and sends it at once when a page starts watching', async () => {
    const job = cloud.dispatch({ id: 'j1' })
    start('console.log("first"); setTimeout(() => {}, 1000)', { flushMs: { watched: 50, quiet: 60_000 } })
    await until(() => planned.length === 1 && cloud.logs.length === 1)
    await new Promise((r) => setTimeout(r, 400))
    assert.equal(job.events.length, 0, 'output went out while nobody watched')
    cloud.watch(true)
    await until(() => job.events.length > 0, 500)
    assert.equal(job.state, 'claimed')
    await until(() => job.state === 'finished')
  })

  it('sends a structured runtime\'s events, and its stderr as log', async () => {
    const said = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hi.' }, { type: 'tool_use', id: 'u1', name: 'Read', input: { file_path: 'a.ts' } }] } })
    const job = cloud.dispatch({ id: 'j1' })
    start('', {
      plan: (runtime, prompt, cwd, resume) => ({
        ...fakeRuntime(`console.log(${JSON.stringify(said)}); console.error("warn")`)(runtime, prompt, cwd, resume),
        renderer: createStreamRenderer(),
      }),
    })
    await until(() => job.state === 'finished')
    const kinds = job.events.map((e) => e.kind)
    assert.ok(kinds.includes('message') && kinds.includes('tool_call'))
    assert.deepEqual(job.events.find((e) => e.kind === 'tool_call')!.data, { toolCallId: 'u1', title: 'Read', kind: 'read', status: 'in_progress', target: 'a.ts' })
    assert.match(job.events.filter((e) => e.kind === 'log').map((e) => e.text).join(''), /warn/)
    assert.doesNotMatch(job.events.map((e) => e.text).join(''), /Hi\./)
  })

  it('holds an ACP runtime\'s turn and sends its events and what it spent', async () => {
    const job = cloud.dispatch({ id: 'j1', runtime: 'opencode' })
    start('', { plan: acpRuntime() })
    await until(() => job.state === 'finished')
    assert.equal(job.outcome, 'done', job.reason)
    assert.deepEqual(job.events.map((e) => e.kind), ['plan', 'tool_call', 'message'])
    assert.deepEqual(job.events.at(-1)!.data, { text: 'Two tiers.' })
    assert.deepEqual(job.report, {
      reply: 'Two tiers.',
      session: 's1',
      usage: { input: 10, cacheCreation: 0, cacheRead: 0, output: 2 },
      context: { used: 900, limit: 100000 },
    })
  })

  it('joins neighbouring log text and cuts what Cloud would not keep', () => {
    const wire = toWire([
      { kind: 'log', data: { text: 'a' } },
      { kind: 'log', data: { text: 'b' } },
      { kind: 'tool_call_update', data: { toolCallId: 't', status: 'completed', result: 'x'.repeat(70_000) } },
    ], 5)
    assert.deepEqual(wire.map((e) => [e.seq, e.kind, e.text]), [[5, 'log', 'ab'], [6, 'tool_call_update', '']])
    assert.equal((wire[1]!.data!.result as string).length, 64 * 1024)
  })

  it('continues the session a job names, and reports what the agent said', async () => {
    const job = cloud.dispatch({ id: 'j1', resume: 'th_1' })
    start()
    await until(() => job.state === 'finished')
    assert.equal(planned[0]!.resume, 'th_1')
    assert.deepEqual(job.report, { reply: 'Two tiers.', session: 'th_1', context: { used: 38_000, limit: 200_000 } })
  })

  it("passes Cloud's prompt and language line on as they are (#47)", async () => {
    const job = cloud.dispatch({ id: 'j1', prompt: 'go\n\n请用中文回复和写作。', languageLine: '请用中文回复和写作。' })
    start()
    await until(() => job.state === 'finished')
    assert.equal(planned[0]!.prompt, 'go\n\n请用中文回复和写作。')
    const akb = { command: 'akb', args: [] }
    assert.equal(akbEnv(akb, 'b', undefined, 'Reply and write in English.').AI4KANBAN_LANGUAGE_LINE, 'Reply and write in English.')
    // Even empty, Cloud's line stands over this machine's language setting.
    assert.equal(akbEnv(akb, 'b', undefined, '').AI4KANBAN_LANGUAGE_LINE, '')
  })

  it('copies a discussion task\'s session, and falls back to a new one reading the discussion (#2146)', async () => {
    const job = cloud.dispatch({ id: 'j1', resume: 'ds1', fork: true, transcript: 'User: Tiers?\n\nAgent: Two.' })
    const forked: (boolean | undefined)[] = []
    let read = ''
    start('', {
      plan: (runtime, prompt, cwd, resume, model, _settings, fork) => {
        planned.push({ runtime, prompt, cwd, resume, model })
        forked.push(fork)
        const file = /leaves out: (\S+)/.exec(prompt)?.[1]
        if (file) read = fs.readFileSync(file, 'utf8')
        // The discussion's session is not on this computer.
        const gone = !!resume
        return {
          command: process.execPath,
          args: ['-e', gone ? 'process.exit(1)' : ''],
          env: process.env,
          renderer: { push: (s) => s, flush: () => '', result: () => (gone ? undefined : 'Two tiers.') },
          quiet: () => false,
          session: () => (gone ? undefined : 'fresh-session'),
        }
      },
    })
    await until(() => job.state === 'finished')
    assert.deepEqual(planned.map((p) => p.resume), ['ds1', null])
    assert.deepEqual(forked, [true, false])
    assert.equal(planned[0]!.prompt, 'go', 'a carried session was pointed at the discussion')
    assert.ok(planned[1]!.prompt.endsWith('\n\n---\n\ngo'), "Cloud's prompt was not last")
    assert.equal(read, 'User: Tiers?\n\nAgent: Two.\n')
    assert.equal(job.outcome, 'done')
    assert.deepEqual(job.report, { reply: 'Two tiers.', session: 'fresh-session' })
  })

  it('hands an idea conversation its ideas and workflows, and reports what the reply left (#2073)', async () => {
    const ideas = [{ id: 'idea_1', title: 'Pricing page', outcome: 'Prices.', acceptance: [], workflow: 'wf_builtin_coding', task: null }]
    const job = cloud.dispatch({ id: 'j1', discussion: { id: 'dsc_1', workspace: 'ws_1', ideas } })
    start(`const fs = require('node:fs'); const f = process.env.KANBAN_IDEAS; const held = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (held.workflows[0].id !== 'wf_builtin_coding') process.exit(4);
      held.ideas[0].start = true; fs.writeFileSync(f, JSON.stringify(held))`)
    await until(() => job.state === 'finished')
    assert.equal(job.outcome, 'done')
    assert.deepEqual((job.report as { ideas: unknown[] }).ideas, [{ ...ideas[0], start: true }])
    assert.equal(fs.existsSync(path.join(runnerHome(), 'ideas', 'j1.json')), false)
  })

  it('reports a failing runtime as failed', async () => {
    const job = cloud.dispatch({ id: 'j1' })
    start('process.exit(3)')
    await until(() => job.state === 'finished')
    assert.equal(job.outcome, 'failed')
    assert.match(job.reason!, /code 3/)
  })

  it('runs a job once however often it is announced', async () => {
    const job = cloud.dispatch({ id: 'j1' })
    start('setTimeout(() => {}, 300)')
    await until(() => job.state === 'finished')
    await new Promise((r) => setTimeout(r, 300))
    assert.equal(job.claims, 1)
    assert.equal(planned.length, 1)
  })

  it('refuses a folder the user did not allow, and one that steps out of it by a link', async () => {
    const allowed = fs.mkdtempSync(path.join(os.tmpdir(), 'allowed-'))
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-'))
    fs.symlinkSync(outside, path.join(allowed, 'escape'))
    fs.mkdirSync(path.join(allowed, 'site'))
    fs.writeFileSync(path.join(runnerHome(), 'projects.json'), JSON.stringify({ projects: [allowed] }))

    const elsewhere = cloud.dispatch({ id: 'out', projectDir: outside })
    const linked = cloud.dispatch({ id: 'link', projectDir: path.join(allowed, 'escape') })
    const inside = cloud.dispatch({ id: 'in', projectDir: path.join(allowed, 'site') })
    start()
    await until(() => [elsewhere, linked, inside].every((j) => j.state === 'finished'))
    assert.equal(elsewhere.outcome, 'failed')
    assert.match(elsewhere.reason!, /not allowed/)
    assert.equal(linked.outcome, 'failed')
    assert.equal(inside.outcome, 'done')
    assert.deepEqual(planned.map((p) => p.cwd), [fs.realpathSync(path.join(allowed, 'site'))])
  })

  it('runs every job Cloud lists at once: the plan is the only limit (#17)', async () => {
    const jobs = ['j1', 'j2', 'j3'].map((id) => cloud.dispatch({ id }))
    start('setInterval(() => {}, 1000)')
    await until(() => jobs.every((j) => j.state === 'claimed') && planned.length === 3)
  })

  it('stops the local process when the lease is lost', async () => {
    const job = cloud.dispatch({ id: 'j1' })
    start('setInterval(() => console.log("tick"), 20)')
    await until(() => job.state === 'claimed' && job.events.length > 0)
    job.leaseLost = true
    await until(() => planned.length === 1 && !cloud.jobs.get('j1')!.reason && job.state === 'claimed')
    // The process is gone: no more output arrives, and the job is never finished by this Runner.
    await new Promise((r) => setTimeout(r, 400))
    const seen = job.events.length
    await new Promise((r) => setTimeout(r, 300))
    assert.equal(job.events.length, seen)
    assert.equal(job.state, 'claimed')
  })

  it('stops a reply when its log says so, and sends what the agent said by then (#2133)', async () => {
    const job = cloud.dispatch({ id: 'j1', runtime: 'opencode', attachments: [{ name: 'shot.png', content: 'aGk=' }] })
    start('', { plan: acpRuntime({ ACP_HALF: '1' }) })
    await until(() => cloud.logs.some((l) => l.job === 'j1'))
    await new Promise((r) => setTimeout(r, 100))
    cloud.stopOverLog('j1')
    await until(() => job.state === 'finished')
    assert.equal(job.outcome, 'done', job.reason)
    assert.deepEqual([(job.report!.reply as string).trim(), job.report!.stopped], ['Two', true])
    assert.equal(fs.existsSync(path.join(runnerHome(), 'attachments', 'j1')), false)
  })

  it('stops a reply its renewal asks to stop, as done', async () => {
    const job = cloud.dispatch({ id: 'j1', stop: true })
    start('setInterval(() => console.log("tick"), 20)')
    await until(() => job.state === 'finished')
    assert.equal(job.outcome, 'done', job.reason)
    assert.equal(job.report!.stopped, true)
  })

  it('reconnects after Cloud drops away, and picks up what arrived meanwhile', async () => {
    start()
    await until(() => cloud.registrations > 0)
    const port = cloud.port
    await cloud.stop()
    const job = cloud.dispatch({ id: 'late' })
    await new Promise((r) => setTimeout(r, 300))
    await cloud.start(port)
    await until(() => job.state === 'finished', 10_000)
    assert.equal(job.outcome, 'done')
  })

  it('fails a job it held before it restarted rather than leaving it hanging', async () => {
    const job = cloud.dispatch({ id: 'j1', state: 'claimed', machine: MACHINE })
    cloud.runner = { machineId: MACHINE, machineName: 'studio', live: true }
    start()
    await until(() => job.state === 'finished')
    assert.equal(job.outcome, 'failed')
    assert.match(job.reason!, /restarted/)
  })

  it('stops, naming the computer, when another one is the account’s Runner', async () => {
    cloud.runner = { machineId: '55555555-5555-4555-8555-555555555555', machineName: 'laptop', live: true }
    const stop = await start().stopped
    assert.deepEqual(stop, { reason: 'elsewhere', machine: 'laptop' })
  })

  it('registers with protocol 11', async () => {
    start()
    await until(() => cloud.registrations > 0)
    assert.equal(cloud.protocol, 11)
  })

  it('stops as outdated when Cloud no longer takes its protocol', async () => {
    cloud.minProtocol = 99
    assert.deepEqual(await start().stopped, { reason: 'outdated' })
  })

  it('frees the account when it quits', async () => {
    start()
    await until(() => cloud.registrations > 0)
    await runner!.close()
    assert.equal(cloud.runner!.live, false)
  })
})

describe('a task’s folder (#2037)', () => {
  const board = () => path.join(cached(), '.akb', 'kanban')
  const read = (file: string) => fs.readFileSync(path.join(board(), file), 'utf8')
  const downloads = () => cloud.log.filter((l) => l.endsWith('/file'))
  const commits = () => cloud.log.filter((l) => l.endsWith('/board/commits'))
  const CARD = 'todo/1-task-1.md'
  const BODY = '# Pricing\n\n![](hero.png) ![](shots/a.png)\n\nTiers.\n'

  beforeEach(() => {
    cloud.task = {
      artifacts: new Map([['art_1', [Buffer.from('hero-1')]], ['art_2', [Buffer.from('a-1')]]]),
      workflow: { workflow: 'wf_own', version: 2, files: {
        'WORKFLOW.md': '---\nname: Coding\n---\n',
        'agents/software-planner/AGENT.md': 'Plan it.',
        'agents/software-planner/references/notes.md': 'Notes',
      } },
    }
    cloud.put({
      [CARD]: BODY,
      'assets/task_1.json': JSON.stringify({ 'hero.png': { artifact: 'art_1' }, 'shots/a.png': { artifact: 'art_2', version: 1 } }),
      'memory/readme.md': 'Shipped',
      'memory/agents/planner/decisions.md': 'No',
      'workflows/wf-own/WORKFLOW.md': '---\nname: Coding\n---\n',
      'workflows/wf-own/agents/software-planner/AGENT.md': 'Plan it.',
      'workflows/wf-own/agents/software-planner/references/notes.md': 'Notes',
      'workflows/wf-own/agents/../escape.md': 'no',
    })
    cloud.putShared({ 'memory/me.md': 'Mine' })
  })

  let script = ''
  const runTask = async (id: string, edit = '', extra: Partial<FakeJob> = {}) => {
    script = edit && `process.chdir('.akb/kanban'); ${edit}`
    const job = cloud.dispatch({ id, task: 'task_1', project: 'prj_1', number: 1, workflow: cloud.task.workflow?.workflow, ...extra })
    if (!runner) start('', { plan: (r, p, c) => fakeRuntime(script)(r, p, c) })
    await until(() => job.state === 'finished')
    return job
  }

  it('reads the board in one call, writes the card, its memory and its assets, and runs there', async () => {
    const job = await runTask('j1')
    assert.equal(job.outcome, 'done', job.reason)
    assert.equal(planned[0]!.cwd, cached())
    assert.match(planned[0]!.prompt, new RegExp(`^Task card: ${path.join(board(), CARD)}`))
    assert.ok(planned[0]!.prompt.endsWith('\n\n---\n\ngo'), "Cloud's prompt was not last")
    assert.equal(read(CARD), BODY)
    assert.equal(read('todo/hero.png'), 'hero-1')
    assert.equal(read('todo/shots/a.png'), 'a-1')
    assert.equal(read('memory/readme.md'), 'Shipped')
    assert.ok(!fs.existsSync(path.join(board(), 'memory', 'me.md')), 'undeclared workspace memory reached the task')
    assert.equal(read('memory/agents/planner/decisions.md'), 'No')
    assert.deepEqual(cloud.log.filter((l) => l.includes('/board')), ['GET /v1/projects/prj_1/board'])
    assert.equal(commits().length, 0, 'a job that changed nothing wrote back')
  })

  it('keeps each project with no folder in a folder of its own (#2061)', async () => {
    await runTask('j1')
    const other = openTaskFolder({ task: 'task_2', project: 'prj_2' }, null)
    assert.equal(other.cwd, cached('prj_2'))
    assert.equal(planned[0]!.cwd, cached())
  })

  it('hands the agent the akb it carries, on the task’s board (#2020)', async () => {
    const job = await runTask('j1', 'const p = require("path"); console.log(process.env.AI4KANBAN_BOARD, require("fs").existsSync(p.join(process.env.PATH.split(p.delimiter)[0], "akb")))')
    assert.equal(job.outcome, 'done', job.reason)
    assert.match(job.events.map((e) => e.text).join(''), new RegExp(`${board()} true`))
  })

  it('copies the workflow the board holds to akb’s agents/, and points the agent at it (#2040)', async () => {
    await runTask('j1')
    const workflow = path.join(board(), 'workflows', 'wf-own', 'WORKFLOW.md')
    assert.equal(fs.readFileSync(workflow, 'utf8'), '---\nname: Coding\n---\n')
    assert.equal(read('agents/software-planner/AGENT.md'), 'Plan it.')
    assert.equal(read('agents/software-planner/references/notes.md'), 'Notes')
    assert.ok(!fs.existsSync(path.join(board(), 'escape.md')), 'a workflow file landed outside agents/')
    assert.match(planned[0]!.prompt, new RegExp(`Workflow: ${workflow}`))
    assert.ok(!cloud.log.includes('GET /v1/tasks/task_1/workflow'), 'the workflow was read beside the board')

    const stamp = fs.statSync(path.join(board(), 'agents', 'software-planner', 'AGENT.md')).mtimeMs
    await runTask('j2')
    assert.equal(fs.statSync(path.join(board(), 'agents', 'software-planner', 'AGENT.md')).mtimeMs, stamp, 'an unchanged version was rewritten')

    // A board missing the folder reads the version, which Cloud writes there.
    cloud.put({ 'workflows/wf-own/WORKFLOW.md': null, 'workflows/wf-own/agents/software-planner/AGENT.md': null,
      'workflows/wf-own/agents/software-planner/references/notes.md': null })
    assert.equal((await runTask('j3')).outcome, 'done')
    assert.ok(cloud.log.includes('GET /v1/tasks/task_1/workflow'))
    assert.equal(cloud.file('workflows/wf-own/WORKFLOW.md'), '---\nname: Coding\n---\n')

    delete cloud.task.workflow
    assert.equal((await runTask('j4', '', { workflow: null })).outcome, 'done', 'a task with no workflow failed')
  })

  it('puts every workflow the project made in agents/, the task’s own first, and drops one no workflow names (#2106)', async () => {
    cloud.put({
      'workflows/wf-a/WORKFLOW.md': '---\nname: Blog\n---\n',
      'workflows/wf-a/agents/software-planner/AGENT.md': 'Theirs.',
      'workflows/wf-a/agents/seo-writer/AGENT.md': 'Write.',
      'workflows/wf-builtin-coding/agents/qa-manager/AGENT.md': 'Built in.',
      'workflows/task-9/agents/draft/AGENT.md': 'Draft.',
    })
    assert.equal((await runTask('j1')).outcome, 'done')
    assert.equal(read('agents/software-planner/AGENT.md'), 'Plan it.')
    assert.equal(read('agents/seo-writer/AGENT.md'), 'Write.')
    assert.ok(!fs.existsSync(path.join(board(), 'agents', 'qa-manager')), 'a built-in’s agent was placed')
    assert.ok(!fs.existsSync(path.join(board(), 'agents', 'draft')), 'a draft’s agent was placed')

    cloud.put({ 'workflows/wf-a/WORKFLOW.md': null, 'workflows/wf-a/agents/software-planner/AGENT.md': null, 'workflows/wf-a/agents/seo-writer/AGENT.md': null })
    assert.equal((await runTask('j2')).outcome, 'done')
    assert.ok(!fs.existsSync(path.join(board(), 'agents', 'seo-writer', 'AGENT.md')), 'an agent no workflow names stayed')
    assert.equal(read('agents/software-planner/AGENT.md'), 'Plan it.')
  })

  it('syncs triage as board files: what another computer sorted comes down, a move here goes up (#2107)', async () => {
    const item = (title: string, extra = '') => `---\nsource_id: derived-${title.length}\ntitle: ${title}\nimported_at: "2026-10-20 09:00"\n${extra}---\n\nWords.\n`
    cloud.put({
      'triage/annual-plan.md': item('Annual plan'),
      'triage/dismissed/sso.md': item('SSO', 'dismissed_at: "2026-10-21 09:00"\ndismissed_by: user\n'),
      'triage/archived/dark-mode.md': item('Dark mode', 'card_id: 4\narchived_at: "2026-10-21 09:00"\n'),
    })
    fs.mkdirSync(path.join(board(), 'triage'), { recursive: true })
    fs.writeFileSync(path.join(board(), 'triage', 'left-over.md'), item('Left over'))
    const edit = `
      const fs = require('fs')
      fs.mkdirSync('triage/dismissed', { recursive: true })
      fs.renameSync('triage/annual-plan.md', 'triage/dismissed/annual-plan.md')
    `
    assert.equal((await runTask('j1', edit)).outcome, 'done')
    assert.ok(!fs.existsSync(path.join(board(), 'triage', 'left-over.md')), 'a file Cloud never held stayed')
    assert.equal(read('triage/dismissed/sso.md'), cloud.file('triage/dismissed/sso.md'))
    assert.equal(read('triage/archived/dark-mode.md'), cloud.file('triage/archived/dark-mode.md'))
    assert.equal(cloud.file('triage/annual-plan.md'), null)
    assert.ok(cloud.file('triage/dismissed/annual-plan.md'))

    // Moved in Cloud meanwhile: the Runner's own move gives way to it.
    cloud.put({ 'triage/new-idea.md': item('New idea') })
    const mine = `
      const fs = require('fs')
      fs.mkdirSync('triage/archived', { recursive: true })
      fs.renameSync('triage/new-idea.md', 'triage/archived/new-idea.md')
      fs.appendFileSync('triage/archived/new-idea.md', 'card_id: 9 here')
    `
    cloud.beforeNextCommit = () => cloud.put({ 'triage/new-idea.md': null, 'triage/archived/new-idea.md': item('New idea', 'card_id: 9\ntask: task_9\n') })
    const job = await runTask('j2', mine)
    assert.equal(job.outcome, 'done', job.reason)
    assert.match(cloud.file('triage/archived/new-idea.md')!, /task: task_9/)
    assert.equal(read('triage/archived/new-idea.md'), cloud.file('triage/archived/new-idea.md'))
  })

  it('keeps the module map, settings and rules in Cloud: the first computer’s go up, and another reads them (#2106)', async () => {
    fs.mkdirSync(path.join(board(), 'rules'), { recursive: true })
    fs.writeFileSync(path.join(board(), 'modules.md'), 'Mine')
    fs.writeFileSync(path.join(board(), 'rules', 'builder.md'), 'Use pnpm.')
    assert.equal((await runTask('j1')).outcome, 'done')
    assert.equal(cloud.file('modules.md'), 'Mine')
    assert.equal(cloud.file('rules/builder.md'), 'Use pnpm.')

    // Another computer, its own blank template.
    fs.rmSync(path.join(cached(), '.akb', 'base.json'))
    fs.rmSync(board(), { recursive: true })
    fs.mkdirSync(board(), { recursive: true })
    fs.writeFileSync(path.join(board(), 'modules.md'), 'Template')
    assert.equal((await runTask('j2')).outcome, 'done')
    assert.equal(read('modules.md'), 'Mine')
    assert.equal(read('rules/builder.md'), 'Use pnpm.')
    assert.equal(cloud.file('modules.md'), 'Mine')

    // Cleared elsewhere, gone here.
    cloud.put({ 'rules/builder.md': null, 'modules.md': 'Edited' })
    assert.equal((await runTask('j3')).outcome, 'done')
    assert.equal(read('modules.md'), 'Edited')
    assert.ok(!fs.existsSync(path.join(board(), 'rules', 'builder.md')), 'a cleared rule came back')
    assert.equal(cloud.file('rules/builder.md'), null)
  })

  it('writes the task index from the cards, another computer’s included (#2106)', async () => {
    cloud.put({ 'todo/2-task-2.md': '---\ntitle: From the other computer\n---\n', 'todo/3-pages/root.md': '---\ntitle: Pages\n---\n', 'todo/README.md': 'Stale' })
    assert.equal((await runTask('j1')).outcome, 'done')
    const index = read('todo/README.md')
    assert.match(index, /^- \[#1 1-task-1\]\(1-task-1\.md\)$/m)
    assert.match(index, /^- \[#2 From the other computer\]\(2-task-2\.md\)$/m)
    assert.match(index, /^- \[#3 Pages\]\(3-pages\/root\.md\)$/m)
    assert.equal(commits().length, 0, 'the index went up')
  })

  it('writes a workflow’s skills into the project, only when they changed, and leaves the project’s own (#2030)', async () => {
    const skill = (root: string, file: string) => path.join(cached(), root, 'skills', file)
    fs.mkdirSync(path.dirname(skill('.claude', 'mine/SKILL.md')), { recursive: true })
    fs.writeFileSync(skill('.claude', 'mine/SKILL.md'), 'my own')
    const root = 'workflows/wf-builtin-coding/'
    cloud.task.workflow = { workflow: 'wf_builtin_coding', version: 2, builtin: true, files: {} }
    cloud.put({
      [`${root}WORKFLOW.md`]: 'x',
      [`${root}agents/a/AGENT.md`]: 'akb has its own',
      [`${root}skills/deck/SKILL.md`]: 'Make decks.',
      [`${root}skills/deck/scripts/run.mjs`]: 'export {}',
      [`${root}skills/mine/SKILL.md`]: 'not yours',
      [`${root}skills/kanban/SKILL.md`]: 'not the board’s',
    })
    await runTask('j1')
    for (const r of ['.claude', '.agents']) {
      assert.equal(fs.readFileSync(skill(r, 'deck/SKILL.md'), 'utf8'), 'Make decks.')
      assert.equal(fs.readFileSync(skill(r, 'deck/scripts/run.mjs'), 'utf8'), 'export {}')
    }
    assert.equal(fs.readFileSync(skill('.claude', 'mine/SKILL.md'), 'utf8'), 'my own')
    assert.ok(!fs.existsSync(skill('.agents', 'mine')), 'a skill the project holds was written beside it')
    assert.ok(!fs.existsSync(skill('.claude', 'kanban')), 'the kanban skill was replaced')
    assert.ok(!fs.existsSync(path.join(board(), 'agents', 'a')), 'a built-in’s agents were copied over akb’s')
    assert.equal(spawnSync('git', ['-C', cached(), 'status', '--porcelain', '--', '.agents'], { encoding: 'utf8' }).stdout, '', 'a skill reached git')

    const stamp = fs.statSync(skill('.claude', 'deck/SKILL.md')).mtimeMs
    await runTask('j2')
    assert.equal(fs.statSync(skill('.claude', 'deck/SKILL.md')).mtimeMs, stamp, 'an unchanged skill was rewritten')

    cloud.put({ [`${root}skills/deck/SKILL.md`]: null, [`${root}skills/deck/scripts/run.mjs`]: null, [`${root}skills/slides/SKILL.md`]: 'Slides.' })
    await runTask('j3')
    assert.equal(fs.readFileSync(skill('.agents', 'slides/SKILL.md'), 'utf8'), 'Slides.')
    assert.ok(!fs.existsSync(skill('.claude', 'deck')), 'a skill the version dropped stayed')
    assert.equal(fs.readFileSync(skill('.claude', 'mine/SKILL.md'), 'utf8'), 'my own')
  })

  it('writes back every file the job changed in one call, on the seq each was read at', async () => {
    const edit = `
      const fs = require('fs')
      fs.writeFileSync('memory/agents/planner/decisions.md', 'Yes')
      fs.mkdirSync('memory/agents/qa-manager', { recursive: true })
      fs.writeFileSync('memory/agents/qa-manager/notes.md', 'Flaky')
      fs.writeFileSync('todo/README.md', 'generated')
      fs.mkdirSync('triage', { recursive: true })
      fs.writeFileSync('triage/idea.md', 'An idea')
      fs.rmSync('memory/readme.md')
    `
    const job = await runTask('j1', edit)
    assert.equal(job.outcome, 'done', job.reason)
    assert.equal(commits().length, 1)
    assert.equal(cloud.file('memory/agents/planner/decisions.md'), 'Yes')
    assert.equal(cloud.file('memory/agents/qa-manager/notes.md'), 'Flaky')
    assert.equal(cloud.file('triage/idea.md'), 'An idea', 'a triage file stayed behind (#2107)')
    assert.equal(cloud.file('memory/readme.md'), null)
    assert.ok(!cloud.board.has('projects/prj_1/todo/README.md'), 'a generated file went up')

    // What was written is now the base: the next job writes nothing.
    await runTask('j2')
    assert.equal(commits().length, 1)
  })

  it('reads only what changed since, sending a hand edit made outside a job first (#59)', async () => {
    await runTask('j1')
    assert.equal(downloads().length, 2)
    const stamp = fs.statSync(path.join(board(), CARD)).mtimeMs
    fs.writeFileSync(path.join(board(), 'memory', 'readme.md'), 'edited by hand')
    fs.writeFileSync(path.join(board(), 'todo', '9-stray.md'), 'stray')
    await runTask('j2')
    assert.equal(downloads().length, 2, 'an unchanged asset was downloaded again')
    assert.equal(fs.statSync(path.join(board(), CARD)).mtimeMs, stamp, 'an unchanged card was rewritten')
    assert.equal(read('memory/readme.md'), 'edited by hand')
    assert.equal(cloud.file('memory/readme.md'), 'edited by hand')
    assert.equal(cloud.file('todo/9-stray.md'), 'stray')
    assert.equal(commits().length, 1)

    cloud.task.artifacts.get('art_1')!.push(Buffer.from('hero-2'))
    cloud.put({ 'memory/readme.md': 'Shipped again' })
    await runTask('j3')
    assert.deepEqual(downloads().slice(2), ['GET /v1/artifacts/art_1/versions/2/file'])
    assert.equal(read('todo/hero.png'), 'hero-2')
    assert.equal(read('memory/readme.md'), 'Shipped again')
  })

  it('keeps a card archived outside a job archived on the next job (#59)', async () => {
    await runTask('j1')
    fs.mkdirSync(path.join(board(), '.archive'), { recursive: true })
    fs.renameSync(path.join(board(), CARD), path.join(board(), '.archive', '1-task-1.md'))
    const job = await runTask('j2')
    assert.equal(job.outcome, 'done', job.reason)
    assert.equal(cloud.file(CARD), null)
    assert.equal(cloud.file('.archive/1-task-1.md'), BODY)
    assert.ok(!fs.existsSync(path.join(board(), CARD)), 'the next job brought the card back')
    assert.equal(read('.archive/1-task-1.md'), BODY)
  })

  it('fails a job whose board changes here do not merge, overwriting none of them (#59)', async () => {
    await runTask('j1')
    fs.writeFileSync(path.join(board(), 'memory', 'readme.md'), 'edited by hand')
    cloud.put({ 'memory/readme.md': 'Shipped elsewhere' })
    const job = await runTask('j2')
    assert.equal(job.outcome, 'failed')
    assert.match(job.reason ?? '', /could not be sent: memory\/readme\.md was changed elsewhere/)
    assert.equal(read('memory/readme.md'), 'edited by hand')
    assert.equal(cloud.file('memory/readme.md'), 'Shipped elsewhere')
  })

  it('sends a board change as it is made, close ones together, and what waited at the start (#59)', async () => {
    await runTask('j1')
    await runner!.close()
    // Changed while no Runner ran: sent as the next one starts.
    fs.writeFileSync(path.join(board(), 'memory', 'readme.md'), 'while away')
    start('', { watchMs: 50 })
    await until(() => cloud.file('memory/readme.md') === 'while away')
    assert.equal(commits().length, 1)
    fs.writeFileSync(path.join(board(), 'memory', 'readme.md'), 'one')
    fs.writeFileSync(path.join(board(), 'memory', 'agents', 'planner', 'decisions.md'), 'two')
    fs.writeFileSync(path.join(board(), 'todo', 'README.md'), 'generated')
    await until(() => commits().length === 2)
    await new Promise((resolve) => setTimeout(resolve, 300))
    assert.equal(commits().length, 2, 'close changes went as more than one write')
    assert.equal(cloud.file('memory/readme.md'), 'one')
    assert.equal(cloud.file('memory/agents/planner/decisions.md'), 'two')
    assert.ok(!cloud.board.has('projects/prj_1/todo/README.md'), 'a generated file went up')
  })

  it('takes a folder’s writes in turn: the same change goes once (#59)', async () => {
    await runTask('j1')
    fs.writeFileSync(path.join(board(), 'memory', 'readme.md'), 'once')
    const ws = keptBoard(cached())!
    const sent = await Promise.all([pushBoard(ws, MACHINE), pushBoard(ws, MACHINE), pull(openTaskFolder({ task: 'task_1', project: 'prj_1', number: 1 }, null), MACHINE)])
    assert.deepEqual(sent.map((s) => s.ok), [true, true, true])
    assert.equal(commits().length, 1)
    assert.equal(cloud.file('memory/readme.md'), 'once')
    assert.equal(read('memory/readme.md'), 'once')
  })

  describe('Cloud’s changes between jobs (#103)', () => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    const reads = () => cloud.log.filter((l) => l.startsWith('GET /v1/projects/prj_1/board')).length
    let watch: ReturnType<typeof watchBoards> | null = null
    afterEach(() => watch?.close())

    it('reads once for hints close together, dropping its own push and versions already read', async () => {
      await runTask('j1')
      watch = watchBoards(MACHINE, 60_000, 60_000, 50)
      const before = reads()
      cloud.put({ 'memory/readme.md': 'From the page' })
      watch.hint('prj_1', cloud.head, MACHINE)
      watch.hint('prj_1', readHead(keptBoard(cached())!)!)
      watch.hint('prj_2', cloud.head)
      await sleep(150)
      assert.equal(reads(), before, 'a dropped hint read the board')
      watch.hint('prj_1', cloud.head)
      watch.hint('prj_1', cloud.head)
      await until(() => read('memory/readme.md') === 'From the page')
      await sleep(150)
      assert.equal(reads(), before + 1)
      assert.equal(readHead(keptBoard(cached())!), cloud.head)
    })

    it('writes only the files left as last read, deletions too, and keeps one changed here for its push', async () => {
      await runTask('j1')
      watch = watchBoards(MACHINE, 60_000, 60_000, 50)
      const head = readHead(keptBoard(cached())!)
      fs.writeFileSync(path.join(board(), 'memory', 'readme.md'), 'mine')
      cloud.put({ 'memory/readme.md': 'theirs', [CARD]: null, 'todo/2-new.md': '---\ntitle: New\n---\n' })
      watch.hint('prj_1', cloud.head)
      await until(() => fs.existsSync(path.join(board(), 'todo', '2-new.md')))
      assert.ok(!fs.existsSync(path.join(board(), CARD)), 'a card deleted on Cloud stayed')
      assert.equal(read('memory/readme.md'), 'mine')
      assert.match(read('todo/README.md'), /#2 New/)
      assert.equal(readHead(keptBoard(cached())!), head, 'the base moved past a file it did not take')
      const sent = await pushBoard(keptBoard(cached())!, MACHINE)
      assert.ok(!sent.ok && sent.conflict, 'the file changed here went up over Cloud’s')
    })

    it('reads a folder a job holds once the job is over', async () => {
      await runTask('j1')
      watch = watchBoards(MACHINE, 60_000, 60_000, 50)
      const release = hold(cached())
      cloud.put({ 'memory/readme.md': 'During the job' })
      watch.hint('prj_1', cloud.head)
      await sleep(150)
      assert.equal(read('memory/readme.md'), 'Shipped', 'a held folder was written')
      release()
      watch.look()
      await until(() => read('memory/readme.md') === 'During the job')
    })

    it('reads on its poll when no hint can arrive', async () => {
      await runTask('j1')
      await runner!.close()
      start('', { watchMs: 50 })
      cloud.put({ 'memory/readme.md': 'Polled' })
      await until(() => read('memory/readme.md') === 'Polled')
    })
  })

  it('sends a .tsx mockup as the page it draws, again when a file beside it changes (#2003)', async () => {
    const edit = (label: string) => `
      const fs = require('fs')
      const dir = '../boards/.akb/kanban/assets/1'
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(dir + '/page.tsx', 'import Plan from "./Plan"\\nimport "./style.css"\\nexport default () => <main className="p-4"><Plan /></main>')
      fs.writeFileSync(dir + '/Plan.tsx', 'export default function Plan() { return <h1 className="plan">${label}</h1> }')
      fs.writeFileSync(dir + '/style.css', '@import "tailwindcss";\\n.plan { color: teal }')
      fs.writeFileSync(dir + '/copy.md', '# Plans')
      const card = '${CARD}'
      const body = fs.readFileSync(card, 'utf8')
      if (!body.includes('page.tsx')) fs.writeFileSync(card, body + '\\n\\n<Asset src=".assets/1/page.tsx" label="Page" />\\n\\n<Asset src=".assets/1/copy.md" label="Copy" />\\n')
    `
    const assets = () => JSON.parse(cloud.file('assets/task_1.json')!)
    assert.equal((await runTask('j1', edit('Free'))).outcome, 'done')
    const ref = assets()['.assets/1/page.tsx']
    assert.equal(cloud.types.get(ref.artifact), 'html')
    assert.equal(cloud.types.get(assets()['.assets/1/copy.md'].artifact), 'markdown')
    const page = cloud.task.artifacts.get(ref.artifact)![0]!.toString()
    assert.match(page, /^<!doctype html>/)
    assert.match(page, /<main class="p-4"><h1 class="plan">Free<\/h1><\/main>/)
    assert.match(page, /\.plan \{\s*color: teal/)
    assert.match(page, /padding:/, 'Tailwind did not style the page')

    assert.equal((await runTask('j2', edit('Plus'))).outcome, 'done')
    assert.deepEqual(assets()['.assets/1/page.tsx'], { artifact: ref.artifact, version: 2 })
    assert.match(cloud.task.artifacts.get(ref.artifact)![1]!.toString(), />Plus</)
    assert.match(fs.readFileSync(path.join(cached(), '.akb', 'boards', '.akb', 'kanban', 'assets', '1', 'page.tsx'), 'utf8'), /^import Plan/,
      'the drawn page was written over its source')
  })

  it('sends back assets first, then the card and its assets list', async () => {
    const edit = `
      const fs = require('fs')
      fs.writeFileSync('${CARD}', fs.readFileSync('${CARD}', 'utf8') + ' ![](new.png)')
      fs.writeFileSync('todo/new.png', 'new-1')
      fs.writeFileSync('todo/hero.png', 'hero-mine')
    `
    const job = await runTask('j1', edit)
    assert.equal(job.outcome, 'done', job.reason)
    assert.match(cloud.file(CARD)!, /new\.png/)
    const { artifacts } = cloud.task
    const list = JSON.parse(cloud.file('assets/task_1.json')!)
    assert.equal(artifacts.get('art_1')!.at(-1)!.toString(), 'hero-mine')
    assert.deepEqual(list['hero.png'], { artifact: 'art_1', version: 2 })
    assert.deepEqual(list['shots/a.png'], { artifact: 'art_2', version: 1 })
    assert.equal(artifacts.get(list['new.png'].artifact)![list['new.png'].version - 1]!.toString(), 'new-1')
    const uploadAt = cloud.log.findIndex((l) => l.startsWith('PUT /v1/uploads/'))
    assert.ok(uploadAt >= 0 && uploadAt < cloud.log.findIndex((l) => l.endsWith('/board/commits')), 'assets went after the card')
  })

  it('lands two computers’ changes to different files without merging anything', async () => {
    cloud.beforeNextCommit = () => cloud.put({ 'memory/readme.md': 'Shipped, from the other computer' })
    const job = await runTask('j1', `require('fs').writeFileSync('memory/agents/planner/a.md', 'mine')`)
    assert.equal(job.outcome, 'done', job.reason)
    assert.equal(commits().length, 1, 'a write to another file was merged')
    assert.equal(cloud.file('memory/agents/planner/a.md'), 'mine')
    assert.equal(cloud.file('memory/readme.md'), 'Shipped, from the other computer')
  })

  it('merges a file both sides changed here, and writes it once more', async () => {
    cloud.beforeNextCommit = () => cloud.put({ [CARD]: BODY.replace('# Pricing', '# Pricing, two tiers') })
    const job = await runTask('j1', `require('fs').writeFileSync('${CARD}', require('fs').readFileSync('${CARD}', 'utf8').replace('Tiers.', 'Tiers, yearly first.'))`)
    assert.equal(job.outcome, 'done', job.reason)
    assert.equal(commits().length, 2)
    assert.equal(cloud.file(CARD), BODY.replace('# Pricing', '# Pricing, two tiers').replace('Tiers.', 'Tiers, yearly first.'))
    assert.equal(read(CARD), cloud.file(CARD))
  })

  it('ends as a conflict, saving nothing, when the same lines changed or a delete meets an edit', async () => {
    cloud.beforeNextCommit = () => cloud.put({ [CARD]: BODY.replace('Tiers.', 'Tiers, monthly first.') })
    const job = await runTask('j1', `
      require('fs').writeFileSync('${CARD}', require('fs').readFileSync('${CARD}', 'utf8').replace('Tiers.', 'Tiers, yearly first.'))
      require('fs').writeFileSync('memory/readme.md', 'Mine')`)
    assert.equal(job.outcome, 'conflict')
    assert.equal(cloud.file('memory/readme.md'), 'Shipped', 'a refused write saved a file')

    // The retry starts from Cloud's board.
    await runTask('j2')
    assert.equal(read(CARD), BODY.replace('Tiers.', 'Tiers, monthly first.'))
    assert.equal(read('memory/readme.md'), 'Shipped')

    cloud.beforeNextCommit = () => cloud.put({ 'memory/readme.md': 'Edited elsewhere' })
    assert.equal((await runTask('j3', `require('fs').rmSync('memory/readme.md')`)).outcome, 'conflict')
    assert.equal(cloud.file('memory/readme.md'), 'Edited elsewhere')
  })

  it('writes nothing once the job moved to another computer', async () => {
    const job = cloud.dispatch({ id: 'j1', task: 'task_1', project: 'prj_1', number: 1, workflow: 'wf_own' })
    script = `process.chdir('.akb/kanban'); require('fs').writeFileSync('memory/readme.md', 'Late')`
    start('', { plan: (r, p, c) => fakeRuntime(script)(r, p, c), renewMs: 60_000 })
    await until(() => planned.length === 1)
    job.machine = 'elsewhere'
    await until(() => commits().length === 1)
    await new Promise((r) => setTimeout(r, 100))
    assert.equal(cloud.file('memory/readme.md'), 'Shipped')
    assert.notEqual(job.outcome, 'done')
  })

  it('runs a job on offline and writes it back once Cloud is reached within the lease', async () => {
    const job = cloud.dispatch({ id: 'j1', task: 'task_1', project: 'prj_1', number: 1, workflow: 'wf_own' })
    script = `process.chdir('.akb/kanban'); setTimeout(() => require('fs').writeFileSync('memory/readme.md', 'Offline work'), 300)`
    start('', { plan: (r, p, c) => fakeRuntime(script)(r, p, c) })
    await until(() => planned.length === 1)
    cloud.offline = true
    await new Promise((r) => setTimeout(r, 600))
    assert.equal(job.state, 'claimed')
    cloud.offline = false
    await until(() => job.state === 'finished')
    assert.equal(job.outcome, 'done', job.reason)
    assert.equal(cloud.file('memory/readme.md'), 'Offline work')
  })

  it('drops a result still offline when its lease ran out', async () => {
    const job = cloud.dispatch({ id: 'j1', task: 'task_1', project: 'prj_1', number: 1, workflow: 'wf_own' })
    script = `process.chdir('.akb/kanban'); setTimeout(() => require('fs').writeFileSync('memory/readme.md', 'Too late'), 200)`
    start('', { plan: (r, p, c) => fakeRuntime(script)(r, p, c), leaseMs: 300 })
    await until(() => planned.length === 1)
    cloud.offline = true
    await new Promise((r) => setTimeout(r, 700))
    cloud.offline = false
    await new Promise((r) => setTimeout(r, 300))
    assert.equal(commits().length, 0)
    assert.equal(cloud.file('memory/readme.md'), 'Shipped')
    assert.equal(job.state, 'claimed')
  })

  it('gives the task the workspace memory its agents share, written back in the same commit as its card (#2093, #2114)', async () => {
    cloud.putShared({ 'memory/agents/copywriting/style.md': 'Shared', 'memory/agents/copywriting/notes.md': 'Not declared',
      'memory/agents/video-cloner/motions/pan.md': 'Pan' })
    cloud.put({ 'memory/agents/copywriting/draft.md': 'Old draft' })
    const job = await runTask('j1', [
      `require('fs').appendFileSync('memory/agents/copywriting/style.md', ' + edit')`,
      `require('fs').mkdirSync('memory/agents/carousel-planner')`,
      `require('fs').writeFileSync('memory/agents/carousel-planner/format-reel.md', 'Reel')`,
      `require('fs').writeFileSync('memory/agents/copywriting/draft.md', 'Draft')`,
      `require('fs').rmSync('memory/agents/video-cloner/motions/pan.md')`,
      `require('fs').appendFileSync('${CARD}', 'Done.')`,
    ].join('; '))
    assert.equal(job.outcome, 'done', job.reason)
    assert.equal(commits().length, 1, 'the card and the shared memory went up apart')
    assert.ok(!fs.existsSync(path.join(board(), 'memory', 'agents', 'copywriting', 'notes.md')), 'an undeclared workspace file reached the task')
    assert.equal(cloud.shared('memory/agents/copywriting/style.md'), 'Shared + edit')
    assert.equal(cloud.shared('memory/agents/carousel-planner/format-reel.md'), 'Reel')
    assert.equal(cloud.shared('memory/agents/video-cloner/motions/pan.md'), null)
    assert.equal(cloud.shared('memory/agents/copywriting/notes.md'), 'Not declared')
    assert.equal(cloud.file('memory/agents/carousel-planner/format-reel.md'), null, 'shared memory reached the project')
    assert.equal(cloud.file('memory/agents/copywriting/draft.md'), 'Draft')
    assert.match(cloud.file(CARD)!, /Done\.$/)
  })

  it('reads shared memory another project’s job wrote since, and nothing of that project', async () => {
    cloud.putShared({ 'memory/agents/copywriting/style.md': 'Shared' })
    await runTask('j1')
    cloud.putShared({ 'memory/agents/copywriting/style.md': 'Shared, from prj_2' })
    cloud.put({ 'todo/2-task-2.md': 'Theirs' }, 'projects/prj_2/')
    await runTask('j2')
    assert.equal(read('memory/agents/copywriting/style.md'), 'Shared, from prj_2')
    assert.ok(!fs.existsSync(path.join(board(), 'todo', '2-task-2.md')), 'another project’s card reached the board')
    assert.ok(!fs.existsSync(path.join(board(), 'projects')), 'a workspace path reached the board')
  })

  it('merges shared memory another job changed meanwhile, on other lines (#2065)', async () => {
    const STYLE = 'memory/agents/copywriting/style.md'
    cloud.putShared({ [STYLE]: 'Tone: plain\nVoice: you\nLength: short\n' })
    cloud.beforeNextCommit = () => cloud.putShared({ [STYLE]: 'Tone: plain, warm\nVoice: you\nLength: short\n' })
    const job = await runTask('j1', `require('fs').writeFileSync('${STYLE}', 'Tone: plain\\nVoice: you\\nLength: short, one screen\\n')`)
    assert.equal(job.outcome, 'done', job.reason)
    assert.equal(commits().length, 2)
    assert.equal(cloud.shared(STYLE), 'Tone: plain, warm\nVoice: you\nLength: short, one screen\n')
    assert.equal(read(STYLE), cloud.shared(STYLE))
  })

  it('ends as a conflict, saving neither card nor memory, when another job changed the same line of shared memory (#2065)', async () => {
    const STYLE = 'memory/agents/copywriting/style.md'
    cloud.putShared({ [STYLE]: 'Tone: plain\n' })
    cloud.beforeNextCommit = () => cloud.putShared({ [STYLE]: 'Tone: warm\n' })
    const job = await runTask('j1', `require('fs').writeFileSync('${STYLE}', 'Tone: dry\\n'); require('fs').appendFileSync('${CARD}', 'Done.')`)
    assert.equal(job.outcome, 'conflict')
    assert.equal(cloud.shared(STYLE), 'Tone: warm\n')
    assert.equal(cloud.file(CARD), BODY, 'a refused write saved the card')
  })

  it('merges a shared file another job made meanwhile under the same name (#2065)', async () => {
    const STYLE = 'memory/agents/copywriting/style.md'
    cloud.beforeNextCommit = () => cloud.putShared({ [STYLE]: 'Same\n' })
    const job = await runTask('j1', `require('fs').mkdirSync('memory/agents/copywriting', { recursive: true }); require('fs').writeFileSync('${STYLE}', 'Same\\n')`)
    assert.equal(job.outcome, 'done', job.reason)
    assert.equal(cloud.shared(STYLE), 'Same\n')
  })

  it('moves a project’s copy of shared memory to the workspace, and a deleted one stays deleted (#2099)', async () => {
    const STYLE = 'memory/agents/copywriting/style.md'
    cloud.put({ [STYLE]: 'Project copy' })
    assert.equal((await runTask('j1')).outcome, 'done')
    assert.equal(cloud.shared(STYLE), 'Project copy')
    assert.equal(cloud.file(STYLE), null)

    assert.equal((await runTask('j2', `require('fs').rmSync('${STYLE}')`)).outcome, 'done')
    assert.equal(cloud.shared(STYLE), null)
    assert.equal((await runTask('j3')).outcome, 'done')
    assert.ok(!fs.existsSync(path.join(board(), STYLE)), 'a deleted shared file came back')
    assert.equal(cloud.shared(STYLE), null, 'a deleted shared file was made again')
  })

  it('drops a project’s copy of shared memory without touching the workspace’s (#2099)', async () => {
    const STYLE = 'memory/agents/copywriting/style.md'
    cloud.putShared({ [STYLE]: 'Shared' })
    cloud.put({ [STYLE]: 'Project copy' })
    assert.equal((await runTask('j1')).outcome, 'done')
    assert.equal(cloud.file(STYLE), null)
    assert.equal(cloud.shared(STYLE), 'Shared')
    assert.equal(read(STYLE), 'Shared')
  })

  it('keeps a project’s copy of shared memory edited elsewhere, and writes back the rest (#2099)', async () => {
    const STYLE = 'memory/agents/copywriting/style.md'
    cloud.putShared({ [STYLE]: 'Shared' })
    cloud.put({ [STYLE]: 'Project copy' })
    cloud.beforeNextCommit = () => cloud.put({ [STYLE]: 'Edited elsewhere' })
    const job = await runTask('j1', `require('fs').writeFileSync('memory/readme.md', 'Mine')`)
    assert.equal(job.outcome, 'done', job.reason)
    assert.equal(cloud.file('memory/readme.md'), 'Mine')
    assert.equal(cloud.file(STYLE), 'Edited elsewhere')
  })

  it('reads a board whole again after a base from before the workspace’s board (#2114)', async () => {
    const base = path.join(cached(), '.akb', 'base.json')
    fs.mkdirSync(path.dirname(base), { recursive: true })
    fs.writeFileSync(base, JSON.stringify({ head_seq: 99, inbox: false, files: { [CARD]: { seq: 1, content: 'Old' } } }))
    assert.equal((await runTask('j1')).outcome, 'done')
    assert.ok(cloud.log.includes('GET /v1/projects/prj_1/board'), 'an old base was read on from its seq')
    assert.equal(read(CARD), BODY)
    assert.equal(JSON.parse(fs.readFileSync(base, 'utf8')).layout, 'workspace')
  })

  it('keeps a project’s task folder in it, out of git', async () => {
    const project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'site-')))
    spawnSync('git', ['init', '-q', project])
    fs.writeFileSync(path.join(runnerHome(), 'projects.json'), JSON.stringify({ projects: [project] }))
    const job = cloud.dispatch({ id: 'j1', task: 'task_1', project: 'prj_1', number: 1, projectDir: project })
    start()
    await until(() => job.state === 'finished')
    assert.equal(job.outcome, 'done')
    assert.equal(planned[0]!.cwd, project)
    assert.equal(fs.readFileSync(path.join(project, '.akb', 'kanban', CARD), 'utf8'), BODY)
    assert.match(fs.readFileSync(path.join(project, '.git', 'info', 'exclude'), 'utf8'), /^\.akb\/$/m)
    assert.equal(spawnSync('git', ['-C', project, 'status', '--porcelain'], { encoding: 'utf8' }).stdout, '')
  })
})

describe('the workspace’s memory files (#2093)', () => {
  it('reads each agent’s `memoryFiles`: folders, `*` within one name, and none from a refused agent', () => {
    const board = fs.mkdtempSync(path.join(os.tmpdir(), 'board-'))
    const agent = (name: string, files: string) => {
      fs.mkdirSync(path.join(board, 'agents', name), { recursive: true })
      fs.writeFileSync(path.join(board, 'agents', name, 'AGENT.md'),
        `---\nname: ${name}\ndescription: Helps.\nakb:\n  when: A card needs it.\n  memoryFiles:\n    ${files}\n---\n\nHelp.\n`)
    }
    agent('notes-keeper', 'workspace: [notes/, tone.md]')
    agent('broken', 'shared: [tone.md]')
    const shared = sharedMemory(board)
    assert.ok(shared('agents/notes-keeper/notes/a/b.md'))
    assert.ok(shared('agents/notes-keeper/tone.md'))
    assert.ok(!shared('agents/notes-keeper/other.md'))
    assert.ok(!shared('agents/broken/tone.md'))
    assert.ok(shared('agents/carousel-planner/format-reel.md'))
    assert.ok(!shared('agents/carousel-planner/format-x/reel.md'))
    assert.ok(!shared('readme.md'))
  })
})

describe('flow jobs (#2020)', () => {
  const board = () => path.join(cached(), '.akb', 'kanban')
  const calls = () =>
    fs.readFileSync(process.env.FAKE_AKB_LOG!, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as string[])
  const cardCalls = () => calls().filter((c) => c[0] === 'card').map((c) => c.join(' '))
  const flowJob = async (id: string, flow: Partial<NonNullable<FakeFlow>> & { verb: string }, extra: Partial<Parameters<FakeCloud['dispatch']>[0]> = {}) => {
    const job = cloud.dispatch({ id, task: 'task_1', project: 'prj_1', number: 2, runtime: 'claude-code', flow: { workflow: 'wf_builtin_coding', ...flow }, ...extra })
    if (!runner) start()
    await until(() => job.state === 'finished')
    return job
  }

  beforeEach(() => {
    cloud.task = { artifacts: new Map(), title: 'Pricing page', request: 'Two tiers, monthly and yearly.' }
  })

  it('creates the card from the task, refines it, and reports the card, its question and the reply', async () => {
    process.env.FAKE_AKB = JSON.stringify({ refine: { result: 'Planned two tiers.', question: 'Which billing period leads?' } })
    const job = await flowJob('j1', { verb: 'create' })
    assert.equal(job.outcome, 'done', job.reason)
    const create = calls().find((c) => c[0] === 'raw' && c[1] === 'create')!
    assert.deepEqual(create.slice(0, 6), ['raw', 'create', '--title', 'Pricing page', '--workflow', 'coding'])
    assert.deepEqual(calls().find((c) => c[0] === 'agent'), ['agent', 'use', 'claude-code', '--board', board()])
    assert.deepEqual(calls().find((c) => c[1] === 'set' && c[2] === 'model'), ['agent', 'set', 'model', '--board', board()])
    assert.deepEqual(cardCalls(), [`card refine 2 --follow --events --json --board ${board()}`])
    assert.deepEqual(job.report, {
      reply: 'Planned two tiers.',
      card: 2,
      review: { question: 'Which billing period leads?', options: ['Monthly', 'Yearly'], position: 2 },
    })
    const file = path.join(board(), 'todo', '2-pricing-page.md')
    assert.equal(cloud.file('todo/2-pricing-page.md'), fs.readFileSync(file, 'utf8'))
    assert.match(cloud.file('todo/2-pricing-page.md')!, /^---\ntitle: Pricing page\n[\s\S]*Two tiers, monthly and yearly\./)
    assert.match(job.events.map((e) => e.text).join(''), /working on #2/)
    assert.doesNotMatch(job.events.map((e) => e.text).join(''), /"ok":/)
    assert.deepEqual(job.events.find((e) => e.kind === 'message')?.data, { text: 'Read #2.' })
    assert.equal(fs.readFileSync(path.join(board(), '.fake', 'agent-board'), 'utf8'), board())
    assert.equal(fs.readFileSync(path.join(board(), '.fake', 'setup'), 'utf8'), 'project\nagent\ndecisions\nmodules\ntasks\n')
    assert.equal(spawnSync('git', ['-C', cached(), 'log', '--oneline'], { encoding: 'utf8' }).stdout.trim().split('\n').length, 1)
  })

  it('builds a card made unplanned straight after writing it (#2139)', async () => {
    cloud.rejections = { tasks: [{ id: 'task_9', number: 9, title: 'Mobile app', request: '', reason: 'never', cancelled_at: '2026-10-20T09:00:00.000Z' }], triage: [] }
    const job = await flowJob('j1', { verb: 'create', skip_plan: true })
    assert.equal(job.outcome, 'done', job.reason)
    assert.deepEqual(cardCalls(), [`card implement 2 --follow --events --json --board ${board()}`])
    assert.deepEqual(cloud.reviewed, [], 'an unplanned build ran the rejection review')
  })

  it('sends each item the job added up with the board, from its task, on its workflow (#2107)', async () => {
    process.env.FAKE_AKB = JSON.stringify({ refine: { propose: 'Own idea', workflow: 'wf-own1' } })
    assert.equal((await flowJob('j1', { verb: 'create' })).outcome, 'done')
    assert.match(cloud.file('triage/proposed.md')!, /\nworkflow: wf-own1\n[\s\S]*source_task: task_1\n/)
    cloud.put({ 'triage/proposed.md': null })
    process.env.FAKE_AKB = JSON.stringify({ refine: { propose: 'Plain idea', workflow: '' } })
    assert.equal((await flowJob('j2', { verb: 'create' })).outcome, 'done')
    assert.match(cloud.file('triage/proposed.md')!, /title: Plain idea\n[\s\S]*source_task: task_1\nworkflow: coding\n---/)
    assert.ok(!cloud.log.some((l) => l.includes('/v1/triage')), 'triage went to Cloud on its own')
  })

  it('reports what the runs this job started spent, not the card\'s earlier ones', async () => {
    const spent = { usage: { input: 10, cacheCreation: 1, cacheRead: 100, output: 5 }, costUsd: 0.25 }
    process.env.FAKE_AKB = JSON.stringify({ refine: { spent }, implement: { spent } })
    await flowJob('j1', { verb: 'create' })
    await new Promise((r) => setTimeout(r, 5))
    const job = await flowJob('j2', { verb: 'implement', card: 2 })
    assert.deepEqual(job.report?.usage, { input: 20, cacheCreation: 2, cacheRead: 200, output: 10 })
    assert.equal(job.report?.costUsd, 0.5)
  })

  it('reports the context window the latest run counting one left (#52)', async () => {
    process.env.FAKE_AKB = JSON.stringify({ refine: { spent: { context: { used: 90000, limit: 200000 } } } })
    assert.deepEqual((await flowJob('j1', { verb: 'create' })).report?.context, { used: 90000, limit: 200000 })
    process.env.FAKE_AKB = JSON.stringify({ implement: { spent: { context: { used: 120000 } } } })
    await new Promise((r) => setTimeout(r, 5))
    assert.equal((await flowJob('j2', { verb: 'implement', card: 2 })).report?.context, undefined)
  })

  it('learns the workspace\'s rejections before planning, and marks them learned once sent back (#2067)', async () => {
    const at = '2026-10-20T09:00:00.000Z'
    cloud.rejections = {
      tasks: [{ id: 'task_9', number: 9, title: 'Mobile app', request: 'An iOS app.', reason: 'we never build mobile', cancelled_at: at }],
      triage: [
        { id: 'tri_5', project: 'prj_2', title: 'SSO', text: 'For teams.', source_task: null, state: 'dismissed', dismissed_reason: 'not for teams', dismissed_at: at, created_at: at },
        { id: 'tri_6', project: 'prj_2', title: 'Dark mode', text: 'Night.', source_task: null, state: 'open', dismissed_reason: null, dismissed_at: null, created_at: at },
      ],
    }
    const synced = { 'triage/dismissed/learned.md': '---\ntitle: Learned\nreviewed_at: "2026-10-19 09:00"\n---\n\nOld.\n', 'triage/archived/made.md': '---\ntitle: Made\n---\n\nDone.\n' }
    cloud.put(synced)
    const spent = { usage: { input: 1, cacheCreation: 0, cacheRead: 0, output: 1 }, costUsd: 0.1 }
    process.env.FAKE_AKB = JSON.stringify({ 'review-dismissals': { spent }, refine: { spent } })
    const job = await flowJob('j1', { verb: 'create' })
    assert.equal(job.outcome, 'done', job.reason)
    const order = calls().map((c) => c[0] === 'raw' ? `raw ${c[1]}` : c[0]).filter((c) => c === 'review-dismissals' || c === 'raw create')
    assert.deepEqual(order, ['review-dismissals', 'raw create'])
    const learned = JSON.parse(fs.readFileSync(path.join(board(), '.fake', 'learned'), 'utf8'))
    assert.deepEqual(learned.args.slice(0, 2), ['review-dismissals', '--all'])
    assert.deepEqual(Object.keys(learned.seen).sort(), ['.archive/.sync/9-mobile-app.md', 'triage/archived/dark-mode.md', 'triage/dismissed/sso.md'])
    assert.match(learned.seen['.archive/.sync/9-mobile-app.md'], /rejected: true\nrejected_reason: we never build mobile\nrejected_at: 2026-10-20 \d\d:00\nrejected_by: user/)
    assert.match(learned.seen['triage/dismissed/sso.md'], /dismissed_by: user\ndismissed_reason: not for teams/)
    assert.deepEqual(cloud.reviewed, [{ tasks: ['task_9'], triage: ['tri_5', 'tri_6'] }])
    assert.equal(cloud.file('memory/agents/planner/rejected.md'), '- **No mobile app**: we never build one (#9)\n')
    assert.ok(!fs.existsSync(path.join(board(), '.archive', '.sync')) && !fs.existsSync(path.join(board(), 'triage', 'dismissed', 'sso.md')), 'what the review read was left behind')
    for (const [p, content] of Object.entries(synced)) {
      assert.equal(fs.readFileSync(path.join(board(), p), 'utf8'), content, `${p} was not put back`)
      assert.equal(cloud.file(p), content, `${p} went up as deleted`)
    }
    assert.ok(![...cloud.board.keys()].some((p) => p.startsWith('projects/prj_1/.archive/') || p === 'projects/prj_1/triage/dismissed/sso.md'))
    assert.equal(job.report?.costUsd, 0.2)
  })

  it('plans anyway when the review fails, leaving the rejections to learn (#2067)', async () => {
    cloud.rejections = { tasks: [{ id: 'task_9', number: 9, title: 'Mobile app', request: '', reason: 'never', cancelled_at: '2026-10-20T09:00:00.000Z' }], triage: [] }
    process.env.FAKE_AKB = JSON.stringify({ 'review-dismissals': { failed: 'Claude Code hit its usage limit.' } })
    const job = await flowJob('j1', { verb: 'create' })
    assert.equal(job.outcome, 'done', job.reason)
    assert.deepEqual(cloud.reviewed, [])
    assert.deepEqual(cardCalls(), [`card refine 2 --follow --events --json --board ${board()}`])
    assert.ok(!fs.existsSync(path.join(board(), '.archive', '.sync')))
  })

  it('takes the title and the request a create job carries', async () => {
    await flowJob('j1', { verb: 'create', title: 'Launch page', text: 'One hero, one button.' })
    assert.equal(calls().find((c) => c[1] === 'create')![3], 'Launch page')
    assert.match(fs.readFileSync(path.join(board(), 'todo', '2-launch-page.md'), 'utf8'), /One hero, one button\./)
    assert.ok(!cloud.log.includes('GET /v1/tasks/task_1'))
  })

  it('puts the pictures a create job carries on the card it makes (#2182)', async () => {
    const job = await flowJob('j1', { verb: 'create' }, { attachments: [{ name: 'home "shot".png', content: 'aGk=' }] })
    assert.equal(job.outcome, 'done', job.reason)
    const card = fs.readFileSync(path.join(board(), 'todo', '2-pricing-page.md'), 'utf8')
    assert.match(card, /\n\n<Asset src="\.assets\/2\/1-home-shot-\.png" label="home shot\.png" \/>\n/)
    const ref = JSON.parse(cloud.file('assets/task_1.json')!)['.assets/2/1-home-shot-.png']
    assert.equal(cloud.task.artifacts.get(ref.artifact)![0]!.toString(), 'hi')
  })

  it('runs resolve, revise and approve on the card it made, and implement until the delivery lands', async () => {
    await flowJob('j1', { verb: 'create' })
    await flowJob('j2', { verb: 'resolve', card: 2, text: 'Monthly' })
    await flowJob('j3', { verb: 'revise', card: 2, text: '-- three tiers' })
    await flowJob('j4', { verb: 'approve', card: 2 })
    const commit = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
    process.env.FAKE_AKB = JSON.stringify({ implement: { result: 'Built it.', landed: 'Landed it.', delivery: { commit, branch: 'main' } } })
    const built = await flowJob('j5', { verb: 'implement', card: 2 })
    const b = board()
    assert.deepEqual(cardCalls(), [
      `card refine 2 --follow --events --json --board ${b}`,
      `card resolve 2 --follow --events --json --board ${b} -- Monthly`,
      `card revise 2 --follow --events --json --board ${b} -- -- three tiers`,
      `card approve 2 --follow --events --json --board ${b}`,
      `card implement 2 --follow --events --json --board ${b}`,
    ])
    assert.equal(built.outcome, 'done', built.reason)
    assert.deepEqual(built.report, { reply: 'Landed it.', card: 2, landing: { commit, branch: 'main' } })
    assert.ok(fs.existsSync(path.join(b, '.archive', '2-pricing-page.md')))
    assert.match(cloud.file('.archive/2-pricing-page.md')!, /implement$/m, 'the archived card never reached Cloud')
    assert.equal(cloud.file('todo/2-pricing-page.md'), null, 'the card stayed in todo/ in Cloud')
    assert.equal(calls().filter((c) => c[1] === 'init').length, 1)
  })

  it('hands a discussion task\'s session and discussion to its planning, and reports the session it ended on (#2146)', async () => {
    process.env.FAKE_AKB = JSON.stringify({ refine: { result: 'Planned.', agentSession: 'ts1' }, resolve: { result: 'Done.', agentSession: 'ts2' } })
    const transcript = 'User: Tiers?\n\nAgent: Two.'
    const planned = await flowJob('j1', { verb: 'create' }, { resume: 'ds1', fork: true, transcript })
    assert.equal(planned.outcome, 'done', planned.reason)
    const b = board()
    const file = path.join(b, '.sync', 'task_1.discussion', 'discussion.md')
    assert.deepEqual(cardCalls(), [`card refine 2 --follow --events --json --session ds1 --fork --transcript ${file} --board ${b}`])
    assert.equal(fs.readFileSync(path.join(b, '.fake', 'transcript'), 'utf8'), `${transcript}\n`)
    assert.ok(!fs.existsSync(file), 'the discussion was left on the board')
    assert.equal((planned.report as { session?: string }).session, 'ts1')
    const answered = await flowJob('j2', { verb: 'resolve', card: 2, text: 'Monthly' }, { resume: 'ts1', transcript })
    assert.equal(cardCalls()[1], `card resolve 2 --follow --events --json --session ts1 --transcript ${file} --board ${b} -- Monthly`)
    assert.equal((answered.report as { session?: string }).session, 'ts2')
    await flowJob('j3', { verb: 'approve', card: 2 }, { resume: 'ts2', transcript })
    assert.equal(cardCalls()[2], `card approve 2 --follow --events --json --board ${b}`)
  })

  it('fails a build that stopped short, and reports one held on a question', async () => {
    await flowJob('j1', { verb: 'create' })
    process.env.FAKE_AKB = JSON.stringify({ implement: { failed: 'Review ran out of rounds.' } })
    const stopped = await flowJob('j2', { verb: 'implement', card: 2 })
    assert.equal(stopped.outcome, 'failed')
    assert.equal(stopped.reason, 'Review ran out of rounds.')
    process.env.FAKE_AKB = JSON.stringify({ implement: { failed: 'waiting on the user', question: 'Keep the old page?', landed: 'Asked one thing.' } })
    const held = await flowJob('j3', { verb: 'implement', card: 2 })
    assert.equal(held.outcome, 'done', held.reason)
    assert.deepEqual(held.report, {
      reply: 'Asked one thing.',
      card: 2,
      review: { question: 'Keep the old page?', options: ['Monthly', 'Yearly'], position: 2 },
    })
    process.env.FAKE_AKB = JSON.stringify({ implement: { result: 'Built it.', landed: 'Landed it.' } })
    const answered = await flowJob('j4', { verb: 'implement', card: 2, text: 'Keep the old page?\n\nNo' })
    assert.equal(answered.outcome, 'done', answered.reason)
    const log = fs.readFileSync(process.env.FAKE_AKB_LOG!, 'utf8').trim().split('\n').map((l) => JSON.parse(l).join(' '))
    const resolveAt = log.findIndex((l) => l.startsWith('card resolve 2 --follow --events --json'))
    assert.ok(resolveAt >= 0 && log.slice(resolveAt).some((l) => l.startsWith('card implement 2 --follow --events --json')),
      'the answer was not resolved before the build carried on')
  })

  it('stops a build whose delivery was cancelled, and fails one discarded or blocked with its reason (#59)', async () => {
    await flowJob('j1', { verb: 'create' })
    const ended = (record: Record<string, unknown>) =>
      JSON.stringify({ implement: { failed: 'delivery d1 did not land', ended: { deliveryId: 'd1', steps: [{ step: 'implement' }], ...record } } })
    process.env.FAKE_AKB = ended({ status: 'cancelled' })
    const cancelled = await flowJob('j2', { verb: 'implement', card: 2 })
    assert.equal(cancelled.outcome, 'stopped', cancelled.reason)
    process.env.FAKE_AKB = ended({ status: 'cancelled', steps: [{ step: 'implement' }, { step: 'discarded' }] })
    const discarded = await flowJob('j3', { verb: 'implement', card: 2 })
    assert.equal(discarded.outcome, 'failed')
    assert.equal(discarded.reason, 'The build was discarded.')
    process.env.FAKE_AKB = ended({ status: 'active', review: { rounds: [], stopped: { reason: 'landing', why: 'this could not be fitted onto the latest `main`: the API moved', at: 1 } } })
    const blocked = await flowJob('j4', { verb: 'implement', card: 2 })
    assert.equal(blocked.outcome, 'failed')
    assert.equal(blocked.reason, 'this could not be fitted onto the latest `main`: the API moved')
  })

  it('fails with akb’s own words when a verb is refused, or the run fails, and saves nothing', async () => {
    await flowJob('j1', { verb: 'create' })
    const saved = cloud.head
    process.env.FAKE_AKB = JSON.stringify({ approve: { refuse: '#2 has no stages, so there is nothing to approve.' } })
    const refused = await flowJob('j2', { verb: 'approve', card: 2 })
    assert.equal(refused.outcome, 'failed')
    assert.equal(refused.reason, '#2 has no stages, so there is nothing to approve.')
    process.env.FAKE_AKB = JSON.stringify({ revise: { failed: 'Claude Code hit its usage limit.\nat …' } })
    const failed = await flowJob('j3', { verb: 'revise', card: 2, text: 'shorter' })
    assert.equal(failed.outcome, 'failed')
    assert.equal(failed.reason, 'Claude Code hit its usage limit.')
    assert.equal(cloud.head, saved)
  })

  describe('stopping the board runs a build started (#2092)', () => {
    type FakeRun = { sessionId: string; status?: string; startedAt: number }
    const runsFile = () => path.join(board(), '.fake', 'runs.json')
    const runs = () => JSON.parse(fs.readFileSync(runsFile(), 'utf8')) as FakeRun[]
    const building = async () => {
      await flowJob('j1', { verb: 'create' })
      process.env.FAKE_AKB = JSON.stringify({ implement: { hang: true, chain: 2 } })
      const job = cloud.dispatch({ id: 'j2', task: 'task_1', project: 'prj_1', number: 2, runtime: 'claude-code', flow: { workflow: 'wf_builtin_coding', verb: 'implement', card: 2 } })
      await until(() => runs().some((r) => r.sessionId.startsWith('run-implement') && r.status === 'running'))
      // A run on the card the job did not start.
      fs.writeFileSync(runsFile(), JSON.stringify([...runs(), { sessionId: 'run-mine', cardId: 2, status: 'running', startedAt: 1 }]))
      return job
    }
    const stopsBuild = () => {
      const built = runs().filter((r) => r.sessionId.startsWith('run-implement'))
      // Each stop starts the delivery's next run until the chain is spent; all are stopped.
      assert.equal(built.length, 3)
      assert.ok(built.every((r) => r.status === 'stopped'))
      assert.equal(runs().find((r) => r.sessionId === 'run-mine')!.status, 'running')
      assert.ok(!calls().some((c) => c[0] === 'run' && c[1] === 'stop' && c[2] === 'run-mine'))
    }

    it('when the Runner closes, before it lets go of the account', async () => {
      const job = await building()
      const at = Date.now()
      await runner!.close()
      runner = null
      assert.ok(Date.now() - at < 3_000, 'closing waited past its limit')
      stopsBuild()
      assert.equal(cloud.runner!.live, false)
      assert.equal(job.state, 'claimed')
    })

    it('when the job’s lease is lost', async () => {
      const job = await building()
      job.leaseLost = true
      await until(() => runs().filter((r) => r.sessionId.startsWith('run-implement')).every((r) => r.status === 'stopped') && runs().length >= 5)
      stopsBuild()
    })

    it('when the user stops it, ending the job stopped (#2128)', async () => {
      const job = await building()
      cloud.stopOverLog('j2')
      await until(() => job.state === 'finished')
      assert.equal(job.outcome, 'stopped', job.reason)
      stopsBuild()
    })
  })

  describe('resuming a build (#2128)', () => {
    it('carries its ended delivery on, without resolving the answer again', async () => {
      await flowJob('j1', { verb: 'create' })
      const job = await flowJob('j2', { verb: 'implement', card: 2, text: 'Monthly', resume: true })
      assert.equal(job.outcome, 'done', job.reason)
      const log = calls().map((c) => c.join(' '))
      const at = log.indexOf(`delivery resume 2 --json --board ${board()}`)
      assert.ok(at >= 0 && log.slice(at).some((l) => l.startsWith('card implement 2 --follow')), 'the delivery was not resumed before the build')
      assert.ok(!cardCalls().some((c) => c.startsWith('card resolve')), 'the answer was resolved again')
    })

    it('builds on when the delivery is still in flight, and ends when it had landed', async () => {
      await flowJob('j1', { verb: 'create' })
      process.env.FAKE_AKB = JSON.stringify({ delivery: { refuse: 'delivery d1 has not ended — it is still in flight on #2.' } })
      assert.equal((await flowJob('j2', { verb: 'implement', card: 2, resume: true })).outcome, 'done')
      assert.ok(cardCalls().some((c) => c.startsWith('card implement 2')))
      process.env.FAKE_AKB = JSON.stringify({ delivery: { landed: true } })
      const landed = await flowJob('j4', { verb: 'implement', card: 2, resume: true })
      assert.equal(landed.outcome, 'done', landed.reason)
      assert.deepEqual(landed.report, { card: 2 })
    })
  })

  describe('stopping the board runs a force-quit Runner left (#2120)', () => {
    type FakeRun = { sessionId: string; cardId: number; status?: string; startedAt: number }
    const runsFile = () => path.join(board(), '.fake', 'runs.json')
    const runs = () => JSON.parse(fs.readFileSync(runsFile(), 'utf8')) as FakeRun[]
    const leaveRun = () =>
      fs.writeFileSync(runsFile(), JSON.stringify([...runs(), { sessionId: 'run-left', cardId: 2, action: 'refine', status: 'running', startedAt: 1 }]))
    const stops = () => calls().filter((c) => c[0] === 'run' && c[1] === 'stop').map((c) => c[2])

    it('when the Runner restarts under a job it held', async () => {
      await flowJob('j1', { verb: 'create' })
      await runner!.close()
      runner = null
      leaveRun()
      const job = cloud.dispatch({ id: 'j2', state: 'claimed', machine: MACHINE, task: 'task_1', project: 'prj_1', number: 2, runtime: 'claude-code', flow: { workflow: 'wf_builtin_coding', verb: 'implement', card: 2 } })
      cloud.runner = { machineId: MACHINE, machineName: 'studio', live: true }
      start()
      await until(() => job.state === 'finished')
      assert.match(job.reason!, /restarted/)
      assert.equal(runs().find((r) => r.sessionId === 'run-left')!.status, 'stopped')
    })

    it('before a job works on the card, which then runs as usual', async () => {
      await flowJob('j1', { verb: 'create' })
      leaveRun()
      const job = await flowJob('j2', { verb: 'revise', card: 2, text: 'shorter' })
      assert.equal(job.outcome, 'done', job.reason)
      assert.equal(runs().find((r) => r.sessionId === 'run-left')!.status, 'stopped')
      const log = calls().map((c) => c.slice(0, 2).join(' '))
      assert.ok(log.indexOf('run stop') < log.indexOf('card revise'))
    })

    it('but not one another job here is working on', async () => {
      await flowJob('j1', { verb: 'create' })
      process.env.FAKE_AKB = JSON.stringify({ implement: { hang: true } })
      cloud.dispatch({ id: 'j2', task: 'task_1', project: 'prj_1', number: 2, runtime: 'claude-code', flow: { workflow: 'wf_builtin_coding', verb: 'implement', card: 2 } })
      await until(() => runs().some((r) => r.sessionId.startsWith('run-implement') && r.status === 'running'))
      const job = await flowJob('j3', { verb: 'revise', card: 2, text: 'shorter' })
      assert.equal(job.outcome, 'failed')
      assert.equal(job.reason, '#2 is already being worked on')
      assert.deepEqual(stops(), [])
      assert.ok(runs().some((r) => r.sessionId.startsWith('run-implement') && r.status === 'running'))
    })
  })

  it('runs on the runtime’s connector and model, and fails rather than switch when it is missing (#2074)', async () => {
    const used = await flowJob('j1', { verb: 'create' }, { runtime: 'codex', model: 'gpt-5-codex' })
    assert.equal(used.outcome, 'done', used.reason)
    assert.deepEqual(calls().find((c) => c[0] === 'agent')!.slice(0, 3), ['agent', 'use', 'codex'])
    assert.deepEqual(calls().find((c) => c[1] === 'set' && c[2] === 'model')!.slice(0, 4), ['agent', 'set', 'model', 'gpt-5-codex'])
    installed = [{ name: 'codex', installed: true }, { name: 'claude-code', installed: false }]
    const missing = await flowJob('j2', { verb: 'approve', card: 2 })
    assert.equal(missing.outcome, 'failed')
    assert.equal(missing.reason, 'Claude Code is not installed on this computer.')
    installed = [{ name: 'codex', installed: true }, { name: 'claude-code', installed: true, loggedIn: false }]
    const signedOut = await flowJob('j3', { verb: 'approve', card: 2 })
    assert.equal(signedOut.reason, 'Claude Code is not signed in on this computer.')
    assert.equal(calls().filter((c) => c[0] === 'agent' && c[1] === 'use').length, 1, 'a missing connector was swapped for the other')
  })

  it('runs a built-in on akb’s own workflow, and an account’s own from its folder', async () => {
    cloud.task.workflow = { workflow: 'wf_builtin_hyperframes_video', version: 1, files: { 'WORKFLOW.md': 'x' }, builtin: true }
    await flowJob('j1', { verb: 'create', workflow: 'wf_builtin_hyperframes_video' })
    assert.equal(calls().find((c) => c[1] === 'create')![5], 'hyperframes-video')
    assert.ok(!fs.existsSync(path.join(board(), 'agents')), 'a built-in’s agents were written')

    cloud.task = { artifacts: new Map(), workflow: { workflow: 'wf_7Kx', version: 1, files: { 'WORKFLOW.md': 'own' } } }
    await flowJob('j2', { verb: 'create', workflow: 'wf_7Kx' }, { task: 'task_2', number: 3 })
    assert.equal(calls().filter((c) => c[1] === 'create').at(-1)![5], 'wf-7kx')
    assert.equal(fs.readFileSync(path.join(board(), 'workflows', 'wf-7kx', 'WORKFLOW.md'), 'utf8'), 'own')
  })

  it('gives this run alone the MCP servers the workflow declares (#2030)', async () => {
    const servers = { mcpServers: { files: { command: 'npx', args: ['-y', '@acme/files'] } } }
    cloud.task.workflow = { workflow: 'wf_builtin_coding', version: 1, builtin: true, files: { 'WORKFLOW.md': 'x', 'mcp.json': JSON.stringify(servers) } }
    await flowJob('j1', { verb: 'create' })
    const file = path.join(board(), '.sync', 'task_1.mcp.json')
    assert.deepEqual(calls().find((c) => c[1] === 'set' && c[2] === 'args'), ['agent', 'set', 'args', '--board', board(), '--', `--mcp-config ${file}`])
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), servers)

    assert.equal(
      mcpArgs('codex', servers.mcpServers, file),
      `-c 'mcp_servers.files.command="npx"' -c 'mcp_servers.files.args=["-y","@acme/files"]'`,
    )

    cloud.put({ 'workflows/wf-builtin-coding/mcp.json': null })
    await flowJob('j2', { verb: 'refine', card: 2 })
    assert.deepEqual(calls().filter((c) => c[1] === 'set' && c[2] === 'args').at(-1), ['agent', 'set', 'args', '--board', board()], 'the servers outlived the version')
  })

  it('hands an ACP runtime the MCP servers as its mcpConfig, not as arguments', async () => {
    installed = [{ name: 'opencode', installed: true }]
    const servers = { mcpServers: { files: { command: 'npx', args: ['-y', '@acme/files'] } } }
    cloud.task.workflow = { workflow: 'wf_builtin_coding', version: 1, builtin: true, files: { 'WORKFLOW.md': 'x', 'mcp.json': JSON.stringify(servers) } }
    const job = await flowJob('j1', { verb: 'create' }, { runtime: 'opencode' })
    assert.equal(job.outcome, 'done', job.reason)
    const file = path.join(board(), '.sync', 'task_1.mcp.json')
    assert.deepEqual(calls().find((c) => c[1] === 'set' && c[2] === 'args'), ['agent', 'set', 'args', '--board', board()])
    assert.deepEqual(calls().find((c) => c[1] === 'set' && c[2] === 'mcpConfig'), ['agent', 'set', 'mcpConfig', file, '--board', board()])
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), servers)
  })

  it('numbers the card with the task\'s number, and names the task to akb (#2063)', async () => {
    const job = await flowJob('j1', { verb: 'create' }, { number: 12 })
    assert.equal(job.outcome, 'done', job.reason)
    const create = calls().find((c) => c[0] === 'raw' && c[1] === 'create')!
    assert.deepEqual(create.slice(create.indexOf('--id'), create.indexOf('--id') + 2), ['--id', '12'])
    assert.equal(job.report!.card, 12)
    assert.ok(cloud.file('todo/12-pricing-page.md'))
    assert.equal(fs.readFileSync(path.join(board(), '.fake', 'task-env'), 'utf8'), 'task_1')
  })

  it('takes the card holding the task\'s number as its own, whatever its slug (#2108)', async () => {
    cloud.put({ 'todo/2-pricing/root.md': '---\ntitle: Pricing\nquestions: []\n---\n\nSplit.\n' })
    const job = await flowJob('j1', { verb: 'revise', text: 'shorter' })
    assert.equal(job.outcome, 'done', job.reason)
    assert.equal(job.report!.card, 2)
    assert.match(cloud.file('todo/2-pricing/root.md')!, /revise shorter\n$/)
  })

  it('writes a first step\'s card fields, naming only the cards still open here (#2108)', async () => {
    cloud.put({ 'todo/5-open.md': '---\ntitle: Open\nquestions: []\n---\n', '.archive/6-done.md': '---\ntitle: Done\n---\n' })
    const metadata = { priority: 'high', roi: 'low', modules: ['web', 'cli'], related: ['WC-5', 'WC-6'], blocked_by: ['WC-5'] }
    const job = await flowJob('j1', { verb: 'create', metadata })
    assert.equal(job.outcome, 'done', job.reason)
    const create = calls().find((c) => c[0] === 'raw' && c[1] === 'create')!
    const flag = (name: string) => create[create.indexOf(name) + 1]
    assert.deepEqual([flag('--priority'), flag('--roi'), flag('--modules'), flag('--related'), flag('--blocked-by')], ['high', 'low', 'web,cli', '5', '5'])
  })

  it('makes no card for a task Cloud has not numbered (#2105)', async () => {
    const job = await flowJob('j1', { verb: 'create' }, { number: null })
    assert.equal(job.outcome, 'failed')
    assert.ok(!calls().some((c) => c[0] === 'raw' && c[1] === 'create'))
  })

  it('works on the card another computer wrote (#2081)', async () => {
    cloud.put({ 'todo/9-task-1.md': '---\ntitle: From elsewhere\nquestions: []\n---\n\nThe plan.\n' })
    const job = await flowJob('j1', { verb: 'revise', card: 9, text: 'shorter' }, { number: 9 })
    assert.equal(job.outcome, 'done', job.reason)
    assert.ok(!calls().some((c) => c[1] === 'create'))
    assert.equal(job.report!.card, 9)
    assert.match(cloud.file('todo/9-task-1.md')!, /The plan\.\n\nrevise shorter\n$/)
  })

  it('works in a project’s own board', async () => {
    const project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'site-')))
    spawnSync('git', ['init', '-q', project])
    fs.writeFileSync(path.join(runnerHome(), 'projects.json'), JSON.stringify({ projects: [project] }))
    const job = await flowJob('j1', { verb: 'create' }, { projectDir: project })
    assert.equal(job.outcome, 'done', job.reason)
    assert.ok(fs.existsSync(path.join(project, '.akb', 'kanban', 'todo', '2-pricing-page.md')))
    assert.ok(!fs.existsSync(cached()))
    assert.ok(fs.existsSync(path.join(project, '.claude', 'skills', 'kanban', 'SKILL.md')), 'the kanban skill was not installed')
    assert.equal(spawnSync('git', ['-C', project, 'status', '--porcelain'], { encoding: 'utf8' }).stdout, '', 'the skill or board reached git')
  })

  describe('a Workflow builder task (#2004)', () => {
    const BUILDER = 'wf_builtin_workflow_builder'
    const DRAFT = 'workflows/task-1/'
    const WORKFLOW = '---\nname: Report\npreviews: [writer]\n---\n'
    const AGENT = '---\nname: writer\ndescription: Writes it.\n---\n\nWrite it.\n'
    const written = { [`${DRAFT}WORKFLOW.md`]: WORKFLOW, 'agents/writer/AGENT.md': AGENT }

    it('places a new one, names its folder on the card, and sends it back with its agents', async () => {
      process.env.FAKE_AKB = JSON.stringify({ refine: { result: 'Wrote it.', writes: written } })
      cloud.task.title = '每周竞品周报'
      const job = await flowJob('j1', { verb: 'create', workflow: BUILDER })
      assert.equal(job.outcome, 'done', job.reason)
      assert.match(cloud.file('todo/2-task.md')!, /<!-- workflow folder: \.akb\/kanban\/workflows\/task-1\/ -->/)
      const files = { 'WORKFLOW.md': WORKFLOW, 'agents/writer/AGENT.md': AGENT }
      assert.deepEqual((job.report?.workflow as { files: unknown }).files, files)
      assert.equal(cloud.file(`${DRAFT}agents/writer/AGENT.md`), AGENT)
    })

    it('starts a new one as the task\'s title with no agents', async () => {
      process.env.FAKE_AKB = JSON.stringify({ refine: { result: 'Left it.' } })
      cloud.task.title = 'Job posts'
      const job = await flowJob('j1', { verb: 'create', workflow: BUILDER })
      assert.equal(job.outcome, 'done', job.reason)
      assert.match(cloud.file(`${DRAFT}WORKFLOW.md`)!, /^---\nname: Job posts\nneedsArtifact: false\n---\n$/)
    })

    it('changes one of the user\'s own in place, its agents laid out for akb', async () => {
      cloud.task.context = { workflow: 'wf_own' }
      cloud.workflows.wf_own = { 'WORKFLOW.md': WORKFLOW, 'agents/writer/AGENT.md': AGENT }
      process.env.FAKE_AKB = JSON.stringify({ refine: { result: 'Changed it.', writes: { 'agents/writer/AGENT.md': AGENT.replace('Write it.', 'Write it short.') } } })
      const job = await flowJob('j1', { verb: 'create', workflow: BUILDER })
      assert.equal(job.outcome, 'done', job.reason)
      assert.match((job.report?.workflow as { files: Record<string, string> }).files['agents/writer/AGENT.md']!, /Write it short\./)

      fs.rmSync(path.join(board(), 'agents'), { recursive: true, force: true })
      process.env.FAKE_AKB = JSON.stringify({ revise: { result: 'Again.' } })
      const again = await flowJob('j2', { verb: 'revise', workflow: BUILDER, card: 2, text: 'Shorter' })
      assert.equal(again.outcome, 'done', again.reason)
      assert.match(fs.readFileSync(path.join(board(), 'agents', 'writer', 'AGENT.md'), 'utf8'), /Write it short\./)
    })

    it('fails the job with what akb found, and sends nothing back', async () => {
      process.env.FAKE_AKB = JSON.stringify({ refine: { writes: written }, specProblems: ['.akb/kanban/agents/writer/AGENT.md: no description'] })
      const job = await flowJob('j1', { verb: 'create', workflow: BUILDER })
      assert.equal(job.outcome, 'failed')
      assert.match(job.reason!, /^The workflow has a problem: .*agents\/writer\/AGENT\.md: no description/)
      assert.equal(cloud.file(`${DRAFT}WORKFLOW.md`), null)
    })
  })
})

describe('periodic agents on the Runner (#2068)', () => {
  let project = ''
  const board = () => path.join(project, '.akb', 'kanban')
  const periodic = () => JSON.parse(fs.readFileSync(path.join(board(), '.fake', 'periodic'), 'utf8'))
  const agent = (over: Record<string, unknown>) =>
    ({ cadence: 'auto', fallback: '1d', since: null, lastSuccess: null, attempts: [], newWork: true, ...over })

  beforeEach(() => {
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'periodic-'))
    fs.writeFileSync(path.join(runnerHome(), 'projects.json'), JSON.stringify({ projects: [project] }))
    cloud.folders = [{ project: 'prj_1', name: 'Site', path: project, notify: true, machine: MACHINE }]
    cloud.task = { artifacts: new Map() }
  })
  afterEach(() => fs.rmSync(project, { recursive: true, force: true }))

  it('is due by this computer\'s clock: on its gap, with something new, and never twice at once', () => {
    const now = Date.parse('2026-10-26T10:00:00')
    const at = (h: number) => new Date(now - h * 3_600_000).toISOString()
    const prune = (over: Record<string, unknown>) => agentDue(agent({ name: 'prune-memory', fallback: '7d', ...over }) as never, now)
    assert.equal(prune({}), true, 'one never run was not due')
    assert.equal(prune({ since: at(1) }), false, 'one first seen an hour ago was due')
    assert.equal(prune({ lastSuccess: at(24 * 8) }), true)
    assert.equal(prune({ lastSuccess: at(24 * 8), attempts: [{ startedAt: at(1), status: 'error' }] }), false, 'a failure was retried at once')
    assert.equal(prune({ attempts: [{ startedAt: at(0), status: 'running' }] }), false, 'a second ran beside the first')
    assert.equal(agentDue(agent({ name: 'qa-manager', cadence: '1d at 09:30', lastSuccess: at(25) }) as never, now), true)
    assert.equal(agentDue(agent({ name: 'qa-manager', cadence: '1d at 09:30', lastSuccess: at(25), newWork: false }) as never, now), false)
  })

  it('asks for what is due, runs it on the project\'s board, and sends the memory back', async () => {
    cloud.periodic = [agent({ name: 'prune-memory', fallback: '7d' }), agent({ name: 'describe-project', lastSuccess: new Date().toISOString() })]
    start()
    await until(() => cloud.jobs.get('agent-1')?.state === 'finished')
    const job = cloud.jobs.get('agent-1')!
    assert.equal(job.outcome, 'done', job.reason)
    assert.deepEqual(cloud.asked[0], { project: 'prj_1', agent: 'prune-memory', workflow: null, seen: null })
    assert.ok(cloud.asked.every((a) => a.agent === 'prune-memory'), 'an agent with nothing new was asked for')
    assert.deepEqual(periodic().args.slice(0, 1), ['prune-memory'])
    assert.equal(cloud.file('memory/prune-memory.md'), 'prune-memory ran.\n')
  })

  it('reflects on the tasks it was handed, proposing from the first', async () => {
    process.env.FAKE_AKB = JSON.stringify({ reflect: { propose: 'Add a pricing FAQ' } })
    cloud.put({ '.archive/7-task-7.md': '---\ntitle: Pricing\n---\n\nTiers.\n' })
    const job = cloud.dispatch({ id: 'r1', project: 'prj_1', projectDir: project, agent: { name: 'reflect', tasks: [{ id: 'task_7', number: 7 }, { id: 'task_8', number: 8 }] } })
    start()
    await until(() => job.state === 'finished')
    assert.equal(job.outcome, 'done', job.reason)
    assert.deepEqual(periodic(), { args: [...periodic().args.slice(0, 1), '--cards', '7', '8', ...periodic().args.slice(4)], task: 'task_7' })
    assert.match(cloud.file('triage/proposed.md')!, /title: Add a pricing FAQ\n[\s\S]*source_task: task_7\n/)
  })

  it('gives a periodic agent the agents of the project’s workflows, so pruning keeps their memory (#2106)', async () => {
    cloud.put({
      'workflows/wf-own/WORKFLOW.md': '---\nname: Blog\n---\n',
      'workflows/wf-own/agents/seo-writer/AGENT.md': 'Write.',
      'memory/agents/seo-writer/notes.md': 'Keep',
      'memory/agents/gone/notes.md': 'Orphan',
    })
    const job = cloud.dispatch({ id: 'p1', project: 'prj_1', projectDir: project, agent: { name: 'prune-memory' } })
    start()
    await until(() => job.state === 'finished')
    assert.equal(job.outcome, 'done', job.reason)
    assert.equal(fs.readFileSync(path.join(board(), 'agents', 'seo-writer', 'AGENT.md'), 'utf8'), 'Write.')
    assert.equal(cloud.file('memory/agents/seo-writer/notes.md'), 'Keep')
    assert.equal(cloud.file('memory/agents/gone/notes.md'), null)
  })

  it('pulls the project\'s board before an idea conversation on its folder (#2110)', async () => {
    cloud.put({ 'todo/4-pricing.md': '---\ntitle: Pricing\n---\n\nTiers.\n' })
    const job = cloud.dispatch({ id: 'd1', project: 'prj_1', projectDir: project, discussion: { id: 'dsc_1', workspace: 'ws_1', ideas: [] } })
    start(`const fs = require('node:fs'); const path = require('node:path');
      if (process.env.AI4KANBAN_BOARD !== ${JSON.stringify(path.join(fs.realpathSync(project), '.akb', 'kanban'))}) process.exit(4);
      if (!fs.existsSync(path.join(process.env.AI4KANBAN_BOARD, 'todo', '4-pricing.md'))) process.exit(5)`)
    await until(() => job.state === 'finished')
    assert.equal(job.outcome, 'done', job.reason)
  })

  it('runs a workflow\'s scheduled agent by its akb name, and fails a project with no folder here', async () => {
    const qa = cloud.dispatch({ id: 'q1', project: 'prj_1', projectDir: project, agent: { name: 'qa-manager', workflow: 'wf_builtin_coding' } })
    const away = cloud.dispatch({ id: 'q2', project: 'prj_1', projectDir: null, agent: { name: 'prune-memory' } })
    start()
    await until(() => qa.state === 'finished' && away.state === 'finished')
    assert.equal(qa.outcome, 'done', qa.reason)
    assert.deepEqual(periodic().args.slice(0, 4), ['agent', 'run', 'coding', 'qa-manager'])
    assert.equal(away.outcome, 'failed')
    assert.equal(away.reason, 'This project has no folder on this computer.')
  })
})

describe('chat memory reviewed on the Runner (#2065)', () => {
  const board = () => path.join(cached(), '.akb', 'kanban')
  const record = (task = 'task_1') => path.join(runnerHome(), 'chats', `${task}.jsonl`)
  const lines = (task = 'task_1') => fs.readFileSync(record(task), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  const reviewed = () => JSON.parse(fs.readFileSync(path.join(runnerHome(), 'chats', 'reviewed.json'), 'utf8'))
  const said = (task: string, ...messages: [string, string, number?][]) => {
    fs.mkdirSync(path.dirname(record(task)), { recursive: true })
    fs.appendFileSync(record(task), messages.map(([id, text, at]) =>
      `${JSON.stringify({ id, role: id.startsWith('msg') ? 'user' : 'agent', text, at: at ?? Date.now(), ...(id.startsWith('msg') ? {} : { runtime: 'codex', model: 'gpt-5' }) })}\n`).join(''))
  }

  beforeEach(() => {
    cloud.task = { artifacts: new Map() }
    cloud.put({ '.archive/1-task-1.md': '---\ntitle: Pricing\n---\n\nTiers.\n' })
  })

  it('keeps a chat’s reply beside the message it answers, and nothing of another job', async () => {
    const job = cloud.dispatch({ id: 'j1', task: 'task_1', project: 'prj_1', model: 'gpt-5', chat: { message: 'msg_1', body: 'Why tiers?' } })
    const other = cloud.dispatch({ id: 'j2', task: 'task_2', project: 'prj_1' })
    start()
    await until(() => job.state === 'finished' && other.state === 'finished')
    assert.equal(job.outcome, 'done', job.reason)
    assert.deepEqual(lines().map(({ at, ...l }) => l), [
      { id: 'msg_1', role: 'user', text: 'Why tiers?' },
      { id: 'j1', role: 'agent', text: 'Two tiers.', runtime: 'codex', model: 'gpt-5' },
    ])
    assert.ok(!fs.existsSync(record('task_2')))
  })

  it('drops what is past 30 days as it starts, and a chat left empty', async () => {
    const old = Date.now() - 31 * 24 * 60 * 60_000
    said('task_1', ['msg_1', 'Old', old], ['j1', 'Older reply', old], ['msg_2', 'New'])
    said('task_2', ['msg_3', 'Gone', old])
    start()
    assert.deepEqual(lines().map((l) => l.text), ['New'])
    assert.ok(!fs.existsSync(record('task_2')))
  })

  it('reviews once a day the archived chats it answered last, writing each memory to its own layer', async () => {
    said('task_1', ['msg_1', 'Always plain words.'], ['j1', 'Noted.'])
    said('task_9', ['msg_9', 'Answered here, not ours any more.'], ['j9', 'Ok.'])
    cloud.chats = [{ task: 'task_1', project: 'prj_1' }]
    start()
    await until(() => [...cloud.jobs.values()].some((j) => j.review && j.state === 'finished'))
    const job = [...cloud.jobs.values()].find((j) => j.review)!
    assert.equal(job.outcome, 'done', job.reason)
    assert.deepEqual(cloud.reviews, [{ project: 'prj_1', tasks: ['task_1'], runtime: 'codex', model: 'gpt-5' }])
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(board(), '.fake', 'reviewed'), 'utf8')), ['task_1'])
    assert.equal(cloud.shared('memory/agents/copywriting/style.md'), 'Style: Always plain words. / Noted.\n')
    assert.equal(cloud.file('memory/agents/copywriting/style.md'), null, 'workspace memory reached the project')
    assert.equal(cloud.file('memory/agents/copywriting/writing.md'), 'Writing: Always plain words. / Noted.\n')
    await until(() => reviewed().tasks?.task_1 === 'j1')

    // Not again the same day, and the next day only once something new was said.
    await new Promise((r) => setTimeout(r, 300))
    assert.equal(cloud.reviews.length, 1)
    fs.writeFileSync(path.join(runnerHome(), 'chats', 'reviewed.json'), JSON.stringify({ ...reviewed(), checkedAt: 0 }))
    await until(() => reviewed().checkedAt > 0)
    assert.equal(cloud.reviews.length, 1)
    said('task_1', ['msg_2', 'And short.'], ['j2', 'Noted.'])
    fs.writeFileSync(path.join(runnerHome(), 'chats', 'reviewed.json'), JSON.stringify({ ...reviewed(), checkedAt: 0 }))
    await until(() => reviewed().tasks?.task_1 === 'j2')
    assert.equal(cloud.reviews.length, 2)
  })

  it('reviews the chat as Cloud keeps it, with what another computer answered (#2110)', async () => {
    said('task_1', ['msg_2', 'And short.'], ['j2', 'Noted.'])
    cloud.taskChats = { task_1: [
      { id: 'msg_1', role: 'user', body: 'Always plain words.', created_at: new Date().toISOString() },
      { id: 'msg_a1', role: 'agent', body: 'Noted there.', created_at: new Date().toISOString() },
      { id: 'msg_2', role: 'user', body: 'And short.', created_at: new Date().toISOString() },
      { id: 'msg_a2', role: 'agent', body: 'Noted.', created_at: new Date().toISOString() },
    ] }
    cloud.chats = [{ task: 'task_1', project: 'prj_1' }]
    start()
    await until(() => [...cloud.jobs.values()].some((j) => j.review && j.state === 'finished'))
    assert.equal([...cloud.jobs.values()].find((j) => j.review)!.outcome, 'done')
    assert.equal(cloud.file('memory/agents/copywriting/writing.md'), 'Writing: Always plain words. / Noted there. / And short. / Noted.\n')
    await until(() => reviewed().tasks?.task_1 === 'msg_a2')
  })

  it('reviews nothing Cloud says another computer answered last', async () => {
    said('task_1', ['msg_1', 'Mine?'], ['j1', 'Yes.'])
    start()
    await until(() => fs.existsSync(path.join(runnerHome(), 'chats', 'reviewed.json')) && reviewed().checkedAt > 0)
    assert.deepEqual(cloud.reviews, [])
  })
})

describe('connection tests (#2074)', () => {
  const test = async (id: string, script: string, extra: Partial<FakeJob> = {}) => {
    const job = cloud.dispatch({ id, test: true, runtime: 'claude-code', model: 'haiku', prompt: 'Reply with OK.', ...extra })
    if (!runner) start(script)
    await until(() => job.state === 'finished')
    return job
  }

  it('sends the prompt alone on the connector and model, and reports how long it took', async () => {
    const job = await test('t1', 'console.log("OK")')
    assert.equal(job.outcome, 'done', job.reason)
    assert.equal(typeof job.report?.ms, 'number')
    assert.deepEqual(planned.map((p) => [p.runtime, p.model, p.prompt]), [['claude-code', 'haiku', 'Reply with OK.']])
  })

  it('names a connector that is missing or signed out, without starting it', async () => {
    installed = [{ name: 'codex', installed: false }, { name: 'claude-code', installed: true, loggedIn: false }]
    assert.equal((await test('t1', 'console.log("OK")', { runtime: 'codex' })).reason, 'not_installed')
    assert.equal((await test('t2', 'console.log("OK")')).reason, 'signed_out')
    assert.equal(planned.length, 0)
  })

  it('stops one that answers too late', async () => {
    const job = await test('t1', 'setTimeout(() => {}, 10_000)')
    assert.deepEqual([job.outcome, job.reason], ['failed', 'timeout'])
  })

  it('tells Cloud what it found before the test ends, so the page reads it fresh (#2087)', async () => {
    installed = [{ name: 'codex', installed: false }, { name: 'claude-code', installed: true }]
    const job = await test('t1', 'console.log("OK")', { runtime: 'codex' })
    assert.equal(job.reason, 'not_installed')
    assert.deepEqual(cloud.runtimes, installed)
  })

  it('holds an ACP runtime\'s turn, and stops one that answers too late', async () => {
    installed = [{ name: 'cursor', installed: true }]
    const ok = cloud.dispatch({ id: 't1', test: true, runtime: 'cursor', prompt: 'Reply with OK.' })
    start('', { plan: acpRuntime() })
    await until(() => ok.state === 'finished')
    assert.equal(ok.outcome, 'done', ok.reason)
    await runner!.close()
    runner = null
    const late = cloud.dispatch({ id: 't2', test: true, runtime: 'cursor', prompt: 'Reply with OK.' })
    start('', { plan: acpRuntime({ ACP_HANG: '1' }) })
    await until(() => late.state === 'finished')
    assert.deepEqual([late.outcome, late.reason], ['failed', 'timeout'])
  })

  it('reports what a failing connector said', async () => {
    const job = await test('t1', 'console.error("model haiku not found"); process.exit(1)')
    assert.equal(job.outcome, 'failed')
    assert.equal(job.reason, 'model haiku not found')
  })
})

describe('the real runtimes', () => {
  it('lists the models Codex shows in its own picker (#2087)', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'codex-')), 'models_cache.json')
    fs.writeFileSync(file, JSON.stringify({ models: [
      { slug: 'gpt-a', display_name: 'GPT-A', visibility: 'list' },
      { slug: 'gpt-hidden', display_name: 'Hidden', visibility: 'hide' },
      { slug: 'gpt-b', visibility: 'list' },
    ] }))
    assert.deepEqual(codexModels(file), [{ id: 'gpt-a', name: 'GPT-A' }, { id: 'gpt-b', name: 'gpt-b' }])
    assert.deepEqual(codexModels(path.join(os.tmpdir(), 'no-such-cache.json')), [])
  })

  it("lists the main models of Claude Code's own picker (#85)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-catalog-'))
    const catalog = (surface: string, fetchedAt: number, models: unknown[]) => ({
      version: 2,
      fetchedAt,
      catalog: { surface, config: { models, provider_alias_targets: { opus: { default: 'claude-opus-5-5' }, fable: { default: 'claude-fable-5-1' } } } },
    })
    fs.writeFileSync(path.join(dir, 'a-cc.json'), JSON.stringify(catalog('cc', 2, [
      { id: 'claude-opus-5-5', name: 'Opus 5.5', short_name: 'Opus', section: 'main', runtime: { family: 'opus' } },
      { id: 'claude-fable-5-1', name: 'Fable 5.1', short_name: 'Fable', section: 'main', runtime: { family: 'fable' } },
      { id: 'claude-new-1', name: 'New 1', section: 'main' },
      { id: 'claude-opus-5', name: 'Opus 5', short_name: 'Opus', section: 'overflow', runtime: { family: 'opus' } },
    ])))
    fs.writeFileSync(path.join(dir, 'b-cc.json'), JSON.stringify(catalog('cc', 1, [{ id: 'claude-old', short_name: 'Old', section: 'main' }])))
    fs.writeFileSync(path.join(dir, 'c-ccd.json'), JSON.stringify(catalog('ccd', 3, [{ id: 'claude-desk', short_name: 'Desk', section: 'main' }])))
    fs.writeFileSync(path.join(dir, 'broken.json'), '{')
    assert.deepEqual(claudeModels(dir), [{ id: 'opus', name: 'Opus' }, { id: 'fable', name: 'Fable' }, { id: 'claude-new-1', name: 'New 1' }])
    assert.deepEqual(claudeModels(path.join(dir, 'missing')), [])
  })

  it('reads the cached model lists again on every heartbeat, keeping the sign-in (#86)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-config-'))
    const was = process.env.CLAUDE_CONFIG_DIR
    process.env.CLAUDE_CONFIG_DIR = dir
    try {
      installed = [{ name: 'claude-code', installed: true, loggedIn: true }, { name: 'cursor', installed: true, loggedIn: true, models: [{ id: 'c1', name: 'C1' }] }]
      start()
      const report = (name: string) => ((cloud.runtimes ?? []) as RuntimeReport[]).find((r) => r.name === name)
      const claude = () => report('claude-code')
      await until(() => claude()?.models?.[0]?.id === 'opus')
      fs.mkdirSync(path.join(dir, 'cache', 'model-catalog'), { recursive: true })
      fs.writeFileSync(path.join(dir, 'cache', 'model-catalog', 'cc.json'), JSON.stringify({
        fetchedAt: 1,
        catalog: { surface: 'cc', config: { models: [{ id: 'claude-new-1', short_name: 'New', section: 'main' }] } },
      }))
      await until(() => claude()?.models?.[0]?.id === 'claude-new-1')
      assert.equal(claude()!.loggedIn, true)
      assert.deepEqual(report('cursor')!.models, [{ id: 'c1', name: 'C1' }])
    } finally {
      if (was === undefined) delete process.env.CLAUDE_CONFIG_DIR
      else process.env.CLAUDE_CONFIG_DIR = was
    }
  })

  it('lists the models OpenCode and Cursor offer (#2084)', () => {
    assert.deepEqual(opencodeModels('opencode/big-pickle\nanthropic/claude-opus-5\n\nWarning: x\n'), [
      { id: 'opencode/big-pickle', name: 'opencode/big-pickle' },
      { id: 'anthropic/claude-opus-5', name: 'anthropic/claude-opus-5' },
    ])
    assert.deepEqual(acpModels({ models: { availableModels: [
      { modelId: 'default[]', name: 'Auto' },
      { modelId: 'gpt-5.5[context=272k]', name: 'gpt-5.5' },
    ] } }), [{ id: 'gpt-5.5[context=272k]', name: 'gpt-5.5' }])
  })

  it('drives OpenCode and Cursor over ACP, with nothing after the subcommand', () => {
    for (const [runtime, command] of [['opencode', 'opencode'], ['cursor', 'cursor-agent']] as const) {
      const p = plan(runtime, 'Build it', os.tmpdir(), null, 'm1')
      assert.equal(p.command, command)
      assert.equal(p.args.at(-1), 'acp')
      assert.ok(p.converse && !p.renderer)
    }
  })

  it('picks the model the way each connector’s own setting does', () => {
    assert.ok(plan('claude-code', 'x', os.tmpdir(), null, 'haiku').args.join(' ').includes('--model haiku'))
    assert.ok(plan('codex', 'x', os.tmpdir(), null, 'gpt-5-codex').args.join(' ').includes('--model gpt-5-codex'))
    assert.ok(!plan('codex', 'x', os.tmpdir()).args.includes('--model'))
  })

  it('runs Kimi Code, DSH, ZCode and Grok Build the way the board does (#2135)', () => {
    const kimi = plan('kimi', 'Build it', os.tmpdir(), null, 'k2')
    assert.equal(kimi.command, 'kimi')
    assert.ok(kimi.renderer && !kimi.converse)
    for (const runtime of ['dsh', 'zcode', 'grok'] as const) assert.ok(plan(runtime, 'Build it', os.tmpdir()).converse, runtime)
  })

  it('turns a runtime\'s settings and key into arguments and environment, by its provider (#2135)', () => {
    const settings = { provider: 'endpoint', baseUrl: 'https://llm.acme.internal/v1', reasoning: 'high', args: '--search' }
    const p = plan('codex', 'x', os.tmpdir(), null, 'gpt-5.1-codex', { settings, secrets: { apiKey: 'sk-test' } })
    const args = p.args.join(' ')
    assert.match(args, /model_provider="?endpoint/)
    assert.match(args, /model_providers\.endpoint\.base_url=https:\/\/llm\.acme\.internal\/v1/)
    assert.match(args, /--model gpt-5\.1-codex/)
    assert.match(args, /--search/)
    assert.ok(!args.includes('sk-test'))
    assert.equal(p.env.OPENAI_API_KEY, 'sk-test')
    // The subscription takes neither the address nor the key.
    const sub = plan('codex', 'x', os.tmpdir(), null, null, { settings: { ...settings, provider: 'subscription' }, secrets: { apiKey: 'sk-test' } })
    assert.ok(!sub.args.join(' ').includes('llm.acme.internal'))
    assert.equal(sub.env.OPENAI_API_KEY, process.env.OPENAI_API_KEY)
  })

  it('reports what each connector takes, never how it reaches a run (#2135)', async () => {
    const { detectRuntimes } = await import('../src/runtimes')
    const found = await detectRuntimes(true)
    assert.deepEqual(found.map((r) => r.name), ['claude-code', 'codex', 'cursor', 'opencode', 'kimi', 'dsh', 'zcode', 'grok'])
    const codex = found.find((r) => r.name === 'codex')!.settings!
    assert.ok(codex.some((s) => s.key === 'apiKey' && s.kind === 'secret'))
    assert.ok(codex.every((s) => !('env' in s) && !('flags' in s)))
    assert.ok(found.every((r) => r.settings?.some((s) => s.key === 'args')))
  })

  it('hands Codex its prompt last and Claude Code its prompt on stdin', () => {
    const codex = plan('codex', 'Build it', os.tmpdir())
    assert.equal(codex.command, 'codex')
    assert.ok(codex.args.includes('--json'))
    assert.equal(codex.args.at(-1), 'Build it')
    const claude = plan('claude-code', 'Build it', os.tmpdir())
    assert.equal(claude.command, 'claude')
    assert.ok(!claude.args.includes('Build it'))
    assert.match(claude.stdin!, /Build it/)
  })
})

describe('runtime keys (#2135)', () => {
  it('keeps a key job\'s key here alone, reports only that it is set, and runs with it', async () => {
    const job = cloud.dispatch({ id: 'k1', test: true, secret: true, secrets: { apiKey: 'sk-test' }, runtime: 'codex', runtimeId: 'rt_1', prompt: 'Keep it.' })
    start()
    await until(() => job.state === 'finished')
    assert.equal(job.outcome, 'done', job.reason)
    const file = path.join(runnerHome(), 'secrets.json')
    assert.equal(fs.statSync(file).mode & 0o777, 0o600)
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { rt_1: { apiKey: 'sk-test' } })
    assert.equal(planned.length, 0)
    await until(() => JSON.stringify(cloud.secrets) === JSON.stringify({ rt_1: ['apiKey'] }))

    const run = cloud.dispatch({ id: 'j1', runtime: 'codex', runtimeId: 'rt_1', settings: { provider: 'openai-api' }, prompt: 'go' })
    await until(() => run.state === 'finished')
    assert.deepEqual(planned.at(-1)!.settings, { settings: { provider: 'openai-api' }, secrets: { apiKey: 'sk-test' } })

    const clear = cloud.dispatch({ id: 'k2', test: true, secret: true, secrets: { apiKey: null }, runtime: 'codex', runtimeId: 'rt_1', prompt: 'Clear it.' })
    await until(() => clear.state === 'finished')
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), {})
  })
})

describe('a landed commit\'s diff (#2109)', () => {
  let dir: string
  const git = (...args: string[]) => spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).stdout.trim()
  const commitAll = (message: string) => {
    git('add', '-A', '-f')
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', message)
    return git('rev-parse', 'HEAD')
  }
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-diff-'))
    git('init', '-q')
    fs.writeFileSync(path.join(dir, 'old.txt'), 'one\ntwo\n')
    fs.writeFileSync(path.join(dir, 'gone.txt'), 'bye\n')
    commitAll('first')
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('reads each file against the first parent, leaving the board out', async () => {
    fs.writeFileSync(path.join(dir, 'old.txt'), 'one\n2\n')
    fs.rmSync(path.join(dir, 'gone.txt'))
    fs.writeFileSync(path.join(dir, 'new.txt'), 'hi\n')
    fs.writeFileSync(path.join(dir, 'pic.bin'), Buffer.from([0, 1, 2, 0]))
    fs.mkdirSync(path.join(dir, '.akb', 'kanban'), { recursive: true })
    fs.writeFileSync(path.join(dir, '.akb', 'kanban', 'card.md'), 'card\n')
    const answer = await diffOf(dir, commitAll('second'))
    assert.ok(!('gone' in answer))
    assert.equal(answer.truncated, false)
    assert.deepEqual(answer.files.map(({ patch: _patch, ...f }) => f), [
      { path: 'gone.txt', status: 'deleted', added: 0, removed: 1 },
      { path: 'new.txt', status: 'added', added: 1, removed: 0 },
      { path: 'old.txt', status: 'modified', added: 1, removed: 1 },
      { path: 'pic.bin', status: 'added', added: 0, removed: 0, binary: true },
    ])
    assert.equal(answer.files[2]!.patch, '@@ -1,2 +1,2 @@\n one\n-two\n+2\n')
    assert.equal(answer.files[3]!.patch, undefined)
  })

  it('sends only the file list for a change past the limits', async () => {
    fs.writeFileSync(path.join(dir, 'big.txt'), 'x'.repeat(FILE_BYTES))
    const answer = await diffOf(dir, commitAll('big'))
    assert.ok(!('gone' in answer))
    assert.equal(answer.truncated, true)
    assert.deepEqual(answer.files, [{ path: 'big.txt', status: 'added', added: 1, removed: 0 }])
  })

  it('answers gone for a commit this folder does not have', async () => {
    assert.deepEqual(await diffOf(dir, 'f'.repeat(40)), { gone: true })
    assert.deepEqual(await diffOf(null, git('rev-parse', 'HEAD')), { gone: true })
  })
})

describe('the presence connection (#2163)', () => {
  it('opens once registered, with the token as a subprotocol, and closes with the Runner', async () => {
    cloud.presence = true
    const r = start()
    await until(() => cloud.presences.some((p) => p.socket))
    assert.equal(cloud.presences[0]!.protocol, 'bearer, t')
    assert.equal(cloud.presences[0]!.machine, MACHINE)
    await r.close()
    runner = null
    await until(() => cloud.presences[0]!.socket!.destroyed)
  })

  it('pings, and reconnects when the connection drops', async () => {
    cloud.presence = true
    const presence = keepPresence(MACHINE, 30)
    try {
      await until(() => (cloud.presences[0]?.pings ?? 0) >= 2)
      cloud.presences[0]!.socket!.destroy()
      await until(() => cloud.presences.length === 2 && cloud.presences[1]!.pings >= 1, 8_000)
    } finally {
      presence.close()
    }
  })

  it('gives up quietly on a Cloud without it, and the Runner registers and runs jobs all the same', async () => {
    const job = cloud.dispatch({ id: 'j1' })
    start()
    await until(() => job.state === 'finished')
    assert.equal(job.outcome, 'done')
    const tried = cloud.presences.length
    assert.equal(tried, 1)
    await new Promise((r) => setTimeout(r, 1_500))
    assert.equal(cloud.presences.length, tried, 'it kept trying a route that is not there')
    assert.ok(cloud.registrations >= 2)
  })
})
