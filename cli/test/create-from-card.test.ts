// `akb create --from-card <id>` (#1273): the card a conversation split work off is named, so
// the create run records its dependency on the new card.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { logPathOf, readStore, withStore } from '../src/lib/agent/store.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, move, run } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-from-card-'))
const kanban = path.join(root, 'docs', 'kanban')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(path.join(kanban, 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '42\n')
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

const LINK = /This came up on card #42; record its dependency on the new card\(s\) as add-task says\./

describe('create --from-card', () => {
  it('asks the create run to record the dependency on the named card', () => {
    assert.match(buildPrompt({ action: 'create', description: 'split X off', fromCard: 42 }), LINK)
  })

  it('leaves the prompt as it was without one', () => {
    const plain = buildPrompt({ action: 'create', description: 'split X off' })
    assert.doesNotMatch(plain, /This came up on card/)
    assert.equal(plain, buildPrompt({ action: 'create', description: 'split X off', fromCard: undefined }))
  })

  it('takes a card on the board and refuses one that is not', async () => {
    await move(root, ['create', '--title', 'The card it came up on'])
    await run(root, ['create', '--from-card', '42', '--print', 'split X off'])
    await assert.rejects(() => run(root, ['create', '--from-card', '43', '--print', 'split X off']), /no open card #43/)
    await assert.rejects(() => run(root, ['create', '--from-card', 'x', '--print', 'split X off']), /no open card #x/)
  })

  it('keeps the card on the run record', () => {
    const logPath = logPathOf('s1')
    fs.mkdirSync(path.dirname(logPath), { recursive: true })
    fs.writeFileSync(logPath, '')
    withStore((store) => {
      store.runs.push({ sessionId: 's1', cardId: null, action: 'create', status: 'done', startedAt: 1, harness: 'claude', logPath, fromCard: 42 })
    })
    assert.equal(readStore().runs.find((r) => r.sessionId === 's1')?.fromCard, 42)
  })
})
