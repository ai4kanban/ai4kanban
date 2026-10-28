import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, it } from 'node:test'
import { withStore, readRuns, logPathOf } from '../src/lib/agent/store.ts'
import { SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import { move, restoreMachineHome } from './helpers/board.ts'

let home = ''
let root = ''
beforeEach(() => {
  home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-sealed-home-')))
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-local-project-')))
  process.env.AI4KANBAN_HOME = home
  fs.mkdirSync(path.join(root, 'docs/kanban/todo'), { recursive: true })
  fs.writeFileSync(path.join(root, 'docs/kanban/config.md'), '# Configuration\n')
  fs.writeFileSync(path.join(root, 'docs/kanban/next-id'), '8\n')
  setBoardRoot(root)
  fs.chmodSync(home, 0o000)
})
afterEach(() => {
  fs.chmodSync(home, 0o700)
  fs.rmSync(home, { recursive: true, force: true })
  fs.rmSync(root, { recursive: true, force: true })
  restoreMachineHome()
})

it('persists sessions and logs while the machine home is inaccessible', async () => {
  await move(root, ['list'])
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  fs.writeFileSync(logPathOf('local'), 'Finished\n')
  withStore(store => store.runs.push({
    sessionId: 'local', cardId: null, action: 'create', status: 'done',
    startedAt: Date.now(), logPath: logPathOf('local'),
  } as never))
  assert.equal(readRuns()[0]?.sessionId, 'local')
  assert.equal(fs.readFileSync(readRuns()[0]!.logPath, 'utf8'), 'Finished\n')
  assert.ok(SESSIONS_DIR.startsWith(path.join(root, '.akb')))
  assert.match(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), /^\.akb\/$/m)
})
