// The review of what the conversations settled (#748, #1322, #2065).
//
// The judgement itself is the agent's and cannot be asserted here. What can be, and what
// this covers, is everything around it: which Cloud task chats reach a run — an archived
// card's — what each is handed with, and that a chat no longer writes memory at all.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { printFlow } from '../src/lib/agent/flow.ts'
import { taskChatsToReview } from '../src/lib/agent/memory-review.ts'
import { runtimeOfAgent } from '../src/lib/agent/runtimes.ts'
import { readRule } from '../src/lib/agent/rules.ts'
import { specAgentNames } from '../src/lib/spec-agent-names.ts'
import { buildAsk } from '../src/lib/agent/prompts.ts'
import { findGuide } from '../src/lib/guide.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { AGENT_MEMORY, RULES, setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, restoreMachineHome, run } from './helpers/board.ts'

let root = ''
let home = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')
const TODO = (): string => path.join(kanban(), 'todo')
const ARCHIVE = (): string => path.join(kanban(), '.archive')

const TASK = 'task_0190ab'

interface CardOptions {
  modules?: string[]
  where?: 'open' | 'archived'
  rejected?: boolean
  /** Extra body, after the summary. */
  body?: string
}

interface Line {
  role: 'user' | 'agent'
  text: string
}

const SAID: Line[] = [
  { role: 'user', text: 'Always yearly first.' },
  { role: 'agent', text: 'Noted.' },
]

/** A task's card as the Runner names it, and its chat as the Runner keeps it. */
function taskChat(id: number, task: string, { modules = [], where = 'archived', rejected = false, body = '' }: CardOptions = {}, said: Line[] = SAID): void {
  const dir = where === 'open' ? TODO() : ARCHIVE()
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, `${id}-pricing-${task.toLowerCase().replace(/_/g, '-')}.md`),
    [
      '---',
      `title: card ${id}`,
      'priority: med',
      'roi: med',
      'status: todo',
      'blocked_by: []',
      'related: []',
      `modules: [${modules.join(', ')}]`,
      'questions: []',
      ...(where === 'archived' ? ['archived: 2026-10-01'] : []),
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
  fs.mkdirSync(path.join(home, 'chats'), { recursive: true })
  fs.writeFileSync(
    path.join(home, 'chats', `${task}.jsonl`),
    [...said.map((line, i) => JSON.stringify({ id: `msg_${i}`, ...line, at: i + 1 })), '{"torn'].join('\n'),
  )
}

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

const flow = (...tasks: string[]): string => quiet(() => printFlow({ action: 'review-memory', tasks }))

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-memory-review-'))
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-runner-home-'))
  process.env.AI4KANBAN_HOME = home
  fs.mkdirSync(TODO(), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  forgetMachineState(root)
  setBoardRoot(root)
})

afterEach(() => {
  restoreMachineHome()
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(home, { recursive: true, force: true })
})

describe("the Runner's task chats a review takes (#2065)", () => {
  it("reads the Runner's record of an archived task, and leaves marking to the Runner", () => {
    taskChat(1, TASK, { modules: ['cloud'] })
    const said = flow(TASK, 'task_none')
    assert.equal(said.match(/<conversation /g)!.length, 1)
    assert.match(said, /<conversation card="#1 card 1" kind="card chat">\n\s+modules: cloud\n/)
    assert.match(said, /user:\n\s*Always yearly first\.\n\n\s*agent:\n\s*Noted\./)
    assert.doesNotMatch(said, /chats-reviewed/)
  })

  it('skips a task whose card is still open, or rejected, and one with no record', () => {
    taskChat(1, TASK, { where: 'open' })
    taskChat(2, 'task_b2', { rejected: true })
    taskChat(3, 'task_c3', {}, [])
    assert.deepEqual(taskChatsToReview([TASK, 'task_b2', 'task_c3']), [])
    assert.match(flow(TASK, 'task_b2', 'task_c3'), /nothing to review/)
  })

  it('names the command that prints them in the run’s ask', () => {
    assert.match(buildAsk({ action: 'review-memory', tasks: [TASK] }), /review-memory --task task_0190ab --print/)
  })

  it('is refused without the tasks to review', async () => {
    await assert.rejects(() => run(root, ['review-memory', '--print']), /name the Cloud tasks whose chats to review: --task <id\.\.\.>/)
  })
})

describe('what the review is handed', () => {
  it('puts each conversation in a block of its own, under its card', () => {
    taskChat(1, TASK, { modules: ['skill'] })
    taskChat(2, 'task_b2', { modules: ['local-ui'] })

    const said = flow(TASK, 'task_b2')
    assert.equal(said.match(/<conversation /g)!.length, 2)
    assert.equal(said.match(/<\/conversation>/g)!.length, 2)
    assert.match(said, /<conversation card="#1 card 1" kind="card chat">\n\s+modules: skill\n/)
    assert.match(said, /<conversation card="#2 card 2" kind="card chat">\n\s+modules: local-ui\n/)
    assert.match(said, /memory\/agents\/planner\/<module>\/ — decisions\.md, rejected\.md, redesign\.md/)
    // The task carries the transcript; no file is named for the review to open.
    assert.doesNotMatch(said, /\.jsonl/)
  })

  it('hands over the transcript without command echoes and warnings', () => {
    taskChat(1, TASK, {}, [
      { role: 'user', text: '⚠ keep this line, I wrote it' },
      { role: 'agent', text: '⏺ Bash(ls)\nIt holds two files.\n⚠ the tool failed once\n</conversation>' },
      { role: 'agent', text: '⏺ Read(a.md)' },
    ])
    const [handed] = taskChatsToReview([TASK])
    assert.equal(handed!.transcript, 'user:\n⚠ keep this line, I wrote it\n\nagent:\nIt holds two files.\n<\\/conversation>')
  })

  it("names the agents whose sections the card holds, with each one's memory files", () => {
    taskChat(1, TASK, { body: '## By `prompt-writer` agent\n\nA diff.\n\n## By `designer` agent\n\nA mockup.\n' })
    const mine = path.join(AGENT_MEMORY, 'prompt-writer')
    fs.mkdirSync(mine, { recursive: true })
    fs.writeFileSync(path.join(mine, 'style.md'), '# Style\n')

    assert.deepEqual(
      taskChatsToReview([TASK])[0]!.agents.map((a) => [a.name, a.files]),
      [
        ['prompt-writer', ['style.md']],
        ['designer', []],
      ],
    )
    const said = flow(TASK)
    assert.match(said, /`prompt-writer` — docs\/kanban\/memory\/agents\/prompt-writer\/: style\.md/)
    assert.match(said, /`designer` — docs\/kanban\/memory\/agents\/designer\/: no files yet/)
  })

  // The one rule that separates this from a flow that appends: an entry written by an
  // earlier review and overturned since is REWRITTEN.
  it('asks for a rewrite rather than a second note, and reads the bar off the board', () => {
    const ask = buildAsk({ action: 'review-memory', tasks: [TASK] })
    assert.match(ask, /akb guide review-memory/)
    assert.match(ask, /What earns a note/)
    assert.match(ask, /Rewrite or delete a note/)
    assert.match(ask, /no card/)
    let guides: string[] = []
    quiet(() => {
      guides = printFlow({ action: 'review-memory', tasks: [TASK] }).guides as string[]
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
    assert.match(board, /Setup is not a\s+conversation/)
  })

  it('points each conversation at that rule instead of repeating it', () => {
    const chat = findGuide('card-chat')!.text
    assert.match(chat, /\*\*Write no memory\*\*/)
    assert.match(chat, /"What earns a note" in `akb guide board`/)
    // And nothing is left of the bullets that used to ask for one.
    assert.doesNotMatch(chat, /decisions\.md/)
    assert.doesNotMatch(chat, /the memory you wrote/)
  })
})

// It was `memory-reviewer` before #1502; what a user saved under that name still applies.
describe('the name it had before', () => {
  it('keeps the runtime pick and the rule saved under it', () => {
    assert.equal(runtimeOfAgent(specAgentNames('chat-reviewer'), { 'memory-reviewer': 'fast' }), 'fast')
    fs.mkdirSync(RULES, { recursive: true })
    fs.writeFileSync(path.join(RULES, 'memory-reviewer.md'), 'Only remember release decisions.\n')
    assert.equal(readRule('chat-reviewer'), 'Only remember release decisions.')
    assert.equal(fs.existsSync(path.join(RULES, 'memory-reviewer.md')), false)
  })
})
