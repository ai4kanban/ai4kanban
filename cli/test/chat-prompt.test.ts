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
  it('is the user words alone — the session already holds the subject', () => {
    assert.equal(chatPrompt(340, 'and the other one?', { resuming: true }), 'and the other one?')
    assert.equal(chatPrompt(null, 'and the other one?', { resuming: true }), 'and the other one?')
  })
})
