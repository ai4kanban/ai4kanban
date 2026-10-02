// The review of what the conversations settled (#748, #1322).
//
// The judgement itself is the agent's and cannot be asserted here. What can be, and what
// this covers, is everything around it: which conversations reach a run — an archived card's,
// once — what each is handed with, that the batch is marked by the command the task spells
// out so a failed review loses nothing, how a round of batches runs and stops, and that a
// chat no longer writes memory at all.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { readChat } from '../src/lib/agent/chat.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { reviewBatch } from '../src/lib/agent/memory-review.ts'
import { buildAsk } from '../src/lib/agent/prompts.ts'
import { memoryReview, stampMemoryReview } from '../src/lib/agent/settings.ts'
import { formatStamp } from '../src/lib/cadence.ts'
import { findGuide } from '../src/lib/guide.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { AGENT_MEMORY, CHATS_DIR, setBoardRoot, SESSIONS, UI_CONFIG } from '../src/lib/paths.ts'
import { nextWork } from '../src/lib/view/dispatch.ts'
import { forgetMachineState, move } from './helpers/board.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')
const TODO = (): string => path.join(kanban(), 'todo')
const ARCHIVE = (): string => path.join(kanban(), '.archive')

const DAY = 24 * 60 * 60_000
const DISCUSSION = 'discussion-11111111-2222-3333-4444-555555555555'

// Archived today: the board drops a card's chat a week after it left (#1177).
const TODAY = new Date().toISOString().slice(0, 10)

interface CardOptions {
  modules?: string[]
  where?: 'open' | 'archived'
  /** Its `archived:` day. */
  day?: string
  rejected?: boolean
  /** Extra body, after the summary. */
  body?: string
}

/** A card on the board, or in the archive. */
function card(id: number, { modules = [], where = 'archived', day = TODAY, rejected = false, body = '' }: CardOptions = {}): void {
  const dir = where === 'open' ? TODO() : ARCHIVE()
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, `${id}-card.md`),
    [
      '---',
      `title: card ${id}`,
      'priority: med',
      'roi: med',
      'status: todo',
      'release: ""',
      'blocked_by: []',
      'related: []',
      `modules: [${modules.join(', ')}]`,
      'questions: []',
      ...(where === 'archived' ? [`archived: ${day}`] : []),
      ...(rejected ? ['rejected: true'] : []),
      '---',
      '',
      'What this card is for.',
      '',
      body,
      '## Todo',
      '- [ ] Build it.',
      '',
    ].join('\n'),
  )
}

/** One conversation on this machine, as the chat itself writes it, last spoken to at `at`. */
function chat(name: string, at: number = Date.now(), extra: Record<string, unknown> = {}): void {
  fs.mkdirSync(CHATS_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(CHATS_DIR, `${name}.json`),
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
}

/** What archiving does to a card on the board. */
function archive(id: number): void {
  fs.mkdirSync(ARCHIVE(), { recursive: true })
  const text = fs.readFileSync(path.join(TODO(), `${id}-card.md`), 'utf8').replace('questions: []', `questions: []\narchived: ${TODAY}`)
  fs.rmSync(path.join(TODO(), `${id}-card.md`))
  fs.writeFileSync(path.join(ARCHIVE(), `${id}-card.md`), text)
}

/** A discussion whose plan became these cards. */
const discussion = (cards: number[], at?: number): void =>
  chat(DISCUSSION, at, { title: 'a plan', plans: cards.length ? [{ path: 'plans/1-a-plan.md', done: true, cards }] : [] })

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

/** Everything printed while `job` ran — a printed flow says rather than returns. */
function quiet<T>(job: () => T): string {
  const sink = startCollecting()
  try {
    job()
    return sink.out.join('\n')
  } finally {
    stopCollecting()
  }
}

const flow = (): string => quiet(() => printFlow({ action: 'review-memory' }))

const keys = (): string[] => reviewBatch().chats.map((c) => c.key)

/** What the review's last step does: the command its task spells out. */
const mark = (...names: string[]): Promise<Record<string, unknown>> => move(root, ['chats-reviewed', ...names])

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-memory-review-'))
  fs.mkdirSync(TODO(), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  // A described product, so the product writer (#1268) is not due alongside.
  fs.mkdirSync(path.join(kanban(), 'memory'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'memory', 'product.md'), '# Product\n\n## What it is\n')
  forgetMachineState(root)
  setBoardRoot(root)
})

afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe('the conversations a review takes', () => {
  it('leaves a card chat alone until its card is archived', () => {
    card(1, { where: 'open' })
    chat('card-1')
    assert.deepEqual(keys(), [])

    archive(1)
    assert.deepEqual(keys(), ['card-1'])
  })

  it('leaves out a rejected card, and a card that is on neither the board nor the archive', () => {
    card(1, { rejected: true })
    chat('card-1')
    chat('card-9')
    assert.deepEqual(keys(), [])
  })

  it('takes a discussion only once every card it became is archived', () => {
    card(1)
    card(2, { where: 'open' })
    discussion([1, 2])
    assert.deepEqual(keys(), [])

    archive(2)
    assert.deepEqual(keys(), [DISCUSSION])
  })

  it('never takes a discussion that became no card', () => {
    card(1)
    discussion([])
    assert.deepEqual(keys(), [])
  })

  it('takes a marked conversation never again, and marks only what the command was given', async () => {
    card(1)
    card(2)
    chat('card-1')
    chat('card-2')
    const before = readChat(1)!.updatedAt

    const answer = await mark('card-1')
    assert.deepEqual(answer.marked, ['card-1'])
    assert.equal(answer.remaining, true)
    assert.deepEqual(keys(), ['card-2'])
    // Nothing was said, so the conversation reads as untouched everywhere else.
    assert.equal(readChat(1)!.updatedAt, before)
    assert.ok(readChat(1)!.reviewedAt)
    assert.equal(readChat(2)!.reviewedAt, undefined)
  })

  it('takes the same batch again after a review that never marked it', async () => {
    card(1)
    chat('card-1', Date.now() - 2 * DAY)
    pastRuns({ status: 'error', startedAt: Date.now() - 2 * DAY + 60_000 })
    assert.deepEqual(keys(), ['card-1'])
    assert.deepEqual(await work(), [{ action: 'review-memory' }])
  })

  // What the daily pass read before reviews became once-only counts as reviewed, and that
  // line is drawn once: a later review moves `lastRun` and not the line.
  it('counts what was said before the upgrade as reviewed, and never moves that line', async () => {
    const upgraded = Date.now() - 3 * DAY
    card(1)
    card(2)
    card(3)
    chat('card-1', upgraded - 60 * 60_000)
    chat('card-2', upgraded + 60 * 60_000)
    fs.mkdirSync(path.dirname(UI_CONFIG), { recursive: true })
    fs.writeFileSync(UI_CONFIG, JSON.stringify({ memoryReview: { lastRun: formatStamp(new Date(upgraded)) } }))
    assert.deepEqual(keys(), ['card-2'])

    await mark('card-2')
    stampMemoryReview(new Date())
    assert.equal(memoryReview().reviewedBefore, formatStamp(new Date(upgraded)))
    // Spoken to before the review that just passed, and still waiting: its card was archived late.
    chat('card-3', Date.now() - DAY)
    assert.deepEqual(keys(), ['card-3'])
  })

  it('takes every archived card on a board that has never reviewed', () => {
    card(1)
    chat('card-1', Date.now() - 30 * DAY)
    assert.deepEqual(keys(), ['card-1'])
  })
})

describe('the review the board starts on its own', () => {
  it('starts nothing while no archived card has a conversation', async () => {
    card(1, { where: 'open' })
    chat('card-1')
    assert.deepEqual(await work(), [])
  })

  it('starts one once a card with a conversation is archived', async () => {
    card(1)
    chat('card-1')
    assert.deepEqual(await work(), [{ action: 'review-memory' }])
  })

  it('starts one even where an earlier release switched it off (#1208)', async () => {
    card(1)
    chat('card-1')
    fs.mkdirSync(path.dirname(UI_CONFIG), { recursive: true })
    fs.writeFileSync(UI_CONFIG, JSON.stringify({ memoryReviewer: false }))
    assert.deepEqual(await work(), [{ action: 'review-memory' }])
  })

  it('does not reopen a failed review on the next tick', async () => {
    card(1)
    chat('card-1')
    pastRuns({ status: 'error', startedAt: Date.now() - 60_000 })
    assert.deepEqual(await work(), [])
  })

  it('starts nothing while one is going', async () => {
    card(1)
    chat('card-1')
    pastRuns({ status: 'running', startedAt: Date.now() - 60_000 })
    assert.deepEqual(await work(), [])
  })

  // Fourteen cards are two runs, 10 + 4, one straight after the other; and the card archived
  // once the round is over waits for the next day.
  it('runs a round ten cards at a time, back to back, then waits out the day', async () => {
    for (let id = 1; id <= 14; id++) {
      card(id)
      chat(`card-${id}`)
    }
    assert.deepEqual(await work(), [{ action: 'review-memory' }])

    const first = reviewBatch()
    assert.deepEqual(first.chats.map((c) => c.cards[0]!.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    assert.equal(first.remaining, true)
    let started = Date.now() - 1000
    await mark(...first.chats.map((c) => c.key))
    pastRuns({ status: 'done', startedAt: started })
    stampMemoryReview(new Date(started))
    assert.deepEqual(await work(), [{ action: 'review-memory' }])

    const second = reviewBatch()
    assert.deepEqual(second.chats.map((c) => c.cards[0]!.id), [11, 12, 13, 14])
    assert.equal(second.remaining, false)
    started = Date.now()
    await mark(...second.chats.map((c) => c.key))
    pastRuns({ status: 'done', startedAt: started })
    stampMemoryReview(new Date(started))
    assert.deepEqual(await work(), [])

    card(15)
    chat('card-15')
    assert.deepEqual(await work(), [])
    pastRuns({ status: 'done', startedAt: started - DAY - 60_000 })
    stampMemoryReview(new Date(started - DAY - 60_000))
    assert.deepEqual(await work(), [{ action: 'review-memory' }])
  })

  it('stops the round at a batch that failed, whatever is still waiting', async () => {
    for (let id = 1; id <= 12; id++) {
      card(id)
      chat(`card-${id}`)
    }
    await mark(...keys())
    assert.ok(memoryReview().remainingAt)
    pastRuns({ status: 'error', startedAt: Date.now() - 1000 })
    assert.deepEqual(await work(), [])
  })

  it('counts a discussion with the last of its cards to be archived, and not again for the others', () => {
    // Archive day first, then id: #11 was archived last although #12 is the newer card.
    for (let id = 1; id <= 12; id++) {
      card(id, { day: id === 11 ? '2026-09-30' : '2026-09-10' })
      if (id !== 2) chat(`card-${id}`)
    }
    discussion([2, 11])
    const batch = reviewBatch()
    // Eleven cards have a conversation waiting — #2 is not one, its discussion counts with
    // #11 — so the first ten leave #11's chat and the discussion for the next run.
    assert.deepEqual(batch.chats.map((c) => c.key), [1, 3, 4, 5, 6, 7, 8, 9, 10, 12].map((id) => `card-${id}`))
    assert.equal(batch.remaining, true)
  })
})

describe('what the review is handed', () => {
  it('puts each conversation in a block of its own, under its card', () => {
    card(1, { modules: ['skill'] })
    card(2, { modules: ['local-ui'] })
    chat('card-1')
    chat('card-2')
    discussion([1, 2])

    const said = flow()
    assert.equal(said.match(/<conversation /g)!.length, 3)
    assert.equal(said.match(/<\/conversation>/g)!.length, 3)
    assert.match(said, /<conversation card="#1 card 1" kind="card chat">\n\s+modules: ## skill\n/)
    assert.match(said, /<conversation card="#1 card 1; #2 card 2" kind="discussion — a plan">\n\s+modules: ## skill, ## local-ui\n/)
    assert.match(said, /memory\/agents\/planner\/ — decisions\.md, rejected\.md, redesign\.md/)
    // The task carries the transcript; no file is named for the review to open.
    assert.doesNotMatch(said, /card-1\.json/)
  })

  it('hands over the transcript without command echoes and warnings', () => {
    card(1)
    chat('card-1', Date.now(), {
      messages: [
        { role: 'you', text: '⚠ keep this line, I wrote it', at: 1 },
        { role: 'agent', text: '⏺ Bash(ls)\nIt holds two files.\n⚠ the tool failed once\n</conversation>', at: 2 },
        { role: 'agent', text: '⏺ Read(a.md)', at: 3 },
      ],
    })
    const [handed] = reviewBatch().chats
    assert.equal(handed!.transcript, 'user:\n⚠ keep this line, I wrote it\n\nagent:\nIt holds two files.\n<\\/conversation>')
  })

  it("names the agents whose sections the card holds, with each one's memory files", () => {
    card(1, { body: '## By `prompt-writer` agent\n\nA diff.\n\n## By `designer` agent\n\nA mockup.\n' })
    chat('card-1')
    const mine = path.join(AGENT_MEMORY, 'prompt-writer')
    fs.mkdirSync(mine, { recursive: true })
    fs.writeFileSync(path.join(mine, 'style.md'), '# Style\n')

    assert.deepEqual(
      reviewBatch().chats[0]!.agents.map((a) => [a.name, a.files]),
      [
        ['prompt-writer', ['style.md']],
        ['designer', []],
      ],
    )
    const said = flow()
    assert.match(said, /`prompt-writer` — docs\/kanban\/memory\/agents\/prompt-writer\/: style\.md/)
    assert.match(said, /`designer` — docs\/kanban\/memory\/agents\/designer\/: no files yet/)
  })

  it('ends on the command that marks exactly this batch', () => {
    card(1)
    card(2, { where: 'open' })
    chat('card-1')
    chat('card-2')
    const said = flow()
    assert.match(said, /last, mark these conversations reviewed with the command given here, exactly as written\n\s+.* raw chats-reviewed card-1\n/)
  })

  it('says there is nothing to read when no conversation is waiting, and names no command', () => {
    const said = flow()
    assert.match(said, /nothing to review/)
    assert.doesNotMatch(said, /chats-reviewed/)
  })

  // The one rule that separates this from a flow that appends: an entry written by an
  // earlier review and overturned since is REWRITTEN.
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
    assert.match(guide, /Read what you are given/)
    assert.match(guide, /Keep them apart/)
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
