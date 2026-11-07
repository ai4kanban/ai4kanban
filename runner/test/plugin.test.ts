import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import os from 'node:os'
import { describe, it } from 'node:test'

import { markUnsent } from '../src/cache'
import { runnerHome, useRunnerHome } from '../src/home'
import { linesFor } from '../src/i18n'
import { nextOf, type Seen } from '../src/plugin'
import { holdMachine, lockPath } from '../src/lock'
import { FakeCloud, writeFakeSession } from './fake-cloud'

// The Claude Code (#2161) and Codex (#2160) plugins: one process per computer runs the jobs, and
// their component speaks MCP on stdout and ends with its host.

const until = async (check: () => boolean, ms = 3_000) => {
  const end = Date.now() + ms
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 20))
  }
}

describe('one Runner per computer', () => {
  it('lets one process hold the computer and hands it on when that one lets go', async () => {
    const held: string[] = []
    let waited: string | null = null
    const first = holdMachine('claude-code', () => held.push('first'))
    await until(() => held.length === 1)
    const second = holdMachine('terminal', () => held.push('second'), (holder) => (waited = holder ?? 'unknown'))
    await until(() => waited !== null)
    assert.equal(waited, 'claude-code')
    assert.deepEqual(held, ['first'])
    first.release()
    await until(() => held.length === 2)
    assert.deepEqual(held, ['first', 'second'])
    second.release()
  })

  it('says the holder is unknown when it does not tell its kind', async () => {
    if (process.platform === 'win32') return
    fs.mkdirSync(path.dirname(lockPath()), { recursive: true })
    fs.rmSync(lockPath(), { force: true })
    const silent = net.createServer((peer) => peer.on('error', () => {})).listen(lockPath())
    await new Promise((r) => silent.once('listening', r))
    let waited: string | null = null
    const lock = holdMachine('terminal', () => {}, (holder) => (waited = holder ?? 'unknown'))
    await until(() => waited !== null)
    assert.equal(waited, 'unknown')
    assert.match(linesFor(false).waitingHere(), /^Another app on this computer is already running/)
    assert.match(linesFor(true).waitingHere('terminal'), /^本机终端已在运行一个 WildCrane 实例/)
    lock.release()
    await new Promise((r) => silent.close(r))
  })

  it('takes over from a holder that crashed and left its socket behind', async () => {
    if (process.platform === 'win32') return
    fs.mkdirSync(path.dirname(lockPath()), { recursive: true })
    const crashed = spawn(process.execPath, ['-e', `require('net').createServer().listen(${JSON.stringify(lockPath())}, () => console.log('up'))`])
    await new Promise((r) => crashed.stdout.once('data', r))
    crashed.kill('SIGKILL')
    await new Promise((r) => crashed.once('exit', r))
    assert.ok(fs.existsSync(lockPath()))
    let held = false
    const lock = holdMachine('terminal', () => (held = true))
    await until(() => held)
    lock.release()
  })
})

/** The built component of `host`'s plugin, spoken to over stdio. */
function component(host: 'claude-code' | 'codex', cloud = 'http://127.0.0.1:9', env: Record<string, string> = {}) {
  const server = path.join(process.env.RUNNER_DIST!, '..', '..', 'plugins', host, 'server', 'dist', 'index.mjs')
  const child = spawn(process.execPath, [server, ...(host === 'codex' ? ['codex'] : [])], {
    stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, CLAUDE_PLUGIN_ROOT: path.resolve(path.dirname(server), '..', '..'), AI4KANBAN_CLOUD_URL: cloud, HTTPS_PROXY: 'http://127.0.0.1:9', ...env },
  })
  const answers = new Map<number, Record<string, unknown>>()
  let buffer = ''
  child.stdout.on('data', (d) => {
    buffer += d
    for (let i; (i = buffer.indexOf('\n')) >= 0; buffer = buffer.slice(i + 1)) {
      const message = JSON.parse(buffer.slice(0, i)) as { id: number }
      answers.set(message.id, message)
    }
  })
  const send = (id: number, method: string, params: unknown) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
  const ready = (async () => {
    send(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } })
    await until(() => answers.has(1))
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`)
  })()
  return { child, answers, send, ready }
}

describe("the Codex status's next line", () => {
  const newer = { version: '0.1.4', latest: '0.1.5' }
  const current = { version: '0.1.5', latest: null }
  const ready = { label: 'Codex', state: 'ready' as const, command: null }
  const out = { label: 'Codex', state: 'signedOut' as const, command: 'codex login' }
  const missing = { label: 'Claude Code', state: 'notInstalled' as const, command: 'npm install -g @anthropic-ai/claude-code' }
  const seen = (over: Partial<Seen> = {}): Seen => ({ connections: [ready], folder: { project: 'p1' }, refused: null, web: 'https://app.wildcrane.ai', ...over })

  it('tells Codex about a newer release, the outdated Runner first, and leaves Claude Code to its panel', () => {
    const next = nextOf('codex', 'running', newer)
    assert.match(String(next), /0\.1\.5 is out; this computer has 0\.1\.4, and tasks still run/)
    assert.match(String(next), /releases\/tag\/plugin-v0\.1\.5/)
    assert.equal(nextOf('codex', 'running', { version: '0.1.4', latest: null }), null)
    assert.match(String(nextOf('codex', 'outdated', newer)), /tasks no longer run/)
    assert.equal(nextOf('claude-code', 'running', newer), null)
  })

  it('names every tool not ready with its command, and the web, when none is', () => {
    const next = String(nextOf('codex', 'running', current, seen({ connections: [out, missing] })))
    assert.equal(next, 'No AI tool is ready on this computer: Codex is signed out (run `codex login`), Claude Code is not installed (run `npm install -g @anthropic-ai/claude-code`). Tell the user, with the command for the tool they use, and that they can finish setup at https://app.wildcrane.ai.')
    assert.equal(nextOf('codex', 'running', current, seen({ connections: [out, ready] })), null)
    assert.equal(nextOf('claude-code', 'running', current, seen({ connections: [out] })), null)
  })

  it('offers to add the folder when it is not a project and was not refused', () => {
    assert.match(String(nextOf('codex', 'running', current, seen({ folder: null }))), /not a WildCrane project yet.*wildcrane_open_settings/)
    assert.equal(nextOf('codex', 'running', current, seen({ folder: null, refused: 'home' })), null)
    assert.equal(nextOf('codex', 'running', current, seen({ folder: null, refused: undefined })), null)
    assert.equal(nextOf('codex', 'running', current, seen()), null)
  })

  it('gives one line, in order: outdated, no tool ready, folder not added, newer release', () => {
    const all = seen({ connections: [out], folder: null })
    assert.match(String(nextOf('codex', 'outdated', newer, all)), /tasks no longer run/)
    assert.match(String(nextOf('codex', 'running', newer, all)), /^No AI tool is ready/)
    assert.match(String(nextOf('codex', 'running', newer, seen({ folder: null }))), /^This folder is not a WildCrane project/)
    assert.match(String(nextOf('codex', 'running', newer, seen())), /0\.1\.5 is out/)
  })
})

describe('the plugin akb in a session started by hand (#187)', () => {
  const instructionsOf = (answers: Map<number, Record<string, unknown>>) => (answers.get(1)!.result as { instructions?: string }).instructions
  const stop = (child: ReturnType<typeof spawn>) => new Promise((r) => {
    child.on('exit', r)
    child.stdin!.end()
  })

  it('writes the shim signed out, and only Codex is told where it is', async () => {
    const shim = path.join(runnerHome(), 'bin', 'akb', 'akb')
    fs.rmSync(path.dirname(shim), { recursive: true, force: true })
    const claude = component('claude-code')
    await claude.ready
    assert.ok(fs.statSync(shim).mode & 0o111)
    assert.equal(instructionsOf(claude.answers), undefined)
    await stop(claude.child)
    const codex = component('codex')
    await codex.ready
    assert.equal(instructionsOf(codex.answers), `When \`akb\` is not on PATH, run \`${shim}\` in its place.`)
    await stop(codex.child)
  })

  it('leaves a job session alone', async () => {
    const shim = path.join(runnerHome(), 'bin', 'akb', 'akb')
    fs.rmSync(path.dirname(shim), { recursive: true, force: true })
    const job = component('codex', undefined, { WILDCRANE_JOB: 'job_1' })
    await job.ready
    assert.equal(fs.existsSync(shim), false)
    assert.equal(instructionsOf(job.answers), undefined)
    await stop(job.child)
  })

  const hook = path.join(process.env.RUNNER_DIST!, '..', '..', 'plugins', 'claude-code', 'hooks', 'session.mjs')
  const session = (env: Record<string, string | undefined>) =>
    spawnSync(process.execPath, [hook], { input: '{"session_id":"s1"}', encoding: 'utf8', env: { ...process.env, WILDCRANE_JOB: '', ...env } })

  it('puts a home with a space and a quote first on the PATH through the env file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wildcrane-hook-'))
    const home = path.join(dir, "it's a home")
    const shims = path.join(home, 'bin', 'akb')
    fs.mkdirSync(shims, { recursive: true })
    fs.writeFileSync(path.join(shims, 'akb'), '#!/bin/sh\n', { mode: 0o755 })
    const env = path.join(dir, 'env')
    assert.match(session({ WILDCRANE_HOME: home, CLAUDE_ENV_FILE: env }).stdout, /s1/)
    const found = spawnSync('/bin/sh', ['-c', `. '${env}'; command -v akb; echo "$AI4KANBAN_COMMAND"`], { encoding: 'utf8' })
    assert.deepEqual(found.stdout.trim().split('\n'), [path.join(shims, 'akb'), 'akb'])
  })

  it('skips with no env file, an unwritable one, and in a job', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wildcrane-hook-'))
    const env = path.join(dir, 'env')
    assert.match(session({ CLAUDE_ENV_FILE: undefined }).stdout, /s1/)
    const stuck = session({ CLAUDE_ENV_FILE: path.join(dir, 'missing', 'env') })
    assert.equal(stuck.status, 0)
    assert.match(stuck.stdout, /s1/)
    session({ CLAUDE_ENV_FILE: env, WILDCRANE_JOB: 'job_1' })
    assert.equal(fs.existsSync(env), false)
  })
})

describe('the plugin component', () => {
  it('两个插件竞争时复用设置服务，宿主退出后另一入口可以重开', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'wc324-hosts-'))
    const env = { WILDCRANE_HOME: home, PATH: '' }
    const a = component('claude-code', undefined, env), b = component('codex', undefined, env)
    const open = async (plugin: ReturnType<typeof component>, id: number) => {
      await plugin.ready
      plugin.send(id, 'tools/call', { name: 'wildcrane_open_settings', arguments: { path: '/project' } })
      await until(() => plugin.answers.has(id))
      const result = plugin.answers.get(id)!.result as { content: { text: string }[] }
      return JSON.parse(result.content[0]!.text) as { url: string; opened: boolean }
    }
    const stop = async (plugin: ReturnType<typeof component>) => {
      if (plugin.child.exitCode !== null) return
      const ended = new Promise((resolve) => plugin.child.once('exit', resolve)); plugin.child.stdin.end(); await ended
    }
    try {
      const [first, second] = await Promise.all([open(a, 20), open(b, 20)])
      assert.equal(new URL(first.url).origin, new URL(second.url).origin)
      assert.equal(first.opened, false)
      const record = JSON.parse(fs.readFileSync(path.join(home, 'settings-page.json'), 'utf8')) as { pid: number }
      const [owner, standby] = record.pid === a.child.pid ? [a, b] : [b, a]
      await stop(owner)
      await assert.rejects(() => fetch(first.url))
      const reopened = await open(standby, 21)
      assert.equal((await fetch(reopened.url)).status, 200)
      assert.notEqual(new URL(reopened.url).origin, new URL(first.url).origin)
    } finally { await stop(a); await stop(b); fs.rmSync(home, { recursive: true, force: true }) }
  })

  it('answers MCP on stdout, keeps the panel tool behind its key, and ends with its host', async () => {
    const { child, answers, send, ready } = component('claude-code')
    await ready
    send(2, 'tools/list', {})
    send(3, 'tools/call', { name: 'wildcrane_panel', arguments: { key: 'guess', action: 'state' } })
    await until(() => answers.has(2) && answers.has(3))
    const tools = (answers.get(2)!.result as { tools: { name: string }[] }).tools.map((t) => t.name)
    assert.deepEqual(tools, ['wildcrane_open_settings', 'wildcrane_draft_read', 'wildcrane_draft_save', 'wildcrane_panel'])
    assert.equal((answers.get(3)!.result as { isError: boolean }).isError, true)
    const exited = new Promise<number | null>((r) => child.on('exit', r))
    child.stdin.end()
    assert.equal(await exited, 0)
  })

  it('gives Codex its own tools, no panel and no start, and asks it to sign in first', async () => {
    const { child, answers, send, ready } = component('codex')
    await ready
    send(2, 'tools/list', {})
    send(3, 'tools/call', { name: 'wildcrane_draft_read', arguments: { path: process.cwd() }, _meta: { threadId: 'thread-1' } })
    await until(() => answers.has(2) && answers.has(3))
    const tools = (answers.get(2)!.result as { tools: { name: string }[] }).tools.map((t) => t.name)
    assert.deepEqual(tools, ['wildcrane_open_settings', 'wildcrane_draft_read', 'wildcrane_draft_save', 'wildcrane_status', 'wildcrane_sign_in', 'wildcrane_add_folder'])
    const read = answers.get(3)!.result as { isError: boolean; content: { text: string }[] }
    assert.equal(read.isError, true)
    assert.equal(JSON.parse(read.content[0]!.text).error, 'signed_out')
    const exited = new Promise<number | null>((r) => child.on('exit', r))
    child.stdin.end()
    assert.equal(await exited, 0)
  })

  it('binds the folder to an existing project, and refuses one already holding another', async () => {
    useRunnerHome()
    fs.rmSync(runnerHome(), { recursive: true, force: true })
    writeFakeSession(runnerHome())
    const cloud = new FakeCloud()
    await cloud.start()
    cloud.others = [{ project: 'prj_docs', name: '帮助文档', workspace: 'ws_team', workspace_name: 'Northwind', personal: false }]
    const site = fs.mkdtempSync(path.join(os.homedir(), '.wildcrane-test-site-'))
    const docs = fs.mkdtempSync(path.join(os.homedir(), '.wildcrane-test-docs-'))
    const { child, answers, send, ready } = component('claude-code', `http://127.0.0.1:${cloud.port}`)
    let id = 10
    const panel = async (args: Record<string, unknown>) => {
      const n = id++
      const key = fs.readFileSync(path.join(runnerHome(), 'plugin', 'panel.key'), 'utf8').trim()
      send(n, 'tools/call', { name: 'wildcrane_panel', arguments: { key, ...args } })
      await until(() => answers.has(n), 10_000)
      return JSON.parse((answers.get(n)!.result as { content: { text: string }[] }).content[0]!.text) as Record<string, unknown>
    }
    try {
      await ready
      const before = await panel({ action: 'state', cwd: docs })
      assert.deepEqual(before.elsewhere, [{ project: 'prj_docs', name: '帮助文档', workspace_name: 'Northwind', personal: false, board: `${before.web}/projects/prj_docs` }])

      assert.equal((await panel({ action: 'addFolder', cwd: site })).added, true)
      const siteName = path.basename(fs.realpathSync(site))
      assert.deepEqual(await panel({ action: 'addFolder', cwd: site, project: 'prj_docs' }), { error: 'folder_taken', message: 'taken', name: siteName })

      const bound = await panel({ action: 'addFolder', cwd: docs, project: 'prj_docs' })
      assert.equal(bound.project, 'prj_docs')
      const after = await panel({ action: 'state', cwd: docs })
      assert.equal((after.folder as { project: string }).project, 'prj_docs')
      assert.deepEqual(after.elsewhere, [])
    } finally {
      const exited = new Promise((r) => child.on('exit', r))
      child.stdin.end()
      await exited
      await cloud.stop()
      fs.rmSync(site, { recursive: true, force: true })
      fs.rmSync(docs, { recursive: true, force: true })
    }
  })

  it('adds a typed folder, refuses one already added, and unbinds one no job holds', async () => {
    useRunnerHome()
    fs.rmSync(runnerHome(), { recursive: true, force: true })
    writeFakeSession(runnerHome())
    const cloud = new FakeCloud()
    await cloud.start()
    cloud.others = [{ project: 'prj_docs', name: '帮助文档', workspace: 'ws_team', workspace_name: 'Northwind', personal: false }]
    const site = fs.mkdtempSync(path.join(os.homedir(), '.wildcrane-test-site-'))
    const docs = fs.mkdtempSync(path.join(os.homedir(), '.wildcrane-test-docs-'))
    const { child, answers, send, ready } = component('claude-code', `http://127.0.0.1:${cloud.port}`)
    let id = 10
    const panel = async (args: Record<string, unknown>) => {
      const n = id++
      const key = fs.readFileSync(path.join(runnerHome(), 'plugin', 'panel.key'), 'utf8').trim()
      send(n, 'tools/call', { name: 'wildcrane_panel', arguments: { key, cwd: site, ...args } })
      await until(() => answers.has(n), 10_000)
      return JSON.parse((answers.get(n)!.result as { content: { text: string }[] }).content[0]!.text) as Record<string, unknown>
    }
    try {
      await ready
      assert.equal((await panel({ action: 'addFolder', path: `~/${path.basename(site)}` })).added, true)
      assert.equal((await panel({ action: 'addFolder', path: site })).error, 'folder_taken')
      assert.equal((await panel({ action: 'addFolder', path: '~' })).error, 'home')
      assert.equal((await panel({ action: 'addFolder', path: path.join(site, 'nowhere') })).error, 'missing')
      assert.equal((await panel({ action: 'addFolder', path: docs, project: 'prj_docs' })).project, 'prj_docs')
      const added = await panel({ action: 'state' })
      assert.equal((added.projects as unknown[]).length, 2)
      assert.deepEqual(added.elsewhere, [])

      markUnsent(fs.realpathSync(docs), true)
      assert.deepEqual(await panel({ action: 'removeFolder', project: 'prj_docs' }), { error: 'busy' })
      assert.equal(((await panel({ action: 'state' })).projects as { busy: boolean }[]).find((p) => p.busy) !== undefined, true)
      markUnsent(fs.realpathSync(docs), false)

      const removed = await panel({ action: 'removeFolder', project: 'prj_docs' })
      assert.deepEqual((removed.projects as { project: string }[]).map((p) => p.project), [(removed.folder as { project: string }).project])
      assert.deepEqual((removed.elsewhere as { project: string }[]).map((p) => p.project), ['prj_docs'])
      assert.ok(fs.existsSync(docs))
    } finally {
      const exited = new Promise((r) => child.on('exit', r))
      child.stdin.end()
      await exited
      await cloud.stop()
      fs.rmSync(site, { recursive: true, force: true })
      fs.rmSync(docs, { recursive: true, force: true })
    }
  })

  it("names the account, reads a session's discussion for the model, and signs out", async () => {
    useRunnerHome()
    fs.rmSync(runnerHome(), { recursive: true, force: true })
    writeFakeSession(runnerHome())
    const held = JSON.parse(fs.readFileSync(path.join(runnerHome(), 'session.json'), 'utf8'))
    fs.writeFileSync(path.join(runnerHome(), 'session.json'), JSON.stringify({ ...held, name: 'Lin Chen', email: 'lin@acme.dev' }))
    const cloud = new FakeCloud()
    await cloud.start()
    const { child, answers, send, ready } = component('claude-code', `http://127.0.0.1:${cloud.port}`)
    let id = 10
    const call = async (name: string, args: Record<string, unknown>) => {
      const n = id++
      send(n, 'tools/call', { name, arguments: args })
      await until(() => answers.has(n), 10_000)
      return JSON.parse((answers.get(n)!.result as { content: { text: string }[] }).content[0]!.text) as Record<string, unknown>
    }
    const panel = (args: Record<string, unknown>) =>
      call('wildcrane_panel', { key: fs.readFileSync(path.join(runnerHome(), 'plugin', 'panel.key'), 'utf8').trim(), cwd: os.homedir(), ...args })
    try {
      await ready
      assert.deepEqual((await panel({ action: 'state' })).account, { name: 'Lin Chen', email: 'lin@acme.dev' })

      const read = await call('wildcrane_draft_read', { sessionId: 'sess-1' })
      assert.equal(read.discussion, 'dsc_1')
      assert.equal((await call('wildcrane_draft_read', { sessionId: 'sess-1' })).discussion, 'dsc_1')
      assert.deepEqual(read.goals, read.ideas)
      assert.equal((read.workflows as { when: string }[])[0]!.when, 'Software changes.')
      assert.match(String(read.url), /discussions\/dsc_1$/)
      assert.equal(cloud.discussions.length, 1)

      const goals = [{ title: '目标', outcome: '结果', acceptance: ['验收'], workflow: 'wf_builtin_coding' }]
      const saved = await call('wildcrane_draft_save', { discussionId: 'dsc_1', expectedVersion: 1, goals })
      assert.equal(saved.saved, true)
      assert.deepEqual(saved.goals, saved.ideas)
      assert.match(String((saved.goals as { url: string }[])[0].url), /discussions\/dsc_1$/)
      assert.equal(cloud.draftBodies[0].goals, undefined, '旧服务必须使用 ideas 写入')
      for (const fields of [{}, { goals, ideas: goals }]) {
        const invalid = await call('wildcrane_draft_save', { discussionId: 'dsc_1', expectedVersion: 2, ...fields })
        assert.equal(invalid.error, 'bad_request')
        assert.equal(invalid.message, 'Provide exactly one of goals or ideas.')
        assert.equal((answers.get(id - 1)!.result as { isError: boolean }).isError, true)
      }
      assert.equal(cloud.draftWrites, 1)
      const conflict = await call('wildcrane_draft_save', { discussionId: 'dsc_1', expectedVersion: 1, ideas: goals })
      assert.equal(conflict.saved, false)
      assert.equal(conflict.reason, 'The goals have changed. Merge your changes with the latest goals and save again.')
      assert.equal(cloud.draftWrites, 1)
      assert.deepEqual(conflict.goals, saved.goals)
      assert.equal(conflict.version, 2)
      assert.deepEqual(conflict.goals, conflict.ideas)
      cloud.goalProtocol = true
      await call('wildcrane_draft_read', { sessionId: 'sess-1' })
      const current = await call('wildcrane_draft_save', { discussionId: 'dsc_1', expectedVersion: 2, goals })
      assert.equal(current.saved, true)
      assert.deepEqual(cloud.draftBodies.at(-1)?.goals, goals)
      assert.equal(cloud.log.some((line) => /\/ideas\/.*\/start|\/goals\/.*\/start/.test(line)), false, '保存不得开始任务')

      // This computer's tasks (#18): read from Cloud, stopped by the route each names.
      const since = new Date(Date.now() - 12 * 60_000 - 5_000).toISOString()
      cloud.machineTasks = [
        { task: 'task_1', key: 'AKB-1', title: 'Fix sign-in', project: 'ai4kanban', runtime: 'claude-code', state: 'running', since, stop: 'task' },
        { task: 'task_2', key: null, title: 'Release notes', project: null, runtime: 'codex', state: 'queued', since, stop: null },
      ]
      const listed = (await panel({ action: 'tasks' })).tasks as Record<string, unknown>[]
      assert.deepEqual(listed.map((t) => [t.title, t.project, t.agent, t.state, t.minutes, t.stop]), [
        ['Fix sign-in', 'ai4kanban', 'Claude Code', 'running', 12, 'task'],
        ['Release notes', '', 'Codex', 'queued', 12, null],
      ])
      assert.match(String(listed[0]!.url), /\/tasks\/AKB-1$/)
      assert.match(String(listed[1]!.url), /\/tasks\/task_2$/)
      assert.deepEqual(await panel({ action: 'stopTask', task: 'task_1', stop: 'task' }), { stopped: true })
      assert.deepEqual(await panel({ action: 'stopTask', task: 'task_3', stop: 'chat' }), { stopped: true })
      assert.deepEqual(cloud.stops, ['stop task_1', 'chat/stop task_3'])
      assert.equal((await panel({ action: 'stopTask', task: 'refused', stop: 'task' })).error, 'forbidden')

      const out = await panel({ action: 'signOut' })
      assert.equal(out.signedIn, false)
      assert.equal(out.runner, 'off')
      assert.equal(fs.existsSync(path.join(runnerHome(), 'session.json')), false)
      assert.equal((await call('wildcrane_draft_read', { sessionId: 'sess-1' })).error, 'signed_out')
    } finally {
      const exited = new Promise((r) => child.on('exit', r))
      child.stdin.end()
      await exited
      await cloud.stop()
    }
  })

  it('tells both hosts to update the plugin once Cloud refuses its Runner as outdated', async () => {
    useRunnerHome()
    fs.rmSync(runnerHome(), { recursive: true, force: true })
    writeFakeSession(runnerHome())
    const cloud = new FakeCloud()
    cloud.minProtocol = 99
    await cloud.start()
    const children: ReturnType<typeof component>['child'][] = []
    const status = async (as: 'claude-code' | 'codex') => {
      const { child, answers, send, ready } = component(as, `http://127.0.0.1:${cloud.port}`)
      children.push(child)
      await ready
      for (let n = 10; ; n++) {
        if (as === 'codex') send(n, 'tools/call', { name: 'wildcrane_status', arguments: { path: os.homedir() } })
        else {
          const key = fs.readFileSync(path.join(runnerHome(), 'plugin', 'panel.key'), 'utf8').trim()
          send(n, 'tools/call', { name: 'wildcrane_panel', arguments: { key, action: 'state', cwd: os.homedir() } })
        }
        await until(() => answers.has(n), 10_000)
        const now = JSON.parse((answers.get(n)!.result as { content: { text: string }[] }).content[0]!.text) as Record<string, unknown>
        if (now.runner === 'outdated') return now
        await new Promise((r) => setTimeout(r, 100))
      }
    }
    try {
      const panel = await status('claude-code')
      assert.match(String(panel.next), /claude plugin update wildcrane@wildcrane/)
      const own = JSON.parse(fs.readFileSync(path.join(process.env.RUNNER_DIST!, '..', '..', 'plugins', 'claude-code', '.claude-plugin', 'plugin.json'), 'utf8')) as { version: string }
      assert.deepEqual(panel.plugin, { version: own.version, latest: null })
      children[0]!.stdin.end()
      await new Promise((r) => children[0]!.on('exit', r))
      const codex = await status('codex')
      assert.match(String(codex.next), /codex plugin add wildcrane@wildcrane/)
      const ownCodex = JSON.parse(fs.readFileSync(path.join(process.env.RUNNER_DIST!, '..', '..', 'plugins', 'codex', 'plugin.json'), 'utf8')) as { version: string }
      assert.deepEqual(codex.plugin, { version: ownCodex.version, latest: null })
    } finally {
      for (const child of children) {
        if (child.exitCode !== null) continue
        const exited = new Promise((r) => child.on('exit', r))
        child.stdin.end()
        await exited
      }
      await cloud.stop()
    }
  })

  it('lets Codex bind the folder to an existing project', async () => {
    useRunnerHome()
    fs.rmSync(runnerHome(), { recursive: true, force: true })
    writeFakeSession(runnerHome())
    const cloud = new FakeCloud()
    await cloud.start()
    cloud.others = [{ project: 'prj_docs', name: '帮助文档', workspace: 'ws_team', workspace_name: 'Northwind', personal: false }]
    const docs = fs.mkdtempSync(path.join(os.homedir(), '.wildcrane-test-docs-'))
    const { child, answers, send, ready } = component('codex', `http://127.0.0.1:${cloud.port}`)
    let id = 10
    const call = async (name: string, args: Record<string, unknown>) => {
      const n = id++
      send(n, 'tools/call', { name, arguments: args })
      await until(() => answers.has(n), 10_000)
      return JSON.parse((answers.get(n)!.result as { content: { text: string }[] }).content[0]!.text) as Record<string, unknown>
    }
    try {
      await ready
      const before = await call('wildcrane_status', { path: docs })
      assert.deepEqual(before.elsewhere, [{ project: 'prj_docs', name: '帮助文档', workspace_name: 'Northwind', personal: false, board: `${before.web}/projects/prj_docs` }])
      assert.equal((await call('wildcrane_add_folder', { path: docs, project: 'prj_docs' })).project, 'prj_docs')
      const after = await call('wildcrane_status', { path: docs })
      assert.equal((after.folder as { project: string }).project, 'prj_docs')
    } finally {
      const exited = new Promise((r) => child.on('exit', r))
      child.stdin.end()
      await exited
      await cloud.stop()
      fs.rmSync(docs, { recursive: true, force: true })
    }
  })
})
