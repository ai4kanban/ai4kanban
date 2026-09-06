// The ready gate (#440): which card the board judges by itself, and what a verdict means.
//
// Nothing spawns here. The gate is two decisions — which card to judge, and what a finished
// judgment lets through — and both are answered from the board and the switch alone, so the
// tests are those two functions against a board written on disk.
//
// The one thing worth saying twice is the loop: a delivery that ends puts its card back at
// `ready`, so a gate that fired on "ready now, not ready before" would gate the card its own
// build had just handed back and build it forever. That is why the trigger is `todo` →
// `ready` and nothing else, and why it has a test of its own.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { buildAfterGate, cardStages, gateRunAfter } from '../src/lib/agent/gate.ts'
import { readyGateOn, setReadyGate } from '../src/lib/agent/settings.ts'
import { openRun } from '../src/lib/agent/sessions.ts'
import { setBoardRoot, UI_CONFIG } from '../src/lib/paths.ts'

let root = ''

const TODO = (): string => path.join(root, 'docs', 'kanban', 'todo')

const cardText = (
  title: string,
  { status = 'todo', priority = 'med', blockedBy = [] as number[], questions = [] as string[] } = {},
): string =>
  [
    '---',
    `title: ${title}`,
    `priority: ${priority}`,
    'roi: med',
    `status: ${status}`,
    'release: ""',
    `blocked_by: [${blockedBy.join(', ')}]`,
    'related: []',
    'modules: []',
    questions.length
      ? `questions:\n${questions.map((q) => `  - ${JSON.stringify(q)}`).join('\n')}`
      : 'questions: []',
    '---',
    '',
    'What this card is for.',
    '',
    '<!-- agent -->',
    '',
    '## Scope',
    '- **A requirement**: something observable.',
    '',
  ].join('\n')

const write = (rel: string, text: string): void => {
  const file = path.join(TODO(), rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}

const card = (id: number, opts: Parameters<typeof cardText>[1] = {}): void =>
  write(path.join('features', `${id}-card.md`), cardText(`card ${id}`, opts))

const setStatus = (id: number, status: string, rel = path.join('features', `${id}-card.md`)): void => {
  const file = path.join(TODO(), rel)
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/^status: .*$/m, `status: ${status}`))
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-ready-gate-'))
  fs.mkdirSync(path.join(TODO(), 'features'), { recursive: true })
  fs.writeFileSync(path.join(TODO(), 'README.md'), '# Open tasks\n')
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'next-id'), '99\n')
  setBoardRoot(root)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the switch', () => {
  it('is off until it is turned on, and only writes itself down when it is', () => {
    assert.equal(readyGateOn(), false)

    assert.equal(setReadyGate(true).ok, true)
    assert.equal(readyGateOn(), true)
    assert.match(fs.readFileSync(UI_CONFIG, 'utf8'), /"readyGate": true/)

    assert.equal(setReadyGate(false).ok, true)
    assert.equal(readyGateOn(), false)
    assert.doesNotMatch(fs.readFileSync(UI_CONFIG, 'utf8'), /readyGate/)
  })

  it('gates nothing while it is off', () => {
    card(1)
    const before = cardStages()
    setStatus(1, 'ready')
    assert.equal(gateRunAfter(before), null)
  })

  it('gates nothing on a board whose solution has no gate, switch on or not', () => {
    fs.writeFileSync(path.join(root, 'docs', 'kanban', 'config.md'), '- **Solution** — marketing\n')
    setReadyGate(true)
    card(1)
    const before = cardStages()
    setStatus(1, 'ready')
    assert.equal(gateRunAfter(before), null)
  })
})

describe('which card the gate takes', () => {
  beforeEach(() => setReadyGate(true))

  it('takes the card whose plan just settled', () => {
    card(1)
    const before = cardStages()
    setStatus(1, 'ready')
    assert.deepEqual(gateRunAfter(before), { action: 'gate', id: 1, title: 'card 1' })
  })

  it('takes a card the run wrote from scratch', () => {
    const before = cardStages()
    card(7, { status: 'ready' })
    assert.equal(gateRunAfter(before)?.id, 7)
  })

  it('leaves a card that was already resting at ready', () => {
    card(1, { status: 'ready' })
    assert.equal(gateRunAfter(cardStages()), null)
  })

  it('leaves a card its own delivery just handed back', () => {
    // The loop this exists to stop: a delivery that ends restores the stage it found, so
    // the card is at `ready` again with nothing about it settled.
    card(1, { status: 'implementing' })
    const before = cardStages()
    setStatus(1, 'ready')
    assert.equal(gateRunAfter(before), null)
  })

  it('takes one card per round, in dispatch order', () => {
    card(1)
    card(2, { priority: 'high' })
    const before = cardStages()
    setStatus(1, 'ready')
    setStatus(2, 'ready')
    assert.equal(gateRunAfter(before)?.id, 2)
  })

  it('leaves a card nothing could build unattended', () => {
    card(1, { blockedBy: [98] })
    card(98)
    card(2, { questions: ['[user] which way? '] })
    write(path.join('recurring', '3-job.md'), cardText('job 3'))
    write(path.join('4-group', 'root.md'), cardText('group 4'))
    const before = cardStages()
    for (const id of [1, 2]) setStatus(id, 'ready')
    setStatus(3, 'ready', path.join('recurring', '3-job.md'))
    setStatus(4, 'ready', path.join('4-group', 'root.md'))
    assert.equal(gateRunAfter(before), null)
  })

  it('leaves a card a run is already holding', () => {
    card(1)
    const before = cardStages()
    setStatus(1, 'ready')
    const held = openRun({ action: 'edit', id: 1, title: 'card 1' }, 'prompt', [])
    assert.ok(!('error' in held))
    assert.equal(gateRunAfter(before), null)
  })
})

describe('what a finished gate means', () => {
  beforeEach(() => setReadyGate(true))

  it('builds the card it left alone', () => {
    card(1, { status: 'ready' })
    assert.deepEqual(buildAfterGate({ action: 'gate', cardId: 1 }), {
      action: 'implement',
      id: 1,
      title: 'card 1',
    })
  })

  it('builds nothing once its question has taken the card back to todo', () => {
    card(1, { status: 'todo', questions: ['[user] which way? '] })
    assert.equal(buildAfterGate({ action: 'gate', cardId: 1 }), null)
  })

  it('builds nothing after the switch went off mid-run', () => {
    card(1, { status: 'ready' })
    setReadyGate(false)
    assert.equal(buildAfterGate({ action: 'gate', cardId: 1 }), null)
  })

  it('builds nothing off a run that was not a gate', () => {
    card(1, { status: 'ready' })
    assert.equal(buildAfterGate({ action: 'writing', cardId: 1 }), null)
  })
})
