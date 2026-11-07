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
import { forgetMachineState } from './helpers/board.ts'

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
      `status: ${status}`,
      'blocked_by: []',
      'related: []',
      'modules: [skill]',
      'questions: []',
      '---',
      '',
      body,
    ].join('\n'),
  )

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
