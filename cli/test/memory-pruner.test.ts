// A board still carrying the old "Prune the memory" card (#514) is migrated once: the card
// goes, its cadence stays.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { migratePruneMemoryCard } from '../src/lib/recurring.ts'
import { setBoardRoot, UI_CONFIG } from '../src/lib/paths.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')

/** An old prune card, as a board made before this release carries one. */
const pruneCard = (cadence: string): void => {
  const dir = path.join(kanban(), 'todo', 'recurring')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, '9-prune-the-memory.md'),
    [
      '---',
      'title: Prune the memory',
      'priority: med',
      'roi: med',
      'status: todo',
      `cadence: ${cadence}`,
      'blocked_by: []',
      'related: []',
      'modules: []',
      'questions: []',
      '---',
      '',
      'Squeeze the memory files back down.',
      '',
      '## Process',
      '1. Prune it.',
      '',
    ].join('\n'),
  )
}

/** The cadence the board saved for the pruner, if any. */
const savedCadence = (): string | undefined =>
  fs.existsSync(UI_CONFIG) ? JSON.parse(fs.readFileSync(UI_CONFIG, 'utf8')).memoryPrune?.cadence : undefined

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-pruner-'))
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  setBoardRoot(root)
})

afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe('a board still carrying the prune card', () => {
  it('loses the card once and keeps its cadence', () => {
    pruneCard('1d at 09:30')
    const removed = migratePruneMemoryCard()
    assert.match(removed!, /9-prune-the-memory\.md$/)
    assert.equal(savedCadence(), '1d at 09:30')
    assert.deepEqual(fs.readdirSync(path.join(kanban(), 'todo', 'recurring')), [])
    // And a second pass finds nothing to do, so re-running the repair is free.
    assert.equal(migratePruneMemoryCard(), null)
  })

  it('never overwrites a cadence already set on the agent', () => {
    fs.mkdirSync(path.dirname(UI_CONFIG), { recursive: true })
    fs.writeFileSync(UI_CONFIG, JSON.stringify({ memoryPrune: { cadence: '6h' } }))
    pruneCard('1d at 09:30')
    migratePruneMemoryCard()
    assert.equal(savedCadence(), '6h')
  })

  it('takes a card with no cadence off without writing a preference', () => {
    pruneCard('')
    assert.ok(migratePruneMemoryCard())
    assert.equal(fs.existsSync(UI_CONFIG), false)
  })
})
