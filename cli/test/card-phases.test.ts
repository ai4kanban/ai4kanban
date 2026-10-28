// A card's approvals (#1790, #2154): `phase` on the card, the stages its chosen previews make,
// the Approve that moves it on, and the rules that stop at the approval band without touching Build.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { setBoardRoot } from '../src/lib/paths.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { advancePhase } from '../src/lib/agent/approve.ts'
import { refinementAfter } from '../src/lib/agent/refine.ts'
import { findCard } from '../src/lib/view/read.ts'
import { awaitingApproval, canImplement, canRefine } from '../src/lib/view/rules.ts'
import { move } from './helpers/board.ts'

describe('a card with several approvals', () => {
  let root = ''
  const kanban = () => path.join(root, 'docs', 'kanban')
  const create = async (workflow?: string) => {
    const id = (await move(root, ['create', '--title', 'Launch post', ...(workflow ? ['--workflow', workflow] : [])])).id as number
    if (workflow) await move(root, ['update', String(id), '--previews', 'blog-planner,blog-writer'])
    return id
  }

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

  it('waits on Approve before the last approval, and not on the last one', async () => {
    const id = await create('blog-post')
    assert.equal(awaitingApproval(findCard(id)!), null)
    assert.equal(canRefine(findCard(id)!), true)
    await move(root, ['update', String(id), '--status', 'ready'])
    const first = findCard(id)!
    assert.equal(awaitingApproval(first), 1)
    assert.equal(canRefine(first), false)
    assert.equal(refinementAfter('resolve', id), null)
    assert.equal(awaitingApproval({ ...first, questions: [{ text: '[user] Which angle?' }] }), null)
    assert.equal(advancePhase(id), null)
    const last = findCard(id)!
    assert.deepEqual([last.stage, awaitingApproval(last)], [2, null])
    // The last stage is made until it is delivered: a planning pass carries on.
    assert.equal((refinementAfter('approve', id) as { action: string } | null)?.action, 'clarify')
  })

  it('leaves a card with one approval as it was', async () => {
    const id = await create()
    const card = findCard(id)!
    assert.deepEqual([card.stages, awaitingApproval(card), canImplement(card)], [undefined, null, true])
    assert.doesNotMatch(fs.readFileSync(path.join(kanban(), 'todo', fs.readdirSync(path.join(kanban(), 'todo')).find((f) => f.startsWith(`${id}-`))!), 'utf8'), /^phases?:/m)
  })

  it('tells planning in a stage before the last that Approve ends it', async () => {
    const printed = (action: 'clarify' | 'resolve', id: number): string => {
      const sink = startCollecting()
      try {
        printFlow({ action, id })
        return sink.out.join('\n')
      } finally {
        stopCollecting()
      }
    }
    const close = /the board's Approve moves the card on/
    const staged = await create('blog-post')
    const plain = await create()
    for (const action of ['clarify', 'resolve'] as const) {
      assert.match(printed(action, staged), /stage\s+1 of 2/)
      assert.match(printed(action, staged), close)
      assert.doesNotMatch(printed(action, plain), /stage\s+\d+ of|the board's Approve/)
    }
    await move(root, ['update', String(staged), '--phase', '2'])
    for (const action of ['clarify', 'resolve'] as const) {
      assert.match(printed(action, staged), /stage\s+2 of 2/)
      assert.doesNotMatch(printed(action, staged), close)
    }
  })
})
