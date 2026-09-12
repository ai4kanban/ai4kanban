// Settling a card that sat too long (#118).
//
// The verdict itself is an agent's and cannot be asserted here. What can, and what this
// covers, is the machinery around it: the flow is the sweeper's alone and a marketing board
// has none, the printed flow carries the two verdicts and the rules that keep it from being
// a refine, and the cards the run will not judge — a group root and a recurring job refused,
// a build and an unfinished card ahead skipped, an unanswered question NOT a reason to stop —
// and that a finished unstick hands the card it kept to nobody.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { printFlow } from '../src/lib/agent/flow.ts'
import { flowByCommand, flowPath, flowRefusal } from '../src/lib/agent/flows.ts'
import { buildAsk } from '../src/lib/agent/prompts.ts'
import { markBoard, refinementRunsAfter } from '../src/lib/agent/refine.ts'
import { roleForFlow, roleNamed } from '../src/lib/agent/roles.ts'
import type { RunRecord } from '../src/lib/agent/types.ts'
import { unstickStop } from '../src/lib/agent/unstick.ts'
import { heldBy, waitingOn } from '../src/lib/card-holds.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')
const todo = (): string => path.join(kanban(), 'todo')

/** Say what kind of board this is — `product` unless the line says otherwise. */
const solution = (name: string): void => {
  fs.writeFileSync(path.join(kanban(), 'config.md'), `- **Solution** — ${name}\n`)
}

/** One card on the board, with the frontmatter the test needs and a body a flow can read. */
function card(file: string, id: number, meta: Record<string, string> = {}, body = ''): void {
  const full = path.join(todo(), file)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  const fields = {
    title: `Card ${id}`,
    priority: 'med',
    roi: 'med',
    status: 'todo',
    release: '""',
    blocked_by: '[]',
    related: '[]',
    modules: '[]',
    questions: '[]',
    ...meta,
  }
  fs.writeFileSync(
    full,
    [
      '---',
      ...Object.entries(fields).map(([k, v]) => `${k}: ${v}`),
      '---',
      '',
      'One thing this card wants.',
      '',
      '## Worth noting',
      '',
      '<!-- agent -->',
      '',
      '## Scope',
      '- do the thing',
      '',
      '## Todo',
      body || '- [ ] do the thing',
      '',
      '## Decided by the agent',
      '',
    ].join('\n'),
  )
}

/** Everything printed while `work` ran — a printed flow says rather than returns. */
function quiet<T>(work: () => T): { value: T; said: string } {
  const sink = startCollecting()
  try {
    return { value: work(), said: sink.out.join('\n') }
  } finally {
    stopCollecting()
  }
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-unstick-'))
  fs.mkdirSync(todo(), { recursive: true })
  fs.writeFileSync(path.join(todo(), 'README.md'), '# Open tasks\n')
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  setBoardRoot(root)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the flow', () => {
  it('is typed `card unstick <id>` and belongs to the sweeper alone', () => {
    const flow = flowByCommand('unstick')!
    assert.equal(flowPath(flow), 'card unstick')
    assert.equal(flow.argument, '<id>')
    assert.equal(roleForFlow('unstick')!.name, 'sweeper')
    // It owns no memory: what it judged is on the card it kept, or gone with the one it dropped.
    assert.deepEqual(roleNamed('sweeper')!.memory, [])
    assert.equal(flowRefusal('unstick'), null)
  })

  it('is not a marketing flow — a topic nobody published is the user\'s to drop', () => {
    solution('marketing')
    assert.equal(roleForFlow('unstick'), undefined)
    assert.match(flowRefusal('unstick')!, /is not a `marketing` flow/)
  })

  it('prints both verdicts, the note, and what separates it from a refine', () => {
    card('1-stale.md', 1)
    const { said } = quiet(() => printFlow({ action: 'unstick', id: 1 }))
    assert.match(said, /raw reject 1 --discard/)
    assert.match(said, /no memory note, no `rejected.md` line/)
    assert.match(said, /By `sweeper` agent/)
    assert.match(said, /never touch a `- \[x\]` todo/)
    assert.match(said, /never append a question: this is a verdict, not a refine/)
    assert.match(said, /end with one line — kept or discarded/)
    // Undatable here: the board is a fresh folder git has never committed.
    assert.match(said, /sat\s+unknown — git has never committed this card/)
  })

  it('asks for a verdict rather than for a better plan', () => {
    const ask = buildAsk({ action: 'unstick', id: 1, title: 'Stale card' })
    assert.match(ask, /akb guide unstick/)
    assert.match(ask, /raw reject 1 --discard/)
    assert.match(ask, /this is not a refine/)
    assert.match(ask, /raise no new question/)
    // The section name reads as itself: no escaped backticks left over from the template.
    assert.match(ask, /under a dated ## By `sweeper` agent note/)
  })
})

describe('the cards it will not judge', () => {
  it('refuses a group root and a recurring job — neither can sit stuck', () => {
    card(path.join('1-group', 'root.md'), 1)
    card(path.join('recurring', '2-sweep.md'), 2, { cadence: '1d' })
    assert.equal(unstickStop(1)!.kind, 'refused')
    assert.match(unstickStop(1)!.why, /group root/)
    assert.equal(unstickStop(2)!.kind, 'refused')
    assert.match(unstickStop(2)!.why, /recurring job/)
  })

  it('skips a card being built and one waiting on an unfinished card', () => {
    card('1-building.md', 1, { status: 'implementing' })
    card('2-ahead.md', 2)
    card('3-behind.md', 3, { blocked_by: '[2]' })
    assert.equal(unstickStop(1)!.kind, 'waiting')
    assert.match(unstickStop(1)!.why, /being built/)
    assert.equal(unstickStop(3)!.kind, 'waiting')
    assert.match(unstickStop(3)!.why, /blocked by #2/)
  })

  it('judges a card whose blocker has left the board, and one waiting on the user', () => {
    card('1-free.md', 1, { blocked_by: '[99]' })
    card('2-asked.md', 2, { questions: '[{ text: "[user] which way?" }]' })
    // #99 is not open, so it holds nothing — and nobody is acting on an unanswered question,
    // so the card is judged like any other and may be discarded before it is ever answered.
    assert.equal(unstickStop(1), null)
    assert.equal(unstickStop(2), null)
  })
})

describe('what is holding a card', () => {
  it('reads the three holds in the order the card does, and stops on two of them', () => {
    const holds = heldBy({
      blockers: [4, 9],
      questions: [{ text: '[user] which way?' }],
      status: 'implementing',
    })
    assert.deepEqual(
      holds.map((h) => h.text),
      ['blocked by #4, #9', 'waiting on you', 'being built'],
    )
    assert.equal(waitingOn(holds)!.kind, 'blocked')
    assert.equal(waitingOn(holds.filter((h) => h.kind === 'user')), null)
  })
})

describe('what follows the run', () => {
  it('starts nothing on the card it kept — the verdict is not a refine', () => {
    card('7-kept.md', 7)
    const before = markBoard()
    const run: RunRecord = {
      sessionId: 'unstick-7',
      cardId: 7,
      action: 'unstick',
      status: 'done',
      startedAt: 0,
      harness: 'test',
      logPath: '/dev/null',
    }
    // The card was rewritten, so the run claims it — and it is still a card the sweeper
    // settled, not one to re-plan.
    assert.deepEqual(refinementRunsAfter(run, [7], before).runs, [])
    assert.equal(refinementRunsAfter(run, [7], before).stalled, undefined)
  })
})
