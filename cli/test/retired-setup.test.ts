// The setup flow is retired (#214): a new board is the skeleton alone, and a board or a run
// record an older version left behind stays where it is, unread.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { readStore } from '../src/lib/agent/store.ts'
import { CONFIG_TEMPLATE } from '../src/lib/config-template.ts'
import { findGuide } from '../src/lib/guide.ts'
import { SESSIONS, setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, move } from './helpers/board.ts'

let root = ''
const kanban = (...parts: string[]): string => path.join(root, 'docs', 'kanban', ...parts)

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-retired-setup-'))
  setBoardRoot(root)
})

afterEach(() => {
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('a new board', () => {
  it('carries no checklist, no questions card and no next step', async () => {
    const answer = await move(root, ['init'])
    assert.equal(answer.created, true)
    assert.ok(!('next' in answer))
    assert.equal(fs.existsSync(kanban('setup-checklist.md')), false)
    assert.deepEqual(fs.readdirSync(kanban('todo')), ['README.md'])
  })

  it('seeds a config holding only what the program reads', () => {
    assert.deepEqual([...CONFIG_TEMPLATE.matchAll(/^- \*\*(.+?)\*\*/gm)].map((m) => m[1]), ['Stale after'])
  })
})

describe('a board from before', () => {
  it('keeps its checklist and its questions card through the repair', async () => {
    await move(root, ['init'])
    const card = kanban('todo', '1-answer-the-questions-setup-couldnt-settle.md')
    fs.writeFileSync(kanban('setup-checklist.md'), '# Setup checklist\n')
    fs.writeFileSync(card, '---\ntitle: Questions\nstatus: todo\n---\n\nBody.\n')
    const answer = await move(root, ['init'])
    assert.equal(answer.created, false)
    assert.equal(fs.readFileSync(kanban('setup-checklist.md'), 'utf8'), '# Setup checklist\n')
    assert.ok(fs.existsSync(card))
  })

  it('drops a recorded setup run on the read rather than listing a blank verb', async () => {
    await move(root, ['init'])
    fs.mkdirSync(path.dirname(SESSIONS), { recursive: true })
    fs.writeFileSync(SESSIONS, JSON.stringify({ runs: [{ sessionId: 'old', action: 'setup', status: 'done' }] }))
    assert.deepEqual(readStore().runs, [])
  })
})

describe('the guide', () => {
  it('has no setup topic', () => {
    assert.equal(findGuide('setup'), null)
  })
})
