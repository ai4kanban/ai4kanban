// A run whose sandbox allows only the project (#622).
//
// Codex, Grok, dsh and OpenCode all default to a sandbox that lets the agent write the
// project folder and nothing else, so `~/.ai4kanban` is refused. Nothing under there is the
// repository's, so a refusal must cost this machine's own record and cost the command
// nothing: the card is written, the plan file is named, the board is read.
//
// The machine home is made genuinely read-only here rather than mocked — the failure this
// card is about is an `EACCES` out of `mkdir`, and nothing short of a real one reproduces it.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { collectReports } from '../src/lib/agent/collect.ts'
import { readChat } from '../src/lib/agent/chat.ts'
import { RUN_ENV } from '../src/lib/agent/env.ts'
import { outboxDir } from '../src/lib/agent/outbox.ts'
import { peekRun } from '../src/lib/agent/sessions.ts'
import { logPathOf, withStore } from '../src/lib/agent/store.ts'
import type { RunRecord } from '../src/lib/agent/types.ts'
import { AKB_DIR, LOCK, ROOT_GITIGNORE, SESSIONS_DIR, setBoardDir, setBoardRoot } from '../src/lib/paths.ts'
import { move, restoreMachineHome } from './helpers/board.ts'

let home = ''
let root = ''
const kanban = (): string => path.join(root, 'docs', 'kanban')
const nextId = (): string => path.join(kanban(), 'next-id')

/** The machine home as a sandbox leaves it: there, readable, and refusing every write. */
function sealHome(): void {
  fs.chmodSync(home, 0o500)
}

beforeEach(() => {
  home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-sealed-home-')))
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-sealed-project-')))
  process.env.AI4KANBAN_HOME = home
  delete process.env[RUN_ENV]
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'config.md'), '# Configuration\n\n- **Project** — a project.\n')
  fs.writeFileSync(nextId(), '8\n')
  setBoardRoot(root)
})

afterEach(() => {
  fs.chmodSync(home, 0o700)
  fs.rmSync(home, { recursive: true, force: true })
  fs.rmSync(root, { recursive: true, force: true })
  delete process.env[RUN_ENV]
  restoreMachineHome()
})

describe('a command whose machine home refuses every write', () => {
  it('reads the board', async () => {
    sealHome()
    const listed = await move(root, ['list'])
    assert.equal(listed.board, kanban())
  })

  it('writes the card and takes its id', async () => {
    sealHome()
    const made = await move(root, ['create', '--title', 'A card written in a sandbox'])
    assert.equal(made.id, 8)
    assert.ok(fs.existsSync(path.join(root, made.file as string)))
    assert.equal(fs.readFileSync(nextId(), 'utf8'), '9\n')
  })

  it('writes the plan file and takes its id, with no number skipped', async () => {
    sealHome()
    const plan = await move(root, ['plan', 'new', '--title', 'A plan written in a sandbox'])
    assert.equal(plan.id, 8)
    // The file is the agent's to write; what `plan new` owes it is the folder and the name.
    assert.equal(plan.path, 'plans/8-a-plan-written-in-a-sandbox.md')
    assert.ok(fs.existsSync(path.join(kanban(), 'plans')))
    // The transcript is machine state and went unwritten; the number still moved by one.
    assert.equal(readChat(null), null)
    assert.equal(fs.readFileSync(nextId(), 'utf8'), '9\n')
  })

  it('keeps the ids running on, one command after another', async () => {
    sealHome()
    await move(root, ['plan', 'new', '--title', 'First'])
    const second = await move(root, ['create', '--title', 'Second'])
    const third = await move(root, ['plan', 'new', '--title', 'Third'])
    assert.deepEqual([second.id, third.id], [9, 10])
    assert.equal(fs.readFileSync(nextId(), 'utf8'), '11\n')
  })

  it('leaves the machine folder untouched rather than half made', async () => {
    sealHome()
    await move(root, ['create', '--title', 'A card'])
    assert.deepEqual(fs.readdirSync(home), [])
  })
})

describe("the board's writing lock", () => {
  it('lives in the project, so a sandboxed run can take it', () => {
    assert.equal(LOCK, path.join(AKB_DIR, 'docs-kanban.lock'))
    assert.equal(AKB_DIR, path.join(root, '.akb'))
  })

  it('is one per board, so two boards in one repository never wait on each other', () => {
    const was = LOCK
    setBoardDir(path.join(root, 'marketing', 'kanban'), root)
    assert.equal(LOCK, path.join(root, '.akb', 'marketing-kanban.lock'))
    assert.notEqual(LOCK, was)
    setBoardRoot(root)
  })

  it('is ignored by the repository the first time a write takes it', async () => {
    sealHome()
    await move(root, ['create', '--title', 'A card'])
    assert.match(fs.readFileSync(ROOT_GITIGNORE, 'utf8'), /^\.akb\/$/m)
    // And released: a lock left behind would refuse every write after this one.
    assert.equal(fs.existsSync(LOCK), false)
  })

  it('adds the line once, to a file the user already had', async () => {
    fs.writeFileSync(ROOT_GITIGNORE, 'node_modules/\n')
    sealHome()
    await move(root, ['create', '--title', 'One'])
    await move(root, ['create', '--title', 'Two'])
    const lines = fs.readFileSync(ROOT_GITIGNORE, 'utf8').split('\n')
    assert.equal(lines.filter((line) => line === '.akb/').length, 1)
    assert.equal(lines[0], 'node_modules/')
  })
})

describe('what a sandboxed run tells the board', () => {
  const runner = (over: Partial<RunRecord> = {}): RunRecord => ({
    sessionId: 'sealed-run',
    cardId: null,
    action: 'create',
    status: 'running',
    startedAt: Date.now(),
    harness: 'test',
    logPath: logPathOf('sealed-run'),
    ...over,
  })

  it('leaves its cards and its plan in the project, for the watcher to collect', async () => {
    const run = runner()
    withStore((store) => store.runs.push(run))
    process.env[RUN_ENV] = run.sessionId
    sealHome()

    await move(root, ['create', '--title', 'A card the run wrote'])
    await move(root, ['plan', 'new', '--title', 'A plan the run wrote'])
    assert.equal(fs.readdirSync(outboxDir(run.sessionId)).length, 2)
  })

  it('reaches the record once the machine home takes writes again', async () => {
    const run = runner()
    withStore((store) => store.runs.push(run))
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
    fs.writeFileSync(logPathOf(run.sessionId), '')
    process.env[RUN_ENV] = run.sessionId
    sealHome()

    const made = await move(root, ['create', '--title', 'A card the run wrote'])
    const plan = await move(root, ['plan', 'new', '--title', 'A plan the run wrote'])

    // The watcher is outside the sandbox, so its writes land.
    fs.chmodSync(home, 0o700)
    delete process.env[RUN_ENV]
    await collectReports(run.sessionId)

    assert.deepEqual(peekRun(run.sessionId)?.createdCardIds, [made.id])
    assert.deepEqual(readChat(null)?.plans?.map((p) => p.path), [plan.path])
    // And each report is applied once: a second collection finds nothing left.
    await collectReports(run.sessionId)
    assert.deepEqual(peekRun(run.sessionId)?.createdCardIds, [made.id])
  })

  it('drops the report rather than failing when the project refuses it too', async () => {
    const run = runner()
    withStore((store) => store.runs.push(run))
    process.env[RUN_ENV] = run.sessionId
    sealHome()
    // The board folder still takes writes — `create` has to write the card — but nothing
    // else in the project does, so `.akb/` cannot be made.
    fs.chmodSync(root, 0o500)
    try {
      const made = await move(root, ['create', '--title', 'A card nobody will hear about'])
      assert.equal(made.id, 8)
      assert.equal(fs.existsSync(path.join(root, '.akb')), false)
    } finally {
      fs.chmodSync(root, 0o700)
    }
  })
})
