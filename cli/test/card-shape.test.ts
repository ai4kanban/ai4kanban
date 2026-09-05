// The two halves of a card, where they are enforced in code (#261): the boundary marker is
// what a spec agent's section is placed against, and a refine that only moves sections has
// not replanned anything, so the loop does not spend another pass on it.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { claimChanges, markBoard, refinementAfter } from '../src/lib/agent/refine.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { move } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-shape-'))
const todo = path.join(root, 'docs', 'kanban', 'todo')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
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

const specWrite = (argv: string[]): Promise<Record<string, unknown>> =>
  move(root, ['spec-write', '5', 'ui-design', ...argv])

describe("a spec agent's section and the boundary", () => {
  it('lands in the agent half when nothing says otherwise', async () => {
    write(SHAPED)
    await specWrite(['--text', 'a screen'])
    assert.deepEqual(headings(), [
      '## Worth noting',
      '<!-- agent -->',
      '## Scope',
      '## Todo',
      '## By `ui-design` agent',
      '## Decided by the agent',
    ])
  })

  it('lands above the boundary when the pick is the user\'s', async () => {
    write(SHAPED)
    await specWrite(['--text', 'a screen', '--half', 'human'])
    assert.deepEqual(headings(), [
      '## Worth noting',
      '## By `ui-design` agent',
      '<!-- agent -->',
      '## Scope',
      '## Todo',
      '## Decided by the agent',
    ])
  })

  it('keeps the marker when a rewrite replaces the section directly above it', async () => {
    write(SHAPED)
    await specWrite(['--text', 'a screen', '--half', 'human'])
    await specWrite(['--text', 'a better screen'])
    assert.deepEqual(headings(), [
      '## Worth noting',
      '## By `ui-design` agent',
      '<!-- agent -->',
      '## Scope',
      '## Todo',
      '## Decided by the agent',
    ])
    assert.ok(fs.readFileSync(file, 'utf8').includes('a better screen'))
  })

  it('sends the section back below the boundary when asked for the agent half', async () => {
    write(SHAPED)
    await specWrite(['--text', 'a screen', '--half', 'human'])
    await specWrite(['--text', 'a screen', '--half', 'agent'])
    assert.deepEqual(headings(), [
      '## Worth noting',
      '<!-- agent -->',
      '## Scope',
      '## Todo',
      '## By `ui-design` agent',
      '## Decided by the agent',
    ])
  })

  // The word the heading carries changed twice (#403, #419). A card written under either
  // one is rewritten in place, so a rerun never leaves two sections for the same agent.
  it('rewrites the heading a card already carries, whichever word it uses', async () => {
    write(SHAPED.replace('## Scope', '## By `ui-design` skill\n\nan old screen\n\n## Scope'))
    await specWrite(['--text', 'a new screen'])
    assert.deepEqual(headings(), [
      '## Worth noting',
      '<!-- agent -->',
      '## By `ui-design` agent',
      '## Scope',
      '## Todo',
      '## Decided by the agent',
    ])
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
    assert.equal(refinementAfter('resolve', 5, 1, claimChanges(before, 'resolve-5')), null)
  })

  it('still catches a pass that rewords a line', async () => {
    write(OLD, 'todo')
    const before = markBoard()
    write(OLD.replace('- a requirement', '- a different requirement'), 'todo')
    assert.deepEqual(refinementAfter('resolve', 5, 1, claimChanges(before, 'resolve-5')), {
      action: 'clarify',
      id: 5,
      title: 'A card',
      refineRound: 2,
      refineEffort: 'standard',
    })
  })

  it('leaves the status a pass closed on alone', async () => {
    write(OLD, 'todo')
    const before = markBoard()
    write(OLD.replace('- a requirement', '- a different requirement'), 'ready')
    assert.equal(refinementAfter('resolve', 5, 1, claimChanges(before, 'resolve-5')), null)
  })
})
