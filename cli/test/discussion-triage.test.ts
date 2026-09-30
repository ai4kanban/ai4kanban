// A discussion started from a triage item files that item under the first card it writes (#1252).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { readChat, sendChatMessage } from '../src/lib/agent/chat.ts'
import { settlePlans } from '../src/lib/agent/discuss.ts'
import { DISCUSSION_ENV, RUN_ENV } from '../src/lib/agent/env.ts'
import { probes } from '../src/lib/agent/origin.ts'
import { CHATS_DIR, KANBAN, setBoardRoot } from '../src/lib/paths.ts'
import { checkSource } from '../src/lib/signals/check.ts'
import { dismissInboxItem } from '../src/lib/signals/inbox.ts'
import { move, uiConfigOf } from './helpers/board.ts'

const DISCUSSION = 'discussion-00000000-0000-0000-0000-000000001252'
const ITEM = 'item-1252'

let root = ''
let home = ''
let realHome: string | undefined
const realEnv: Record<string, string | undefined> = {}
const realProbes = { ...probes }

function board(): void {
  const agent = path.join(root, 'agent.mjs')
  fs.writeFileSync(agent, '')
  const kanban = path.join(root, 'docs', 'kanban')
  fs.mkdirSync(path.join(kanban, 'todo'), { recursive: true })
  fs.mkdirSync(path.join(kanban, 'triage'), { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '7\n')
  fs.writeFileSync(
    uiConfigOf(kanban),
    JSON.stringify({ runtimes: [{ id: 'global', name: 'Global default', harness: 'claude-code', settings: { command: `node ${agent}` } }] }),
  )
  setBoardRoot(root)
  fs.writeFileSync(
    path.join(KANBAN, 'triage', 'item.md'),
    `---\nsource_id: ${ITEM}\ntitle: An item\ncollected_at: 2026-09-28 10:00\nimported_at: 2026-09-28 10:01\n---\n\nWords.\n`,
  )
}

function discussion(extra: Record<string, unknown> = {}, target = DISCUSSION): void {
  fs.mkdirSync(CHATS_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(CHATS_DIR, `${target}.json`),
    JSON.stringify({
      cardId: target,
      harness: 'claude-code',
      resumeId: 'session',
      messages: [{ role: 'you', text: 'discuss triage', at: 1 }],
      startedAt: 1,
      updatedAt: 1,
      triage: ITEM,
      ...extra,
    }),
  )
}

// The card id the item was filed under, wherever it went.
function cardOf(): string | undefined {
  const at = checkSource(ITEM).relPath
  return at ? /card_id: (\d+)/.exec(fs.readFileSync(path.join(root, at), 'utf8'))?.[1] : undefined
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-discussion-triage-'))
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-discussion-triage-home-'))
  realHome = process.env.HOME
  process.env.HOME = home
  for (const name of [RUN_ENV, DISCUSSION_ENV, 'CLAUDE_CODE_SESSION_ID']) {
    realEnv[name] = process.env[name]
    delete process.env[name]
  }
  probes.chain = () => ['-zsh']
  probes.opencode = () => undefined
  board()
})

afterEach(() => {
  if (realHome === undefined) delete process.env.HOME
  else process.env.HOME = realHome
  for (const [name, value] of Object.entries(realEnv)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  Object.assign(probes, realProbes)
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(home, { recursive: true, force: true })
})

describe('a discussion started from a triage item', () => {
  it('keeps the item from the first message only', async () => {
    await sendChatMessage(DISCUSSION, 'discuss triage', { triage: ITEM })
    assert.equal(readChat(DISCUSSION)?.triage, ITEM)
    const other = 'discussion-00000000-0000-0000-0000-000000000002'
    discussion({ triage: undefined }, other)
    await sendChatMessage(other, 'more', { triage: ITEM })
    assert.equal(readChat(other)?.triage, undefined)
  })

  it('archives the item once a plan handoff writes a card', () => {
    discussion({ plans: [{ path: 'plans/1-x.md', run: 'run-1' }] })
    settlePlans(DISCUSSION, () => ({ live: false, cards: [7, 8] }))
    assert.equal(checkSource(ITEM).status, 'archived')
    assert.equal(cardOf(), '7')
    assert.equal(readChat(DISCUSSION)?.triage, undefined)
  })

  it('archives the item when a card is created in the discussion, and only once', async () => {
    discussion()
    process.env[DISCUSSION_ENV] = DISCUSSION
    await move(root, ['create', '--title', 'First'])
    assert.equal(checkSource(ITEM).status, 'archived')
    assert.equal(cardOf(), '7')
    await move(root, ['create', '--title', 'Second'])
    assert.equal(cardOf(), '7')
  })

  it('leaves an ignored item ignored, with the card noted', async () => {
    discussion()
    dismissInboxItem(ITEM, 'user', 'not now')
    process.env[DISCUSSION_ENV] = DISCUSSION
    await move(root, ['create', '--title', 'First'])
    assert.equal(checkSource(ITEM).status, 'dismissed')
    assert.equal(cardOf(), '7')
  })

  it('lets the card through when the item is gone', async () => {
    discussion({ triage: 'gone' })
    process.env[DISCUSSION_ENV] = DISCUSSION
    await move(root, ['create', '--title', 'First'])
    assert.equal(readChat(DISCUSSION)?.triage, undefined)
    assert.equal(checkSource(ITEM).status, 'pending')
  })

  it('leaves the item alone for a discussion that did not start from one', async () => {
    discussion({ triage: undefined })
    process.env[DISCUSSION_ENV] = DISCUSSION
    await move(root, ['create', '--title', 'First'])
    assert.equal(checkSource(ITEM).status, 'pending')
  })
})
