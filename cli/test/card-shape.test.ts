// The two halves of a card, where they are enforced in code (#261): the boundary marker is
// what a spec agent's section is placed against, and a refine that only moves sections has
// not replanned anything, so the loop does not spend another pass on it.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { claimChanges, markBoard } from '../src/lib/agent/refine.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, move, uiConfigOf } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-shape-'))
const todo = path.join(root, 'docs', 'kanban', 'todo')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(path.join(todo, 'skill'), { recursive: true })
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

const file = path.join(todo, 'skill', '5-a-card.md')

const write = (body: string, status = 'ready'): void =>
  fs.writeFileSync(
    file,
    [
      '---',
      'title: A card',
      'priority: med',
      'roi: med',
      `status: ${status}`,
      'release: ""',
      'blocked_by: []',
      'related: []',
      'modules: [skill]',
      'questions: []',
      '---',
      '',
      body,
    ].join('\n'),
  )

const read = (): string[] => fs.readFileSync(file, 'utf8').split('\n')
const headings = (): string[] => read().filter((l) => /^(##\s|<!-- agent -->)/.test(l))

const SHAPED = [
  'The observable result and the current behavior or constraint it changes.',
  '',
  '## Worth noting',
  '- a call a reviewer could refuse',
  '',
  '<!-- agent -->',
  '',
  '## Scope',
  '- a requirement',
  '',
  '## Todo',
  '- [ ] a step',
  '',
  '## Decided by the agent',
  '- **One?** Yes.',
  '',
].join('\n')

const specWrite = (argv: string[], agent = 'ui-designer'): Promise<Record<string, unknown>> =>
  move(root, ['spec-write', '5', agent, ...argv])

/** What a board saved for the retired Output setting (#445). */
const setOutput = (agent: string, output: string): void =>
  fs.writeFileSync(
    uiConfigOf(root, 'docs', 'kanban'),
    JSON.stringify({ specAgents: { [agent]: { output } } }, null, 2),
  )

const ABOVE = [
  '## Worth noting',
  '## By `ui-designer` agent',
  '<!-- agent -->',
  '## Scope',
  '## Todo',
  '## Decided by the agent',
]

const BELOW = [
  '## Worth noting',
  '<!-- agent -->',
  '## Scope',
  '## Todo',
  '## By `ui-designer` agent',
  '## Decided by the agent',
]

describe("the half a spec agent's section lands in (#445, #1574)", () => {
  it('is the human half, on the rewrite too', async () => {
    write(SHAPED)
    await specWrite(['--text', 'a screen'])
    assert.deepEqual(headings(), ABOVE)
    // Directly above the marker, so a rewrite that took it away would divide the card
    // somewhere else.
    await specWrite(['--text', 'a better screen'])
    assert.deepEqual(headings(), ABOVE)
    assert.ok(fs.readFileSync(file, 'utf8').includes('a better screen'))
  })

  // There is no setting any more (#1574): a value an older board saved acts on nothing.
  it('is the human half for every agent, whatever the board saved', async () => {
    setOutput('tech-stack-advisor', 'agent')
    write(SHAPED)
    await specWrite(['--text', 'a pick'], 'tech-stack-advisor')
    assert.deepEqual(headings(), [
      '## Worth noting',
      '## By `tech-stack-advisor` agent',
      '<!-- agent -->',
      '## Scope',
      '## Todo',
      '## Decided by the agent',
    ])
  })

  it('moves a section an older card holds below the boundary up on its own rewrite', async () => {
    write(SHAPED.replace('## Decided by the agent', '## By `ui-designer` agent\n\na screen\n\n## Decided by the agent'))
    assert.deepEqual(headings(), BELOW)
    await specWrite(['--text', 'a better screen'])
    assert.deepEqual(headings(), ABOVE)
  })

  // The word the heading carries changed twice (#403, #419). A card written under either
  // one is rewritten rather than doubled, so a rerun never leaves two sections for one agent.
  it('rewrites the heading a card already carries, whichever word it uses', async () => {
    write(SHAPED.replace('## Scope', '## By `ui-designer` skill\n\nan old screen\n\n## Scope'))
    await specWrite(['--text', 'a new screen'])
    assert.deepEqual(headings(), ABOVE)
    const card = fs.readFileSync(file, 'utf8')
    assert.ok(card.includes('a new screen'))
    assert.ok(!card.includes('an old screen'))
  })
})

describe('repairing a card is not a change worth another pass', () => {
  const OLD = [
    'The observable result and the current behavior or constraint it changes.',
    '',
    '## Decided by the agent',
    '- **One?** Yes.',
    '',
    '## Scope',
    '- a requirement',
    '',
    '## Todo',
    '- [ ] a step',
    '',
  ].join('\n')

  it('reads a section move and the new marker as no change', async () => {
    write(OLD, 'todo')
    const before = markBoard()
    write(SHAPED.replace('## Worth noting\n- a call a reviewer could refuse\n\n', ''), 'todo')
    assert.deepEqual(claimChanges(before, 'resolve-5'), [])
  })

  it('still catches a pass that rewords a line', async () => {
    write(OLD, 'todo')
    const before = markBoard()
    write(OLD.replace('- a requirement', '- a different requirement'), 'todo')
    assert.deepEqual(claimChanges(before, 'resolve-5'), [5])
  })
})
