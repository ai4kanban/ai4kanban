// How a refinement loop ends. The loop runs one pass at a time and each pass decides for
// itself whether the card is settled — so the one thing the board owes the user is a word
// when a loop ends with the card still rough. That failure is silent by nature: a card left
// at `todo` looks exactly like a card nobody has refined yet. These tests are what fixes it.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { setBoardRoot } from '../src/lib/paths.ts'
import { markBoard, refinementRunsAfter, type BoardMarks } from '../src/lib/agent/refine.ts'
import type { RunRecord } from '../src/lib/agent/types.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-refine-'))
const TRACK = path.join(root, 'docs', 'kanban', 'todo', 'skill')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(TRACK, { recursive: true })
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

const CARD = path.join(TRACK, '7-a-card-to-refine.md')

function writeCard(opts: { status?: string; body?: string } = {}): void {
  fs.writeFileSync(
    CARD,
    [
      '---',
      'title: A card to refine',
      'track: skill',
      'priority: med',
      'roi: med',
      `status: ${opts.status ?? 'todo'}`,
      'release: ""',
      'blocked_by: []',
      'related: []',
      'modules: []',
      'questions: []',
      '---',
      '',
      opts.body ?? 'The plan as it stands.',
      '',
      '## Todo',
      '',
      '- [ ] build it',
      '',
    ].join('\n'),
  )
}

// One finished refinement pass on #7, at a given round of the loop.
const pass = (round: number): RunRecord => ({
  sessionId: 's',
  cardId: 7,
  action: 'refine',
  status: 'done',
  startedAt: 0,
  harness: 'test',
  logPath: '/dev/null',
  refineRound: round,
})

// The board as it stood before that pass, then what the pass left behind.
function afterPass(round: number, wrote: () => void): ReturnType<typeof refinementRunsAfter> {
  const before: BoardMarks = markBoard()
  wrote()
  return refinementRunsAfter(pass(round), before)
}

describe('a refinement loop that keeps going', () => {
  it('starts the next pass when the card changed and rounds are left', () => {
    writeCard()
    const { runs, stalled } = afterPass(2, () => writeCard({ body: 'A sharper plan.' }))
    assert.equal(stalled, undefined)
    assert.deepEqual(
      runs.map((r) => [r.action, r.id, r.refineRound]),
      [['refine', 7, 3]],
    )
  })

  it('ends without a word when the pass marked the card ready', () => {
    writeCard()
    const { runs, stalled } = afterPass(2, () => writeCard({ status: 'ready', body: 'Approved.' }))
    assert.equal(stalled, undefined)
    assert.deepEqual(runs, [])
  })
})

describe('a refinement loop that ends with the card still rough', () => {
  it('says so when the pass left it at todo without approving it', () => {
    writeCard()
    const { runs, stalled } = afterPass(2, () => {})
    assert.deepEqual(runs, [])
    assert.match(stalled ?? '', /#7 is still at todo/)
    // Nothing about running out of passes: this loop stopped early, it did not exhaust.
    assert.doesNotMatch(stalled ?? '', /refine passes/)
  })

  it('names the round cap when the last pass was still changing the card', () => {
    writeCard()
    const { runs, stalled } = afterPass(6, () => writeCard({ body: 'Changed again.' }))
    assert.deepEqual(runs, [])
    assert.match(stalled ?? '', /refine passes and #7 changed on every one/)
  })

  it('says nothing about a run that was never a refinement pass', () => {
    writeCard()
    const before = markBoard()
    const { stalled } = refinementRunsAfter({ ...pass(1), refineRound: undefined }, before)
    assert.equal(stalled, undefined)
  })
})
