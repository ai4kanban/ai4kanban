import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { collectReports } from '../src/lib/agent/collect.ts'
import { readChat } from '../src/lib/agent/chat.ts'
import { findDelivery } from '../src/lib/agent/deliveries.ts'
import { readDiscuss, startedPlanning } from '../src/lib/agent/discuss.ts'
import { planFromText, readPlan } from '../src/lib/plans.ts'
import { RUN_ENV, DISCUSSION_ENV } from '../src/lib/agent/env.ts'
import { REPORT_ENV, outboxDir } from '../src/lib/agent/outbox.ts'
import { peekRun, openRun } from '../src/lib/agent/sessions.ts'
import { logPathOf, withStore } from '../src/lib/agent/store.ts'
import type { RunRecord, AgentRequest } from '../src/lib/agent/types.ts'
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
  delete process.env[REPORT_ENV]
  delete process.env[DISCUSSION_ENV]
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
  delete process.env[REPORT_ENV]
  delete process.env[DISCUSSION_ENV]
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

  it('refuses an unpersisted plan instead of claiming success', async () => {
    const draft = path.join(root, 'draft.md')
    fs.writeFileSync(draft, '# An outcome\n')
    sealHome()
    await assert.rejects(() => move(root, ['plan', 'new', '--title', 'First', '--body-file', draft]), /not saved/)
    assert.equal(readChat(null), null)
    assert.equal(fs.existsSync(path.join(kanban(), 'plans')), false)
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

  for (const entry of ['run', 'chat'] as const) {
    it(`${entry} confirms the body and visible handoff through its host`, async () => {
      const run = runner()
      withStore((store) => store.runs.push(run))
      fs.mkdirSync(SESSIONS_DIR, { recursive: true })
      fs.writeFileSync(logPathOf(run.sessionId), '')
      const session = entry === 'run' ? run.sessionId : 'chat-test'
      process.env[entry === 'run' ? RUN_ENV : REPORT_ENV] = session
      const target = entry === 'chat' ? 'discussion-11111111-1111-4111-8111-111111111111' : null
      if (target) process.env[DISCUSSION_ENV] = target
      const draft = path.join(root, 'draft.md')
      fs.writeFileSync(draft, '# Saved outcome\n\nReady to plan or build.\n')
      sealHome()
      const timer = setInterval(() => {
        if (!fs.existsSync(outboxDir(session))) return
        fs.chmodSync(home, 0o700)
        void collectReports(session)
      }, 10)
      try {
        const plan = await move(root, ['plan', 'new', '--title', 'Saved outcome', '--body-file', draft])
        assert.equal(plan.id, 8)
        assert.equal(fs.readFileSync(nextId(), 'utf8'), '9\n')
        const visible = await readDiscuss(target)
        assert.equal(visible.plan?.text, fs.readFileSync(draft, 'utf8'))
        assert.equal(visible.run, null)
        assert.equal(readPlan(planFromText(visible.plan!.path)!)?.text, visible.plan?.text)
        assert.equal(fs.existsSync(path.join(kanban(), 'plans')), false)
        fs.writeFileSync(draft, '# Revised outcome\n')
        await move(root, ['plan', 'save', '--path', plan.path as string, '--body-file', draft])
        assert.equal((await readDiscuss(target)).plan?.text, '# Revised outcome\n')
        assert.equal(readChat(target)?.plans?.length, 1)
        assert.equal(fs.readFileSync(nextId(), 'utf8'), '9\n')
        for (const action of ['create', 'implement'] as const) {
          const opened = openRun({ action, plan: visible.plan!.path } as AgentRequest, 'Use the saved plan')
          assert.ok(!('error' in opened))
          if (action === 'implement') {
            assert.equal(findDelivery(opened.run.deliveryId!)?.approved, '# Revised outcome')
          }
          startedPlanning(opened.run.sessionId, action === 'create' ? 'plan' : 'build', target)
          assert.equal((await readDiscuss(target)).run?.running, true)
        }
      } finally { clearInterval(timer) }
    })
  }

  it('reports host persistence failure and retries the reserved id', async () => {
    const draft = path.join(root, 'draft.md')
    fs.writeFileSync(draft, '# Keep this draft\n')
    process.env[REPORT_ENV] = 'chat-failure'
    sealHome()
    const timer = setInterval(() => { void collectReports('chat-failure') }, 10)
    try {
      await assert.rejects(() => move(root, ['plan', 'new', '--title', 'Outcome', '--body-file', draft]), /not saved/)
      assert.equal((await readDiscuss()).plan, null)
      assert.equal(fs.readFileSync(draft, 'utf8'), '# Keep this draft\n')
      fs.chmodSync(home, 0o700)
      const saved = await move(root, ['plan', 'save', '--path', 'plans/8-outcome.md', '--body-file', draft])
      assert.equal(saved.id, 8)
      assert.equal(fs.readFileSync(nextId(), 'utf8'), '9\n')
      assert.equal((await readDiscuss()).plan?.text, '# Keep this draft\n')
    } finally { clearInterval(timer) }
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
