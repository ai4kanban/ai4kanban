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
import { askUser } from '../src/lib/agent/review.ts'
import {
  board,
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
import { patchCard as screenPatchCard, saveProject } from '../src/lib/view/api.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-contract-'))
const kanban = path.join(root, 'docs', 'kanban')
const track = path.join(kanban, 'todo', 'features')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
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
    track: 'features',
    priority: 'med',
    roi: 'med',
    status: 'todo',
    release: '',
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
    const read = await board().readCard(1)
    assert.ok(read)
    const stale = read.revision

    // Somebody else writes the card between the read and the write.
    const first = await withLease({ card: 1 }, (env) => board().patchCard(1, { priority: 'high' }, env))
    assert.equal(first.kind, 'ok')
    assert.notEqual(first.ok && first.revision, stale)

    const late = await board().patchCard(1, { priority: 'low' }, await readAt(1, stale))
    assert.equal(late.kind, 'conflict')
    assert.equal(late.ok, false)
    assert.equal(late.kind === 'conflict' && late.current, (await board().readCard(1))!.revision)
    // Nothing was written: the first change still stands.
    assert.equal((await board().readCard(1))!.priority, 'high')
  })

  it('goes through when the caller passes the revision it read', async () => {
    writeCard(1)
    const read = await board().readCard(1)
    const done = await board().patchCard(1, { priority: 'high' }, await readAt(1, read!.revision))
    assert.equal(done.kind, 'ok')
    assert.equal((await board().readCard(1))!.priority, 'high')
  })

  it('hands a caller that read nothing the revision its lease was granted at', async () => {
    writeCard(1)
    const done = await withLease({ card: 1 }, (env) => board().patchCard(1, { roi: 'high' }, env))
    assert.equal(done.kind, 'ok')
    assert.equal((await board().readCard(1))!.roi, 'high')
  })
})

describe('the writer lease', () => {
  it('is what a card write needs: without one the write is refused, not applied', async () => {
    writeCard(1)
    const read = await board().readCard(1)
    const res = await board().patchCard(1, { priority: 'high' }, envelope(read!.revision))
    assert.equal(res.kind, 'refused')
    assert.match(res.ok === false ? res.error : '', /writer lease/)
    assert.equal((await board().readCard(1))!.priority, 'med')
  })

  it('carries a write through a board that moved after the lease was granted', async () => {
    writeCard(1)
    const got = await board().lease({ card: 1 })
    assert.ok(got.ok)
    // What waiting out another writer looks like from here: the lease's revision is behind
    // by the time this write reaches the lock. A caller that read nothing has nothing stale
    // to protect, so it goes through rather than coming back as a conflict.
    const other = await withLease({ card: 1 }, (env) => board().patchCard(1, { priority: 'high' }, env))
    assert.equal(other.kind, 'ok')

    const done = await board().patchCard(1, { roi: 'high' }, envelope(got.lease.revision, got.lease.id))
    assert.equal(done.kind, 'ok')
    assert.equal((await board().readCard(1))!.roi, 'high')
    assert.equal((await board().readCard(1))!.priority, 'high')
    await board().releaseLease(got.lease.id)
  })

  it('is gone once given back, and a write on it is refused', async () => {
    writeCard(1)
    const got = await board().lease({ card: 1 })
    assert.ok(got.ok)
    await board().releaseLease(got.lease.id)
    const res = await board().patchCard(1, { priority: 'high' }, envelope(got.lease.revision, got.lease.id))
    assert.equal(res.kind, 'refused')
  })
})

describe('a write to a card that is not there', () => {
  it('refuses by name, and a refusal is not a conflict', async () => {
    const res = await withLease({ card: 99 }, (env) => board().patchCard(99, { priority: 'high' }, env))
    assert.equal(res.kind, 'refused')
    assert.match(res.ok === false ? res.error : '', /no open card #99/)
  })

  it('reads back as nothing rather than throwing', async () => {
    assert.equal(await board().readCard(99), null)
  })
})

describe('a lifecycle change the board refuses', () => {
  it("comes back as a refusal carrying the board's own line", async () => {
    writeCard(1)
    const res = await withLease({ card: 1 }, (env) =>
      board().setSchedule(1, { action: 'refine', notes: '' }, env),
    )
    assert.equal(res.kind, 'refused')
    assert.match(res.ok === false ? res.error : '', /not waiting on anything/)
    assert.equal((await board().readCard(1))!.schedule, null)
  })

  it('takes the schedule on a card that really is blocked', async () => {
    writeCard(1)
    writeCard(2, { blocked_by: [1] })
    const res = await withLease({ card: 2 }, (env) =>
      board().setSchedule(2, { action: 'refine', notes: 'sharpen it' }, env),
    )
    assert.equal(res.kind, 'ok')
    assert.deepEqual((await board().readCard(2))!.schedule, { action: 'refine', notes: 'sharpen it' })
  })
})

describe('the revision itself', () => {
  it('is derived from the card and never written into its frontmatter', async () => {
    writeCard(1)
    const before = fs.readFileSync(fileOf(1), 'utf8')
    const read = await board().readCard(1)
    assert.ok(read!.revision)
    assert.equal(fs.readFileSync(fileOf(1), 'utf8'), before)
    assert.doesNotMatch(before, /revision/)
  })

  it('is NO_REVISION for a card the board does not have', async () => {
    const got = await board().lease({ card: 99 })
    assert.equal(got.ok && got.lease.revision, NO_REVISION)
  })
})

describe('a board that will not grant a lease', () => {
  // Every write refuses by ANSWERING, and none of them throws. A screen's dialog has to say
  // why and stay open, and the bookkeeping a run does as it closes must not take the run
  // down with it — a busy board is the one that reaches all of them.
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

  it("answers a screen's write instead of throwing", async () => {
    const res = await screenPatchCard(1, { priority: 'high' })
    assert.equal(res.ok, false)
    assert.match(res.error ?? '', /writing this board/)
  })

  it('answers a save that takes its own lease instead of throwing', async () => {
    const res = await saveProject('A project', '', [])
    assert.equal(res.ok, false)
    assert.match(res.error ?? '', /writing this board/)
  })

  it("leaves a run's question unwritten rather than ending the run", async () => {
    await assert.doesNotReject(() => askUser(1, { text: 'is this still silent?', options: ['yes', 'no'] }))
  })

  it('says how to archive the card by hand rather than ending the landing', async () => {
    const box = startCollecting()
    try {
      await completeCard(1, 'abc123')
    } finally {
      stopCollecting()
    }
    assert.match(box.out.join('\n'), /could not be archived/)
    assert.match(box.out.join('\n'), /board archive 1/)
  })
})
