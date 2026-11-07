// A run whose card lands under it still succeeds (#682).
//
// Landing archives the card it built, and that can happen while another run is still
// working on the same card. The run's closing format check used to read the card's absence
// as destruction — `missing-card`, a failed run, and a repair round that reported it again
// every time. A card that left the board the way a finished card does is not missing, and
// neither is one rejected into the archive.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { setBoardRoot, SESSIONS_DIR } from '../src/lib/paths.ts'
import { cmdRemove } from '../src/commands/remove.ts'
import { RUN_ENV } from '../src/lib/agent/env.ts'
import { findDelivery } from '../src/lib/agent/deliveries.ts'
import { BoardError, quietlyAsync } from '../src/lib/io.ts'
import { cancelDelivery, openRun, leftBoardOnLanding, leftBoardRejected, patch, peekRun } from '../src/lib/agent/sessions.ts'
import { withStore } from '../src/lib/agent/store.ts'
import { setBoardProvider } from '../src/lib/board/index.ts'
import { watchRun } from '../src/lib/agent/watch.ts'
import { forgetMachineState } from './helpers/board.ts'

let root = ''
let file = ''

const card = `---
title: A feature
priority: med
status: implementing
blocked_by: []
related: []
modules: []
questions: []
---

An observable feature.

## Worth noting

<!-- agent -->

## Scope
A requirement.

## Todo
- [ ] Implement it.

## Decided by the agent

### Overruled by the user
`

/** An agent that does `what` to the board and then exits cleanly. */
function fakeRun(what: string, action: 'clarify' | 'resolve' = 'resolve'): string {
  const script = path.join(root, 'fake-agent.cjs')
  fs.writeFileSync(script, `
    const fs = require('node:fs');
    const path = require('node:path');
    ${what}
    console.log(JSON.stringify({type: 'result', result: 'Done'}));
  `)
  fs.writeFileSync(
    path.join(root, 'docs/kanban/ui.config.json'),
    JSON.stringify({ harness: 'claude-code', harnessSettings: { 'claude-code': { command: `${process.execPath} ${script}` } } }),
  )
  const opened = openRun({ action, id: 1 }, 'Apply the answers.', [])
  if ('error' in opened) throw new Error(opened.error)
  opened.spec.plan.argv = [process.execPath, script]
  opened.spec.plan.harness = 'claude-code'
  fs.writeFileSync(path.join(SESSIONS_DIR, `${opened.run.sessionId}.plan.json`), JSON.stringify(opened.spec))
  patch(opened.run.sessionId, (r) => { r.pid = process.pid })
  return opened.run.sessionId
}

/** Move the card into `.archive/`, the way a landing does. */
const archives = (): string => `
    const archive = ${JSON.stringify(path.join(root, 'docs/kanban/.archive'))};
    fs.mkdirSync(archive, {recursive: true});
    fs.renameSync(${JSON.stringify(file)}, path.join(archive, '1-feature.md'));
`
/** File the card as rejected, the way `akb raw reject` does. A discard leaves no reason. */
const rejects = (mark = 'rejected: true\nrejected_reason: Not needed'): string => `
    const archive = ${JSON.stringify(path.join(root, 'docs/kanban/.archive'))};
    fs.mkdirSync(archive, {recursive: true});
    const marked = fs.readFileSync(${JSON.stringify(file)}, 'utf8').replace('questions: []', ${JSON.stringify(`${mark}\nquestions: []`)});
    fs.writeFileSync(path.join(archive, '1-feature.md'), marked);
    fs.rmSync(${JSON.stringify(file)});
`
/** Delete it outright, the way nothing on the board ever should. */
const deletes = (): string => `fs.rmSync(${JSON.stringify(file)});`

const logOf = (id: string): string => fs.readFileSync(peekRun(id)!.logPath, 'utf8')

/** A delivery for card 1 that landed a commit, with no `.archive/` to read — which is what
 *  a Cloud board's local copy looks like. */
function landedDelivery(): void {
  withStore((store) => {
    store.deliveries.push({
      deliveryId: 'd1', cardId: 1, title: 'A feature', status: 'finished',
      startedAt: 1, endedAt: 2, sessions: [], approved: '', steps: [],
      landing: { status: 'landed', attempts: 1, commit: 'c1e0306d', at: 2 },
    })
  })
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-landed-card-'))
  forgetMachineState(root)
  setBoardRoot(root)
  setBoardProvider(null)
  file = path.join(root, 'docs/kanban/todo/1-feature.md')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, card)
  fs.writeFileSync(path.join(root, 'docs/kanban/next-id'), '3\n')
  fs.writeFileSync(path.join(path.dirname(file), 'README.md'), '# Tasks\n\n- [ ] #1 [A feature](1-feature.md)\n')
})

afterEach(() => {
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('a card archived by its own landing mid-run', () => {
  it('closes the run as done and says so in the log', async () => {
    const id = fakeRun(archives())
    await watchRun(id, async () => ({ error: 'no resume' }))
    assert.equal(peekRun(id)?.status, 'done')
    const log = logOf(id)
    assert.doesNotMatch(log, /missing-card/)
    assert.match(log, /\[board\] Task #1 left the board with its landing/)
  })

  it('is not reported again by a format repair that already listed it', async () => {
    const id = fakeRun(archives())
    patch(id, (r) => {
      r.formatRepair = { attempt: 1, errors: 'Task #1 disappeared.', cardIds: [1], changedIds: [], existingIds: [] }
    })
    await watchRun(id, async () => ({ error: 'no resume' }))
    assert.equal(peekRun(id)?.status, 'done')
    assert.doesNotMatch(logOf(id), /missing-card/)
    assert.equal(peekRun(id)?.formatRepair, undefined)
  })

  it('is dropped from the repair list while another card still fails', async () => {
    const other = path.join(path.dirname(file), '2-other.md')
    fs.writeFileSync(other, card.replace('title: A feature', 'title: Another feature'))
    const id = fakeRun(`${archives()}\n    fs.writeFileSync(${JSON.stringify(other)}, 'no frontmatter\\n');`)
    patch(id, (r) => {
      r.formatRepair = { attempt: 1, errors: 'Task #1 disappeared.', cardIds: [1, 2], changedIds: [], existingIds: [] }
    })
    await watchRun(id, async () => ({ error: 'no resume' }))
    assert.equal(peekRun(id)?.status, 'error')
    assert.doesNotMatch(logOf(id), /missing-card/)
    assert.match(logOf(id), /\[board\] Task #1 left the board with its landing/)
    assert.deepEqual(peekRun(id)?.formatRepair?.cardIds, [2])
  })

  it('is recognised off a landed delivery when the board keeps no archive', async () => {
    const id = fakeRun(deletes())
    landedDelivery()
    await watchRun(id, async () => ({ error: 'no resume' }))
    assert.equal(peekRun(id)?.status, 'done')
    assert.doesNotMatch(logOf(id), /missing-card/)
  })
})

describe('a planning run that rejects its own card', () => {
  const closesClean = (id: string): void => {
    assert.equal(peekRun(id)?.status, 'done')
    assert.equal(peekRun(id)?.formatRepair, undefined)
    const log = logOf(id)
    assert.doesNotMatch(log, /missing-card/)
    assert.doesNotMatch(log, /left the board with its landing/)
    assert.match(log, /\[board\] Task #1 was rejected/)
  }

  for (const action of ['clarify', 'resolve'] as const) {
    it(`closes a ${action} run as done`, async () => {
      const id = fakeRun(rejects(), action)
      await watchRun(id, async () => ({ error: 'no resume' }))
      closesClean(id)
    })
  }

  it('closes a --discard the same way', async () => {
    const id = fakeRun(rejects('rejected: true'))
    await watchRun(id, async () => ({ error: 'no resume' }))
    closesClean(id)
  })

  it('closes a subtask rejected along with its group', async () => {
    const group = path.join(path.dirname(file), '2-group')
    fs.mkdirSync(group)
    fs.writeFileSync(path.join(group, 'root.md'), card.replace('title: A feature', 'title: A group'))
    const inGroup = path.join(group, '1-feature.md')
    fs.renameSync(file, inGroup)
    const archive = path.join(root, 'docs/kanban/.archive')
    const id = fakeRun(`
      for (const name of ['root.md', '1-feature.md']) {
        const at = path.join(${JSON.stringify(group)}, name);
        fs.writeFileSync(at, fs.readFileSync(at, 'utf8').replace('questions: []', 'rejected: true\\nquestions: []'));
      }
      fs.mkdirSync(${JSON.stringify(archive)}, {recursive: true});
      fs.renameSync(${JSON.stringify(group)}, path.join(${JSON.stringify(archive)}, '2-group'));
    `)
    await watchRun(id, async () => ({ error: 'no resume' }))
    closesClean(id)
  })

  it('leaves leftBoardOnLanding false', async () => {
    const id = fakeRun(rejects())
    await watchRun(id, async () => ({ error: 'no resume' }))
    assert.equal(leftBoardRejected(1), true)
    assert.equal(leftBoardOnLanding(1), false)
  })
})

describe('a discard answer to a build held on a question (#241)', () => {
  const git = (...args: string[]): string => {
    const ran = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
    assert.equal(ran.status, 0, ran.stderr)
    return ran.stdout.trim()
  }

  function heldBuild(): { worktree: string; branch: string } {
    fs.writeFileSync(file, card.replace('questions: []', 'questions:\n  - Keep building?'))
    git('init', '--quiet', '-b', 'main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'test')
    fs.writeFileSync(path.join(root, 'code.txt'), 'one\n')
    git('add', 'code.txt')
    git('commit', '--quiet', '-m', 'start')
    const at = { worktree: '.akb/worktrees/1/d1', branch: 'card/1/d1' }
    git('worktree', 'add', '--quiet', '-b', at.branch, at.worktree, 'HEAD')
    withStore((store) => {
      store.deliveries.push({
        deliveryId: 'd1', cardId: 1, title: 'A feature', status: 'active',
        startedAt: 1, sessions: [], approved: card, steps: [], commitMode: 'auto',
        priorStatus: 'ready', targetBranch: 'main', ...at,
        landing: { status: 'waiting', attempts: 0, at: 2, why: 'held on an open question' },
      })
    })
    return at
  }

  async function resolving(id: string, moves: () => Promise<void>): Promise<void> {
    const previous = process.env[RUN_ENV]
    process.env[RUN_ENV] = id
    try {
      await quietlyAsync(moves)
    } finally {
      if (previous === undefined) delete process.env[RUN_ENV]
      else process.env[RUN_ENV] = previous
    }
  }

  it('cancels the delivery, rejects the card and closes the resolve run as done', async () => {
    const at = heldBuild()
    const id = fakeRun('')
    await resolving(id, async () => {
      assert.equal((await cancelDelivery('d1')).ok, true)
      cmdRemove(1, 'rejected', { reason: 'No longer needed.' })
    })
    await watchRun(id, async () => ({ error: 'no resume' }))
    assert.equal(peekRun(id)?.status, 'done')
    assert.equal(findDelivery('d1')?.status, 'cancelled')
    assert.equal(findDelivery('d1')?.answers, undefined)
    assert.equal(fs.existsSync(path.join(root, at.worktree)), true)
    assert.ok(git('branch', '--list', at.branch).includes(at.branch))
    assert.equal(leftBoardRejected(1), true)
    const archived = fs.readFileSync(path.join(root, 'docs/kanban/.archive/1-feature.md'), 'utf8')
    assert.match(archived, /rejected: true/)
    assert.match(archived, /Keep building\?/)
    assert.doesNotMatch(logOf(id), /missing-card/)
  })

  it('still refuses rejection without cancelling the delivery', async () => {
    const at = heldBuild()
    const id = fakeRun('')
    await resolving(id, async () => {
      assert.throws(() => cmdRemove(1, 'rejected', { reason: 'No longer needed.' }),
        (error: unknown) => error instanceof BoardError && error.kind === 'card-held')
    })
    assert.equal(findDelivery('d1')?.status, 'active')
    assert.equal(fs.existsSync(path.join(root, at.worktree)), true)
    assert.equal(leftBoardRejected(1), false)
  })
})

describe('a card a run simply deleted', () => {
  it('still fails the run and asks for the card back', async () => {
    const id = fakeRun(deletes())
    await watchRun(id, async () => ({ error: 'no resume' }))
    assert.equal(peekRun(id)?.status, 'error')
    assert.match(peekRun(id)?.error ?? '', /\[missing-card\] Task #1 disappeared/)
    assert.equal(leftBoardRejected(1), false)
  })
})

describe('leftBoardOnLanding', () => {
  it('is false for a card still on the board, and for one nothing landed', () => {
    assert.equal(leftBoardOnLanding(1), false)
    fs.rmSync(file)
    assert.equal(leftBoardOnLanding(1), false)
  })

  it('is true off the archive, and off a delivery that landed a commit', () => {
    const archive = path.join(root, 'docs/kanban/.archive')
    fs.mkdirSync(archive, { recursive: true })
    fs.renameSync(file, path.join(archive, '1-feature.md'))
    assert.equal(leftBoardOnLanding(1), true)
    fs.rmSync(archive, { recursive: true, force: true })
    assert.equal(leftBoardOnLanding(1), false)
    landedDelivery()
    assert.equal(leftBoardOnLanding(1), true)
  })
})
