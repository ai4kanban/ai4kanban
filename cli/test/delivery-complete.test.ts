import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, beforeEach, it } from 'node:test'
import { buildAkbProgram } from '../src/lib/cli/akb.ts'
import { completeDelivery } from '../src/lib/agent/complete.ts'
import { activeDelivery, findDelivery, joinDelivery, settleOrphanedDeliveries } from '../src/lib/agent/deliveries.ts'
import { RUN_ENV } from '../src/lib/agent/env.ts'
import { deliveryStep, nextDeliveryRun } from '../src/lib/agent/progress.ts'
import { ruleFor } from '../src/lib/agent/rules.ts'
import { agentForRun } from '../src/lib/agent/runner.ts'
import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { closeRun, cancelDelivery, openRun } from '../src/lib/agent/sessions.ts'
import { logPathOf, readAction, withStore } from '../src/lib/agent/store.ts'
import type { RunRecord } from '../src/lib/agent/types.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { move, refuses, run } from './helpers/board.ts'

let root: string
let card: string
let deliveryId: string
const sha = 'a'.repeat(40)

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-complete-'))
  fs.mkdirSync(path.join(root, 'docs/kanban/todo'), { recursive: true })
  setBoardRoot(root)
  delete process.env[RUN_ENV]
  await move(root, ['create', '--id', '1', '--title', 'Deliver it'])
  card = path.join(root, 'docs/kanban/todo/1-deliver-it.md')
  fs.writeFileSync(card, fs.readFileSync(card, 'utf8').replace('- [ ] ', '- [x] '))
  deliveryId = open('first')
  process.env[RUN_ENV] = 'first'
})
afterEach(() => {
  delete process.env[RUN_ENV]
  fs.rmSync(root, { recursive: true, force: true })
})
function open(sessionId: string): string {
  return withStore((store) => {
    const run: RunRecord = { sessionId, cardId: 1, action: 'implement', status: 'running', startedAt: Date.now(),
      harness: 'claude-code', logPath: logPathOf(sessionId) }
    fs.mkdirSync(path.dirname(run.logPath), { recursive: true })
    fs.writeFileSync(run.logPath, '')
    store.runs.push(run)
    return joinDelivery(store, run, 'Deliver it', 'implement').deliveryId
  })
}
function patch(change: (delivery: NonNullable<ReturnType<typeof findDelivery>>) => void) {
  withStore((store) => change(store.deliveries.find((d) => d.deliveryId === deliveryId)!))
}

it('does not finish on a successful process exit', async () => {
  await closeRun('first', { status: 'done' })
  assert.equal(activeDelivery(1)?.status, 'active')
  assert.ok(fs.existsSync(card))
})
it('requires ownership and paired full software results', async () => {
  patch((d) => { d.base = sha })
  for (const result of [{}, { commit: sha }, { branch: 'main' }, { commit: 'abc', branch: 'main' }]) {
    assert.throws(() => completeDelivery(deliveryId, result))
  }
  process.env[RUN_ENV] = 'stranger'
  assert.throws(() => completeDelivery(deliveryId, { commit: sha, branch: 'main' }), /own/)
  process.env[RUN_ENV] = 'first'
  await refuses(root, ['archive', '1'], /delivery complete/)
})
it('asks a merged commit only of a land agent declaring akb.merges', () => {
  patch((d) => { d.base = sha; d.workflow!.land = [{ agent: 'blog-writer', extra: '' }] })
  assert.equal(completeDelivery(deliveryId).finished, true)
})
it('lets the builder finish without a commit outside git', () => {
  assert.equal(findDelivery(deliveryId)?.base, undefined)
  assert.equal(completeDelivery(deliveryId).finished, true)
  assert.equal(fs.existsSync(card), false)
  assert.equal(findDelivery(deliveryId)?.landing, undefined)
})
it('archives once and returns the same handoff on repeated completion', () => {
  const result = completeDelivery('1', { commit: sha, branch: 'main' })
  assert.equal(result.finished, true)
  assert.ok(result.note)
  assert.equal(fs.existsSync(card), false)
  assert.deepEqual(completeDelivery(deliveryId, { commit: sha, branch: 'main' }), result)
  assert.throws(() => completeDelivery(deliveryId, { commit: 'b'.repeat(40), branch: 'main' }), /different/)
  assert.equal(findDelivery(deliveryId)?.landing?.commit, sha)
})
it('keeps a failed archive retryable and lets a resumed run finish the receipt', async () => {
  fs.appendFileSync(card, '\n## Todo\n- [ ] Finish validation\n')
  assert.throws(() => completeDelivery(deliveryId, { commit: sha, branch: 'main' }))
  assert.equal(findDelivery(deliveryId)?.status, 'active')
  assert.equal(deliveryStep(findDelivery(deliveryId)!), 0)
  fs.writeFileSync(card, fs.readFileSync(card, 'utf8').replaceAll('- [ ] ', '- [x] '))
  await closeRun('first', { status: 'stopped' })
  open('resumed')
  process.env[RUN_ENV] = 'resumed'
  assert.equal(completeDelivery(deliveryId, { commit: sha, branch: 'main' }).finished, true)
})
it('records workflow steps in order and retains the earlier code result', async () => {
  patch((d) => { d.workflow!.land = [{ agent: 'builder', extra: '' }, { agent: 'blog-writer', extra: '' }]; d.rules = { builder: 'Builder rule', 'blog-writer': 'Writer rule' } })
  assert.equal(completeDelivery(deliveryId, { commit: sha, branch: 'main' }).finished, false)
  assert.ok(fs.existsSync(card))
  assert.equal(completeDelivery(deliveryId, { commit: sha, branch: 'main' }).finished, false)
  await closeRun('first', { status: 'done' })
  const next = nextDeliveryRun(deliveryId)!
  assert.equal(next.deliveryId, deliveryId)
  assert.equal(agentForRun(next), 'blog-writer')
  assert.equal(ruleFor(next, findDelivery(deliveryId)!.rules), 'Writer rule')
  assert.doesNotMatch(buildPrompt(next), /you, the `builder` agent/)
  open('second')
  process.env[RUN_ENV] = 'second'
  assert.equal(completeDelivery(deliveryId).finished, true)
  assert.equal(findDelivery(deliveryId)?.landing?.commit, sha)
})
it('validates file outputs without a Git repository', () => {
  patch((d) => { d.workflow!.needsArtifact = true; d.workflow!.land = [{ agent: 'blog-writer', extra: '' }] })
  assert.throws(() => completeDelivery(deliveryId), /no output/)
  fs.appendFileSync(card, '\n- [x] Output: `out/article.md`\n')
  assert.throws(() => completeDelivery(deliveryId), /missing/)
  fs.mkdirSync(path.join(root, 'out'))
  fs.writeFileSync(path.join(root, 'out/article.md'), 'Delivered')
  assert.equal(completeDelivery(deliveryId).finished, true)
  assert.equal(fs.existsSync(path.join(root, '.git')), false)
})
it('retains old Git context and leaves directories intact on cancel', async () => {
  const tree = path.join(root, '.akb/worktrees/1/legacy')
  fs.mkdirSync(tree, { recursive: true })
  fs.writeFileSync(path.join(tree, 'pending.txt'), 'work')
  patch((d) => { d.worktree = tree; d.branch = 'card/1/legacy'; d.base = sha; d.landing = { status: 'landing', at: 1, attempts: 1 } })
  await closeRun('first', { status: 'stopped' })
  await cancelDelivery(deliveryId)
  assert.equal(fs.readFileSync(path.join(tree, 'pending.txt'), 'utf8'), 'work')
  assert.equal(findDelivery(deliveryId)?.branch, 'card/1/legacy')
  assert.equal(readAction('conflict'), 'implement')
  const stale = openRun({ action: 'implement', id: 1, deliveryId }, 'Continue', [])
  assert.ok('error' in stale)
  assert.equal(findDelivery(deliveryId)?.status, 'cancelled')
})
it('keeps questions open and supersedes changed approved requirements', async () => {
  patch((d) => { d.answers = [{ outcome: 'changed', why: 'New requirement', at: Date.now() }] })
  assert.throws(() => completeDelivery(deliveryId, { commit: sha, branch: 'main' }), /superseded/)
  await closeRun('first', { status: 'done' })
  const next = nextDeliveryRun(deliveryId)
  assert.equal(next?.id, 1)
  assert.equal(next?.deliveryId, undefined)
  assert.equal(findDelivery(deliveryId)?.status, 'cancelled')
})

it('delivers through the CLI after agent-owned conflict repair, checks and a newer target', async () => {
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  git('init', '-q', '-b', 'main')
  git('config', 'user.name', 'Test')
  git('config', 'user.email', 'test@example.com')
  fs.writeFileSync(path.join(root, 'app.txt'), 'base\n')
  git('add', 'app.txt')
  git('commit', '-qm', 'base')
  const base = git('rev-parse', 'HEAD')
  const tree = path.join(root, '.akb/worktrees/1/builder')
  git('worktree', 'add', '-b', 'card/1/builder', tree, base)
  const atTree = (...args: string[]) => execFileSync('git', ['-C', tree, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  patch((d) => { d.base = base; d.targetBranch = 'main'; d.branch = 'card/1/builder'; d.worktree = tree })
  fs.writeFileSync(path.join(root, 'app.txt'), 'target\n')
  git('commit', '-am', 'parallel change')
  fs.writeFileSync(path.join(tree, 'app.txt'), 'task\n')
  atTree('commit', '-am', 'task')
  assert.throws(() => atTree('merge', 'main'))
  const mergeHead = path.resolve(tree, atTree('rev-parse', '--git-path', 'MERGE_HEAD'))
  await closeRun('first', { status: 'interrupted' })
  assert.equal(fs.existsSync(mergeHead), true, 'the runtime must preserve unfinished Git state')
  assert.ok(fs.existsSync(card))
  open('git-resumed')
  process.env[RUN_ENV] = 'git-resumed'
  fs.writeFileSync(path.join(tree, 'app.txt'), 'target and task\n')
  atTree('add', 'app.txt')
  atTree('commit', '-m', 'resolve both intentions')
  const check = () => execFileSync(process.execPath, ['-e', "const fs=require('fs');if(fs.readFileSync('app.txt','utf8')!=='target and task\\n')process.exit(1)"], { cwd: tree })
  fs.writeFileSync(path.join(tree, 'app.txt'), 'broken\n')
  assert.throws(check)
  assert.equal(findDelivery(deliveryId)?.status, 'active')
  fs.writeFileSync(path.join(tree, 'app.txt'), 'target and task\n')
  fs.writeFileSync(path.join(root, 'parallel.txt'), 'another target update')
  git('add', 'parallel.txt')
  git('commit', '-qm', 'newer target')
  atTree('merge', 'main', '--no-edit')
  check()
  const commit = atTree('rev-parse', 'HEAD')
  git('merge', '--ff-only', 'card/1/builder')
  git('merge-base', '--is-ancestor', commit, 'main')
  await run(root, ['delivery', 'complete', '1', '--commit', commit, '--branch', 'main', '--json'])
  assert.equal(findDelivery(deliveryId)?.status, 'finished')
  assert.equal(findDelivery(deliveryId)?.landing?.commit, commit)
  assert.equal(fs.readFileSync(path.join(root, 'parallel.txt'), 'utf8'), 'another target update')
  assert.equal(fs.existsSync(tree), true)
})

it('recovers an archive interrupted after the card moved and repairs its index', async () => {
  const index = path.join(root, 'docs/kanban/todo/README.md')
  fs.writeFileSync(index, '- [Deliver it](1-deliver-it.md)\n')
  const rename = fs.renameSync
  fs.renameSync = (from, to) => {
    rename(from, to)
    if (String(from) === card) throw new Error('Interrupted after archive move')
  }
  try {
    assert.throws(() => completeDelivery(deliveryId, { commit: sha, branch: 'main' }), /Interrupted/)
  } finally { fs.renameSync = rename }
  assert.equal(fs.existsSync(card), false)
  assert.equal(findDelivery(deliveryId)?.status, 'active')
  await closeRun('first', { status: 'interrupted' })
  assert.equal(findDelivery(deliveryId)?.status, 'active')
  assert.equal(open('after-archive'), deliveryId)
  process.env[RUN_ENV] = 'after-archive'
  const result = completeDelivery(deliveryId, { commit: sha, branch: 'main' })
  assert.equal(result.finished, true)
  assert.doesNotMatch(fs.readFileSync(index, 'utf8'), /1-deliver-it/)
  assert.deepEqual(completeDelivery(deliveryId, { commit: sha, branch: 'main' }), result)
})

it('recovers a non-Git delivery from its local log when its live index is lost', async () => {
  await closeRun('first', { status: 'done' })
  withStore((store) => { store.runs = []; store.deliveries = [] })
  assert.equal(activeDelivery(1), undefined)
  const recovered = settleOrphanedDeliveries()
  assert.deepEqual(recovered.recovered.map((d) => d.deliveryId), [deliveryId])
  assert.equal(activeDelivery(1)?.status, 'active')
})

it('rejects retired Git commands and keeps leaf arguments strict', async () => {
  for (const args of [
    ['delivery', 'conflict', '1'], ['delivery', 'blocked', '1', 'why'],
    ['delivery', 'discard', '1', '--yes'], ['workflow', 'worktree', 'coding', 'on'],
  ]) {
    const program = buildAkbProgram({ program: 'akb', cwd: root, installHint: '' })
    await assert.rejects(() => program.parseAsync(args, { from: 'user' }), { code: 'commander.unknownCommand' })
  }
  await assert.rejects(() => run(root, ['delivery', 'complete', '1', 'extra']), /too many arguments/)
  await assert.rejects(() => run(root, ['workflow', 'list', '--unexpected']), /unknown option/)
})

it('replays the durable completion receipt when a legacy writer drops live receipt fields', () => {
  const result = completeDelivery(deliveryId, { commit: sha, branch: 'main' })
  patch((d) => { delete d.completions })
  assert.deepEqual(completeDelivery(deliveryId, { commit: sha, branch: 'main' }), result)
  assert.equal(findDelivery(deliveryId)?.completions?.length, 1)
})
