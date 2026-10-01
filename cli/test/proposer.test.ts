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
import { withStore } from '../src/lib/agent/store.ts'
import { chatFile } from '../src/lib/agent/chat.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { cmdTriageAdd, type TriageAddOptions } from '../src/commands/triage.ts'
import { readSignals } from '../src/lib/signals/index.ts'
import { triageShut } from './helpers/triage.ts'

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
async function said(work: () => unknown): Promise<string> {
  const lines: string[] = []
  const wasLog = console.log
  console.log = (line: unknown) => {
    lines.push(String(line))
  }
  try {
    await work()
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

describe('what archiving hands over', () => {
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

})

describe('the flow', () => {
  it('sends the run to the card the archive holds, which the board no longer has', () => {
    open(1)
    complete(1)
    const ask = buildAsk({ action: 'reflect', id: 1, title: 'card 1' })
    assert.match(ask, /docs\/kanban\/\.archive\/1-card\.md/)
    assert.match(ask, /triage add/)
  })

  it('reads the card the archive holds, which the board no longer has', async () => {
    open(1)
    complete(1)
    const printed = await said(() => printFlow({ action: 'reflect', id: 1, title: 'card 1' }))
    assert.match(printed, /docs\/kanban\/\.archive\/1-card\.md/)
    assert.match(printed, /triage add/)
    // And it is told outright that proposing nothing is a finished job.
    assert.match(printed, /propose nothing at all/)
  })

  const ended = (extra: Record<string, unknown>): void => {
    withStore((store) => {
      store.deliveries.push({
        deliveryId: 'd1', cardId: 1, title: 'card 1', status: 'finished',
        startedAt: 1, endedAt: 2, sessions: [], approved: '', steps: [], ...extra,
      } as never)
    })
  }
  const reflect = (): Promise<string> => said(() => printFlow({ action: 'reflect', id: 1, title: 'card 1' }))

  it('points at the commit a delivery landed', async () => {
    open(1)
    complete(1)
    ended({ landing: { status: 'landed', attempts: 1, commit: 'c1e0306d9a8b7c6d5e4f', at: 2 } })
    const printed = await reflect()
    assert.match(printed, /shipped +`git show c1e0306d9a8b`/)
  })

  it('lists the files a files delivery recorded', async () => {
    open(1)
    const file = path.join(TODO(), '1-card.md')
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('- [x] Build it.', '- [x] Write `notes/plan.md`\n- [x] Draw `art/cover.png`'))
    complete(1)
    ended({ commitMode: 'files', planned: [] })
    const printed = await reflect()
    assert.match(printed, /the files it delivered:\n.*notes\/plan\.md\n.*art\/cover\.png/)
  })

  it('falls back to the commits that name a card nothing delivered', async () => {
    open(1)
    complete(1)
    assert.match(await reflect(), /git log --grep "\(#1\)"/)
  })

  it('names the discussion a card came from, up to the handoff', async () => {
    open(1)
    complete(1)
    const now = Date.now()
    const said3 = [1, 2, 3].map((n) => ({ role: 'you', text: `line ${n}`, at: now }))
    fs.mkdirSync(path.dirname(chatFile(1)), { recursive: true })
    fs.writeFileSync(chatFile('discussion-abc'), JSON.stringify({ cardId: 'discussion-abc', harness: 'claude-code', messages: said3, startedAt: now, updatedAt: now }))
    fs.writeFileSync(chatFile(1), JSON.stringify({
      cardId: 1, harness: 'claude-code', messages: [], startedAt: now, updatedAt: now,
      from: { discussion: 'discussion-abc', resumeId: 'r1', harness: 'claude-code', messages: 2 },
    }))
    const printed = await reflect()
    assert.match(printed, /discussion-abc\.json — its first 2 messages, up to the handoff/)
  })

  it('names no discussion for a card that came from none', async () => {
    open(1)
    complete(1)
    assert.doesNotMatch(await reflect(), /^ +discussion /m)
  })

  it('names the misses file whether or not it exists yet', async () => {
    open(1)
    complete(1)
    assert.match(await reflect(), /memory\/agents\/proposer\/missed\.md — none yet/)
    const missed = path.join(kanban(), 'memory', 'agents', 'proposer', 'missed.md')
    fs.mkdirSync(path.dirname(missed), { recursive: true })
    fs.writeFileSync(missed, '- **x**: y (#1)\n')
    const printed = await reflect()
    assert.match(printed, /memory\/agents\/proposer\/missed\.md/)
    assert.doesNotMatch(printed, /none yet/)
  })

  it('gives the memory review the misses file', async () => {
    const printed = await said(() => printFlow({ action: 'review-memory' }))
    assert.match(printed, /memory\/agents\/proposer\/missed\.md — a follow-up the user says the proposer missed/)
  })

  it('refuses a card that never reached the archive', () => {
    open(1)
    assert.throws(() => printFlow({ action: 'reflect', id: 1, title: 'card 1' }), /\.archive/)
  })
})

describe('a proposal in the inbox', () => {
  const add = (opts: TriageAddOptions) => triageShut(() => cmdTriageAdd(opts))

  it('lands as an ordinary item carrying the card that prompted it', async () => {
    await said(() =>
      add({
        title: 'Let a delivery say what it skipped',
        source: '#1',
        text: 'Card #1 left its second half undone — docs/kanban/.archive/1-card.md.',
      }),
    )
    const [item] = readSignals().signals
    assert.equal(item!.title, 'Let a delivery say what it skipped')
    // `#1` names no source the board knows, so it is kept as it was written (#560).
    assert.equal(item!.sourceType, '')
    assert.deepEqual(item!.meta, [{ key: 'source', value: '#1' }])
    assert.match(item!.summary, /1-card\.md/)
  })

  it('refuses the same proposal twice', async () => {
    const twice = () =>
      said(() => add({ title: 'The same idea', source: '#1', text: 'The same words.' }))
    await twice()
    await assert.rejects(twice, /already waiting in triage — docs\/kanban\/triage\//)
    assert.equal(readSignals().signals.length, 1)
  })

  it('refuses one with nothing written in it', async () => {
    await assert.rejects(() => add({ title: 'A title alone' }), /has to say something/)
    await assert.rejects(() => add({ text: 'Words with no title.' }), /--title/)
  })
})
