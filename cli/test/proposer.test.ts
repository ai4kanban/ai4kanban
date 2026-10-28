// The proposer (#534): what a completed card starts, and where its proposals land.
//
// The reflection itself is an agent's judgment and cannot be asserted here. What can, and
// what this covers, is the machinery around it: completed cards wait in a queue and one run
// covers a batch of them (#1467), only a run that passed takes its cards off, the flow reads its cards out of `.archive/` where the ordinary card
// read no longer finds them, and `akb triage add` puts one proposal in the inbox carrying
// the card that prompted it.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { printFlow } from '../src/lib/agent/flow.ts'
import { buildAsk, buildRun } from '../src/lib/agent/prompts.ts'
import { writeConfig } from '../src/lib/agent/settings.ts'
import { switchWorkflowScheduled } from '../src/lib/agent/workflows.ts'
import { queueCompleted } from '../src/lib/agent/propose.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import { reflectQueue } from '../src/lib/agent/settings.ts'
import { logPathOf, withStore } from '../src/lib/agent/store.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { cmdTriageAdd, type TriageAddOptions } from '../src/commands/triage.ts'
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
  /** Write the reflection down as started, then close it the way its watcher does. */
  const reflectOn = async (cards: number[], status: 'done' | 'error'): Promise<void> => {
    const opened = openRun({ action: 'reflect', cards }, 'prompt', [])
    assert.ok(!('error' in opened))
    // A finished run whose log is gone is pruned from the record.
    fs.mkdirSync(path.dirname(logPathOf(opened.run.sessionId)), { recursive: true })
    fs.writeFileSync(logPathOf(opened.run.sessionId), '')
    await closeRun(opened.run.sessionId, { status, ok: status === 'done', code: status === 'done' ? 0 : 1 })
  }

  /** Queue what completed since `before`, and read the queue back. */
  const queuedAfter = (before: number[]): number[] => {
    queueCompleted(before)
    return reflectQueue()
  }

  it('queues the card that reached the archive', () => {
    open(1)
    const before = openNow()
    complete(1)
    assert.deepEqual(queuedAfter(before), [1])
  })

  it('queues every card completed at once, oldest first', () => {
    open(1)
    open(2)
    const before = openNow()
    complete(1)
    complete(2)
    assert.deepEqual(queuedAfter(before), [1, 2])
  })

  it('keeps queueing while a round is running', () => {
    open(1)
    open(2)
    let before = openNow()
    complete(1)
    queueCompleted(before)
    assert.ok(!('error' in openRun({ action: 'reflect', cards: [1] }, 'prompt', [])))
    before = openNow()
    complete(2)
    assert.deepEqual(queuedAfter(before), [1, 2])
  })

  it('keeps the cards of a round that failed', async () => {
    open(1)
    open(2)
    let before = openNow()
    complete(1)
    queueCompleted(before)
    await reflectOn([1], 'error')
    assert.deepEqual(reflectQueue(), [1])
    before = openNow()
    complete(2)
    assert.deepEqual(queuedAfter(before), [1, 2])
  })

  it('takes the cards of a round that passed off the queue, for good', async () => {
    open(1)
    const before = openNow()
    complete(1)
    queueCompleted(before)
    await reflectOn([1], 'done')
    assert.deepEqual(reflectQueue(), [])
    // A second run whose window also saw #1 complete queues it no more.
    assert.deepEqual(queuedAfter(before), [])
  })

  it('reflects on nothing while the card is still on the board', () => {
    open(1)
    assert.deepEqual(queuedAfter(openNow()), [])
  })

  it('leaves a card that was already in the archive before the run', () => {
    open(1)
    complete(1)
    assert.deepEqual(queuedAfter(openNow()), [])
  })

  it('never queues a card reflected on alone before batching', () => {
    open(1)
    const before = openNow()
    complete(1)
    assert.ok(!('error' in openRun({ action: 'reflect', cards: [1] }, 'prompt', [])))
    assert.equal(queueCompleted(before), false)
    assert.deepEqual(reflectQueue(), [])
  })
})

describe('a reflection run', () => {
  it('signs what it proposes', async () => {
    open(1)
    const before = openNow()
    complete(1)
    queueCompleted(before)
    const opened = openRun({ action: 'reflect', cards: [1] }, 'prompt', [])
    assert.ok(!('error' in opened))
    process.env.KANBAN_RUN = opened.run.sessionId
    try {
      await cmdTriageAdd({ title: 'Follow it up', text: 'More.', source: '#1', workflow: 'coding' })
    } finally {
      delete process.env.KANBAN_RUN
    }
    assert.equal(readSignals().signals.find((s) => s.title === 'Follow it up')?.agent, 'proposer')
  })
})

describe('the flow', () => {
  it('sends the run to the card the archive holds, which the board no longer has', () => {
    open(1)
    complete(1)
    const ask = buildAsk({ action: 'reflect', cards: [1] })
    assert.match(ask, /docs\/kanban\/\.archive\/1-card\.md/)
    assert.match(ask, /triage add/)
  })

  it('hands one run every card in its batch, each in its own block, sourced to itself', async () => {
    open(1)
    open(2)
    complete(1)
    complete(2)
    const ask = buildAsk({ action: 'reflect', cards: [1, 2] })
    assert.match(ask, /#1 \("card 1"\), #2 \("card 2"\)/)
    assert.match(ask, /<card id="1">\nfile +docs\/kanban\/\.archive\/1-card\.md\n(.*\n)*<\/card>\n<card id="2">\nfile +docs\/kanban\/\.archive\/2-card\.md/)
    const printed = await said(() => printFlow({ action: 'reflect', cards: [1, 2] }))
    assert.match(printed, /--source "#<id>" .*the archived file of the card it traces to/)
  })

  it('reads the card the archive holds, which the board no longer has', async () => {
    open(1)
    complete(1)
    const printed = await said(() => printFlow({ action: 'reflect', cards: [1] }))
    assert.match(printed, /docs\/kanban\/\.archive\/1-card\.md/)
    assert.match(printed, /triage add/)
    // And it is told outright that proposing nothing is a finished job.
    assert.match(printed, /propose nothing at all/)
  })

  it('carries the small-fixes pick into the printed flow (#1469)', async () => {
    open(1)
    complete(1)
    const printed = () => said(() => printFlow({ action: 'reflect', cards: [1] }))
    assert.doesNotMatch(await printed(), /Your settings on this board/)
    writeConfig((cfg) => void (cfg.specAgents = { proposer: { 'small-fixes': 'auto' } }))
    const auto = await printed()
    assert.match(auto, /Your settings on this board:\n- A small fix .*--schedule implement/)
    assert.doesNotMatch(auto, /--related/)
  })

  const ended = (extra: Record<string, unknown>): void => {
    withStore((store) => {
      store.deliveries.push({
        deliveryId: 'd1', cardId: 1, title: 'card 1', status: 'finished',
        startedAt: 1, endedAt: 2, sessions: [], approved: '', steps: [], ...extra,
      } as never)
    })
  }
  const reflect = (): Promise<string> => said(() => printFlow({ action: 'reflect', cards: [1] }))

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
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('- [x] Build it.', '- [x] Output: `notes/plan.md`\n- [x] Output: `art/cover.png`'))
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

  it('names the scheduled agents switched on, and only those', async () => {
    open(1)
    complete(1)
    const home = path.join(kanban(), 'agents', 'night-auditor')
    fs.mkdirSync(home, { recursive: true })
    fs.writeFileSync(path.join(home, 'AGENT.md'), ['---', 'name: night-auditor', 'description: Audits the night.', 'akb:', '  reads: archived-cards', '---', '', 'You audit.', ''].join('\n'))
    assert.equal(switchWorkflowScheduled('coding', 'night-auditor', true).ok, true)
    const scheduled = () => buildRun({ action: 'reflect', cards: [1] }).prompt
    let printed = scheduled()
    assert.match(printed, /<\/card>\n<scheduled-agents>\nqa-manager — Keeps the project's test cases/)
    assert.match(printed, /^night-auditor — Audits the night\.$/m)
    assert.equal(switchWorkflowScheduled('coding', 'night-auditor', false).ok, true)
    printed = scheduled()
    assert.match(printed, /qa-manager — /)
    assert.doesNotMatch(printed, /night-auditor/)
    assert.equal(switchWorkflowScheduled('coding', 'qa-manager', false).ok, true)
    assert.doesNotMatch(scheduled(), /scheduled-agents/)
  })

  it('gives the memory review the misses file', async () => {
    const printed = await said(() => printFlow({ action: 'review-memory' }))
    assert.match(printed, /memory\/agents\/proposer\/missed\.md — a follow-up the user says the proposer missed/)
  })

  it('refuses a card that never reached the archive', () => {
    open(1)
    assert.throws(() => printFlow({ action: 'reflect', cards: [1] }), /\.archive/)
  })
})

describe('a proposal in the inbox', () => {
  const add = (opts: TriageAddOptions) => cmdTriageAdd({ workflow: 'coding', ...opts })

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

  it('carries the workflow that does it (#2139)', async () => {
    await said(() => add({ title: 'Cut the video shorter', source: '#1', text: 'It runs long.', workflow: 'hyperframes-video' }))
    assert.equal(readSignals().signals[0]!.workflow, 'hyperframes-video')
  })

  it('refuses one with no workflow, or one this board has not got (#2139)', async () => {
    await assert.rejects(() => cmdTriageAdd({ title: 'An idea', text: 'Words.' }), /--workflow/)
    await assert.rejects(() => add({ title: 'An idea', text: 'Words.', workflow: 'nope' }), /no workflow called "nope"/)
    assert.equal(readSignals().signals.length, 0)
  })

  it('refuses one with nothing written in it', async () => {
    await assert.rejects(() => add({ title: 'A title alone' }), /has to say something/)
    await assert.rejects(() => add({ text: 'Words with no title.' }), /--title/)
  })
})
