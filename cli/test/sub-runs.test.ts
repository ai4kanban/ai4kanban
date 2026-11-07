// A run's sub-runs (#1421): `akb run start` from inside a run, `akb run wait`, and what the
// parent's end does to them.

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import { closeRun, listRuns, openResume, openRun, patch, peekRun } from '../src/lib/agent/sessions.ts'
import { startSubRun } from '../src/lib/agent/start.ts'
import { readRuntimes } from '../src/lib/agent/runtimes.ts'
import { withStore } from '../src/lib/agent/store.ts'
import { setBoardProvider } from '../src/lib/board/index.ts'
import { watchRun } from '../src/lib/agent/watch.ts'
import { cmdSubStart, cmdSubWait } from '../src/commands/run.ts'
import { RUN_ENV } from '../src/lib/agent/env.ts'
import type { DeliveryRecord } from '../src/lib/agent/types.ts'
import { forgetMachineState } from './helpers/board.ts'

let root = ''
const sleepers: number[] = []

/** A live parent run of an agent that does `what` and then exits cleanly. */
function parentRun(what = ''): string {
  const script = path.join(root, 'fake-agent.cjs')
  fs.writeFileSync(script, `${what}\nconsole.log(JSON.stringify({type: 'result', result: 'Done'}));`)
  const opened = openRun({ action: 'prune-memory' }, 'Prune.', [])
  if ('error' in opened) throw new Error(opened.error)
  opened.spec.plan.argv = [process.execPath, script]
  fs.writeFileSync(path.join(SESSIONS_DIR, `${opened.run.sessionId}.plan.json`), JSON.stringify(opened.spec))
  patch(opened.run.sessionId, (r) => {
    r.pid = process.pid
  })
  fs.writeFileSync(opened.run.logPath, '')
  return opened.run.sessionId
}

/** A sub-run of `parent`, alive for as long as a process of its own is. */
function liveSub(parent: string): string {
  const started = startSubRun(parent, 'Module skill: update the QA cases for card #1')
  if ('error' in started) throw new Error(started.error)
  const sleeper = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' })
  sleepers.push(sleeper.pid!)
  patch(started.run.sessionId, (r) => {
    r.pid = sleeper.pid
  })
  fs.writeFileSync(started.run.logPath, '')
  return started.run.sessionId
}

const watch = (id: string): Promise<number> => watchRun(id, async () => ({ error: 'no resume' }))

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-sub-runs-'))
  forgetMachineState(root)
  setBoardRoot(root)
  setBoardProvider(null)
  fs.mkdirSync(path.join(root, 'docs/kanban/todo'), { recursive: true })
  fs.writeFileSync(path.join(root, 'docs/kanban/next-id'), '1\n')
  fs.writeFileSync(path.join(root, 'docs/kanban/todo/README.md'), '# Tasks\n')
})

afterEach(() => {
  delete process.env[RUN_ENV]
  for (const pid of sleepers.splice(0)) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // gone
    }
  }
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('starting a sub-run', () => {
  it('records its parent, and works in its folder, flow and delivery', () => {
    const parent = parentRun()
    patch(parent, (r) => {
      r.cwd = '/somewhere/else'
      r.deliveryId = 'd-1'
      r.cardId = 7
    })
    const started = startSubRun(parent, 'Module docs: card #7')
    if ('error' in started) throw new Error(started.error)
    const sub = peekRun(started.run.sessionId)!
    const was = peekRun(parent)!
    assert.equal(sub.action, 'sub')
    assert.equal(sub.parentId, parent)
    assert.equal(sub.cwd, '/somewhere/else')
    assert.equal(sub.flowId, was.flowId)
    assert.equal(sub.deliveryId, 'd-1')
    assert.equal(sub.cardId, 7)
    assert.equal(sub.input, 'Module docs: card #7')
    const { prompt } = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, `${sub.sessionId}.plan.json`), 'utf8'))
    assert.match(prompt, new RegExp(`^You are a sub-run: run \`${parent}\` started you`))
    assert.match(prompt, /——— your task ———\n\nModule docs: card #7/)
  })

  it("runs on the parent's runtime unless it names one, and refuses one the board lacks", () => {
    const parent = parentRun()
    const [first] = readRuntimes()
    patch(parent, (r) => {
      r.runtime = first!.id
    })
    const inherited = startSubRun(parent, 'a')
    if ('error' in inherited) throw new Error(inherited.error)
    assert.equal(inherited.run.runtime, first!.id)
    const missing = startSubRun(parent, 'a', 'no-such-runtime')
    assert.ok('error' in missing)
    assert.match(missing.error, /no runtime called "no-such-runtime"\. It has: /)
  })

  it('is refused inside a sub-run, and for a run that is not going', async () => {
    const parent = parentRun()
    const sub = liveSub(parent)
    const nested = startSubRun(sub, 'a')
    assert.ok('error' in nested && nested.reason === 'subRunNested')
    await closeRun(parent, { status: 'done' })
    assert.ok('error' in startSubRun(parent, 'a'))
  })

  it('is refused outside a run', async () => {
    delete process.env[RUN_ENV]
    await assert.rejects(() => cmdSubStart(['a'], {}), /for an agent inside a run/)
    await assert.rejects(() => cmdSubWait([]), /for an agent inside a run/)
  })

  it('is never continued on its own', async () => {
    const sub = liveSub(parentRun())
    await closeRun(sub, { status: 'error' })
    const resumed = await openResume(sub)
    assert.ok('error' in resumed && resumed.reason === 'subRunResume')
    assert.equal((await listRuns()).find((r) => r.sessionId === sub)?.canResume, false)
  })
})

describe('waiting on sub-runs', () => {
  it('returns at its limit with the ones still running', async () => {
    const parent = parentRun()
    const sub = liveSub(parent)
    process.env[RUN_ENV] = parent
    const out = await cmdSubWait([], 50)
    assert.deepEqual(out.running, [sub])
  })

  it("gives each ended one's status and last message", async () => {
    const parent = parentRun()
    const sub = liveSub(parent)
    patch(sub, (r) => {
      r.result = 'Updated 2 cases.'
    })
    await closeRun(sub, { status: 'done', ok: true })
    process.env[RUN_ENV] = parent
    const out = await cmdSubWait([sub.slice(0, 8)], 50)
    assert.deepEqual(out.ended, [{ sessionId: sub, status: 'done', result: 'Updated 2 cases.' }])
    assert.deepEqual(out.running, [])
  })
})

describe("the parent's end", () => {
  it('stops its sub-runs still going', async () => {
    const parent = parentRun()
    const sub = liveSub(parent)
    await watch(parent)
    assert.equal(peekRun(parent)?.status, 'done')
    await listRuns()
    assert.equal(peekRun(sub)?.status, 'stopped')
  })

  it('stops a sub-run whose parent is gone', async () => {
    const parent = parentRun()
    const sub = liveSub(parent)
    await closeRun(parent, { status: 'interrupted' })
    await listRuns()
    assert.equal(peekRun(sub)?.stopping, true)
  })
})

describe("a sub-run's end", () => {
  it("leaves its parent's delivery as it was", async () => {
    const parent = parentRun()
    withStore((store) =>
      store.deliveries.push({
        deliveryId: 'd-1',
        cardId: null,
        title: 'A build',
        status: 'active',
        startedAt: Date.now(),
        sessions: [parent],
        approved: 'A build',
        steps: [],
        commitMode: 'auto',
        targetBranch: 'main',
      } as DeliveryRecord),
    )
    patch(parent, (r) => {
      r.deliveryId = 'd-1'
    })
    const sub = liveSub(parent)
    await closeRun(sub, { status: 'done', ok: true })
    const delivery = withStore((store) => store.deliveries.find((d) => d.deliveryId === 'd-1'))
    assert.equal(delivery?.status, 'active')
    assert.deepEqual(delivery?.sessions, [parent])
    assert.deepEqual(delivery?.steps, [])
  })
})
