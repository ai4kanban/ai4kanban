import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { SESSIONS_FILE, projectStateDir } from '../../cli/src/lib/machine/project'
import { IDLE_MS, cacheDir, clearAkb, hold, markUnsent, markUsed, removeLegacy, sweepCache } from '../src/cache'
import { keepOnly } from '../src/folders'
import { runnerHome, useRunnerHome } from '../src/home'
import { FakeCloud, writeFakeSession } from './fake-cloud'

// The cache (#2147): idle or unreachable projects go, unless a job, a paused delivery or an
// unsent write keeps them.

const MACHINE = '55555555-5555-4555-8555-555555555555'
const NOW = Date.now()
const OLD = NOW - IDLE_MS - 60_000

let cloud: FakeCloud

/** A cached project's folder, last used `at`. */
function cached(project: string, at = NOW): string {
  const dir = cacheDir(project)
  fs.mkdirSync(path.join(dir, '.akb', 'kanban'), { recursive: true })
  markUsed(dir, at)
  return dir
}

function linked(at = NOW): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'linked-')))
  spawnSync('git', ['init', '-q', dir])
  fs.writeFileSync(path.join(dir, 'app.ts'), 'mine')
  fs.mkdirSync(path.join(dir, '.akb', 'kanban'), { recursive: true })
  fs.writeFileSync(path.join(dir, '.akb', 'base.json'), '{}')
  markUsed(dir, at)
  fs.writeFileSync(path.join(runnerHome(), 'projects.json'), JSON.stringify({ projects: [dir] }))
  return dir
}

const has = (project: string) => fs.existsSync(cacheDir(project))
const reach = (...projects: string[]) =>
  (cloud.others = projects.map((project) => ({ project, name: project, workspace: 'ws_1', workspace_name: 'Mine', personal: true })))

beforeEach(async () => {
  useRunnerHome()
  fs.rmSync(runnerHome(), { recursive: true, force: true })
  writeFakeSession(runnerHome())
  cloud = new FakeCloud()
  await cloud.start()
})

afterEach(async () => {
  await cloud.stop()
})

describe('the cache (#2147)', () => {
  it('drops a project unused for a week, keeps a recent one, and starts counting for one with no record', async () => {
    reach('prj_old', 'prj_new', 'prj_bare')
    cached('prj_old', OLD)
    cached('prj_new')
    fs.mkdirSync(cacheDir('prj_bare'), { recursive: true })
    await sweepCache(MACHINE, NOW)
    assert.deepEqual([has('prj_old'), has('prj_new'), has('prj_bare')], [false, true, true])
    await sweepCache(MACHINE, NOW + IDLE_MS + 60_000)
    assert.equal(has('prj_bare'), false)
  })

  it('drops a project the account no longer reaches', async () => {
    reach('prj_1')
    cached('prj_1')
    cached('prj_gone')
    await sweepCache(MACHINE, NOW)
    assert.deepEqual([has('prj_1'), has('prj_gone')], [true, false])
  })

  it('keeps a project a job runs in, one with a paused delivery, and one whose write to Cloud failed', async () => {
    const running = cached('prj_running', OLD)
    const release = hold(running)
    const paused = cached('prj_paused', OLD)
    const state = projectStateDir(path.join(paused, '.akb', 'kanban'))
    fs.mkdirSync(state, { recursive: true })
    fs.writeFileSync(path.join(state, SESSIONS_FILE), JSON.stringify({ deliveries: [{ deliveryId: 'd1', status: 'active' }] }))
    markUnsent(cached('prj_unsent', OLD), true)
    await sweepCache(MACHINE, NOW)
    assert.deepEqual([has('prj_running'), has('prj_paused'), has('prj_unsent')], [true, true, true])

    release()
    fs.writeFileSync(path.join(state, SESSIONS_FILE), JSON.stringify({ deliveries: [{ deliveryId: 'd1', status: 'finished' }] }))
    markUnsent(cacheDir('prj_unsent'), false)
    await sweepCache(MACHINE, NOW)
    assert.deepEqual([has('prj_running'), has('prj_paused'), has('prj_unsent')], [false, false, false])
  })

  it('drops by idleness alone when Cloud cannot say who has access', async () => {
    cached('prj_fresh')
    cached('prj_old', OLD)
    await cloud.stop()
    await sweepCache(MACHINE, NOW)
    assert.deepEqual([has('prj_fresh'), has('prj_old')], [true, false])

    fs.rmSync(path.join(runnerHome(), 'session.json'))
    await cloud.start()
    await sweepCache(MACHINE, NOW)
    assert.equal(has('prj_fresh'), true)
  })

  it('empties a linked folder’s .akb/ alone, when idle or no longer this computer’s', async () => {
    const idle = linked(OLD)
    cloud.folders = [{ project: 'prj_1', name: 'Site', path: idle, notify: true, machine: MACHINE }]
    await sweepCache(MACHINE, NOW)
    assert.deepEqual(fs.readdirSync(path.join(idle, '.akb')), [])
    assert.equal(fs.readFileSync(path.join(idle, 'app.ts'), 'utf8'), 'mine')

    const away = linked()
    cloud.folders = []
    await sweepCache(MACHINE, NOW)
    assert.deepEqual(fs.readdirSync(path.join(away, '.akb')), [])

    const kept = linked()
    cloud.folders = [{ project: 'prj_1', name: 'Site', path: kept, notify: true, machine: MACHINE }]
    await sweepCache(MACHINE, NOW)
    assert.ok(fs.existsSync(path.join(kept, '.akb', 'base.json')))
  })

  it('empties the .akb/ of a folder taken off this computer, unless a job holds it', () => {
    const dir = linked()
    const release = hold(dir)
    for (const gone of keepOnly([])) assert.equal(clearAkb(gone), false)
    assert.ok(fs.existsSync(path.join(dir, '.akb', 'base.json')))
    release()
    assert.equal(clearAkb(dir), true)
    assert.deepEqual(fs.readdirSync(path.join(dir, '.akb')), [])
  })

  it('removes the folders from before the cache, and an account folder left empty', () => {
    const home = runnerHome()
    for (const dir of ['boards/prj_1', 'akb-bin', 'acct/unfiled/prj_1/.akb', 'other/unfiled', 'work/j1']) fs.mkdirSync(path.join(home, dir), { recursive: true })
    fs.writeFileSync(path.join(home, 'other', 'keep.json'), '{}')
    removeLegacy()
    for (const gone of ['boards', 'akb-bin', 'acct', 'other/unfiled']) assert.equal(fs.existsSync(path.join(home, gone)), false, gone)
    for (const kept of ['other/keep.json', 'work/j1', 'session.json']) assert.ok(fs.existsSync(path.join(home, kept)), kept)
  })
})
