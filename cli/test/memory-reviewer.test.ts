// The daily review of what the conversations settled (#748).
//
// The judgement itself is the agent's and cannot be asserted here — whether a "what if"
// taken back three turns later is a decision is exactly the thing a person reads the whole
// exchange to answer. What can be asserted, and what this covers, is everything around it:
// which conversations reach the run and which memory each one's notes belong in, that the
// window is the last review that PASSED so a failed one loses nothing, that a failure does
// not reopen on the next tick and does come round the next day, that the agent ships on and
// switching it off stops only the automatic pass, and that a chat no longer writes memory at
// all.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { printFlow } from '../src/lib/agent/flow.ts'
import { chatsToReview } from '../src/lib/agent/memory-review.ts'
import { buildAsk } from '../src/lib/agent/prompts.ts'
import { memoryReview, memoryReviewerOn, setSwitch, stampMemoryReview } from '../src/lib/agent/settings.ts'
import { findGuide } from '../src/lib/guide.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { CHATS_DIR, setBoardRoot, SESSIONS } from '../src/lib/paths.ts'
import { nextWork } from '../src/lib/view/dispatch.ts'
import { forgetMachineState } from './helpers/board.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')
const TODO = (): string => path.join(kanban(), 'todo')
const ARCHIVE = (): string => path.join(kanban(), '.archive')

const DAY = 24 * 60 * 60_000

const cardText = (title: string, modules: string[]): string =>
  [
    '---',
    `title: ${title}`,
    'priority: med',
    'roi: med',
    'status: todo',
    'release: ""',
    'blocked_by: []',
    'related: []',
    `modules: [${modules.join(', ')}]`,
    'questions: []',
    '---',
    '',
    'What this card is for.',
    '',
    '## Todo',
    '- [ ] Build it.',
    '',
  ].join('\n')

/** A card on the board, or in the archive where the ordinary read no longer finds it. */
function card(id: number, modules: string[], where: 'open' | 'archived' = 'open'): void {
  const dir = where === 'open' ? TODO() : ARCHIVE()
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${id}-card.md`), cardText(`card ${id}`, modules))
}

/** One conversation on this machine, as the chat itself writes it. `at` is when it was last
 *  spoken to — the transcript's own `updatedAt` and the file's modification time together,
 *  because the review shortlists on the second and decides on the first. */
function chat(name: string, at: number, extra: Record<string, unknown> = {}): string {
  fs.mkdirSync(CHATS_DIR, { recursive: true })
  const file = path.join(CHATS_DIR, `${name}.json`)
  fs.writeFileSync(
    file,
    JSON.stringify({
      harness: 'claude-code',
      startedAt: at - 1000,
      updatedAt: at,
      messages: [
        { role: 'you', text: 'what about doing it this way', at: at - 1000 },
        { role: 'agent', text: 'here is what that would mean', at },
      ],
      ...extra,
    }),
  )
  fs.utimesSync(file, new Date(at), new Date(at))
  return file
}

/** Review runs in the record, so the dispatcher can see what the last one did. */
function pastRuns(...runs: { status: string; startedAt: number }[]): void {
  fs.mkdirSync(path.dirname(SESSIONS), { recursive: true })
  fs.writeFileSync(
    SESSIONS,
    JSON.stringify({
      runs: runs.map((run, i) => ({
        sessionId: `past-${i}`,
        cardId: null,
        action: 'review-memory',
        status: run.status,
        startedAt: run.startedAt,
        endedAt: run.startedAt + 1,
        harness: 'claude-code',
        logPath: '/dev/null',
      })),
      deliveries: [],
    }),
  )
}

const work = (): Promise<{ action: string }[]> => nextWork(() => Promise.resolve(true))

/** Everything printed while `work` ran — a printed flow says rather than returns. */
function quiet<T>(job: () => T): string {
  const sink = startCollecting()
  try {
    job()
    return sink.out.join('\n')
  } finally {
    stopCollecting()
  }
}

const stamp = (when: Date): string => {
  stampMemoryReview(when)
  return memoryReview().lastRun
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-memory-review-'))
  fs.mkdirSync(TODO(), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  forgetMachineState(root)
  setBoardRoot(root)
})

afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe('the review the board starts on its own', () => {
  it('ships on, and starts nothing while no conversation has said anything', async () => {
    assert.equal(memoryReviewerOn(), true)
    assert.deepEqual(await work(), [])
  })

  it('starts one once a conversation has been spoken to', async () => {
    card(1, [])
    chat('card-1', Date.now())
    assert.deepEqual(await work(), [{ action: 'review-memory' }])
  })

  it('starts nothing while the agent is switched off', async () => {
    card(1, [])
    chat('card-1', Date.now())
    setSwitch('memoryReviewer', false)
    assert.equal(memoryReviewerOn(), false)
    assert.deepEqual(await work(), [])
  })

  it('waits out the day after a review that passed', async () => {
    card(1, [])
    chat('card-1', Date.now() - 60_000)
    stamp(new Date(Date.now() - 30_000))
    assert.deepEqual(await work(), [])
  })

  it('comes back for a conversation spoken to since the last review', async () => {
    card(1, [])
    stamp(new Date(Date.now() - 2 * DAY))
    chat('card-1', Date.now() - DAY - 60_000)
    assert.deepEqual(await work(), [{ action: 'review-memory' }])
  })

  it('does not reopen a failed review on the next tick', async () => {
    card(1, [])
    chat('card-1', Date.now())
    pastRuns({ status: 'error', startedAt: Date.now() - 60_000 })
    assert.deepEqual(await work(), [])
  })

  it('starts nothing while one is going', async () => {
    card(1, [])
    chat('card-1', Date.now())
    pastRuns({ status: 'running', startedAt: Date.now() - 60_000 })
    assert.deepEqual(await work(), [])
  })

  // The two halves of "a failure costs nothing": the day comes round, and the conversation
  // the failed review never got through is still inside the window.
  it('comes round the next day after a failure, with that day’s conversation still in the window', async () => {
    card(1, [])
    const spoken = Date.now() - 2 * DAY
    chat('card-1', spoken)
    stamp(new Date(spoken - 60_000))
    pastRuns({ status: 'error', startedAt: spoken + 60_000 })

    assert.deepEqual(await work(), [{ action: 'review-memory' }])
    const since = new Date(memoryReview().lastRun).getTime()
    assert.deepEqual(
      chatsToReview(since).map((c) => c.cardId),
      [1],
    )
  })
})

describe('the conversations one review reads', () => {
  it('takes a card chat and a discussion, and leaves out what predates the window', async () => {
    card(1, [])
    const since = Date.now() - DAY
    chat('card-1', since + 60_000)
    chat('discussion-11111111-2222-3333-4444-555555555555', since + 60_000)
    chat('card-2', since - 60_000)

    assert.deepEqual(
      chatsToReview(since).map((c) => c.cardId),
      [1, null],
    )
  })

  it('leaves out a transcript that was rewritten without anything being said in it', () => {
    const since = Date.now() - DAY
    const file = chat('card-1', since - 60_000)
    // What archiving a discussion or naming one does: the file is written again, and
    // `updatedAt` stays exactly where it was.
    fs.utimesSync(file, new Date(), new Date())
    assert.deepEqual(chatsToReview(since), [])
  })

  it("writes into the card's own modules, and into the archived card's when it has left the board", () => {
    card(1, ['skill'])
    card(2, ['local-ui'], 'archived')
    const since = Date.now() - DAY
    chat('card-1', since + 60_000)
    chat('card-2', since + 60_000)

    const read = chatsToReview(since)
    assert.deepEqual(read.find((c) => c.cardId === 1)!.memory, ['docs/kanban/memory/skill'])
    const gone = read.find((c) => c.cardId === 2)!
    assert.equal(gone.card, 'archived')
    assert.deepEqual(gone.memory, ['docs/kanban/memory/local-ui'])
  })

  it('falls back to the project memory for a discussion, and for a card it cannot find', () => {
    const since = Date.now() - DAY
    chat('discussion-11111111-2222-3333-4444-555555555555', since + 60_000)
    chat('card-9', since + 60_000)

    for (const read of chatsToReview(since)) {
      assert.deepEqual(read.memory, ['docs/kanban/memory'])
    }
    assert.equal(chatsToReview(since).find((c) => c.cardId === 9)!.card, 'gone')
  })
})

describe('what the review is handed', () => {
  it('names each conversation, its transcript and the memory it writes', () => {
    card(1, ['skill'])
    chat('card-1', Date.now())

    const said = quiet(() => printFlow({ action: 'review-memory' }))
    assert.match(said, /card 1 \(#1\)/)
    assert.match(said, /transcript: .*card-1\.json/)
    assert.match(said, /memory: .*memory\/skill/)
    assert.match(said, /none has been reviewed yet/)
  })

  it('says there is nothing to read when nothing has been said', () => {
    assert.match(quiet(() => printFlow({ action: 'review-memory' })), /nothing to review/)
  })

  // The one rule that separates this from a flow that appends: an entry written yesterday
  // and overturned today is REWRITTEN, so reading the whole transcript has a point.
  it('asks for a rewrite rather than a second note, and reads the bar off the board', () => {
    const ask = buildAsk({ action: 'review-memory' })
    assert.match(ask, /akb guide review-memory/)
    assert.match(ask, /What earns a note/)
    assert.match(ask, /Rewrite or delete a note/)
    assert.match(ask, /no card/)
    let guides: string[] = []
    quiet(() => {
      guides = printFlow({ action: 'review-memory' }).guides as string[]
    })
    assert.deepEqual(guides, ['board', 'review-memory'])
  })

  it('holds to the opt-out and to writing nothing, in its own guide', () => {
    const guide = findGuide('review-memory')!.text
    assert.match(guide, /don't record this/i)
    assert.match(guide, /writing nothing is a complete result/)
    assert.match(guide, /Read the whole transcript/)
  })
})

// #796: the rule sits beside what tempts a run into writing, so a conversation flow added
// later inherits it instead of waiting for its own sentence.
describe('a conversation writes no memory', () => {
  it('carries the rule where every flow already reads the bar', () => {
    const board = findGuide('board')!.text
    assert.match(board, /\*\*A conversation writes none\*\*/)
    assert.match(board, /akb guide review-memory/)
    assert.match(board, /Setup is not a\s+conversation/)
  })

  it('points each conversation at that rule instead of repeating it', () => {
    for (const name of ['card-chat', 'discuss-idea']) {
      const guide = findGuide(name)!.text
      assert.match(guide, /\*\*Write no memory\*\*/)
      assert.match(guide, /"What earns a note" in `akb guide board`/)
    }
    // And nothing is left of the bullets that used to ask for one.
    const chat = findGuide('card-chat')!.text
    assert.doesNotMatch(chat, /decisions\.md/)
    assert.doesNotMatch(chat, /the memory you wrote/)
  })
})
