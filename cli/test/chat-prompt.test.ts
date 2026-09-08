// What a chat's first message says (#242).
//
// The board keeps one conversation per card, but the agent only knows which card it is in if
// the message says so. Without it "what is this about?" reads as a question about the skill
// and gets answered as one — which is what this asks about.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { chatPrompt } from '../src/lib/agent/chat.ts'
import { setAgentRule } from '../src/lib/agent/rules.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

// A conversation carries the board's language on every turn (#337), so the machine is
// pinned here — the developer's own pick must not change what these prompts say.
let home = ''

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-chat-home-'))
  process.env.AI4KANBAN_HOME = home
})

afterEach(() => {
  delete process.env.AI4KANBAN_HOME
  fs.rmSync(home, { recursive: true, force: true })
})

describe("a card conversation's first message", () => {
  it('names the card the conversation is about, and the card comes before the words', () => {
    const prompt = chatPrompt(340, 'what this is about?', { title: 'Restore the rule on card questions' })
    assert.match(prompt, /#340/)
    assert.match(prompt, /Restore the rule on card questions/)
    assert.ok(prompt.indexOf('#340') < prompt.indexOf('what this is about?'))
    assert.match(prompt, /what this is about\?$/)
  })

  it('still names the card by number when the title is unknown', () => {
    const prompt = chatPrompt(340, 'hello', { title: '' })
    assert.match(prompt, /#340/)
  })
})

describe("the board conversation's first message", () => {
  it('says it is about the board, not about the skill', () => {
    const prompt = chatPrompt(null, 'what is this about?')
    assert.match(prompt, /chat about this project's board/)
    assert.doesNotMatch(prompt, /#\d/)
  })
})

describe('every message after the first', () => {
  it('keeps the user words last without repeating the subject', () => {
    assert.match(chatPrompt(340, 'and the other one?', { resuming: true }), /and the other one\?$/)
    assert.match(chatPrompt(null, 'and the other one?', { resuming: true }), /and the other one\?$/)
  })
})

// The discussion helper (#502) — the role every conversation is held by. What is asked here
// is that a conversation carries its brief and its rule, on the first turn and on every turn
// after it, whether the screen named a flow or a terminal named nothing.
describe('the discussion helper', () => {
  let root = ''

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-chat-role-'))
    fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo'), { recursive: true })
    setBoardRoot(root)
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('puts a discussion on its own brief, with no screen naming one', () => {
    for (const turn of [{}, { resuming: true }]) {
      assert.match(chatPrompt(null, 'an idea', turn), /akb guide discuss-idea/)
      assert.match(chatPrompt('discussion-7', 'an idea', turn), /akb guide discuss-idea/)
    }
    // A chat about a card is about that card, and the card says what it is.
    assert.doesNotMatch(chatPrompt(340, 'an idea', { title: 'a card' }), /akb guide/)
  })

  it("carries the agent's own rule, ahead of the words the user typed", () => {
    assert.equal(setAgentRule('discussion-helper', 'Always name the cheaper option.').ok, true)
    const prompt = chatPrompt(null, 'an idea')
    assert.match(prompt, /`discussion-helper` agent carries one rule of its own/)
    assert.ok(prompt.indexOf('Always name the cheaper option.') < prompt.indexOf('an idea'))
    // And on every turn after the first: a conversation outlives any one edit of it.
    assert.match(chatPrompt(null, 'and this?', { resuming: true }), /Always name the cheaper option\./)
  })

  it('says nothing about a rule the board never wrote', () => {
    assert.doesNotMatch(chatPrompt(null, 'an idea'), /carries one rule of its own/)
  })
})
