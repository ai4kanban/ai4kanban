// Which tasks a board raises a Cloud event about, and what that event carries (#319).
//
// What is asked here is the judgment, not the network: the two event rules and the
// watched-release filter, the question winning when a task is both, the board's internal
// tags being stripped before anything leaves, and a card revised under a live event
// fingerprinting differently so it is refreshed rather than raised again.
//
// And the machine's own list of enabled boards: a Cloud id that means nothing outside
// Cloud, a local path held here and nowhere else, and a board kept across being turned off
// and on again so its events are never orphaned.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import {
  ALL_RELEASES,
  cloudBoardById,
  cloudBoardFor,
  disableCloudBoard,
  enableCloudBoard,
  namesBoards,
  readCloudBoards,
  setCloudBoardRelease,
} from '../src/lib/cloud/boards.ts'
import { CLOUD_EVENT_STATES, eventLabel, isFinalEventState } from '../src/lib/cloud/events.ts'
import { readOutbox } from '../src/lib/cloud/outbox.ts'
import { recordCloudActionFor, recordCloudDeliveryState } from '../src/lib/cloud/publish.ts'
import { readCloudCardLink } from '../src/lib/cloud/center.ts'
import { actionableKind, snapshotFor, userQuestions } from '../src/lib/cloud/snapshot.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import type { Card, Question } from '../src/lib/view/types.ts'

let home = ''

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-cloud-events-'))
  process.env.AI4KANBAN_HOME = home
})

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true })
  delete process.env.AI4KANBAN_HOME
})

const BOARD = { id: 'b-1', path: '/tmp/project', name: 'ai4kanban', release: '0.8.0' }

function card(over: Partial<Card> = {}): Card {
  return {
    id: 12,
    revision: 'r1',
    relPath: 'features/12-a.md',
    title: 'A task',
    track: 'features',
    priority: 'high',
    roi: 'high',
    status: 'todo',
    release: '0.8.0',
    blocked_by: [],
    related: [],
    questions: [],
    verify: [],
    modules: [],
    last_run: '',
    cadence: '',
    schedule: null,
    body: BODY,
    todos: { total: 0, done: 0 },
    isGroup: false,
    recurring: false,
    nextRun: '',
    openBlockers: [],
    ...over,
  } as Card
}

/** A card body shaped like a real one: the opening paragraph and the review notes a
 *  reviewer needs, and below the marker the plan, which never leaves this machine. */
const BODY = [
  'A task waiting on a decision arrives carrying enough of the card to review.',
  '',
  '## Worth noting',
  '- **A button decides**: it does not open the app.',
  '',
  '<!-- agent -->',
  '',
  '## Scope',
  '- the whole plan, which never leaves this machine',
  '',
  '## Worth noting after implementation',
  '- **What changed**: the delivery left this note.',
].join('\n')

const asked = (text: string, over: Partial<Question> = {}): Question => ({ text, ...over })

describe('which tasks a board raises an event about', () => {
  it('raises one for a task at ready in the watched release', () => {
    assert.equal(actionableKind(card({ status: 'ready' }), BOARD), 'ready_for_review')
  })

  it('raises one for a task carrying a question only the user can answer', () => {
    const held = card({ questions: [asked('[user] Which way?')] })
    assert.equal(actionableKind(held, BOARD), 'question')
  })

  it('asks the question rather than the approval when a task is both', () => {
    // Answering rewrites the card and moves its revision, so an approval granted first
    // would bind a revision about to change.
    const both = card({ status: 'ready', questions: [asked('[user] Which way?')] })
    assert.equal(actionableKind(both, BOARD), 'question')
    assert.equal(snapshotFor(both, BOARD)?.decision, 'answer')
  })

  it('raises nothing for a question the board itself is meant to research', () => {
    assert.equal(actionableKind(card({ questions: [asked('an untriaged one')] }), BOARD), null)
  })

  it('raises nothing for a task in another release, or promised to none', () => {
    assert.equal(actionableKind(card({ status: 'ready', release: '0.9.0' }), BOARD), null)
    assert.equal(actionableKind(card({ status: 'ready', release: '' }), BOARD), null)
  })

  it('raises for every release once the board watches all of them', () => {
    const all = { ...BOARD, release: ALL_RELEASES }
    assert.equal(actionableKind(card({ status: 'ready', release: '0.9.0' }), all), 'ready_for_review')
    assert.equal(actionableKind(card({ status: 'ready', release: '' }), all), 'ready_for_review')
    // The width is the board's; the event still carries the card's own release.
    assert.equal(snapshotFor(card({ status: 'ready', release: '0.9.0' }), all)?.release, '0.9.0')
  })

  it('raises nothing at all while the board is watching no release', () => {
    assert.equal(actionableKind(card({ status: 'ready' }), { ...BOARD, release: '' }), null)
  })

  it('raises nothing for a recurring job, which has no end state to approve', () => {
    assert.equal(actionableKind(card({ status: 'ready', recurring: true }), BOARD), null)
  })

  it('raises nothing for a plain todo', () => {
    assert.equal(actionableKind(card(), BOARD), null)
  })

  it('raises nothing while the board is working on the card', () => {
    // An agent rewrites a card over several board writes, so mid-run it says `ready` in
    // moments it is not done being worked on. It comes back when the run ends.
    const ready = card({ status: 'ready' })
    assert.equal(actionableKind(ready, BOARD, new Set([12])), null)
    assert.equal(snapshotFor(ready, BOARD, new Set([12])), null)
    assert.equal(actionableKind(ready, BOARD, new Set([13])), 'ready_for_review')
    assert.equal(actionableKind(ready, BOARD, new Set()), 'ready_for_review')
  })

  it('holds a question back too, since a run can still answer it itself', () => {
    const asking = card({ questions: [asked('[user] Which way?')] })
    assert.equal(actionableKind(asking, BOARD, new Set([12])), null)
    assert.equal(actionableKind(asking, BOARD, new Set()), 'question')
  })

  it('raises nothing for a card waiting on an open one — it cannot be built either way', () => {
    const blocked = { id: 9, title: 'The one it waits on' }
    assert.equal(actionableKind(card({ status: 'ready', openBlockers: [blocked] }), BOARD), null)
    assert.equal(actionableKind(card({ questions: [asked('[user] Which way?')], openBlockers: [blocked] }), BOARD), null)
    // `blocked_by` naming a card that is archived, rejected or recurring blocks nothing —
    // which is exactly what `openBlockers` being empty already says.
    assert.equal(actionableKind(card({ status: 'ready', blocked_by: [9] }), BOARD), 'ready_for_review')
  })
})

describe('what one event carries', () => {
  it('strips the board’s internal tag from every question', () => {
    const held = card({
      questions: [
        asked('[user] Which way?', { mode: 'single', options: ['left', 'right'], recommend: [2] }),
        asked('[user] And a plain one'),
      ],
    })

    assert.deepEqual(userQuestions(held), [
      { text: 'Which way?', mode: 'single', options: ['left', 'right'], recommend: [2] },
      { text: 'And a plain one' },
    ])
  })

  it('leaves every other part of the card behind', () => {
    const snapshot = snapshotFor(card({ status: 'ready' }), BOARD)!
    const carried = JSON.stringify(snapshot)

    assert.equal(snapshot.taskId, 12)
    assert.equal(snapshot.taskTitle, 'A task')
    assert.equal(snapshot.release, '0.8.0')
    assert.equal(snapshot.revision, 'r1')
    assert.ok(!carried.includes('never leaves this machine'), 'the plan must not travel')
    assert.ok(!carried.includes('## Scope'), 'the agent half must not travel')
    assert.ok(!carried.includes('features/12-a.md'), 'the card’s path must not travel')
  })

  it('carries the opening paragraph and the review notes, and nothing else of the body', () => {
    // What a message away from this machine is reviewed from (#320): approving a build off
    // a title alone is not a review.
    const snapshot = snapshotFor(card({ status: 'ready' }), BOARD)!

    assert.equal(snapshot.summary, 'A task waiting on a decision arrives carrying enough of the card to review.')
    assert.equal(
      snapshot.notes,
      [
        '## Worth noting',
        '- **A button decides**: it does not open the app.',
        '',
        '## Worth noting after implementation',
        '- **What changed**: the delivery left this note.',
      ].join('\n'),
    )
  })

  it('carries that text bounded, cut where a person would have stopped', () => {
    const long = Array.from({ length: 400 }, (_, at) => `- the ${at}th thing worth noting`)
    const snapshot = snapshotFor(
      card({ status: 'ready', body: ['## Worth noting', ...long].join('\n') }),
      BOARD,
    )!

    assert.ok(snapshot.notes.length < 3000, 'a long card costs one snapshot, not its whole body')
    assert.ok(snapshot.notes.endsWith('worth noting'), 'cut at a bullet rather than mid-line')
  })

  it('is news when the review notes move and nothing else does', () => {
    // The fingerprint is what decides whether a refresh interrupts anybody, so text a
    // reviewer reads has to be in it.
    const before = snapshotFor(card({ status: 'ready' }), BOARD)!
    const after = snapshotFor(
      card({ status: 'ready', body: `${BODY}\n- **And another**: worth knowing.` }),
      BOARD,
    )!
    assert.notEqual(before.fingerprint, after.fingerprint)
  })

  it('names the board on the event, and says nothing about where it is', () => {
    const snapshot = snapshotFor(card({ status: 'ready' }), BOARD)!
    assert.equal(snapshot.boardId, 'b-1')
    assert.equal(snapshot.boardName, 'ai4kanban')
    assert.ok(!JSON.stringify(snapshot).includes('/tmp/project'))
  })

  it('carries no question on a ready-for-review event', () => {
    // A question on the card would have made it a question event; a ready one asks for the
    // revision itself.
    assert.deepEqual(snapshotFor(card({ status: 'ready' }), BOARD)!.questions, [])
  })
})

describe('when a live event has to be refreshed', () => {
  const ready = card({ status: 'ready' })

  it('fingerprints the same card at the same revision the same way', () => {
    assert.equal(snapshotFor(ready, BOARD)!.fingerprint, snapshotFor(card({ status: 'ready' }), BOARD)!.fingerprint)
  })

  it('moves when the revision does', () => {
    const moved = card({ status: 'ready', revision: 'r2' })
    assert.notEqual(snapshotFor(ready, BOARD)!.fingerprint, snapshotFor(moved, BOARD)!.fingerprint)
  })

  it('moves when the question list does', () => {
    const one = card({ questions: [asked('[user] a')] })
    const two = card({ questions: [asked('[user] a'), asked('[user] b')] })
    assert.notEqual(snapshotFor(one, BOARD)!.fingerprint, snapshotFor(two, BOARD)!.fingerprint)
  })

  it('moves when the last question is answered on a ready card, so the row becomes the approval', () => {
    const asking = card({ status: 'ready', questions: [asked('[user] a')] })
    const approved = card({ status: 'ready' })
    assert.equal(snapshotFor(asking, BOARD)!.decision, 'answer')
    assert.equal(snapshotFor(approved, BOARD)!.decision, 'implement')
    assert.notEqual(snapshotFor(asking, BOARD)!.fingerprint, snapshotFor(approved, BOARD)!.fingerprint)
  })
})

describe('the nine states this card fixes', () => {
  it('names all nine, and no more', () => {
    assert.equal(CLOUD_EVENT_STATES.length, 9)
    assert.deepEqual([...CLOUD_EVENT_STATES], [
      'actionable',
      'accepted',
      'waiting_for_server',
      'running',
      'completed',
      'failed',
      'stale',
      'cancelled',
      'interrupted',
    ])
  })

  it('keeps live work however old it is, and finishes the five that end', () => {
    for (const state of ['actionable', 'accepted', 'waiting_for_server', 'running'] as const) {
      assert.equal(isFinalEventState(state), false, state)
    }
    for (const state of ['completed', 'failed', 'stale', 'cancelled', 'interrupted'] as const) {
      assert.equal(isFinalEventState(state), true, state)
    }
  })

  it('gives every state one wording, so no surface invents a second', () => {
    for (const state of CLOUD_EVENT_STATES) {
      assert.ok(eventLabel({ kind: 'question', state }), state)
    }
    assert.equal(eventLabel({ kind: 'question', state: 'actionable' }), 'Question waiting')
    assert.equal(eventLabel({ kind: 'ready_for_review', state: 'actionable' }), 'Ready for review')
  })
})

describe('the machine’s list of enabled boards', () => {
  it('holds nothing until a board is turned on', () => {
    assert.deepEqual(readCloudBoards(), [])
    assert.equal(cloudBoardFor('/tmp/whatever'), null)
  })

  it('mints an id that means nothing outside Cloud, and keeps the path here', () => {
    const board = enableCloudBoard('/tmp/project', '0.8.0')

    assert.match(board.id, /^[0-9a-f-]{36}$/)
    assert.equal(board.path, path.resolve('/tmp/project'))
    assert.equal(board.name, 'project')
    assert.equal(cloudBoardById(board.id)?.path, path.resolve('/tmp/project'))
  })

  it('keeps a board’s id across being turned off and on, so its events are never orphaned', () => {
    const first = enableCloudBoard('/tmp/project', '0.8.0')
    const again = enableCloudBoard('/tmp/project', '0.9.0')

    assert.equal(again.id, first.id)
    assert.equal(again.release, '0.9.0')
    assert.equal(readCloudBoards().length, 1)
  })

  it('swaps the release it watches', () => {
    enableCloudBoard('/tmp/project', '0.8.0')
    assert.equal(setCloudBoardRelease('/tmp/project', '0.9.0')?.release, '0.9.0')
    assert.equal(cloudBoardFor('/tmp/project')?.release, '0.9.0')
  })

  it('names a row’s board only once a second one is enabled', () => {
    enableCloudBoard('/tmp/project', '0.8.0')
    assert.equal(namesBoards(), false)
    enableCloudBoard('/tmp/other', '1.0')
    assert.equal(namesBoards(), true)
  })

  it('forgets a board that is turned off, and leaves the rest', () => {
    enableCloudBoard('/tmp/project', '0.8.0')
    enableCloudBoard('/tmp/other', '1.0')

    assert.equal(disableCloudBoard('/tmp/project')?.name, 'project')
    assert.equal(cloudBoardFor('/tmp/project'), null)
    assert.equal(readCloudBoards().length, 1)
  })

  it('reads a damaged file as no boards rather than taking a screen down', () => {
    fs.mkdirSync(home, { recursive: true })
    fs.writeFileSync(path.join(home, 'boards.json'), '{ not json')
    assert.deepEqual(readCloudBoards(), [])
  })
})

// The card page starts the delivery and records the click a moment later, so the delivery's
// first state reaches an event that has no action to report against yet. Held until the
// click lands, the row moves accepted → running → the outcome rather than skipping the
// middle one.
describe('a delivery that starts before its click is recorded', () => {
  let project = ''

  beforeEach(() => {
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-cloud-outbox-'))
    setBoardRoot(project)
  })

  afterEach(() => {
    fs.rmSync(project, { recursive: true, force: true })
  })

  const publishedAs = (state: string, eventId = 'e-1'): void => {
    fs.mkdirSync(path.join(project, '.akb'), { recursive: true })
    fs.writeFileSync(
      path.join(project, '.akb', 'cloud-outbox.json'),
      JSON.stringify({ version: 1, published: { 12: { eventId, fingerprint: 'f1', state } }, pending: [] }),
    )
  }

  const pending = (): string[] => readOutbox().pending.map((p) => p.kind)
  const stateNow = (): string | undefined => readOutbox().published['12']?.state

  it('reports nothing while the event is still waiting on a person', () => {
    publishedAs('actionable')
    recordCloudDeliveryState(12, 'running')

    assert.deepEqual(pending(), [])
    assert.equal(stateNow(), 'actionable')
  })

  it('moves the event through running once the click is on record', () => {
    publishedAs('actionable')
    recordCloudDeliveryState(12, 'running')
    recordCloudActionFor(12, 'implement', 'r1')

    assert.deepEqual(pending(), ['action', 'outcome'])
    assert.equal(stateNow(), 'running')
  })

  it('never lands a held state on a later event', () => {
    publishedAs('actionable', 'e-1')
    recordCloudDeliveryState(12, 'running')
    // That event was retired and the task raised a fresh one before anybody clicked.
    publishedAs('actionable', 'e-2')
    recordCloudActionFor(12, 'implement', 'r1')

    assert.deepEqual(pending(), ['action'])
    assert.equal(stateNow(), 'accepted')
  })
})

// --- the card link a Slack message carries (#320) ----------------------------
// It names the board as well as the card, so it lands on the right one while another
// project is open — and says plainly when that board is not on this machine, rather than
// opening whatever card wears that number on the board in front of the user.

describe('the card link in a message', () => {
  it('leads to the board it names, on this machine', () => {
    const board = enableCloudBoard('/tmp/project-a', ALL_RELEASES)

    assert.deepEqual(readCloudCardLink(`ai4kanban://card/${board.id}/12`), {
      ok: true,
      boardPath: board.path,
      taskId: 12,
    })
  })

  it('says so when that board has been moved off this machine', () => {
    assert.deepEqual(readCloudCardLink('ai4kanban://card/b-gone/12'), { ok: false, reason: 'not-here' })
  })

  it('answers nothing for a URL that names no card, so other answers pass through', () => {
    assert.equal(readCloudCardLink('ai4kanban://cloud/signed-in?code=x'), null)
    assert.equal(readCloudCardLink('ai4kanban://cloud/slack-connected'), null)
    assert.equal(readCloudCardLink('https://example.com/card/b-1/12'), null)
    assert.equal(readCloudCardLink('ai4kanban://card/b-1/not-a-number'), null)
  })
})
