// The planning scores' contract (#224). `docs/kanban/record.csv` is the evidence and
// `readScoreView` is the only thing that turns it into figures, so these tests fix what a
// window is, what each series counts, and what too little evidence looks like.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { setBoardRoot } from '../src/lib/paths.ts'
import { RECORD_HEADER, recordFile } from '../src/lib/record.ts'
import { CURRENT_WINDOW, readScoreView } from '../src/lib/view/score.ts'
import type { ScoreSeries, ScoreSeriesKey, ScoreView, ScoreWindow } from '../src/lib/view/types.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-score-'))
const kanban = path.join(root, 'docs', 'kanban')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(path.join(kanban, 'todo'), { recursive: true })
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

/** Write the record straight, so a test can lay out lines a board would take weeks to
 *  write — including two releases closed on one day. */
const record = (...lines: string[]): void =>
  fs.writeFileSync(recordFile(), [RECORD_HEADER, ...lines].join('\n') + '\n')

const releases = (...ids: string[]): void =>
  fs.writeFileSync(path.join(kanban, 'releases.md'), ids.map((id) => `- **${id}** — a goal`).join('\n') + '\n')

const view = (): ScoreView => {
  const result = readScoreView()
  assert.ok(result.ok, `expected a reading, got ${result.ok ? '' : result.error}`)
  return result.view
}

const pick = (window: ScoreWindow, key: ScoreSeriesKey): ScoreSeries => {
  const found = window.series.find((s) => s.key === key)
  assert.ok(found, `no ${key} series`)
  return found
}

/** N question closures the board settled — enough to clear the details floor on its own. */
const settled = (n: number, card = 1): string[] =>
  Array.from({ length: n }, () => `2026-08-01,question-closed,${card},board`)

describe('the windows', () => {
  it('is one open window on a board with no record at all', () => {
    releases('0.8.0')
    const v = view()
    assert.equal(v.empty, true)
    assert.deepEqual(
      v.windows.map((w) => [w.release, w.open]),
      [['0.8.0', true]],
    )
  })

  it('names the open window Current when no release is open', () => {
    record('2026-08-01,card-created,1,asked')
    assert.equal(view().windows.at(-1)!.release, CURRENT_WINDOW)
  })

  it('is not empty once the record holds a line', () => {
    record('2026-08-01,card-created,1,asked')
    assert.equal(view().empty, false)
  })

  it('splits on file order, so two releases closed on one day are two windows', () => {
    record(
      '2026-08-01,question-closed,1,board',
      '2026-08-02,release-closed,,0.6.0',
      '2026-08-02,question-closed,2,user',
      '2026-08-02,release-closed,,0.7.0',
      '2026-08-02,question-closed,3,board',
    )
    releases('0.8.0')
    const v = view()
    assert.deepEqual(
      v.windows.map((w) => [w.release, w.open]),
      [
        ['0.6.0', false],
        ['0.7.0', false],
        ['0.8.0', true],
      ],
    )
    assert.deepEqual(pick(v.windows[0]!, 'details').counts.map((c) => c.value), [1, 0])
    assert.deepEqual(pick(v.windows[1]!, 'details').counts.map((c) => c.value), [0, 1])
    assert.deepEqual(pick(v.windows[2]!, 'details').counts.map((c) => c.value), [1, 0])
  })

  it('keeps the open window even when it holds nothing', () => {
    record('2026-08-01,question-closed,1,board', '2026-08-02,release-closed,,0.6.0')
    const open = view().windows.at(-1)!
    assert.equal(open.open, true)
    assert.deepEqual(open.series.map((s) => s.evidence), [0, 0, 0])
    assert.deepEqual(open.series.map((s) => s.percent), [null, null, null])
  })
})

describe('the evidence floors', () => {
  it('draws no point below the floor, and never a zero', () => {
    record(...Array.from({ length: 19 }, () => '2026-08-01,question-closed,1,user'))
    const details = pick(view().windows[0]!, 'details')
    assert.equal(details.percent, null)
    assert.equal(details.evidence, 19)
    assert.equal(details.floor, 20)
    assert.deepEqual(details.counts.map((c) => c.value), [0, 19])
    assert.deepEqual(details.cards, [1])
  })

  it('draws a point at the floor exactly', () => {
    record(...settled(15), ...Array.from({ length: 5 }, () => '2026-08-01,question-closed,2,user'))
    const details = pick(view().windows[0]!, 'details')
    assert.equal(details.evidence, 20)
    assert.equal(details.percent, 75)
  })

  it('rounds the percentage to a whole number', () => {
    record(...settled(20), '2026-08-01,question-closed,2,user')
    assert.equal(pick(view().windows[0]!, 'details').percent, 95) // 20/21 = 95.2%
  })

  it('needs 20 calls for decisions and 10 decided proposals', () => {
    const proposals = Array.from({ length: 9 }, (_, i) => `2026-08-01,card-archived,${i + 10},proposed`)
    record('2026-08-01,decisions-stood,1,19', '2026-08-01,decisions-overruled,1,0', ...proposals)
    const v = view().windows[0]!
    assert.equal(pick(v, 'decisions').floor, 20)
    assert.equal(pick(v, 'decisions').percent, null)
    assert.equal(pick(v, 'proposals').floor, 10)
    assert.equal(pick(v, 'proposals').percent, null)
    assert.equal(pick(v, 'proposals').evidence, 9)
  })

  it('scores decisions once the calls reach the floor', () => {
    record('2026-08-01,decisions-stood,1,18', '2026-08-01,decisions-overruled,1,2')
    const decisions = pick(view().windows[0]!, 'decisions')
    assert.equal(decisions.evidence, 20)
    assert.equal(decisions.percent, 90)
    assert.deepEqual(decisions.counts.map((c) => c.value), [18, 2])
  })

  it('scores proposals once ten are decided', () => {
    record(
      ...Array.from({ length: 8 }, (_, i) => `2026-08-01,card-archived,${i + 1},proposed`),
      '2026-08-01,card-rejected,9,proposed',
      '2026-08-01,card-rejected,10,proposed',
    )
    const proposals = pick(view().windows[0]!, 'proposals')
    assert.equal(proposals.percent, 80)
    assert.deepEqual(proposals.cards, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
})

describe('what is left out', () => {
  it('leaves a question moved to verification out of details', () => {
    record('2026-08-01,question-closed,1,board', '2026-08-01,question-closed,1,verify')
    const details = pick(view().windows[0]!, 'details')
    assert.equal(details.evidence, 1)
    assert.deepEqual(details.counts.map((c) => c.value), [1, 0])
  })

  it('leaves a card somebody asked for out of proposals', () => {
    record('2026-08-01,card-archived,1,asked', '2026-08-01,card-rejected,2,asked')
    const proposals = pick(view().windows[0]!, 'proposals')
    assert.equal(proposals.evidence, 0)
    assert.deepEqual(proposals.cards, [])
  })

  it('leaves a proposal still open out of proposals', () => {
    record('2026-08-01,card-created,1,proposed')
    assert.equal(pick(view().windows[0]!, 'proposals').evidence, 0)
  })

  it('leaves a card that contributed nothing out of the contributing ids', () => {
    record('2026-08-01,decisions-stood,4,0', '2026-08-01,decisions-overruled,4,0', '2026-08-01,decisions-stood,5,3')
    const decisions = pick(view().windows[0]!, 'decisions')
    assert.equal(decisions.evidence, 3)
    assert.deepEqual(decisions.cards, [5])
  })
})

describe('the contributing cards', () => {
  it('names a card once however often it contributed, in id order', () => {
    record(
      '2026-08-01,question-closed,9,board',
      '2026-08-01,question-closed,2,user',
      '2026-08-01,question-closed,9,board',
      '2026-08-01,question-closed,10,board',
    )
    assert.deepEqual(pick(view().windows[0]!, 'details').cards, [2, 9, 10])
  })

  it('keeps one series\' ids out of another', () => {
    record('2026-08-01,question-closed,1,board', '2026-08-01,decisions-stood,2,4')
    const window = view().windows[0]!
    assert.deepEqual(pick(window, 'details').cards, [1])
    assert.deepEqual(pick(window, 'decisions').cards, [2])
    assert.deepEqual(pick(window, 'proposals').cards, [])
  })
})

describe('a record that cannot be read', () => {
  it('says so rather than reading as a board that planned nothing', () => {
    fs.mkdirSync(recordFile()) // a directory where the file should be
    const result = readScoreView()
    assert.equal(result.ok, false)
    assert.match(result.ok ? '' : result.error, /record\.csv/)
  })
})
