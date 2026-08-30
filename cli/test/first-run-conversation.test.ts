// The board's first-run conversation (#280).
//
// The app's first run asks what the project is by talking instead of by handing over a form.
// Two things have to hold for that to work at all: the agent is told the shape it has to
// answer in, and the board can read that shape back out of the reply. Both are pinned here —
// a guide section renamed out from under the prompt, or a reply the board silently
// misreads, are exactly the failures that leave a new user staring at a broken first screen.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { chatPrompt } from '../src/lib/agent/chat.ts'
import { parseSetupProposal, setupOpening } from '../src/lib/agent/setup-chat.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-first-run-'))
const kanban = path.join(root, 'docs', 'kanban')
let home = ''

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(path.join(kanban, 'todo', 'features'), { recursive: true })
  fs.mkdirSync(path.join(kanban, 'todo', 'platform'), { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '1\n')
  setBoardRoot(root)
  // The board's language is carried on every turn, so the developer's own pick must not
  // change what these prompts say.
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-first-run-home-'))
  process.env.AI4KANBAN_HOME = home
})

after(() => {
  delete process.env.AI4KANBAN_HOME
  fs.rmSync(root, { recursive: true, force: true })
  if (home) fs.rmSync(home, { recursive: true, force: true })
})

describe('what the conversation opens with', () => {
  it('carries the instructions the agent has to answer by', () => {
    const prompt = chatPrompt('setup', setupOpening())
    // The guide's section, embedded — a rename that lost it would leave these out.
    assert.match(prompt, /"summary"/)
    assert.match(prompt, /"description"/)
    assert.match(prompt, /unsure/)
  })

  it('states the tracks the board already has rather than asking to guess them', () => {
    const opening = setupOpening()
    assert.match(opening, /features/)
    assert.match(opening, /platform/)
  })

  it('never asks for the goal — that has a screen of its own', () => {
    assert.match(chatPrompt('setup', setupOpening()), /Never ask for the goal/)
  })

  it('is not the board conversation, and not a card one', () => {
    const prompt = chatPrompt('setup', 'go')
    assert.doesNotMatch(prompt, /chat about this project's board/)
    assert.doesNotMatch(prompt, /This is a chat about task/)
  })
})

describe('every turn after the first', () => {
  it('reminds the agent of the shape, which a long session drifts away from', () => {
    const prompt = chatPrompt('setup', 'the name is wrong', { resuming: true })
    assert.match(prompt, /the name is wrong/)
    assert.match(prompt, /same JSON block/)
  })

  it('leaves every other conversation as it was', () => {
    assert.equal(chatPrompt(null, 'and the other one?', { resuming: true }), 'and the other one?')
    assert.equal(chatPrompt(12, 'and the other one?', { resuming: true }), 'and the other one?')
  })
})

const block = (body: unknown): string => '```json\n' + JSON.stringify(body) + '\n```'

const GOOD = {
  summary: 'Ledger — the bookkeeping service behind the billing API.',
  name: 'Ledger',
  description: 'the bookkeeping service behind the billing API',
  tracks: [{ name: 'features', note: 'new behavior a user can see.' }],
  unsure: false,
  ask: '',
}

describe('reading one reply', () => {
  it('takes the block out of a reply that says other things around it', () => {
    const read = parseSetupProposal(`Here is what I found.\n\n${block(GOOD)}\n\nTell me what is wrong.`)
    assert.equal(read?.name, 'Ledger')
    assert.equal(read?.tracks.length, 1)
    assert.equal(read?.tracks[0]?.name, 'features')
    assert.equal(read?.unsure, false)
  })

  it('takes the LAST block, so a quoted example never wins over the answer', () => {
    const first = block({ ...GOOD, name: 'Example', summary: 'The example from the guide.' })
    const read = parseSetupProposal(`${first}\n\nand my own answer:\n\n${block(GOOD)}`)
    assert.equal(read?.name, 'Ledger')
  })

  it('reads a repo with nothing to read as a question, not as a finding', () => {
    const read = parseSetupProposal(
      block({
        summary: 'I cannot tell what this is yet.',
        name: '',
        description: '',
        tracks: [],
        unsure: true,
        ask: 'What is this project, in a line?',
      }),
    )
    assert.equal(read?.unsure, true)
    assert.equal(read?.ask, 'What is this project, in a line?')
  })

  it('answers nothing for a reply with no block — the board never guesses a project out of prose', () => {
    assert.equal(parseSetupProposal('I think this is a bookkeeping service. Shall I go on?'), null)
    assert.equal(parseSetupProposal('```json\nnot json at all\n```'), null)
  })

  it('answers nothing for a block that is some other JSON', () => {
    assert.equal(parseSetupProposal(block({ ok: true })), null)
    // A name with no sentence to lead the view with is not an answer to this question.
    assert.equal(parseSetupProposal(block({ ...GOOD, summary: '' })), null)
  })

  it('carries the folder a renamed track replaces, so its cards move with it', () => {
    const read = parseSetupProposal(
      block({ ...GOOD, tracks: [{ name: 'features', note: 'x', was: 'feature' }, { name: 'docs', note: 'y' }] }),
    )
    assert.equal(read?.tracks[0]?.was, 'feature')
    assert.equal(read?.tracks[1]?.was, undefined)
  })

  it('drops a track with no name rather than writing a folder called nothing', () => {
    const read = parseSetupProposal(block({ ...GOOD, tracks: [{ name: '', note: 'x' }, { name: 'bugs', note: '' }] }))
    assert.deepEqual(
      read?.tracks.map((t) => t.name),
      ['bugs'],
    )
  })
})
