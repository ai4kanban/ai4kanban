// The two halves of a card, where they are enforced in code (#261): the boundary marker is
// what a spec agent's section is placed against, and a refine that only moves sections is
// not a change the user has to approve again.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { cmdSpecWrite } from '../src/commands/spec-write.ts'
import { markBoard, refinementNeedsApproval } from '../src/lib/agent/refine.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

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
      'track: skill',
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
  'What the task does, and what is wrong without it.',
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

describe("a spec agent's section and the boundary", () => {
  it('lands in the agent half when nothing says otherwise', () => {
    write(SHAPED)
    cmdSpecWrite(['5', 'ui-design', '--text', 'a screen'])
    assert.deepEqual(headings(), [
      '## Worth noting',
      '<!-- agent -->',
      '## Scope',
      '## Todo',
      '## By `ui-design` agent',
      '## Decided by the agent',
    ])
  })

  it('lands above the boundary when the pick is the user\'s', () => {
    write(SHAPED)
    cmdSpecWrite(['5', 'ui-design', '--text', 'a screen', '--half', 'human'])
    assert.deepEqual(headings(), [
      '## Worth noting',
      '## By `ui-design` agent',
      '<!-- agent -->',
      '## Scope',
      '## Todo',
      '## Decided by the agent',
    ])
  })

  it('keeps the marker when a rewrite replaces the section directly above it', () => {
    write(SHAPED)
    cmdSpecWrite(['5', 'ui-design', '--text', 'a screen', '--half', 'human'])
    cmdSpecWrite(['5', 'ui-design', '--text', 'a better screen'])
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

  it('sends the section back below the boundary when asked for the agent half', () => {
    write(SHAPED)
    cmdSpecWrite(['5', 'ui-design', '--text', 'a screen', '--half', 'human'])
    cmdSpecWrite(['5', 'ui-design', '--text', 'a screen', '--half', 'agent'])
    assert.deepEqual(headings(), [
      '## Worth noting',
      '<!-- agent -->',
      '## Scope',
      '## Todo',
      '## By `ui-design` agent',
      '## Decided by the agent',
    ])
  })
})

describe('repairing a card is not a change to approve', () => {
  const OLD = [
    'What the task does, and what is wrong without it.',
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

  it('reads a section move and the new marker as no change', () => {
    write(OLD)
    const before = markBoard()
    write(SHAPED.replace('## Worth noting\n- a call a reviewer could refuse\n\n', ''))
    assert.equal(refinementNeedsApproval(5, before), false)
  })

  it('still catches a pass that rewords a line', () => {
    write(OLD)
    const before = markBoard()
    write(OLD.replace('- a requirement', '- a different requirement'))
    assert.equal(refinementNeedsApproval(5, before), true)
  })
})
