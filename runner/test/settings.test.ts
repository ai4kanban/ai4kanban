import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { clearSession, readSession, writeSession } from '../../cli/src/lib/cloud/session'
import { adoptLegacy, allow, allowedProjects, refusal } from '../src/folders'
import { runnerHome, useRunnerHome } from '../src/home'
import { closeSettings, openSettings, startSettingsServer } from '../src/settings-server'
import { settingsAction, addFolder } from '../src/settings'
import { acceptAlphaUpdates, saveAlphaUpdates } from '../src/preferences'
import { hold, kept } from '../src/cache'
import { FakeCloud, writeFakeSession } from './fake-cloud'

if (process.env.WC324_WORKER === 'hold') {
  const release = hold(process.env.WC324_FOLDER!)
  process.send?.({ ready: true })
  process.on('message', () => { release(); process.exit(0) })
} else {
beforeEach(() => { useRunnerHome(); fs.mkdirSync(runnerHome(), { recursive: true }); })
afterEach(async () => { await closeSettings(); clearSession(); fs.rmSync(path.join(runnerHome(), 'projects.json'), { force: true }); })

async function browser(context: { path?: string; project?: string } = {}) {
  const { url } = await openSettings(async (action, _, ctx) => ({ action, context: ctx }), context, false)
  const parsed = new URL(url)
  const origin = parsed.origin
  const exchange = (ticket = parsed.hash.slice(1)) => fetch(`${origin}/session`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ ticket }) })
  const session = await exchange()
  const cookie = session.headers.get('set-cookie')!.split(';')[0]!
  const { csrf } = await session.json() as { csrf: string }
  const call = (headers = {}, route = '/api/state') => fetch(origin + route, { method: 'POST', headers: { origin, cookie, 'x-settings-csrf': csrf, 'content-type': 'application/json', ...headers }, body: '{}' })
  return { origin, cookie, csrf, exchange, call }
}

describe('本机 Alpha 偏好', () => {
  const file = () => path.join(runnerHome(), 'preferences.json')
  afterEach(() => fs.rmSync(file(), { recursive: true, force: true }))
  it('缺失、错误类型和损坏配置默认关闭，保存保留未知字段且退出登录不删除', async () => {
    for (const text of ['{}', '{', '[]', '{"acceptAlphaUpdates":"true"}']) {
      fs.writeFileSync(file(), text); assert.equal(acceptAlphaUpdates(), false)
    }
    fs.writeFileSync(file(), '{"future":42}')
    assert.deepEqual(await settingsAction('updates', { acceptAlphaUpdates: true }, {}), { acceptAlphaUpdates: true })
    assert.deepEqual(JSON.parse(fs.readFileSync(file(), 'utf8')), { future: 42, acceptAlphaUpdates: true })
    assert.equal(fs.statSync(file()).mode & 0o777, 0o600)
    clearSession(); useRunnerHome(); assert.equal(acceptAlphaUpdates(), true)
    const state = await settingsAction('state', {}, {}) as { acceptAlphaUpdates: boolean }
    assert.equal(state.acceptAlphaUpdates, true)
    assert.deepEqual(await settingsAction('updates', { acceptAlphaUpdates: 'true' }, {}), { error: 'bad_request' })
    assert.equal(acceptAlphaUpdates(), true)
  })
  it('原子替换失败保留有效值并可重试', async () => {
    saveAlphaUpdates(true)
    const rename = fs.renameSync
    fs.renameSync = () => { throw Error('disk unavailable') }
    try {
      assert.deepEqual(await settingsAction('updates', { acceptAlphaUpdates: false }, {}), { error: 'preferences_write', acceptAlphaUpdates: true })
      assert.equal(acceptAlphaUpdates(), true)
      assert.ok(!fs.readdirSync(runnerHome()).some(f => f.startsWith('preferences.json.') && f.endsWith('.tmp')))
    } finally { fs.renameSync = rename }
    saveAlphaUpdates(false); assert.equal(acceptAlphaUpdates(), false)
  })
})

describe('本机设置服务', () => {
  it('一次性入口建立会话，复用同一随机端口且各入口保留上下文', async () => {
    const a = await browser({ path: '/a' }), b = await browser({ path: '/b' })
    assert.equal(a.origin, b.origin)
    assert.equal((await a.exchange()).status, 403)
    assert.deepEqual(await (await a.call()).json(), { action: 'state', context: { path: '/a' } })
    assert.deepEqual(await (await b.call()).json(), { action: 'state', context: { path: '/b' } })
    assert.equal(fs.statSync(path.join(runnerHome(), 'settings-page.json')).mode & 0o777, 0o600)
  })
  it('拒绝恶意来源、缺失凭据、DNS 重绑定和跨站请求', async () => {
    const a = await browser()
    assert.equal((await a.call({ origin: 'https://evil.example' })).status, 403)
    assert.equal((await a.call({ origin: '' })).status, 403)
    assert.equal((await a.call({ 'x-settings-csrf': '' })).status, 403)
    assert.equal((await a.call({ cookie: '' })).status, 403)
    assert.equal((await a.call({ 'sec-fetch-site': 'cross-site' })).status, 403)
    const url = new URL(a.origin)
    const code = await new Promise<number>((resolve) => {
      const req = http.get({ hostname: '127.0.0.1', port: url.port, headers: { host: 'evil.example' } }, (res) => { res.resume(); resolve(res.statusCode!) })
      req.on('error', () => resolve(0))
    })
    assert.equal(code, 403)
  })
  it('静态资源仅精确匹配固定入口，关闭后旧页面失效', async () => {
    const a = await browser()
    for (const route of ['/session.json', '/%2e%2e/session.json', '/settings-client.js/../session.json', '/etc/passwd']) assert.equal((await fetch(a.origin + route)).status, 404)
    const html = await (await fetch(a.origin)).text()
    assert.ok(!html.includes(a.csrf))
    await closeSettings()
    await assert.rejects(() => a.call())
    assert.ok(!fs.existsSync(path.join(runnerHome(), 'settings-page.json')))
  })
  it('打开和关闭不改动本机 settings.json', async () => {
    const prefs = path.join(runnerHome(), 'settings.json')
    const kept = '{\n  "usageInstallId": "keep-me",\n  "language": "zh"\n}\n'
    fs.writeFileSync(prefs, kept)
    try {
      await browser()
      assert.equal(fs.readFileSync(prefs, 'utf8'), kept)
      await closeSettings()
      assert.equal(fs.readFileSync(prefs, 'utf8'), kept)
    } finally { fs.rmSync(prefs, { force: true }) }
  })
  it('同浏览器多标签保持各自会话和目录上下文', async () => {
    const a = await browser({ path: '/a' })
    const entry = await openSettings(async () => ({}), { path: '/b' }, false)
    const second = await fetch(a.origin + '/session', { method: 'POST', headers: { origin: a.origin, cookie: a.cookie }, body: JSON.stringify({ ticket: new URL(entry.url).hash.slice(1) }) })
    assert.equal(second.headers.get('set-cookie')!.split(';')[0], a.cookie)
    const b = await second.json() as { csrf: string }
    assert.equal((await a.call()).status, 200)
    const response = await a.call({ 'x-settings-csrf': b.csrf })
    assert.deepEqual(await response.json(), { action: 'state', context: { path: '/b' } })
  })
  it('本机运行过更新的 Runner 时由它提供设置页，旧版不带设置页时用自带的', async () => {
    const versions = path.join(runnerHome(), 'bin', 'runner')
    const install = (version: string, settings: boolean) => {
      const dist = path.join(versions, version, 'dist')
      fs.mkdirSync(dist, { recursive: true })
      fs.writeFileSync(path.join(dist, 'runner.mjs'), '')
      if (settings) fs.copyFileSync(path.join(process.env.RUNNER_DIST!, 'settings.mjs'), path.join(dist, 'settings.mjs'))
      fs.writeFileSync(path.join(versions, 'state.json'), JSON.stringify({ good: [version], bad: [] }))
    }
    const owner = () => (JSON.parse(fs.readFileSync(path.join(runnerHome(), 'settings-page.json'), 'utf8')) as { pid: number }).pid
    try {
      install('9.9.8', false)
      await browser()
      assert.equal(owner(), process.pid)
      await closeSettings()
      install('9.9.9', true)
      const a = await browser({ path: '/a' }), b = await browser({ path: '/b' })
      assert.equal(a.origin, b.origin)
      assert.notEqual(owner(), process.pid)
      const state = await (await a.call()).json() as { signedIn: boolean; machine: string; context: { path?: string } }
      assert.equal(state.signedIn, false)
      assert.ok(state.machine)
      assert.equal(state.context.path, '/a')
      await closeSettings()
      await assert.rejects(() => a.call())
    } finally { fs.rmSync(versions, { recursive: true, force: true }) }
  })
})

describe('目录授权', () => {
  it('兼容原绑定，同时按账号保留和隔离权限', async () => {
    const cloud = new FakeCloud(); await cloud.start()
    try {
      writeFakeSession(runnerHome()); const session = readSession()!
      const a = fs.mkdtempSync(path.join(os.tmpdir(), 'wc324-a-')), b = fs.mkdtempSync(path.join(os.tmpdir(), 'wc324-b-'))
      fs.writeFileSync(path.join(runnerHome(), 'projects.json'), JSON.stringify({ projects: [fs.realpathSync(a)] }))
      adoptLegacy(); assert.deepEqual(allowedProjects(), [fs.realpathSync(a)])
      writeSession({ ...session, subject: 'other' }); assert.deepEqual(allowedProjects(), [])
      allow(fs.realpathSync(b)); assert.deepEqual(allowedProjects(), [fs.realpathSync(b)])
      writeSession(session); assert.deepEqual(allowedProjects(), [fs.realpathSync(a)])
    } finally { await cloud.stop() }
  })
  it('符号链接不能绕过目录限制，普通文件不是目录', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wc324-link-'))
    const link = path.join(dir, 'home'); fs.symlinkSync(os.homedir(), link)
    assert.equal(refusal(link), 'home')
    fs.writeFileSync(path.join(dir, 'file'), 'hello')
    assert.equal(refusal(path.join(dir, 'file')), 'missing')
  })
  it('其他进程正在执行时，本机目录不能解除', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wc324-hold-'))
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, WC324_WORKER: 'hold', WC324_FOLDER: dir } })
    try {
      await new Promise((resolve) => child.once('message', resolve))
      assert.equal(kept(dir), true)
      const exited = new Promise((resolve) => child.once('exit', resolve))
      child.send({ close: true }); await exited
      assert.equal(kept(dir), false)
    } finally { child.kill() }
  })
  it('云端绑定成功而本机保存失败时可以重试，不重复创建项目', async () => {
    const cloud = new FakeCloud(); await cloud.start()
    const dir = fs.mkdtempSync(path.join(os.homedir(), '.wc324-save-'))
    const blocked = path.join(runnerHome(), `projects.json.${process.pid}.tmp`)
    try {
      writeFakeSession(runnerHome()); adoptLegacy()
      fs.mkdirSync(blocked)
      const result = await addFolder(dir)
      assert.equal(result.error, 'authorization_write')
      assert.equal(cloud.folders.length, 1)
      assert.deepEqual(allowedProjects(), [])
      fs.rmdirSync(blocked)
      const retried = await addFolder(dir)
      assert.ok('added' in retried && retried.added)
      assert.equal(cloud.folders.length, 1)
      assert.deepEqual(allowedProjects(), [fs.realpathSync(dir)])
    } finally { fs.rmSync(blocked, { recursive: true, force: true }); fs.rmSync(dir, { recursive: true, force: true }); await cloud.stop() }
  })
  it('没有选择目录时，浏览器不能提交任意路径授权', async () => {
    const cloud = new FakeCloud(); await cloud.start()
    try {
      writeFakeSession(runnerHome())
      const result = await settingsAction('bind', { path: os.tmpdir(), project: 'prj_any' }, {})
      assert.deepEqual(result, { error: 'missing' })
    } finally { await cloud.stop() }
  })
  it('选择和取消不授予目录权限，换账号后不能确认旧选择', async () => {
    const cloud = new FakeCloud(); await cloud.start()
    try {
      writeFakeSession(runnerHome()); const session = readSession()!
      const dir = fs.mkdtempSync(path.join(os.homedir(), '.wc324-choice-'))
      const context = { path: dir }
      const choice = await settingsAction('pick', { current: true }, context) as { path: string }
      assert.equal(choice.path, fs.realpathSync(dir)); assert.deepEqual(allowedProjects(), [])
      await settingsAction('cancel', {}, context)
      assert.deepEqual(await settingsAction('bind', { project: 'prj_any' }, context), { error: 'missing' })
      await settingsAction('pick', { current: true }, context)
      writeSession({ ...session, subject: 'other' })
      assert.deepEqual(await settingsAction('bind', { project: 'prj_any' }, context), { error: 'signed_out' })
    } finally { await cloud.stop() }
  })
})

}
