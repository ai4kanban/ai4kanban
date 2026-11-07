import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, beforeEach, describe, it } from 'node:test'
import type { Job } from '../src/api'
import { progressEvidence, progressFolder, restartFolder } from '../src/handoff'
import { allow } from '../src/folders'

let root: string
let tree: string
let job: Job
const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-333-'))
  git('init', '-b', 'main'); git('config', 'user.email', 'test@example.com'); git('config', 'user.name', '测试')
  fs.writeFileSync(path.join(root, 'app.ts'), '原来的文件\n')
  git('add', '.'); git('commit', '-m', '初始提交')
  tree = path.join(root, '.akb', 'worktrees', '333', 'delivery')
  git('worktree', 'add', '-b', 'card/333/delivery', tree)
  const dir = path.join(root, '.akb', 'kanban', 'deliveries')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'delivery.json'), JSON.stringify({ deliveryId: 'delivery', cardId: 333, base: git('rev-parse', 'HEAD'),
    commitMode: 'auto', branch: 'card/333/delivery', worktree: '.akb/worktrees/333/delivery', startedAt: 1 }))
  job = { id: 'new-execution', runtime: 'codex', projectDir: root, task: 'task_333', number: 333, project: 'prj_333',
    flow: { verb: 'implement', workflow: 'wf_builtin_coding' }, attachments: [], prompt: '', state: 'claimed' }
  allow(root)
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe('换机本地证据', () => {
  it('只读检查记录与实际文件；修改和未跟踪文件都会使证据变化', () => {
    const first = progressEvidence(job, root)
    assert.match(first!, /^[a-f0-9]{64}$/)
    job.handoff = { kind: 'check', started: true, verb: 'implement', evidence: first }
    const before = git('status', '--porcelain')
    assert.equal(git('status', '--porcelain'), before)
    fs.writeFileSync(path.join(tree, 'app.ts'), '尚未提交的改动\n')
    const second = progressEvidence(job, root)
    assert.notEqual(first, second)
    fs.writeFileSync(path.join(tree, 'extra.ts'), '新增文件')
    assert.notEqual(second, progressEvidence(job, root))
  })
  it('只有同名分支、云端卡片或不完整交付时不能声称进度完整', () => {
    fs.rmSync(path.join(root, '.akb', 'kanban', 'deliveries', 'delivery.json'))
    assert.equal(progressEvidence(job, root), null)
    job.handoff = { kind: 'check', started: true }
  })
  it('重启在普通隔离目录运行，保留目标与旧交付的改动，重复目录拒绝覆盖', () => {
    fs.writeFileSync(path.join(root, 'app.ts'), '目标已有改动')
    fs.writeFileSync(path.join(tree, 'app.ts'), '旧交付已有改动')
    const isolated = restartFolder(job, root)
    assert.notEqual(isolated, tree)
    assert.equal(fs.readFileSync(path.join(isolated, 'app.ts'), 'utf8'), '目标已有改动')
    assert.equal(fs.existsSync(path.join(isolated, '.git')), false)
    assert.equal(fs.readFileSync(path.join(root, 'app.ts'), 'utf8'), '目标已有改动')
    assert.equal(fs.readFileSync(path.join(tree, 'app.ts'), 'utf8'), '旧交付已有改动')
    assert.throws(() => restartFolder(job, root), /已存在/)
    const recovery = { ...job, id: 'retry', handoff: { kind: 'execution' as const, action: 'restart' as const, isolation: job.id, recovering: true } }
    fs.writeFileSync(path.join(isolated, 'app.ts'), '新交付的已有进度')
    assert.equal(restartFolder(recovery, root), isolated)
    assert.equal(fs.readFileSync(path.join(isolated, 'app.ts'), 'utf8'), '新交付的已有进度')
  })
  it('再次换机检查上次重启的隔离交付，不误读原项目的旧进度', () => {
    const isolated = restartFolder(job, root)
    const nextTree = path.join(isolated, '.akb', 'worktrees', '333', 'continued')
    git('worktree', 'add', '-b', 'card/333/continued', nextTree)
    const records = path.join(isolated, '.akb', 'kanban', 'deliveries')
    fs.mkdirSync(records, { recursive: true })
    fs.writeFileSync(path.join(records, 'continued.json'), JSON.stringify({ deliveryId: 'continued', cardId: 333,
      base: git('rev-parse', 'HEAD'), commitMode: 'auto', branch: 'card/333/continued',
      worktree: '.akb/worktrees/333/continued', startedAt: 2 }))
    const evidence = progressEvidence(job, isolated)
    job.handoff = { kind: 'check', started: true, verb: 'implement', progressIsolation: job.id, evidence }
    assert.equal(progressFolder(job, root), fs.realpathSync(isolated))
    fs.rmSync(path.join(isolated, '.akb', 'handoff.json'))
    assert.equal(progressFolder({ ...job, handoff: { ...job.handoff, progressIsolation: '../outside' } }, root), null)
  })
})
