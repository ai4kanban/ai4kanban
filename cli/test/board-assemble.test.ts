// The two screens a hosted page draws, assembled from one Cloud read (#322).
//
// `view/read.ts` walks `docs/kanban/` and the tests around it cover that path. This covers
// the other caller of the same rules: a browser holding nothing but what
// `GET /v1/workspaces/<id>/read` handed back. The group shape, the bands, the release
// picker and the two refusals are all worked out here rather than by the service, so a
// wrong answer here is a wrong board on screen.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  boardScreenFrom,
  cardScreenFrom,
  type BoardRead,
  type ReadCard,
} from '../src/lib/board/assemble.ts'

const meta = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  title: 'A card',
  priority: 'med',
  roi: 'med',
  status: 'todo',
  release: '',
  blocked_by: [],
  related: [],
  questions: [],
  verify: [],
  modules: [],
  ...over,
})

/** One card as a workspace stores it: the number, the revision, and `{ path, meta, body }`
 *  under `data` — `path` relative to `docs/kanban/`. */
const card = (id: number, path: string, over: Record<string, unknown> = {}, body = ''): ReadCard => ({
  id,
  revision: `r${id}`,
  data: { path, meta: meta({ title: `Card ${id}`, ...over }), body },
})

const read = (over: Partial<BoardRead> = {}): BoardRead => ({
  workspace: { id: 'ws-1', name: 'Sales board' },
  cards: [],
  documents: [],
  ...over,
})

const MODULES = '- **cloud** — the service\n- **local-ui** — the board UI\n'
const RELEASES = '- **0.9.0** — the browser release\n- **1.0.0**\n'

describe('a board, assembled from one Cloud read', () => {
  it('bands the cards in module-map order, with the untagged band last and empties dropped', () => {
    const screen = boardScreenFrom(
      read({
        cards: [
          card(1, 'todo/1-one.md', { modules: ['local-ui'] }),
          card(2, 'todo/2-two.md', { modules: ['cloud'] }),
          card(3, 'todo/3-three.md'),
          card(4, 'todo/4-four.md', { modules: ['gone-from-the-map'] }),
        ],
        documents: [{ path: 'modules.md', body: MODULES }],
      }),
    )
    assert.deepEqual(
      screen.board!.columns.map((c) => [c.title, c.cards.map((x) => x.id)]),
      [
        ['cloud', [2]],
        ['local-ui', [1]],
        // A module the map has since lost is banded rather than dropped, before the catch-all.
        ['gone-from-the-map', [4]],
        ['Untagged', [3]],
      ],
    )
  })

  it('sorts a band by pick order rather than by the order the read arrived in', () => {
    const screen = boardScreenFrom(
      read({
        cards: [
          card(1, 'todo/1-one.md', { priority: 'low' }),
          card(2, 'todo/2-two.md', { priority: 'high' }),
          card(3, 'todo/3-three.md', { status: 'implementing', priority: 'low' }),
        ],
      }),
    )
    assert.deepEqual(screen.board!.columns[0]!.cards.map((c) => c.id), [3, 2, 1])
  })

  it('puts the group shape back: a root carries its subtasks and neither subtask is a board card', () => {
    const screen = boardScreenFrom(
      read({
        cards: [
          card(10, 'todo/10-group/root.md', {}, '## Todo\n- [x] one #11\n- [ ] two #12\n'),
          card(11, 'todo/10-group/11-one.md', { release: '0.9.0' }, '- [x] a\n- [ ] b\n'),
          card(12, 'todo/10-group/12-two.md', { blocked_by: [11] }),
          card(13, 'todo/13-loose.md'),
        ],
      }),
    )
    const ids = screen.board!.columns.flatMap((c) => c.cards.map((x) => x.id))
    assert.deepEqual(ids, [10, 13])

    const root = screen.board!.columns[0]!.cards.find((c) => c.id === 10)!
    assert.equal(root.isGroup, true)
    assert.deepEqual(root.subtaskLines, { total: 2, resolved: 1 })
    assert.deepEqual(root.subtasks!.map((s) => [s.id, s.release, s.todos]), [
      [11, '0.9.0', { total: 2, done: 1 }],
      [12, '', { total: 0, done: 0 }],
    ])
  })

  it('links a subtask back to its root and resolves a blocker still on the board', () => {
    const board = read({
      cards: [
        card(10, 'todo/10-group/root.md', { title: 'The group' }, '- [ ] one #11\n- [ ] two #12\n'),
        card(11, 'todo/10-group/11-one.md'),
        card(12, 'todo/10-group/12-two.md', { blocked_by: [11, 99, 12] }),
      ],
    })
    const screen = cardScreenFrom(board, 12)!
    assert.deepEqual(screen.card.parent, { id: 10, title: 'The group' })
    // 99 left the board and 12 names itself: neither can ever clear, so neither blocks.
    assert.deepEqual(screen.card.openBlockers, [{ id: 11, title: 'Card 11' }])
  })

  it('fills the release picker off releases.md and counts every open card, subtasks included', () => {
    const screen = boardScreenFrom(
      read({
        cards: [
          card(10, 'todo/10-group/root.md', { release: '0.9.0' }, '- [ ] one #11\n'),
          card(11, 'todo/10-group/11-one.md', { release: '1.0.0' }),
          card(12, 'todo/12-loose.md'),
        ],
        documents: [{ path: 'releases.md', body: RELEASES }],
      }),
    )
    assert.deepEqual(screen.board!.releases, ['0.9.0', '1.0.0'])
    assert.deepEqual(screen.board!.releaseGoals, { '0.9.0': 'the browser release' })
    assert.deepEqual(screen.board!.releaseCounts, { '0.9.0': 1, '1.0.0': 1, '': 1 })
  })

  it('serves nothing the two screens do not draw', () => {
    const screen = boardScreenFrom(read({ cards: [card(1, 'todo/1-one.md')] }))
    assert.deepEqual(screen.board!.archive, [])
    assert.deepEqual(screen.board!.memoryModules, [])
    assert.equal(screen.board!.setup, null)
    assert.equal(screen.board!.goalWritten, false)
    assert.equal(screen.board!.goalNeedsWork, false)
    assert.equal(screen.error, null)
    // The workspace, live — there is no copy here to be out of date.
    assert.equal(screen.id, 'ws-1')
    assert.deepEqual(screen.standing, {
      kind: 'cloud',
      offline: false,
      workspaceName: 'Sales board',
      readAt: '',
      readWhen: '',
    })
  })

  it('reads a card off the wire defensively: no path is dropped, a missing field is empty', () => {
    const screen = boardScreenFrom(
      read({
        cards: [
          { id: 1, revision: 'r1', data: { meta: { title: 'No path' } } },
          { id: 2, revision: 'r2', data: null },
          { id: 3, revision: 'r3', data: { path: 'todo/3-bare.md' } },
        ],
      }),
    )
    const cards = screen.board!.columns.flatMap((c) => c.cards)
    assert.deepEqual(cards.map((c) => c.id), [3])
    assert.equal(cards[0]!.title, '')
    assert.deepEqual(cards[0]!.questions, [])
    assert.deepEqual(cards[0]!.modules, [])
    assert.equal(cards[0]!.schedule, null)
  })

  it('spells when a recurring job is next due, and leaves a one-shot card without one', () => {
    const now = new Date(2026, 8, 5, 12, 0, 0).getTime()
    const screen = boardScreenFrom(
      read({
        cards: [
          card(1, 'todo/recurring/1-waiting.md', { cadence: '7d', last_run: '2026-09-04 09:00' }),
          card(2, 'todo/recurring/2-overdue.md', { cadence: '7d', last_run: '2026-08-01 09:00' }),
          card(3, 'todo/recurring/3-never-run.md', { cadence: '7d' }),
          card(4, 'todo/4-one-shot.md', { cadence: '7d', last_run: '2026-09-04 09:00' }),
        ],
      }),
      now,
    )
    const byId = new Map(screen.board!.columns.flatMap((c) => c.cards).map((c) => [c.id, c]))
    assert.equal(byId.get(1)!.recurring, true)
    // Due on the 11th, spelled on the clock the read was made on.
    assert.match(byId.get(1)!.nextRun, /11/)
    assert.equal(byId.get(2)!.nextRun, 'Due now')
    // A cadence and no run yet is due the moment it gets one.
    assert.equal(byId.get(3)!.nextRun, 'Due now')
    // Not under `recurring/`, so nothing but a person starts it — cadence or no cadence.
    assert.equal(byId.get(4)!.recurring, false)
    assert.equal(byId.get(4)!.nextRun, '')
  })
})

describe('one card, assembled from the same read', () => {
  it('answers a card the read holds, subtasks included, and null for one it does not', () => {
    const board = read({
      cards: [
        card(10, 'todo/10-group/root.md', {}, '- [ ] one #11\n'),
        card(11, 'todo/10-group/11-one.md'),
      ],
      documents: [{ path: 'releases.md', body: RELEASES }],
    })
    // A subtask is never a board card, but it is still a page of its own.
    assert.equal(cardScreenFrom(board, 11)!.card.id, 11)
    assert.equal(cardScreenFrom(board, 10)!.card.subtasks!.length, 1)
    // What `no such card` is drawn from.
    assert.equal(cardScreenFrom(board, 99), null)
  })

  it('carries the ids it may link to and the releases its picker offers, and nothing of a machine', () => {
    const screen = cardScreenFrom(
      read({
        cards: [
          card(10, 'todo/10-group/root.md', {}, '- [ ] one #11\n'),
          card(11, 'todo/10-group/11-one.md'),
        ],
        documents: [{ path: 'releases.md', body: RELEASES }],
      }),
      10,
    )!
    assert.deepEqual(screen.openIds, [10, 11])
    assert.deepEqual(screen.releases, ['0.9.0', '1.0.0'])
    assert.deepEqual(screen.memoryModules, [])
    assert.equal(screen.goalWritten, false)
    assert.equal(screen.diff, null)
    assert.deepEqual(screen.plan, { commitMode: 'manual' })
  })
})
