import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, it } from 'node:test'
import { readChat } from '../src/lib/agent/chat.ts'
import { readDiscuss } from '../src/lib/agent/discuss.ts'
import { RUN_ENV, DISCUSSION_ENV } from '../src/lib/agent/env.ts'
import { withStore, readRuns, logPathOf } from '../src/lib/agent/store.ts'
import { CHATS_DIR, SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'
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
  delete process.env[RUN_ENV]
  delete process.env[DISCUSSION_ENV]
  restoreMachineHome()
})

it('saves and updates discussion plans without a host or readable machine home', async () => {
  const target = 'discussion-11111111-1111-4111-8111-111111111111'
  process.env[DISCUSSION_ENV] = target
  process.env[RUN_ENV] = 'standalone'
  const draft = path.join(root, 'draft.md')
  fs.writeFileSync(draft, '# First\n')
  const plan = await move(root, ['plan', 'new', '--title', 'First', '--body-file', draft])
  assert.equal((await readDiscuss(target)).plan?.text, '# First\n')
  fs.writeFileSync(draft, '# Revised\n')
  await move(root, ['plan', 'save', '--path', plan.path as string, '--body-file', draft])
  assert.equal((await readDiscuss(target)).plan?.text, '# Revised\n')
  assert.equal(readChat(target)?.plans?.length, 1)
  assert.ok(CHATS_DIR.startsWith(path.join(root, '.akb')))
  assert.equal(fs.existsSync(path.join(root, '.akb/runs')), false)
  assert.match(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), /^\.akb\/$/m)
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
})

it('reports plan persistence failures and retains the draft', async () => {
  await move(root, ['list'])
  fs.writeFileSync(CHATS_DIR, 'Not a directory')
  const draft = path.join(root, 'draft.md')
  fs.writeFileSync(draft, '# Keep me\n')
  await assert.rejects(() => move(root, ['plan', 'new', '--title', 'Failure', '--body-file', draft]), /not saved/)
  assert.equal(fs.readFileSync(draft, 'utf8'), '# Keep me\n')
})
