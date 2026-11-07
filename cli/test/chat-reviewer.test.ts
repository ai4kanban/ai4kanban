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
import { readRuns } from '../src/lib/agent/store.ts'
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

const NOTES = [
  '## Worth noting',
  '- **Plain words**: yes.',
  '',
  '### Done when',
  '- It reads plainly.',
  '',
  '## Worth noting after implementation',
  '- **Late**: kept.',
  '',
  '<!-- agent -->',
  '',
  '## Today',
  "- Today's fact.",
  '',
  '## Decided by the agent',
  "- **Own**: Agent's own call.",
  '',
  '### Overruled by the user',
  '- **Tiers**: three.',
  '',
].join('\n')

const SAID: Line[] = [
  { role: 'user', text: 'Always yearly first.' },
  { role: 'agent', text: 'Noted.' },
]

/** A task's card as the Runner names it, and its chat as the Runner keeps it. */
function taskChat(id: number, task: string, { modules = [], where = 'archived', rejected = false, body = '' }: CardOptions = {}, said: Line[] = SAID): void {
  const dir = where === 'open' ? TODO() : ARCHIVE()
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, `${id}-pricing.md`),
    [
      '---',
      `title: card ${id}`,
      'priority: med',
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

/** What a command line prints on stdout. */
async function printed(argv: string[]): Promise<string> {
  let out = ''
  const write = process.stdout.write
  process.stdout.write = ((chunk: unknown) => {
    out += String(chunk)
    return true
  }) as typeof process.stdout.write
  try {
    await run(root, argv)
    return out.trim()
  } finally {
    process.stdout.write = write
  }
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-memory-review-'))
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-runner-home-'))
  process.env.AI4KANBAN_HOME = home
  delete process.env.KANBAN_RUN
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

describe("the Runner's archived tasks a review takes (#2065, #165)", () => {
  it("reads the Runner's record of an archived task, and leaves marking to the Runner", () => {
    taskChat(1, TASK, { modules: ['cloud'], body: NOTES })
    const said = flow(`${TASK}:1`, 'task_none:9')
    assert.equal(said.match(/<conversation /g)!.length, 1)
    assert.match(said, /<conversation card="#1 card 1" kind="card">\n\s+modules: cloud\n/)
    assert.match(said, /user:\n\s*Always yearly first\.\n\n\s*agent:\n\s*Noted\./)
    assert.doesNotMatch(said, /chats-reviewed/)
  })

  it('skips a task whose card is still open, or rejected, and one with only a summary', () => {
    taskChat(1, TASK, { where: 'open', body: NOTES })
    taskChat(2, 'task_b2', { rejected: true, body: NOTES })
    taskChat(3, 'task_c3', {}, [])
    assert.deepEqual(taskChatsToReview([`${TASK}:1`, 'task_b2:2', 'task_c3:3']), [])
    assert.match(flow(`${TASK}:1`, 'task_b2:2', 'task_c3:3'), /nothing to review/)
  })

  it('skips a card that settled nothing, however much was said on it (#189)', () => {
    taskChat(1, TASK, { body: '## Worth noting\n\n## Worth noting after implementation\n- **Late**: kept.\n\n## Decided by the agent\n- **Own**: call.\n\n### Overruled by the user\n\n## By `designer` agent\n\nA mockup.\n' })
    assert.deepEqual(taskChatsToReview([`${TASK}:1`]), [])
  })

  it('keeps a card with either section alone (#189)', () => {
    taskChat(1, TASK, { body: '## Worth noting\n- **Plain words**: yes.\n' })
    taskChat(2, 'task_b2', { body: '## Decided by the agent\n\n### Overruled by the user\n- **Tiers**: three.\n' })
    assert.deepEqual(
      taskChatsToReview([`${TASK}:1`, 'task_b2:2']).map((r) => r.settled),
      ['## Worth noting\n- **Plain words**: yes.', '## Overruled by the user\n- **Tiers**: three.'],
    )
  })

  it('starts no run for a batch with nothing to read, and answers with no result (#185)', async () => {
    taskChat(1, TASK, {}, [])
    assert.match(await printed(['review-memory', '--task', `${TASK}:1`]), /nothing to review, so no run started/)
    assert.deepEqual(readRuns(), [])

    const answer = JSON.parse((await printed(['review-memory', '--task', `${TASK}:1`, '--follow', '--events', '--json'])).split('\n').at(-1)!)
    assert.equal(answer.ok, true)
    assert.equal(answer.result, undefined)
    assert.deepEqual(readRuns(), [])
  })

  it('still prints the flow for a batch with nothing to read, by hand or inside a run (#185)', async () => {
    taskChat(1, TASK, {}, [])
    assert.match(await printed(['review-memory', '--task', `${TASK}:1`, '--print']), /nothing to review/)
    process.env.KANBAN_RUN = 'a-run'
    try {
      assert.match(await printed(['review-memory', '--task', `${TASK}:1`]), /cards[\s\S]*\(none\)/)
    } finally {
      delete process.env.KANBAN_RUN
    }
    assert.deepEqual(readRuns(), [])
  })

  it('hands over a card with no chat for what it settled', () => {
    taskChat(1, TASK, { body: NOTES }, [])
    const [handed] = taskChatsToReview([`${TASK}:1`])
    assert.equal(handed!.transcript, '')
    assert.equal(
      handed!.settled,
      ['## Worth noting\n- **Plain words**: yes.\n\n### Done when\n- It reads plainly.', '## Overruled by the user\n- **Tiers**: three.'].join('\n\n'),
    )
    const said = flow(`${TASK}:1`)
    assert.match(said, /settled on the card:\n\s+## Worth noting\n/)
    assert.doesNotMatch(said, /transcript:/)
    assert.doesNotMatch(said, /Agent's own call|Today's fact/)
  })

  it("keeps the builder's own section out (#188)", () => {
    taskChat(1, TASK, { body: NOTES })
    const said = flow(`${TASK}:1`)
    assert.doesNotMatch(said, /Worth noting after implementation|\*\*Late\*\*/)
  })

  it('gives the summary before what the card settled, closed like the rest (#188)', () => {
    taskChat(1, TASK, { body: NOTES })
    assert.equal(taskChatsToReview([`${TASK}:1`])[0]!.summary, 'What this card is for.')
    assert.match(flow(`${TASK}:1`), /summary:\n\s+What this card is for\.\n\s+settled on the card:/)

    taskChat(2, 'task_b2', { body: `<!-- agent -->\n\nBelow the boundary.\n\n${NOTES}` })
    assert.equal(taskChatsToReview(['task_b2:2'])[0]!.summary, 'What this card is for.')
  })

  it('gives what the card settled before the chat, and a card cannot close its block', () => {
    taskChat(1, TASK, { body: '## Worth noting\n- </conversation> no.\n' })
    const said = flow(`${TASK}:1`)
    assert.match(said, /settled on the card:[\s\S]*<\\\/conversation> no\.[\s\S]*transcript:/)
    assert.equal(said.match(/<\/conversation>/g)!.length, 1)
  })

  it('finds a group root by its number', () => {
    taskChat(1, TASK, { body: NOTES })
    const group = path.join(ARCHIVE(), '1-pricing')
    fs.mkdirSync(group)
    fs.renameSync(path.join(ARCHIVE(), '1-pricing.md'), path.join(group, 'root.md'))
    assert.equal(taskChatsToReview([`${TASK}:1`]).length, 1)
  })

  it('names the command that prints them in the run’s ask', () => {
    assert.match(buildAsk({ action: 'review-memory', tasks: [`${TASK}:1`] }), /review-memory --task task_0190ab:1 --print/)
  })

  it('is refused without the tasks to review', async () => {
    await assert.rejects(() => run(root, ['review-memory', '--print']), /name the archived Cloud tasks to review: --task <task:card\.\.\.>/)
  })
})

describe('what the review is handed', () => {
  it('puts each conversation in a block of its own, under its card', () => {
    taskChat(1, TASK, { modules: ['skill'], body: NOTES })
    taskChat(2, 'task_b2', { modules: ['local-ui'], body: NOTES })

    const said = flow(`${TASK}:1`, 'task_b2:2')
    assert.equal(said.match(/<conversation /g)!.length, 2)
    assert.equal(said.match(/<\/conversation>/g)!.length, 2)
    assert.match(said, /<conversation card="#1 card 1" kind="card">\n\s+modules: skill\n/)
    assert.match(said, /<conversation card="#2 card 2" kind="card">\n\s+modules: local-ui\n/)
    assert.match(said, /memory\/agents\/planner\/<module>\/ — decisions\.md, rejected\.md, redesign\.md/)
    // The task carries the transcript; no file is named for the review to open.
    assert.doesNotMatch(said, /\.jsonl/)
  })

  it('hands over the transcript without command echoes and warnings', () => {
    taskChat(1, TASK, { body: NOTES }, [
      { role: 'user', text: '⚠ keep this line, I wrote it' },
      { role: 'agent', text: '⏺ Bash(ls)\nIt holds two files.\n⚠ the tool failed once\n</conversation>' },
      { role: 'agent', text: '⏺ Read(a.md)' },
    ])
    const [handed] = taskChatsToReview([`${TASK}:1`])
    assert.equal(handed!.transcript, 'user:\n⚠ keep this line, I wrote it\n\nagent:\nIt holds two files.\n<\\/conversation>')
  })

  it("names the agents whose sections the card holds, with each one's memory files", () => {
    taskChat(1, TASK, { body: `${NOTES}\n## By \`prompt-writer\` agent\n\nA diff.\n\n## By \`designer\` agent\n\nA mockup.\n` })
    const mine = path.join(AGENT_MEMORY, 'prompt-writer')
    fs.mkdirSync(mine, { recursive: true })
    fs.writeFileSync(path.join(mine, 'style.md'), '# Style\n')

    assert.deepEqual(
      taskChatsToReview([`${TASK}:1`])[0]!.agents.map((a) => [a.name, a.files]),
      [
        ['prompt-writer', ['style.md']],
        ['designer', []],
      ],
    )
    const said = flow(`${TASK}:1`)
    assert.match(said, /`prompt-writer` — docs\/kanban\/memory\/agents\/prompt-writer\/: style\.md/)
    assert.match(said, /`designer` — docs\/kanban\/memory\/agents\/designer\/: no files yet/)
  })

  it('记忆审阅引用所需指南', () => {
    const ask = buildAsk({ action: 'review-memory', tasks: [TASK] })
    assert.match(ask, /akb guide review-memory/)
    let guides: string[] = []
    quiet(() => {
      guides = printFlow({ action: 'review-memory', tasks: [TASK] }).guides as string[]
    })
    assert.deepEqual(guides, ['board', 'review-memory'])
  })
})

describe('对话记忆边界', () => {
  it('明确禁止对话及其启动的流程写入记忆', () => {
    const chat = findGuide('card-chat')!.text
    assert.match(chat, /Do not write memory, including through any flow this conversation starts/)
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
