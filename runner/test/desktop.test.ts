import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { afterEach, beforeEach, describe, it } from 'node:test'

import type { Alert } from '../src/api'
import { notice } from '../src/desktop'
import { allow, allowedProjects, keepOnly, refusal, type Where } from '../src/folders'
import { runnerHome, useRunnerHome } from '../src/home'
import { linesFor } from '../src/i18n'
import { FakeCloud, until, writeFakeSession } from './fake-cloud'

// The desktop app's side of the Runner (#2005): which folders can be a project, and the built
// Runner speaking the shell's line protocol against a stand-in Cloud.

const mac = (home = '/Users/lin'): Where => ({ platform: 'darwin', home, resolve: (p) => p })
const win = (home = 'C:\\Users\\lin'): Where => ({ platform: 'win32', home, resolve: (p) => p })

describe('a folder picked as a project', () => {
  it('is one folder of the user’s', () => {
    assert.equal(refusal('/Users/lin/code/site', mac()), null)
    assert.equal(refusal('/Volumes/Work/site', mac()), null)
    assert.equal(refusal('D:\\work\\site', win()), null)
    assert.equal(refusal('C:\\Users\\lin\\site', win()), null)
  })

  it('is not the home folder, or one holding it', () => {
    assert.equal(refusal('/Users/lin', mac()), 'home')
    assert.equal(refusal('/Users/lin/', mac()), 'home')
    assert.equal(refusal('/Users', mac()), 'home')
    assert.equal(refusal('c:\\users\\LIN', win()), 'home')
    assert.equal(refusal('C:\\Users', win()), 'home')
  })

  it('is not a whole disk', () => {
    assert.equal(refusal('/', mac()), 'disk')
    assert.equal(refusal('/Volumes/Work', mac()), 'disk')
    assert.equal(refusal('D:\\', win()), 'disk')
    assert.equal(refusal('\\\\server\\share', win()), 'disk')
  })

  it('is not the system’s, or the Runner’s own', () => {
    assert.equal(refusal('/System/Library', mac()), 'system')
    assert.equal(refusal('/Applications', mac()), 'system')
    assert.equal(refusal('/usr/local/src', mac()), 'system')
    assert.equal(refusal('C:\\Windows\\System32', win()), 'system')
    assert.equal(refusal('C:\\Program Files\\x', win()), 'system')
    assert.equal(refusal(path.join(runnerHome(), 'work'), mac()), 'system')
  })

  it('is refused when it is not there', () => {
    assert.equal(refusal('/Users/lin/gone', { ...mac(), resolve: () => null }), 'missing')
  })
})

describe('the allow list', () => {
  beforeEach(() => {
    useRunnerHome()
    fs.rmSync(runnerHome(), { recursive: true, force: true })
  })

  it('only ever loses a folder to Cloud', () => {
    const a = fs.mkdtempSync(path.join(os.tmpdir(), 'a-'))
    const b = fs.mkdtempSync(path.join(os.tmpdir(), 'b-'))
    allow(a)
    allow(b)
    keepOnly([a, '/somewhere/else'])
    assert.deepEqual(allowedProjects(), [fs.realpathSync(a)])
  })
})

describe('the Runner inside the desktop app', () => {
  let cloud: FakeCloud
  let child: ChildProcess | null = null
  let events: Record<string, unknown>[] = []
  const send = (command: unknown) => child!.stdin!.write(`${JSON.stringify(command)}\n`)
  const seen = (type: string, match: (e: Record<string, unknown>) => boolean = () => true) =>
    until(() => events.some((e) => e.type === type && match(e)), 10_000)

  beforeEach(async () => {
    useRunnerHome()
    fs.rmSync(runnerHome(), { recursive: true, force: true })
    writeFakeSession(runnerHome())
    cloud = new FakeCloud()
    await cloud.start()
    events = []
    child = spawn(process.execPath, [path.join(process.env.RUNNER_DIST!, 'runner.mjs')], {
      env: { ...process.env, WILDCRANE_DESKTOP: '1', LANG: 'zh_CN.UTF-8' },
      stdio: ['pipe', 'pipe', 'inherit'],
    })
    readline.createInterface({ input: child.stdout! }).on('line', (line) => {
      if (line.startsWith('{')) events.push(JSON.parse(line))
    })
  })

  afterEach(async () => {
    child?.kill('SIGKILL')
    child = null
    await cloud.stop()
  })

  it('connects, names the account, and shows an alert once notifications are on', async () => {
    await seen('hello', (e) => e.lang === 'zh' && e.protocol === 1)
    await seen('connection', (e) => e.state === 'connected')
    await seen('account', (e) => e.name === 'Lin Chen' && e.email === 'lin@acme.dev')
    assert.equal(cloud.runner!.notify, false)

    send({ cmd: 'notify', on: true })
    await until(() => cloud.runner!.notify === true)
    cloud.alerts.push({ id: 'alr_1', kind: 'review', task: 'task_1', task_title: '新增 Pricing 页面', phase: 2 })
    send({ cmd: 'refresh' })
    await seen('notify', (e) => e.id === 'alr_1')
    const notice = events.find((e) => e.type === 'notify')!
    assert.equal(notice.title, '待你审核')
    assert.equal(notice.body, '「新增 Pricing 页面」待审核')
    assert.match(String(notice.url), /\/tasks\/task_1$/)
    await until(() => cloud.alerts[0]!.shown === true)

    send({ cmd: 'read', alert: 'alr_1' })
    await until(() => cloud.alerts[0]!.read === true)

    cloud.alerts.push({ id: 'alr_2', kind: 'comment', task: 'task_1', task_title: '新增 Pricing 页面', phase: 2,
      comment: { id: 'cmt_1', author: { email: 'ana@studio.co', handle: 'ana' }, body: '按钮再大一点' } })
    send({ cmd: 'refresh' })
    await seen('notify', (e) => e.id === 'alr_2' && e.title === '「新增 Pricing 页面」有新评论' && e.body === 'ana：按钮再大一点')
  })

  it('places a picked folder on this computer, and refuses the home folder', async () => {
    await seen('folders')
    send({ cmd: 'addFolder', path: os.homedir() })
    await seen('folderRefused', (e) => e.why === 'home')

    const site = fs.mkdtempSync(path.join(os.homedir(), '.wildcrane-test-site-'))
    try {
      send({ cmd: 'addFolder', path: site })
      await seen('folders', (e) => (e.folders as { path: string }[]).some((f) => f.path === fs.realpathSync(site)))
      assert.deepEqual(allowedProjects(), [fs.realpathSync(site)])
      assert.equal(cloud.folders[0]!.name, path.basename(site))

      send({ cmd: 'removeFolder', project: cloud.folders[0]!.project })
      await until(() => cloud.folders.length === 0)
      await until(() => allowedProjects().length === 0)
    } finally {
      fs.rmSync(site, { recursive: true, force: true })
    }
  })

  it('places an existing project in a picked folder, and names the project already holding one', async () => {
    await seen('elsewhere')
    cloud.others = [{ project: 'prj_docs', name: '帮助文档', workspace: 'ws_team', workspace_name: 'Northwind', personal: false }]
    send({ cmd: 'removeFolder', project: 'none' })
    await seen('elsewhere', (e) => (e.projects as { project: string }[]).some((p) => p.project === 'prj_docs'))

    const site = fs.mkdtempSync(path.join(os.homedir(), '.wildcrane-test-site-'))
    const docs = fs.mkdtempSync(path.join(os.homedir(), '.wildcrane-test-docs-'))
    try {
      send({ cmd: 'addFolder', path: site })
      await seen('folders', (e) => (e.folders as { path: string }[]).some((f) => f.path === fs.realpathSync(site)))
      send({ cmd: 'addFolder', path: site, project: 'prj_docs' })
      await seen('folderRefused', (e) => e.why === 'taken' && e.project === 'prj_docs' && e.taken === path.basename(site))

      events.splice(0)
      send({ cmd: 'addFolder', path: docs, project: 'prj_docs' })
      await seen('folders', (e) => (e.folders as { project: string; path: string }[]).some((f) => f.project === 'prj_docs' && f.path === fs.realpathSync(docs)))
      await seen('elsewhere', (e) => (e.projects as unknown[]).length === 0)
      assert.ok(allowedProjects().includes(fs.realpathSync(docs)))
    } finally {
      cloud.others = []
      cloud.folders = []
      fs.rmSync(site, { recursive: true, force: true })
      fs.rmSync(docs, { recursive: true, force: true })
    }
  })

  it('signs out, freeing this computer, and waits to sign in again', async () => {
    await seen('connection', (e) => e.state === 'connected')
    send({ cmd: 'signOut' })
    await seen('signin', (e) => e.state === 'needed')
    assert.equal(fs.existsSync(path.join(runnerHome(), 'session.json')), false)
    assert.equal(cloud.runner!.live, false)
  })
})

describe('a comment notification', () => {
  const alert = (author: { email?: string; handle?: string | null }, body: string): Alert => ({
    id: 'alr_1', kind: 'comment', task: 'task_1', task_title: 'Homepage redesign', phase: 1,
    comment: { id: 'cmt_1', author, body },
  })

  it('names the task and who said what, in either language', () => {
    const a = alert({ email: 'lena@studio.co', handle: 'lena' }, 'Bigger **title**, please')
    assert.deepEqual(notice(a, linesFor(false)), { title: 'New comment on Homepage redesign', body: 'lena: Bigger **title**, please' })
    assert.deepEqual(notice(a, linesFor(true)), { title: '「Homepage redesign」有新评论', body: 'lena：Bigger **title**, please' })
  })

  it('names the task of a review', () => {
    const review: Alert = { id: 'alr_2', kind: 'review', task: 'task_1', task_title: 'Homepage redesign', phase: 1 }
    assert.equal(notice(review, linesFor(true)).body, '「Homepage redesign」待审核')
    assert.equal(notice(review, linesFor(false)).body, '"Homepage redesign" is ready for review')
  })

  it('falls back to the email without a GitHub account', () => {
    assert.equal(notice(alert({ email: 'lena@studio.co', handle: null }, 'Ok'), linesFor(false)).body, 'lena@studio.co: Ok')
  })

  it('folds whitespace and cuts at 100 characters', () => {
    assert.equal(notice(alert({ handle: 'lena' }, '  one\n\n two\tthree '), linesFor(false)).body, 'lena: one two three')
    const long = notice(alert({ handle: 'lena' }, '评'.repeat(101)), linesFor(true)).body
    assert.equal(long, `lena：${'评'.repeat(100)}…`)
    assert.equal(notice(alert({ handle: 'lena' }, '评'.repeat(100)), linesFor(true)).body, `lena：${'评'.repeat(100)}`)
  })
})
