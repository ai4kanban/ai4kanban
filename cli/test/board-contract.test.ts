// The board's operation contract (#312): what a mutation answers with when the card moved
// under the caller, when there is no such card, and when the board's own rules refuse the
// change. Those three are the whole of "a write is never stale" — a conflict is its own
// result kind, so a caller re-reads that card instead of showing the user a sentence.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { completeCard } from '../src/lib/agent/complete.ts'
import {
  board,
  cardRevision,
  envelope,
  NO_REVISION,
  setBoardProvider,
  withLease,
  type BoardProvider,
  type OpEnvelope,
} from '../src/lib/board/index.ts'
import { serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import type { Meta } from '../src/lib/types.ts'
import { findCard } from '../src/lib/view/read.ts'
import { forgetMachineState } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-contract-'))
const kanban = path.join(root, 'docs', 'kanban')
const track = path.join(kanban, 'todo', 'features')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(track, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '20\n')
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

const fileOf = (id: number): string => path.join(track, `${id}-card-${id}.md`)

/** An envelope carrying a lease over card `id` and the revision the caller says it read —
 *  how a screen that read the card before opening a dialog writes it. */
async function readAt(id: number, expect: string): Promise<OpEnvelope> {
  const got = await board().lease({ card: id })
  assert.ok(got.ok)
  return envelope(expect, got.lease.id)
}

function writeCard(id: number, over: Partial<Meta> = {}): void {
  const meta: Partial<Meta> = {
    title: `Card ${id}`,
    priority: 'med',
    roi: 'med',
    status: 'todo',
    blocked_by: [],
    related: [],
    modules: [],
    questions: [],
    schedule: null,
    ...over,
  }
  fs.writeFileSync(fileOf(id), `${serializeFrontmatter(meta)}\n\nA card.\n\n## Todo\n\n- [ ] Build it.\n`)
}

describe('a write against a revision that has moved', () => {
  it('is a conflict naming the revision the board holds now, and writes nothing', async () => {
    writeCard(1)
    const stale = cardRevision(1)

    // Somebody else writes the card between the read and the write.
    const first = await withLease({ card: 1 }, (env) => board().setStatus(1, 'ready', env))
    assert.equal(first.kind, 'ok')
    assert.notEqual(first.ok && first.revision, stale)

    const late = await board().setStatus(1, 'todo', await readAt(1, stale))
    assert.equal(late.kind, 'conflict')
    assert.equal(late.ok, false)
    assert.equal(late.kind === 'conflict' && late.current, cardRevision(1))
    // Nothing was written: the first change still stands.
    assert.equal(findCard(1)!.status, 'ready')
  })

  it('goes through when the caller passes the revision it read', async () => {
    writeCard(1)
    const done = await board().setStatus(1, 'ready', await readAt(1, cardRevision(1)))
    assert.equal(done.kind, 'ok')
    assert.equal(findCard(1)!.status, 'ready')
  })

  it('hands a caller that read nothing the revision its lease was granted at', async () => {
    writeCard(1)
    const done = await withLease({ card: 1 }, (env) => board().setStatus(1, 'ready', env))
    assert.equal(done.kind, 'ok')
    assert.equal(findCard(1)!.status, 'ready')
  })
})

describe('the writer lease', () => {
  it('is what a card write needs: without one the write is refused, not applied', async () => {
    writeCard(1)
    const res = await board().setStatus(1, 'ready', envelope(cardRevision(1)))
    assert.equal(res.kind, 'refused')
    assert.match(res.ok === false ? res.error : '', /writer lease/)
    assert.equal(findCard(1)!.status, 'todo')
  })

  it('carries a write through a board that moved after the lease was granted', async () => {
    writeCard(1)
    const got = await board().lease({ card: 1 })
    assert.ok(got.ok)
    // What waiting out another writer looks like from here: the lease's revision is behind
    // by the time this write reaches the lock. A caller that read nothing has nothing stale
    // to protect, so it goes through rather than coming back as a conflict.
    const other = await withLease({ card: 1 }, (env) => board().appendQuestion(1, 'Which one?', ['A', 'B'], env))
    assert.equal(other.kind, 'ok')

    const done = await board().appendQuestion(1, 'And when?', ['Now', 'Later'], envelope(got.lease.revision, got.lease.id))
    assert.equal(done.kind, 'ok')
    // Both writes stand: the later one did not overwrite the one it waited out.
    assert.equal(findCard(1)!.questions.length, 2)
    await board().releaseLease(got.lease.id)
  })

  it('is gone once given back, and a write on it is refused', async () => {
    writeCard(1)
    const got = await board().lease({ card: 1 })
    assert.ok(got.ok)
    await board().releaseLease(got.lease.id)
    const res = await board().setStatus(1, 'ready', envelope(got.lease.revision, got.lease.id))
    assert.equal(res.kind, 'refused')
  })
})

describe('a write to a card that is not there', () => {
  it('refuses by name, and a refusal is not a conflict', async () => {
    const res = await withLease({ card: 99 }, (env) => board().setStatus(99, 'ready', env))
    assert.equal(res.kind, 'refused')
    assert.match(res.ok === false ? res.error : '', /no task with id 99/)
  })
})

describe('the revision itself', () => {
  it('is derived from the card and never written into its frontmatter', () => {
    writeCard(1)
    const before = fs.readFileSync(fileOf(1), 'utf8')
    assert.ok(cardRevision(1))
    assert.equal(fs.readFileSync(fileOf(1), 'utf8'), before)
    assert.doesNotMatch(before, /revision/)
  })

  it('is NO_REVISION for a card the board does not have', async () => {
    const got = await board().lease({ card: 99 })
    assert.equal(got.ok && got.lease.revision, NO_REVISION)
  })
})

describe('a board that will not grant a lease', () => {
  // The bookkeeping a run does as it closes must not take the run down with it.
  const busy = (): void => {
    setBoardProvider({
      kind: 'local',
      lease: () => {
        throw new Error('another command is writing this board')
      },
      releaseLease: () => Promise.resolve(),
    } as unknown as BoardProvider)
  }

  beforeEach(() => {
    writeCard(1)
    busy()
  })

  after(() => setBoardProvider(null))

  it('says how to archive the card by hand rather than ending the landing', async () => {
    const box = startCollecting()
    try {
      await completeCard(1, 'abc123')
    } finally {
      stopCollecting()
    }
    assert.match(box.out.join('\n'), /could not be archived/)
    assert.match(box.out.join('\n'), /raw archive 1/)
  })
})
