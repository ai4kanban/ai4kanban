// Start now on a triage item (#1193): a build with no card, bounded by the item, that files the
// item on the card it writes and holds it off a sort while it runs.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { findDelivery } from '../src/lib/agent/deliveries.ts'
import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { openRun, patch } from '../src/lib/agent/sessions.ts'
import { itemsBeingCarded } from '../src/lib/agent/store.ts'
import type { AgentRequest } from '../src/lib/agent/types.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { addToInbox } from '../src/lib/signals/add.ts'
import { readSignals } from '../src/lib/signals/index.ts'

let root = ''
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-triage-start-'))
  fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo'), { recursive: true })
  setBoardRoot(root)
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

const waitingItem = () => {
  addToInbox({ text: 'Fix the footer link\n\nIt points at the old docs.' })
  const item = readSignals().signals[0]!
  const req: AgentRequest = {
    action: 'implement',
    description: item.title,
    triage: { sourceId: item.sourceId, file: item.relPath },
  }
  return { item, req }
}

describe('Start now on a triage item', () => {
  it('asks the run to write the card, file the item on it, then build', () => {
    const { item, req } = waitingItem()
    const prompt = buildPrompt(req)
    assert.match(prompt, new RegExp(`Build the triage item at \`${item.relPath}\``))
    assert.match(prompt, new RegExp(`## Source\` naming its source id \`${item.sourceId}\``))
    assert.match(prompt, new RegExp(`triage archive ${item.sourceId} --card <id>\`, then build it`))
  })

  it('bounds the delivery by the item, and records the item on the run', () => {
    const { item, req } = waitingItem()
    const opened = openRun(req, 'build it')
    assert.ok(!('error' in opened))
    assert.equal(opened.run.cardId, null)
    assert.deepEqual(opened.run.triage, { sourceId: item.sourceId, file: item.relPath })
    const delivery = findDelivery(opened.run.deliveryId as string)
    assert.equal(delivery?.title, 'Fix the footer link')
    assert.equal(delivery?.approved, 'Fix the footer link\n\nIt points at the old docs.')
  })

  it('holds the item off a sort only while the run is live', () => {
    const { item, req } = waitingItem()
    const opened = openRun(req, 'build it')
    assert.ok(!('error' in opened))
    assert.deepEqual([...itemsBeingCarded()], [item.sourceId])
    patch(opened.run.sessionId, (run) => {
      run.status = 'error'
    })
    assert.deepEqual([...itemsBeingCarded()], [])
  })
})
