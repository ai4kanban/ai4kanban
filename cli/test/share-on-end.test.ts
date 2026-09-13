// The switch under the box, and what ending a shared conversation does (#679).
//
// The promise the whole file checks is that the switch costs nothing until the end: it is off
// on every new conversation, nothing is collected while it is on, and turning it off — or
// clearing the conversation — takes the end's submission away again.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import {
  carriedForward,
  clearChat,
  noteChatMessage,
  readChat,
  setChatCard,
  setChatShare,
} from '../src/lib/agent/chat.ts'
import { archiveDiscussion } from '../src/lib/agent/discussions.ts'
import { openEndCase, replyOver } from '../src/lib/agent/share.ts'
import { readCase } from '../src/lib/case/state.ts'
import { CHATS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, restoreMachineHome } from './helpers/board.ts'
import type { ChatTarget } from '../src/lib/agent/types.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-share-'))
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-share-home-'))

beforeEach(() => {
  process.env.AI4KANBAN_HOME = home
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(path.join(root, 'docs', 'kanban'), { recursive: true })
  setBoardRoot(root)
  takingPart(true)
})

after(() => {
  for (const dir of [root, home]) fs.rmSync(dir, { recursive: true, force: true })
  restoreMachineHome()
})

/** This machine's answer about partner feedback — the consent the switch is read against. */
function takingPart(on: boolean): void {
  fs.mkdirSync(home, { recursive: true })
  fs.writeFileSync(path.join(home, 'settings.json'), JSON.stringify({ partnerFeedback: on }))
}

/** A conversation with something said in it, which is what gives it a file to hold a switch. */
function said(target: ChatTarget, ...lines: string[]): void {
  for (const line of lines) noteChatMessage(target, line)
}

/** A reply being written on this conversation, as `sendChatMessage` marks one. */
function answering(cardId: number): void {
  const dir = path.join(CHATS_DIR, `card-${cardId}.answering`)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'owner'), `${process.pid}\n`)
}

/** Long enough for the wait above to have looked at least once. */
const pause = (): Promise<void> => new Promise((done) => setTimeout(done, 50))

/** The agent's side of it, written straight onto the transcript. */
function replied(target: ChatTarget, text: string): void {
  const file = path.join(CHATS_DIR, `${typeof target === 'number' ? `card-${target}` : target}.json`)
  const chat = JSON.parse(fs.readFileSync(file, 'utf8'))
  chat.messages.push({ role: 'agent', text, at: Date.now() })
  fs.writeFileSync(file, JSON.stringify(chat))
}

describe('the switch', () => {
  it('is off on every new conversation, whatever this machine has already agreed to', () => {
    said(7, 'the spec missed archived search')
    assert.equal(readChat(7)!.shareOnEnd, false)
    assert.equal(openEndCase(7), null)
  })

  it('collects nothing while it is on — the end is what files a submission', () => {
    said(7, 'the spec missed archived search')
    setChatShare(7, true)
    assert.equal(readChat(7)!.shareOnEnd, true)
    assert.equal(readCase('card-7'), null)
  })

  it('drops the end’s submission when it goes off again', () => {
    said(7, 'the spec missed archived search')
    setChatShare(7, true)
    openEndCase(7)
    assert.ok(readCase('card-7'))
    setChatShare(7, false)
    assert.equal(readCase('card-7'), null)
  })

  it('goes with the transcript when the conversation is cleared by hand', () => {
    said(7, 'the spec missed archived search')
    setChatShare(7, true)
    openEndCase(7)
    clearChat(7)
    assert.equal(readCase('card-7'), null)
    assert.equal(readChat(7), null)
  })
})

describe('what ending a shared conversation files', () => {
  it('is about the card a card’s own conversation is on, with no card to pick', () => {
    said(7, 'the spec missed archived search')
    replied(7, 'which change do you mean?')
    said(7, 'the one that added the search')
    setChatShare(7, true)
    const opened = openEndCase(7)!
    assert.equal(opened.cardId, 7)
    // The whole conversation, both sides, in the order it was said.
    assert.match(opened.text, /User: the spec missed archived search/)
    assert.match(opened.text, /Agent: which change do you mean\?/)
    assert.match(opened.text, /User: the one that added the search/)
  })

  it('is about the card a discussion linked', () => {
    said('discussion-d1', 'this one went wide')
    setChatCard('discussion-d1', 603)
    setChatShare('discussion-d1', true)
    assert.equal(openEndCase('discussion-d1')!.cardId, 603)
  })

  it('files nothing for a discussion that linked no card', () => {
    said('discussion-d1', 'this one went wide')
    setChatShare('discussion-d1', true)
    assert.equal(openEndCase('discussion-d1'), null)
    assert.equal(readCase('discussion-d1'), null)
  })

  it('is filed by the end itself, which has already happened by then', () => {
    said(7, 'the spec missed archived search')
    setChatShare(7, true)
    // What the rail's End discussion does, in the order the board does it. The submitting
    // turn is started after this and never waited on, so it can undo none of it.
    assert.deepEqual(archiveDiscussion(7), { ok: true, plans: [] })
    const filed = openEndCase(7)!
    assert.equal(filed.cardId, 7)
    assert.match(filed.text, /the spec missed archived search/)
    assert.equal(readChat(7)!.archived, true)
  })

  it('files nothing on a machine that does not take part', () => {
    said(7, 'the spec missed archived search')
    setChatShare(7, true)
    takingPart(false)
    forgetMachineState(root)
    assert.equal(openEndCase(7), null)
  })

  it('waits out a reply that was still being written when the end came', async () => {
    said(7, 'the spec missed archived search')
    setChatShare(7, true)
    answering(7)
    // The end holds there rather than filing a conversation short of its last answer.
    let over: boolean | null = null
    const waiting = replyOver(7).then((done) => (over = done))
    await pause()
    assert.equal(over, null)
    replied(7, 'the search only read the archive')
    fs.rmSync(path.join(CHATS_DIR, 'card-7.answering'), { recursive: true, force: true })
    await waiting
    assert.equal(over, true)
    assert.match(openEndCase(7)!.text, /the search only read the archive/)
  })
})

describe('what a reply lands on when the screen moved while it was written', () => {
  it('keeps the end, the switch and the link the user left, not the ones it was sent with', () => {
    said(7, 'the spec missed archived search')
    // What the turn holds from the moment the message was sent…
    const sent = readChat(7)!
    // …against what the screen did while the reply was being written.
    assert.deepEqual(archiveDiscussion(7), { ok: true, plans: [] })
    setChatShare(7, true)
    setChatCard(7, 603)
    const written = carriedForward(sent, readChat(7))
    assert.equal(written.archived, true)
    assert.equal(written.shareOnEnd, true)
    assert.equal(written.linkedCard, 603)
  })

  it('turns the switch back off where that is the newer answer', () => {
    said(7, 'the spec missed archived search')
    setChatShare(7, true)
    const sent = readChat(7)!
    setChatShare(7, false)
    assert.equal(carriedForward(sent, readChat(7)).shareOnEnd, false)
  })
})
