// A test bundle never spawns a run's watcher (#1298).
//
// The watcher is the built file run again (src/lib/agent/launch.ts's `SELF`), and in a test
// bundle that file is the test itself: detached, it would run the tests again, which start
// the next copy. Only scripts/build.mjs marks a build as the command.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { spawnWatcher } from '../src/lib/agent/launch.ts'
import { startRun } from '../src/lib/agent/start.ts'
import { readRuns } from '../src/lib/agent/store.ts'
import { SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import { move } from './helpers/board.ts'

let root = ''

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-launch-'))
  const kanban = path.join(root, 'docs', 'kanban')
  fs.mkdirSync(path.join(kanban, 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '1\n')
  fs.writeFileSync(path.join(kanban, 'todo', 'README.md'), '# Tasks\n\n## Tasks\n')
  setBoardRoot(root)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('starting a run outside the built command', () => {
  it('spawns nothing and leaves no watcher log', () => {
    assert.equal(spawnWatcher('no-such-run'), undefined)
    assert.equal(fs.existsSync(path.join(SESSIONS_DIR, 'no-such-run.watch.log')), false)
  })

  it('still writes the run down, with no pid', async () => {
    const card = await move(root, ['create', '--title', 'A piece'])
    const started = await startRun({ action: 'clarify', id: card.id as number })
    assert.ok(!('error' in started), 'an ordinary card starts a run')
    assert.equal(started.spawned, false)
    const [run] = readRuns()
    assert.equal(run.sessionId, started.run.sessionId)
    assert.equal(run.status, 'running')
    assert.equal(run.pid, undefined)
  })
})
