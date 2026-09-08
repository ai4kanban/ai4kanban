// The discussions a board holds at once (#496).
//
// The promise is that a board is no longer one conversation: every subject has its own
// transcript and its own plans, the rail lists the twenty spoken to most recently, and the
// one conversation a board held before this becomes the first row rather than being lost.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import {
  chatPlan,
  clearChatPlan,
  noteChatMessage,
  readChat,
  setChatPlan,
  setChatPlanRun,
} from '../src/lib/agent/chat.ts'
import {
  archiveDiscussion,
  asDiscussion,
  KEEP,
  listDiscussions,
  startDiscussion,
  titleDiscussion,
} from '../src/lib/agent/discussions.ts'
import { CHATS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import type { DiscussionTarget } from '../src/lib/agent/types.ts'

let root = ''
let home = ''
let realHome: string | undefined

// A discussion is only on the list once something has been said in it, so this is what puts
// one there.
const spoke = (target: DiscussionTarget, words: string, at?: number): void => {
  noteChatMessage(target, words)
  if (at === undefined) return
  const file = path.join(CHATS_DIR, `${target}.json`)
  const chat = JSON.parse(fs.readFileSync(file, 'utf8'))
  fs.writeFileSync(file, JSON.stringify({ ...chat, updatedAt: at }))
}

// A plan file this board really has, so `setChatPlan` takes it.
const plan = (name: string): string => {
  const plans = path.join(root, 'docs', 'kanban', 'plans')
  fs.mkdirSync(plans, { recursive: true })
  fs.writeFileSync(path.join(plans, name), '# a plan\n')
  return `plans/${name}`
}

const planIsThere = (rel: string): boolean =>
  fs.existsSync(path.join(root, 'docs', 'kanban', rel))

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-discussions-'))
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-discussions-home-'))
  realHome = process.env.HOME
  process.env.HOME = home
  fs.mkdirSync(path.join(root, 'docs', 'kanban'), { recursive: true })
  setBoardRoot(root)
})

afterEach(() => {
  if (realHome === undefined) delete process.env.HOME
  else process.env.HOME = realHome
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(home, { recursive: true, force: true })
})

describe('a board holding several discussions', () => {
  it('keeps each one to itself', () => {
    const first = startDiscussion()
    const second = startDiscussion()
    spoke(first, 'the rail')
    spoke(second, 'the landing queue')

    assert.equal(readChat(first)?.messages[0]?.text, 'the rail')
    assert.equal(readChat(second)?.messages[0]?.text, 'the landing queue')
    assert.equal(
      listDiscussions().length,
      2,
      'both are on the list, and neither has read the other',
    )
  })

  it('leaves a discussion nobody has spoken in off the list', () => {
    startDiscussion()
    assert.deepEqual(listDiscussions(), [])
  })

  it('names a row by the first line typed, then by the plan the agent named', () => {
    const target = startDiscussion()
    spoke(target, 'the rail is too long\nand the second line is not the name')
    assert.equal(listDiscussions()[0]?.name, 'the rail is too long')

    setChatPlan(target, plan('9-rail.md'), 'Shorten the rail')
    assert.equal(listDiscussions()[0]?.name, 'Shorten the rail')
  })

  it('holds the plans it wrote in order, with the last one live', () => {
    const target = startDiscussion()
    spoke(target, 'two subjects, one after the other')
    const first = plan('9-first.md')
    const second = plan('10-second.md')

    setChatPlan(target, first, 'The first')
    assert.equal(chatPlan(readChat(target))?.path, first)

    // Its cards are written: it stays on the list, and the live slot is empty until the next
    // plan is named.
    clearChatPlan(target)
    assert.equal(chatPlan(readChat(target)), undefined)
    assert.deepEqual(readChat(target)?.plans?.map((p) => p.path), [first])

    setChatPlan(target, second, 'The second')
    assert.deepEqual(readChat(target)?.plans?.map((p) => p.path), [first, second])
    assert.equal(chatPlan(readChat(target))?.path, second)
  })

  it('sorts the list by what was spoken to most recently', () => {
    const older = startDiscussion()
    const newer = startDiscussion()
    spoke(older, 'last week', 1000)
    spoke(newer, 'this morning', 2000)
    assert.deepEqual(listDiscussions().map((r) => r.target), [newer, older])
  })
})

describe('the list holding itself to length', () => {
  it('archives everything past the twenty most recent, oldest first', () => {
    const targets: DiscussionTarget[] = []
    for (let i = 0; i < KEEP + 3; i++) {
      const target = startDiscussion()
      spoke(target, `subject ${i}`, 1000 + i)
      targets.push(target)
    }
    const rows = listDiscussions()
    assert.equal(rows.length, KEEP)
    // The three oldest went, and their transcripts are still on this machine.
    for (const gone of targets.slice(0, 3)) {
      assert.ok(!rows.some((r) => r.target === gone))
      assert.equal(readChat(gone)?.archived, true)
      assert.equal(readChat(gone)?.messages.length, 1)
    }
  })
})

describe('archiving one by hand', () => {
  it('takes the row away and keeps the transcript', () => {
    const target = startDiscussion()
    spoke(target, 'done with this one')
    assert.deepEqual(archiveDiscussion(target), { ok: true, plans: [] })
    assert.deepEqual(listDiscussions(), [])
    assert.equal(readChat(target)?.messages[0]?.text, 'done with this one')
  })

  it('drops the plans nothing came of', () => {
    const target = startDiscussion()
    spoke(target, 'an idea that went nowhere')
    const first = plan('9-first.md')
    const second = plan('10-second.md')
    setChatPlan(target, first, 'The first')
    setChatPlan(target, second, 'The second')

    assert.deepEqual(archiveDiscussion(target), { ok: true, plans: [first, second] })
    assert.equal(planIsThere(first), false)
    assert.equal(planIsThere(second), false)
  })

  it('keeps a plan a run was started from — its cards name the file', () => {
    const target = startDiscussion()
    spoke(target, 'this one became cards')
    const built = plan('9-built.md')
    setChatPlan(target, built, 'Built')
    setChatPlanRun(target, 'session-1', 'build')

    assert.deepEqual(archiveDiscussion(target), { ok: true, plans: [] })
    assert.equal(planIsThere(built), true)
  })

  it('refuses a discussion this board never held', () => {
    assert.ok('error' in archiveDiscussion('discussion-nope' as DiscussionTarget))
  })
})

describe('naming one', () => {
  it('writes the name onto the conversation', () => {
    const target = startDiscussion()
    spoke(target, 'whatever was typed first')
    titleDiscussion(target, 'What it turned out to be about')
    assert.equal(listDiscussions()[0]?.name, 'What it turned out to be about')
  })
})

describe('what a target may name', () => {
  it('takes a discussion of this board’s, spelled either way', () => {
    const target = startDiscussion()
    assert.equal(asDiscussion(target), target)
    assert.equal(asDiscussion(target.slice('discussion-'.length)), target)
  })

  it('refuses anything else, so no address can escape the folder', () => {
    assert.equal(asDiscussion('board'), null)
    assert.equal(asDiscussion('discussion-../../etc/passwd'), null)
    assert.equal(asDiscussion(''), null)
  })
})

describe('a board upgrading into the list', () => {
  it('keeps the one conversation it was holding, as the first discussion', () => {
    fs.mkdirSync(CHATS_DIR, { recursive: true })
    fs.writeFileSync(
      path.join(CHATS_DIR, 'board.json'),
      JSON.stringify({
        cardId: null,
        harness: 'claude-code',
        resumeId: 'session-1',
        messages: [{ role: 'you', text: 'the subject it was holding', at: 1000 }],
        startedAt: 900,
        updatedAt: 1000,
      }),
    )

    const rows = listDiscussions()
    assert.equal(rows.length, 1)
    assert.equal(rows[0]!.name, 'the subject it was holding')
    // The session it was carried on by comes with it, and the board's own conversation is
    // now empty rather than being read twice.
    assert.equal(readChat(rows[0]!.target)?.resumeId, 'session-1')
    assert.equal(readChat(null), null)
    assert.deepEqual(listDiscussions().map((r) => r.target), [rows[0]!.target])
  })

  it('leaves the board conversation started afterwards where it is', () => {
    // The board's own chat rail is still a conversation of its own, and the rail reads the
    // list every few seconds — so an upgrade that ran twice would swallow it mid-sentence.
    assert.deepEqual(listDiscussions(), [])
    noteChatMessage(null, 'said in the board rail, after the upgrade')

    assert.deepEqual(listDiscussions(), [])
    assert.equal(readChat(null)?.messages[0]?.text, 'said in the board rail, after the upgrade')
  })
})
