// A card's stages (#1790): `phases`/`phase` on the card, the Approve that moves it on, and the
// rules that stop at the approval band without touching Build.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { setBoardRoot } from '../src/lib/paths.ts'
import { advancePhase, approvalRequest } from '../src/lib/agent/approve.ts'
import { refinementAfter } from '../src/lib/agent/refine.ts'
import { findCard } from '../src/lib/view/read.ts'
import { awaitingApproval, canImplement, canRefine } from '../src/lib/view/rules.ts'
import { validateSpec } from '../src/lib/spec-contract.ts'
import { move, refuses } from './helpers/board.ts'

describe('a card with stages', () => {
  let root = ''
  const kanban = () => path.join(root, 'docs', 'kanban')
  const fileOf = (id: number) =>
    path.join(kanban(), 'todo', fs.readdirSync(path.join(kanban(), 'todo')).find((f) => f.startsWith(`${id}-`))!)
  const create = async (workflow?: string) =>
    (await move(root, ['create', '--title', 'Launch post', ...(workflow ? ['--workflow', workflow] : [])])).id as number

  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-phases-')))
    fs.mkdirSync(path.join(root, '.git'), { recursive: true })
    fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
    fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
    fs.writeFileSync(path.join(kanban(), 'todo', 'README.md'), '# Tasks\n\n## Tasks\n')
    fs.writeFileSync(path.join(kanban(), 'config.md'), '# Configuration\n\n- **Project** — a project.\n')
    setBoardRoot(root)
  })
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

  it('writes, reads and validates the stages', async () => {
    const id = await create('blog-post')
    await move(root, ['update', String(id), '--phases', '大纲, 文章', '--phase', '1'])
    const text = fs.readFileSync(fileOf(id), 'utf8')
    assert.match(text, /^phases:\n {2}- 大纲\n {2}- 文章\nphase: 1$/m)
    assert.deepEqual([findCard(id)!.phases, findCard(id)!.phase], [['大纲', '文章'], 1])
    assert.deepEqual(validateSpec(fileOf(id), text, id).filter((e) => e.rule.startsWith('phase')), [])

    await refuses(root, ['update', String(id), '--phase', '3'], /--phase must be 1 to 2/)
    await refuses(root, ['update', String(id), '--phases', '大纲'], /at least two stages/)
    const rules = validateSpec(fileOf(id), text.replace('phase: 1', 'phase: 3'), id).map((e) => e.rule)
    assert.ok(rules.includes('phase'))

    await move(root, ['update', String(id), '--phases', ''])
    assert.equal(findCard(id)!.phases, undefined)
    assert.doesNotMatch(fs.readFileSync(fileOf(id), 'utf8'), /^phases?:/m)
  })

  it('leaves a card without stages as it was', async () => {
    const id = await create()
    const card = findCard(id)!
    assert.equal(card.phases, undefined)
    assert.equal(awaitingApproval(card), null)
    assert.equal(canImplement(card), true)
    assert.doesNotMatch(fs.readFileSync(fileOf(id), 'utf8'), /^phases?:/m)
    assert.deepEqual(approvalRequest({ action: 'approve', id }), { error: `#${id} has no stages, so there is nothing to approve.` })
  })

  it('waits on Approve before the last stage, and not on the last one', async () => {
    const id = await create('blog-post')
    await move(root, ['update', String(id), '--phases', 'Outline,Article', '--phase', '1'])
    const first = findCard(id)!
    assert.equal(awaitingApproval(first), 'Outline')
    assert.equal(canRefine(first), false)
    assert.equal(refinementAfter('resolve', id), null)

    assert.equal(awaitingApproval({ ...first, questions: [{ text: '[user] Which angle?' }] }), null)

    const asked = approvalRequest({ action: 'approve', id })
    assert.deepEqual(asked, { action: 'approve', id, title: 'Launch post', notes: undefined })
    // Asking writes nothing; the card moves on once its run is cleared to start.
    assert.equal(findCard(id)!.phase, 1)
    assert.equal(advancePhase(id), null)
    const last = findCard(id)!
    assert.equal(last.phase, 2)
    assert.equal(awaitingApproval(last), null)
    // The last stage is made like today's: a planning pass carries on until it is delivered.
    assert.equal((refinementAfter('approve', id) as { action: string } | null)?.action, 'clarify')
    assert.match((approvalRequest({ action: 'approve', id }) as { error: string }).error, /last stage/)
  })

  it('does not change whether Build is offered', async () => {
    const coding = await create()
    const plan = await create('blog-post')
    for (const id of [coding, plan]) {
      const before = canImplement(findCard(id)!)
      await move(root, ['update', String(id), '--phases', 'A,B,C', '--phase', '2'])
      assert.equal(canImplement(findCard(id)!), before)
    }
  })
})
