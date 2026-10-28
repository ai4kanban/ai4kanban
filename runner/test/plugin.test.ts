import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import os from 'node:os'
import { describe, it } from 'node:test'

import { runnerHome, useRunnerHome } from '../src/home'
import { linesFor } from '../src/i18n'
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
    const second = holdMachine('desktop', () => held.push('second'), (holder) => (waited = holder ?? 'unknown'))
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
    const lock = holdMachine('desktop', () => {}, (holder) => (waited = holder ?? 'unknown'))
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
function component(host: 'claude-code' | 'codex', cloud = 'http://127.0.0.1:9') {
  const server = path.join(process.env.RUNNER_DIST!, '..', '..', 'plugins', host, 'server', 'dist', 'index.mjs')
  const child = spawn(process.execPath, [server, ...(host === 'codex' ? ['codex'] : [])], {
    stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, AI4KANBAN_CLOUD_URL: cloud },
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

describe('the plugin component', () => {
  it('answers MCP on stdout, keeps the panel tool behind its key, and ends with its host', async () => {
    const { child, answers, send, ready } = component('claude-code')
    await ready
    send(2, 'tools/list', {})
    send(3, 'tools/call', { name: 'wildcrane_panel', arguments: { key: 'guess', action: 'start', discussion: 'dsc_1', idea: 'idea_1', version: 1 } })
    await until(() => answers.has(2) && answers.has(3))
    const tools = (answers.get(2)!.result as { tools: { name: string }[] }).tools.map((t) => t.name)
    assert.deepEqual(tools, ['wildcrane_draft_read', 'wildcrane_draft_save', 'wildcrane_panel'])
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
    assert.deepEqual(tools, ['wildcrane_draft_read', 'wildcrane_draft_save', 'wildcrane_status', 'wildcrane_sign_in', 'wildcrane_add_folder'])
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
      assert.deepEqual(before.elsewhere, [{ project: 'prj_docs', name: '帮助文档', workspace_name: 'Northwind', personal: false }])

      assert.equal((await panel({ action: 'addFolder', cwd: site })).added, true)
      assert.deepEqual(await panel({ action: 'addFolder', cwd: site, project: 'prj_docs' }), { error: 'folder_taken', message: 'taken' })

      const bound = await panel({ action: 'addFolder', cwd: docs, project: 'prj_docs' })
      assert.equal(bound.project, 'prj_docs')
      const after = await panel({ action: 'state', cwd: docs })
      assert.equal((after.folder as { project: string }).project, 'prj_docs')
      assert.equal(after.elsewhere, undefined)
    } finally {
      const exited = new Promise((r) => child.on('exit', r))
      child.stdin.end()
      await exited
      await cloud.stop()
      fs.rmSync(site, { recursive: true, force: true })
      fs.rmSync(docs, { recursive: true, force: true })
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
      assert.deepEqual(before.elsewhere, [{ project: 'prj_docs', name: '帮助文档', workspace_name: 'Northwind', personal: false }])
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
