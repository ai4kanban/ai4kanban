// The proposer (#534): what a completed card starts, and where its proposals land.
//
// The reflection itself is an agent's judgment and cannot be asserted here. What can, and
// what this covers, is the machinery around it: the switch is off until somebody asks for
// it, archiving is the only trigger and it fires once per completed card, a card the board
// has already reflected on is never reflected on twice, the flow reads its card out of
// `.archive/` where the ordinary card read no longer finds it, and `akb triage add` puts
// one proposal in the inbox carrying the card that prompted it.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { printFlow } from '../src/lib/agent/flow.ts'
import { buildAsk } from '../src/lib/agent/prompts.ts'
import { reflectRunsAfter } from '../src/lib/agent/propose.ts'
import { openRun } from '../src/lib/agent/sessions.ts'
import { proposerOn, setProposer } from '../src/lib/agent/settings.ts'
import { setBoardRoot, UI_CONFIG } from '../src/lib/paths.ts'
import { cmdTriageAdd } from '../src/commands/triage.ts'
import { readSignals } from '../src/lib/signals/index.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')
const TODO = (): string => path.join(kanban(), 'todo')
const ARCHIVE = (): string => path.join(kanban(), '.archive')

const cardText = (title: string): string =>
  [
    '---',
    `title: ${title}`,
    'priority: med',
    'roi: med',
    'status: todo',
    'release: ""',
    'blocked_by: []',
    'related: []',
    'modules: []',
    'questions: []',
    '---',
    '',
    'What this card was for.',
    '',
    '<!-- agent -->',
    '',
    '## Scope',
    '- **A requirement**: something observable.',
    '',
    '## Todo',
    '- [x] Build it.',
    '',
  ].join('\n')

const open = (id: number): void => {
  fs.writeFileSync(path.join(TODO(), `${id}-card.md`), cardText(`card ${id}`))
}

/** Move an open card into the archive, the way `raw archive` renames it. */
const complete = (id: number): void => {
  fs.mkdirSync(ARCHIVE(), { recursive: true })
  fs.renameSync(path.join(TODO(), `${id}-card.md`), path.join(ARCHIVE(), `${id}-card.md`))
}

/** The board as a run's watcher marked it at the spawn: the ids still open then. */
const openNow = (): number[] =>
  fs
    .readdirSync(TODO())
    .filter((name) => /^\d+-/.test(name))
    .map((name) => Number(name.split('-')[0]))

/** Everything printed while `work` ran — a command that says rather than returns. */
function said(work: () => void): string {
  const lines: string[] = []
  const wasLog = console.log
  console.log = (line: unknown) => {
    lines.push(String(line))
  }
  try {
    work()
  } finally {
    console.log = wasLog
  }
  return lines.join('\n')
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-proposer-'))
  fs.mkdirSync(TODO(), { recursive: true })
  fs.writeFileSync(path.join(TODO(), 'README.md'), '# Open tasks\n')
  fs.writeFileSync(path.join(kanban(), 'next-id'), '99\n')
  setBoardRoot(root)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the switch', () => {
  it('is off until it is turned on, and only writes itself down when it is', () => {
    assert.equal(proposerOn(), false)

    assert.equal(setProposer(true).ok, true)
    assert.equal(proposerOn(), true)
    assert.match(fs.readFileSync(UI_CONFIG, 'utf8'), /"proposer": true/)

    assert.equal(setProposer(false).ok, true)
    assert.equal(proposerOn(), false)
    assert.doesNotMatch(fs.readFileSync(UI_CONFIG, 'utf8'), /proposer/)
  })

  it('reflects on nothing while it is off', () => {
    open(1)
    const before = openNow()
    complete(1)
    assert.deepEqual(reflectRunsAfter(before), [])
  })
})

describe('what archiving hands over', () => {
  beforeEach(() => setProposer(true))

  it('reflects on the card that reached the archive', () => {
    open(1)
    const before = openNow()
    complete(1)
    assert.deepEqual(reflectRunsAfter(before), [{ action: 'reflect', id: 1, title: 'card 1' }])
  })

  it('reflects once per completed card, so a group close gets one each', () => {
    open(1)
    open(2)
    const before = openNow()
    complete(1)
    complete(2)
    assert.deepEqual(
      reflectRunsAfter(before).map((req) => req.id),
      [2, 1],
    )
  })

  it('reflects on nothing while the card is still on the board', () => {
    open(1)
    assert.deepEqual(reflectRunsAfter(openNow()), [])
  })

  it('leaves a card that was already in the archive before the run', () => {
    open(1)
    complete(1)
    assert.deepEqual(reflectRunsAfter(openNow()), [])
  })

  it('leaves a card the board has already reflected on', () => {
    // Two runs' windows overlap all the time: both saw #1 open at their spawn and both see
    // it archived at their close. The first one's reflection is the one that counts.
    open(1)
    const before = openNow()
    complete(1)
    const first = openRun({ action: 'reflect', id: 1, title: 'card 1' }, 'prompt', [])
    assert.ok(!('error' in first))
    assert.deepEqual(reflectRunsAfter(before), [])
  })

  it('hands over the completion no run is closing behind — a manual commit', () => {
    // A manual delivery is finished by the user's own commit and archived where that is
    // noticed, not at a run's close. `reflectOnCompletion` is what that path calls, and it
    // answers on the one card rather than on a window of them.
    open(1)
    open(2)
    complete(1)
    assert.deepEqual(reflectRunsAfter([1]), [{ action: 'reflect', id: 1, title: 'card 1' }])
    // And nothing for a card that is still on the board.
    assert.deepEqual(reflectRunsAfter([2]), [])
  })

  it('reflects on nothing after the switch went off mid-run', () => {
    open(1)
    const before = openNow()
    complete(1)
    setProposer(false)
    assert.deepEqual(reflectRunsAfter(before), [])
  })
})

describe('the flow', () => {
  it('sends the run to the card the archive holds, which the board no longer has', () => {
    open(1)
    complete(1)
    const ask = buildAsk({ action: 'reflect', id: 1, title: 'card 1' })
    assert.match(ask, /docs\/kanban\/\.archive\/1-card\.md/)
    assert.match(ask, /triage add/)
  })

  it('reads the card the archive holds, which the board no longer has', () => {
    open(1)
    complete(1)
    const printed = said(() => printFlow({ action: 'reflect', id: 1, title: 'card 1' }))
    assert.match(printed, /docs\/kanban\/\.archive\/1-card\.md/)
    assert.match(printed, /triage add/)
    // And it is told outright that proposing nothing is a finished job.
    assert.match(printed, /propose nothing at all/)
  })

  it('refuses a card that never reached the archive', () => {
    open(1)
    assert.throws(() => printFlow({ action: 'reflect', id: 1, title: 'card 1' }), /\.archive/)
  })
})

describe('a proposal in the inbox', () => {
  it('lands as an ordinary item carrying the card that prompted it', () => {
    said(() =>
      cmdTriageAdd({
        title: 'Let a delivery say what it skipped',
        source: '#1',
        text: 'Card #1 left its second half undone — docs/kanban/.archive/1-card.md.',
      }),
    )
    const [item] = readSignals().signals
    assert.equal(item!.title, 'Let a delivery say what it skipped')
    assert.equal(item!.source, '#1')
    assert.match(item!.summary, /1-card\.md/)
  })

  it('refuses the same proposal twice', () => {
    const twice = () =>
      said(() => cmdTriageAdd({ title: 'The same idea', source: '#1', text: 'The same words.' }))
    twice()
    assert.throws(twice, /already in the inbox/)
    assert.equal(readSignals().signals.length, 1)
  })

  it('refuses one with nothing written in it', () => {
    assert.throws(() => cmdTriageAdd({ title: 'A title alone' }), /has to say something/)
    assert.throws(() => cmdTriageAdd({ text: 'Words with no title.' }), /--title/)
  })
})
