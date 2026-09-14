// The switch under the box, and what ending a shared conversation does (#679, #659).
//
// The promise the whole file checks is that the switch costs nothing until the end: it is off
// on every new conversation, nothing is collected while it is on, and turning it off — or
// clearing the conversation — takes the end's submission away again.
//
// And that the end is every end (#659). All three of them submit, none of the other ways out
// of a conversation does, and a discussion that shares under no card does not end at all.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import {
  carriedForward,
  chatPlan,
  clearChat,
  noteChatMessage,
  readChat,
  setChatArchived,
  setChatCard,
  setChatPlan,
  setChatShare,
} from '../src/lib/agent/chat.ts'
import { startedPlanning } from '../src/lib/agent/discuss.ts'
import { archiveDiscussion } from '../src/lib/agent/discussions.ts'
import { endBlocked, END_BLOCK_SAID, endShared, openEndCase, replyOver } from '../src/lib/agent/share.ts'
import { closeCase, readCase } from '../src/lib/case/state.ts'
import { CHATS_DIR, PLANS, setBoardRoot } from '../src/lib/paths.ts'
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

/** The board's own turn, as `sendChatMessage` leaves one (#685): only the reply reaches the
 *  transcript, and it is marked the board's. */
function boardReplied(target: ChatTarget, text: string): void {
  const file = path.join(CHATS_DIR, `${typeof target === 'number' ? `card-${target}` : target}.json`)
  const chat = JSON.parse(fs.readFileSync(file, 'utf8'))
  chat.messages.push({ role: 'agent', text, at: Date.now(), fromBoard: true })
  fs.writeFileSync(file, JSON.stringify(chat))
}

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

// ---- the three ends, and the one that is held (#659) ------------------------
//
// A discussion ends three ways: Start planning, Build now, and the rail's End discussion. All
// three submit, and none of them happens at all while the switch is on with no card to file
// the submission under.

const PLAN = 'plans/1-an-idea.md'

/** A plan this discussion is writing, which is what the two handoff answers act on. */
function planning(target: ChatTarget): void {
  fs.mkdirSync(PLANS, { recursive: true })
  fs.writeFileSync(path.join(PLANS, '1-an-idea.md'), '# an idea\n')
  assert.deepEqual(setChatPlan(target, PLAN), { ok: true })
}

/** One discussion, mid-subject, with a plan under it. */
function discussing(target: ChatTarget, ...lines: string[]): void {
  said(target, ...lines)
  planning(target)
}

const D = 'discussion-d1'

describe('a discussion that shares but linked no card', () => {
  it('cannot be ended from the rail, and says which of the two ways out to take', () => {
    discussing(D, 'the spec missed archived search')
    setChatShare(D, true)
    assert.deepEqual(archiveDiscussion(D), {
      error: END_BLOCK_SAID['share-needs-card'],
      reason: 'share-needs-card',
    })
    assert.notEqual(readChat(D)!.archived, true)
    assert.equal(readCase(D), null)
  })

  it('cannot be handed to a run either — no handoff is written, and the row stays', () => {
    discussing(D, 'the spec missed archived search')
    setChatShare(D, true)
    assert.deepEqual(startedPlanning('s1', 'build', D), {
      error: END_BLOCK_SAID['share-needs-card'],
      reason: 'share-needs-card',
    })
    assert.equal(chatPlan(readChat(D))!.run, undefined)
    assert.notEqual(readChat(D)!.archived, true)
    assert.equal(readCase(D), null)
  })

  it('ends once a card is picked, and files the whole conversation under it', () => {
    discussing(D, 'the spec missed archived search')
    replied(D, 'which change do you mean?')
    setChatShare(D, true)
    setChatCard(D, 603)
    assert.deepEqual(archiveDiscussion(D), { ok: true, plans: [PLAN] })
    const filed = openEndCase(D)!
    assert.equal(filed.cardId, 603)
    assert.match(filed.text, /Agent: which change do you mean\?/)
  })

  it('ends once sharing goes off, and files nothing at all', () => {
    discussing(D, 'the spec missed archived search')
    setChatShare(D, true)
    setChatShare(D, false)
    assert.deepEqual(archiveDiscussion(D), { ok: true, plans: [PLAN] })
    assert.equal(readChat(D)!.archived, true)
    assert.equal(openEndCase(D), null)
    assert.equal(readCase(D), null)
  })

  it('is the only conversation held: a card’s own chat is about that card', () => {
    said(7, 'the spec missed archived search')
    setChatShare(7, true)
    assert.equal(endBlocked(7), null)
    assert.deepEqual(archiveDiscussion(7), { ok: true, plans: [] })
  })

  it('is not held while it shares nothing', () => {
    discussing(D, 'the spec missed archived search')
    assert.equal(endBlocked(D), null)
    assert.deepEqual(archiveDiscussion(D), { ok: true, plans: [PLAN] })
  })
})

describe('turning the switch off', () => {
  it('takes the card with it, so turning it on again picks from nothing', () => {
    said(D, 'the spec missed archived search')
    setChatShare(D, true)
    setChatCard(D, 603)
    setChatShare(D, false)
    assert.equal(readChat(D)!.linkedCard, undefined)
    setChatShare(D, true)
    assert.equal(endBlocked(D), 'share-needs-card')
  })
})

describe('a handoff is an end', () => {
  it('files the conversation the same way the rail’s End discussion does', async () => {
    discussing(D, 'the spec missed archived search')
    replied(D, 'which change do you mean?')
    setChatShare(D, true)
    setChatCard(D, 603)
    assert.deepEqual(startedPlanning('s1', 'plan', D), { ok: true })
    // The submission is started by the handoff and never waited on, so the test is what
    // waits for it.
    await pause()
    const chat = readChat(D)!
    assert.equal(chat.archived, true)
    assert.equal(chat.archivedBy, 'board')
    assert.equal(chatPlan(chat)!.run, 's1')
    const filed = readCase(D)!
    assert.equal(filed.cardId, 603)
    assert.match(filed.text, /the spec missed archived search/)
  })

  it('files nothing when the switch is off, however the plan was handed over', async () => {
    discussing(D, 'the spec missed archived search')
    assert.deepEqual(startedPlanning('s1', 'build', D), { ok: true })
    await pause()
    assert.equal(readChat(D)!.archived, true)
    assert.equal(readCase(D), null)
  })

  it('sends what the conversation says now when a submission that never went is ended again', async () => {
    discussing(D, 'the spec missed archived search')
    setChatShare(D, true)
    setChatCard(D, 603)
    assert.deepEqual(startedPlanning('s1', 'plan', D), { ok: true })
    await pause()
    assert.match(readCase(D)!.text, /archived search/)
    // The run wrote no card, so `settleHandoff` puts the row back and the subject goes on.
    setChatArchived(D, false)
    said(D, 'and the second pass missed it too')
    // The first end spent the switch (#685), so sharing again is the user's own answer.
    setChatShare(D, true)
    setChatCard(D, 603)
    // The plan stays — it was handed to a run, and the cards that run wrote name its path.
    assert.deepEqual(archiveDiscussion(D), { ok: true, plans: [] })
    const again = openEndCase(D)!
    // Nothing ever went, so it is one record under one id — carrying the conversation as it
    // now is, not the words the first end went with.
    assert.equal(again.id, readCase(D)!.id)
    assert.match(again.text, /the second pass missed it too/)
  })
})

// ---- ending the same conversation twice (#685) ------------------------------
//
// A card's conversation outlives its ends: it is still on the card page, and the next message
// said into it brings the row back. So the second end is an end like the first — its own
// submission, under its own number, carrying the conversation as it now reads.

describe('ending the same conversation a second time', () => {
  it('opens a submission of its own, with a number of its own', () => {
    said(7, 'the spec missed archived search')
    setChatShare(7, true)
    const first = openEndCase(7)!
    closeCase('card-7', { status: 'sent' })
    // The user shares again and ends again.
    setChatShare(7, true)
    said(7, 'and it missed the archived filter too')
    const second = openEndCase(7)!
    assert.notEqual(second.id, first.id)
    assert.equal(second.status, 'collecting')
    assert.match(second.text, /the archived filter too/)
  })

  it('carries the whole conversation, not only what was said since the first end', () => {
    said(7, 'the spec missed archived search')
    setChatShare(7, true)
    openEndCase(7)
    closeCase('card-7', { status: 'sent' })
    said(7, 'and it missed the archived filter too')
    setChatShare(7, true)
    const second = openEndCase(7)!
    assert.match(second.text, /the spec missed archived search/)
    assert.match(second.text, /the archived filter too/)
  })

  it('leaves the board’s own turn out of what is shared', () => {
    said(7, 'the spec missed archived search')
    setChatShare(7, true)
    openEndCase(7)
    closeCase('card-7', { status: 'sent' })
    // What the first end's submitting turn left behind: the board asked, and only the reply
    // is written into the transcript.
    boardReplied(7, 'I have submitted this conversation as fb_abcd1234.')
    said(7, 'and it missed the archived filter too')
    setChatShare(7, true)
    const second = openEndCase(7)!
    assert.ok(!second.text.includes('I have submitted this conversation'))
    assert.match(second.text, /the archived filter too/)
  })

  it('goes on under the same number while the last attempt has not landed', () => {
    said(7, 'the spec missed archived search')
    setChatShare(7, true)
    const first = openEndCase(7)!
    // Refused by the platform, or never reached it. It may in truth have landed, so the next
    // attempt keeps the number the service keys the object by.
    closeCase('card-7', { status: 'failed', reason: 'refused' })
    setChatShare(7, true)
    assert.equal(openEndCase(7)!.id, first.id)
  })
})

describe('the switch after an end', () => {
  it('goes off, and leaves the submission that end just filed standing', async () => {
    said(7, 'the spec missed archived search')
    setChatShare(7, true)
    assert.deepEqual(archiveDiscussion(7), { ok: true, plans: [] })
    await endShared(7)
    assert.equal(readChat(7)!.shareOnEnd, false)
    // Turning it off BY HAND withdraws the submission. This is the switch having done what it
    // promised, so the material this end shared is still there to send.
    assert.ok(readCase('card-7'))
    assert.match(readCase('card-7')!.text, /archived search/)
  })

  it('stays off when the conversation is spoken into again', async () => {
    said(7, 'the spec missed archived search')
    setChatShare(7, true)
    assert.deepEqual(archiveDiscussion(7), { ok: true, plans: [] })
    await endShared(7)
    said(7, 'one more thing')
    assert.equal(readChat(7)!.shareOnEnd, false)
    // And a second end shares nothing, because nobody asked it to.
    assert.deepEqual(archiveDiscussion(7), { ok: true, plans: [] })
    assert.equal(openEndCase(7), null)
  })

  it('queues nothing for an end that arrives while the first is waiting on a reply', async () => {
    said(7, 'the spec missed archived search')
    setChatShare(7, true)
    answering(7)
    const first = endShared(7)
    await pause()
    // The switch is already spent, so this second end finds nothing to share and returns at
    // once — rather than joining the wait and submitting the same conversation twice.
    assert.equal(readChat(7)!.shareOnEnd, false)
    await endShared(7)
    fs.rmSync(path.join(CHATS_DIR, 'card-7.answering'), { recursive: true, force: true })
    await first
    assert.equal(readCase('card-7')!.cardId, 7)
  })

  it('is not turned off by an ordinary end that shares nothing', async () => {
    said(7, 'the spec missed archived search')
    assert.deepEqual(archiveDiscussion(7), { ok: true, plans: [] })
    await endShared(7)
    assert.equal(readChat(7)!.shareOnEnd, false)
    assert.equal(readCase('card-7'), null)
  })
})

describe('what is not an end', () => {
  it('files nothing for a reply landing, or for a screen that was simply shut', () => {
    discussing(D, 'the spec missed archived search')
    setChatShare(D, true)
    setChatCard(D, 603)
    // A turn finishing, and more said after it: the switch says ending submits, and none of
    // this is an end — nothing on this board reads it as one.
    replied(D, 'which change do you mean?')
    said(D, 'the one that added the search')
    assert.equal(readCase(D), null)
    assert.notEqual(readChat(D)!.archived, true)
  })
})
