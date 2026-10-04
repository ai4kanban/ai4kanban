// Recurring cards become scheduled agents (#1414): the card's words are the agent's rule,
// its cadence and last run go to the workflow, and the card leaves the board.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { scheduledAgent } from '../src/lib/agent/workflows.ts'
import { specAgentCatalog } from '../src/lib/agents/catalog.ts'
import { board } from '../src/lib/board/index.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { migrateRecurringCards, recurringCardsLeft } from '../src/lib/recurring.ts'
import { readInbox } from '../src/lib/signals/inbox.ts'
import { allCards } from '../src/lib/view/read.ts'
import { forgetMachineState, move } from './helpers/board.ts'

let root = ''
const kanban = (...parts: string[]): string => path.join(root, 'docs', 'kanban', ...parts)
const read = (...parts: string[]): string => fs.readFileSync(kanban(...parts), 'utf8')
const exists = (...parts: string[]): boolean => fs.existsSync(kanban(...parts))

const write = (rel: string, text: string): void => {
  fs.mkdirSync(path.dirname(kanban(rel)), { recursive: true })
  fs.writeFileSync(kanban(rel), text)
}

interface CardBits {
  title?: string
  front?: string[]
  questions?: string[]
  body?: string
}

const BODY = ['Check the links on the site every week.', '', '## Process', '1. Crawl the site.', '2. Report dead links.', ''].join('\n')

const recurringCard = (name: string, bits: CardBits = {}): void =>
  write(
    `todo/recurring/${name}.md`,
    [
      '---',
      `title: ${bits.title ?? 'Check the links'}`,
      'priority: med',
      'roi: med',
      'status: todo',
      'release: ""',
      'blocked_by: []',
      'related: []',
      'modules: []',
      ...(bits.front ?? []),
      ...(bits.questions ?? ['questions: []']),
      '---',
      '',
      bits.body ?? BODY,
    ].join('\n'),
  )

const plainCard = (name: string, front: string[]): void =>
  write(`todo/${name}.md`, ['---', 'title: A task', 'priority: med', 'roi: med', 'status: todo', 'release: ""', ...front, 'modules: []', 'questions: []', '---', '', 'Body.', ''].join('\n'))

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-recurring-'))
  fs.mkdirSync(kanban('todo'), { recursive: true })
  fs.writeFileSync(kanban('next-id'), '50\n')
  fs.writeFileSync(kanban('todo', 'README.md'), '# Tasks\n\n## Tasks\n')
  fs.writeFileSync(kanban('config.md'), '- **Solution** — product\n')
  setBoardRoot(root)
})

afterEach(() => {
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('a recurring card becomes a scheduled agent', () => {
  it('carries a cadence and a last run over, switched on', () => {
    recurringCard('7-check-the-links', { front: ['cadence: 7d', 'last_run: 2026-09-20 09:00'] })
    const done = migrateRecurringCards()

    assert.deepEqual(done.failed, [])
    assert.equal(done.agents.length, 1)
    assert.equal(done.agents[0]!.agent, 'check-the-links')
    assert.equal(done.agents[0]!.on, true)
    const one = scheduledAgent('coding', 'check-the-links')!
    assert.equal(one.off, undefined)
    assert.equal(one.cadence, '7d')
    assert.equal(one.lastRun, '2026-09-20 09:00')
    // The cadence counts from the card's last run, not from the upgrade.
    assert.equal(one.since, undefined)

    const agent = specAgentCatalog().agents.find((a) => a.name === 'check-the-links')!
    assert.equal(agent.schedule, true)
    assert.equal(agent.description, 'Check the links on the site every week.')
    assert.equal(agent.i18n.en?.title, 'Check the links')
    assert.equal(agent.body.trim(), BODY.trim().replace('## Process\n', '## Process\n\n'))
    assert.deepEqual(specAgentCatalog().problems, [])

    assert.equal(exists('todo', 'recurring'), false)
    assert.equal(recurringCardsLeft(), false)
  })

  it('leaves a card with no cadence switched off', () => {
    recurringCard('7-check-the-links')
    const done = migrateRecurringCards()
    assert.equal(done.agents[0]!.on, false)
    const one = scheduledAgent('coding', 'check-the-links')!
    assert.equal(one.off, true)
    assert.equal(one.lastRun, '')
  })

  it('keeps the run state in the rule as the card wrote it, and writes none when the card had none', () => {
    recurringCard('7-check-the-links', {
      body: ['A job.', '', '## Run state', '- **Last page**: 12', '', '## Process', '1. Carry on from `## Run state`.', ''].join('\n'),
    })
    recurringCard('8-other-job')
    migrateRecurringCards()
    assert.match(read('agents', 'check-the-links', 'AGENT.md'), /\nA job\.\n\n## Run state\n\n- \*\*Last page\*\*: 12\n\n## Process\n\n1\. Carry on from `## Run state`\.\n$/)
    assert.doesNotMatch(read('agents', 'other-job', 'AGENT.md'), /Run state/)
  })

  it('goes to the workflow the card names, and to Coding when that one is gone', () => {
    recurringCard('7-check-the-links', { front: ['workflow: no-such-workflow'] })
    const done = migrateRecurringCards()
    assert.equal(done.agents[0]!.workflow, 'Coding')
    assert.ok(scheduledAgent('coding', 'check-the-links'))
  })

  it('turns each open question into a triage item naming the agent, and leaves a skipped one behind', () => {
    recurringCard('7-check-the-links', {
      questions: [
        'questions:',
        '  - "[user] Should external links count?"',
        '  - question: Which report format?',
        '    mode: single',
        '    options:',
        '      - Markdown',
        '      - CSV',
        '    recommend: [1]',
        '  - question: Skipped long ago?',
        '    skipped: true',
      ],
    })
    migrateRecurringCards()
    const items = readInbox()
    assert.deepEqual(items.map((i) => i.title).sort(), ['Should external links count?', 'Which report format?'])
    for (const item of items) assert.deepEqual(item.meta, [{ key: 'source', value: 'agent check-the-links' }])
    assert.match(items.find((i) => i.title === 'Which report format?')!.summary, /- Markdown\n- CSV/)
  })

  it('moves the folders beside the cards to agents/, merging one named after an agent', () => {
    recurringCard('7-check-the-links', {
      body: ['A job.', '', '## Process', '1. Write `docs/kanban/todo/recurring/link-report/result.md`.', ''].join('\n'),
    })
    write('todo/recurring/link-report/result.md', '# Result\n')
    write('todo/recurring/check-the-links/notes.md', '# Notes\n')
    migrateRecurringCards()
    assert.equal(read('agents', 'link-report', 'result.md'), '# Result\n')
    assert.equal(read('agents', 'check-the-links', 'notes.md'), '# Notes\n')
    assert.ok(exists('agents', 'check-the-links', 'AGENT.md'))
    assert.match(read('agents', 'check-the-links', 'AGENT.md'), /`docs\/kanban\/agents\/link-report\/result\.md`/)
    // A working folder is no broken agent.
    assert.deepEqual(specAgentCatalog().problems, [])
    assert.equal(exists('todo', 'recurring'), false)
  })

  it('adds the card id to a name another agent already has', () => {
    write('agents/check-the-links/AGENT.md', ['---', 'name: check-the-links', 'description: Use when.', 'akb:', '  hook: plan', '---', '', 'Mine.', ''].join('\n'))
    recurringCard('7-check-the-links')
    recurringCard('8-builder')
    const done = migrateRecurringCards()
    assert.deepEqual(done.agents.map((a) => a.agent), ['check-the-links-7', 'builder-8'])
    assert.match(read('agents', 'check-the-links', 'AGENT.md'), /Mine\./)
  })

  it('deletes "Fetch triage items" with or without a cadence, and makes no agent of it', () => {
    recurringCard('7-fetch-triage-items', { title: 'Fetch triage items', front: ['cadence: 1d'] })
    const done = migrateRecurringCards()
    assert.deepEqual(done.agents, [])
    assert.deepEqual(done.removed, ['docs/kanban/todo/recurring/7-fetch-triage-items.md'])
    assert.equal(exists('agents'), false)
    assert.equal(exists('todo', 'recurring'), false)
  })

  it('does nothing the second time', () => {
    recurringCard('7-check-the-links', { front: ['cadence: 7d'] })
    migrateRecurringCards()
    const before = read('agents', 'check-the-links', 'AGENT.md')
    assert.deepEqual(migrateRecurringCards(), { agents: [], removed: [], failed: [] })
    assert.equal(read('agents', 'check-the-links', 'AGENT.md'), before)
    assert.deepEqual(fs.readdirSync(kanban('agents')), ['check-the-links'])
  })

  it('picks up where a pass stopped after writing the agent, without making a second one', () => {
    recurringCard('7-check-the-links', { front: ['cadence: 7d'] })
    const card = read('todo', 'recurring', '7-check-the-links.md')
    migrateRecurringCards()
    write('todo/recurring/7-check-the-links.md', card)
    const done = migrateRecurringCards()
    assert.equal(done.agents[0]!.agent, 'check-the-links')
    assert.deepEqual(fs.readdirSync(kanban('agents')), ['check-the-links'])
  })

  it('keeps a card it cannot migrate and leaves no half an agent', () => {
    recurringCard('7-no-process', { body: 'A job with no steps.\n' })
    recurringCard('8-check-the-links')
    const done = migrateRecurringCards()
    assert.equal(done.failed.length, 1)
    assert.match(done.failed[0]!.why, /## Process/)
    assert.ok(exists('todo', 'recurring', '7-no-process.md'))
    assert.equal(exists('agents', 'no-process'), false)
    assert.deepEqual(done.agents.map((a) => a.agent), ['check-the-links'])
    assert.equal(recurringCardsLeft(), true)
    // Still waiting, it is no card: nothing refines or builds it.
    assert.deepEqual(allCards().map((c) => c.id), [])
  })

  it('takes the card out of the index and out of every other card’s blocked_by and related', () => {
    recurringCard('7-check-the-links')
    plainCard('9-a-task', ['blocked_by: [7, 3]', 'related: [7]'])
    fs.appendFileSync(kanban('todo', 'README.md'), '- [#7 Check the links](recurring/7-check-the-links.md)\n- [#9 A task](9-a-task.md)\n')
    migrateRecurringCards()
    assert.match(read('todo', '9-a-task.md'), /^blocked_by: \[3\]$/m)
    assert.match(read('todo', '9-a-task.md'), /^related: \[\]$/m)
    assert.doesNotMatch(read('todo', 'README.md'), /#7/)
    assert.match(read('todo', 'README.md'), /#9/)
  })
})

describe('when the migration runs', () => {
  it('runs on the board repair, which says what became of each card', async () => {
    recurringCard('7-check-the-links', { front: ['cadence: 7d'] })
    recurringCard('8-fetch-triage-items', { title: 'Fetch triage items' })
    await move(root, ['init'])
    assert.ok(exists('agents', 'check-the-links', 'AGENT.md'))
    assert.equal(exists('todo', 'recurring'), false)
  })

  it('runs before the board starts anything on its own', async () => {
    recurringCard('7-check-the-links')
    const work = await board().nextWork()
    assert.equal(work.some((w) => w.id === 7), false)
    assert.ok(exists('agents', 'check-the-links', 'AGENT.md'))
    assert.equal(exists('todo', 'recurring'), false)
  })
})
