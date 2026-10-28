// `akb raw list --archived` (#1400): the cards that landed, read from the delivery records.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { formatStamp } from '../src/lib/cadence.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, move, refuses } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-list-archived-'))
const kanban = path.join(root, 'docs', 'kanban')

const MINUTE = 60 * 1000
// A whole minute, so a stamp names it exactly.
const T0 = new Date(2026, 7, 2, 14, 0).getTime()

interface Landing {
  cardId: number | null
  at: number
  commit?: string
  status?: string
  workflow?: string
}

let serial = 0
function delivery(l: Landing): void {
  const deliveryId = `d${++serial}`
  const record = {
    deliveryId,
    cardId: l.cardId,
    title: `Card ${l.cardId}`,
    status: 'finished',
    startedAt: l.at - MINUTE,
    endedAt: l.at,
    sessions: [],
    landing: { status: l.status ?? 'landed', attempts: 0, ...(l.commit ? { commit: l.commit } : {}), at: l.at },
    ...(l.workflow ? { workflow: { id: l.workflow, name: l.workflow } } : {}),
  }
  fs.writeFileSync(path.join(kanban, 'deliveries', `${deliveryId}.json`), JSON.stringify(record))
}

function cardFile(folder: string, relPath: string): void {
  const file = path.join(kanban, folder, relPath)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, '---\ntitle: A card\n---\n')
}

interface Listed {
  id: number
  title: string
  workflow: string
  landedAt: string
  commit: string
  file: string
}

const listed = async (argv: string[] = []): Promise<Listed[]> =>
  (await move(root, ['list', '--archived', ...argv])).cards as Listed[]

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(path.join(kanban, 'todo'), { recursive: true })
  fs.mkdirSync(path.join(kanban, 'deliveries'), { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '90\n')
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

describe('list --archived', () => {
  it('lists each landing oldest first, with its commit and archived file', async () => {
    delivery({ cardId: 2, at: T0 + 5 * MINUTE, commit: 'bbb' })
    delivery({ cardId: 1, at: T0, commit: 'aaa', workflow: 'coding' })
    cardFile('.archive', '1-first.md')
    cardFile('.archive', '2-group/root.md')

    assert.deepEqual(await listed(), [
      { id: 1, title: 'Card 1', workflow: 'coding', landedAt: formatStamp(new Date(T0)), commit: 'aaa', file: 'docs/kanban/.archive/1-first.md' },
      {
        id: 2,
        title: 'Card 2',
        workflow: 'coding',
        landedAt: formatStamp(new Date(T0 + 5 * MINUTE)),
        commit: 'bbb',
        file: 'docs/kanban/.archive/2-group/root.md',
      },
    ])
  })

  it('keeps only the landings after --since', async () => {
    delivery({ cardId: 1, at: T0, commit: 'aaa' })
    delivery({ cardId: 2, at: T0 + 1, commit: 'bbb' })
    delivery({ cardId: 3, at: T0 + MINUTE, commit: 'ccc' })

    const answer = await move(root, ['list', '--archived', '--since', formatStamp(new Date(T0))])
    assert.deepEqual((answer.cards as Listed[]).map((c) => c.id), [2, 3])
    assert.equal(answer.since, formatStamp(new Date(T0)))
  })

  it('keeps only one workflow, counting a record that names none as the default', async () => {
    delivery({ cardId: 1, at: T0, commit: 'aaa' })
    delivery({ cardId: 2, at: T0 + 1, commit: 'bbb', workflow: 'blog-post' })
    delivery({ cardId: 3, at: T0 + 2, commit: 'ccc', workflow: 'coding' })

    assert.deepEqual((await listed(['--workflow', 'coding'])).map((c) => c.id), [1, 3])
    assert.deepEqual((await listed(['--workflow', 'blog-post'])).map((c) => c.id), [2])
    await refuses(root, ['list', '--archived', '--workflow', 'nope'], /no workflow called "nope"/)
  })

  it('leaves out a landing with no commit, one that did not land, and one with no card', async () => {
    delivery({ cardId: 1, at: T0 })
    delivery({ cardId: 2, at: T0, commit: 'bbb', status: 'waiting' })
    delivery({ cardId: null, at: T0, commit: 'ccc' })

    assert.deepEqual(await listed(), [])
  })

  it('leaves out a card still on the board', async () => {
    delivery({ cardId: 1, at: T0, commit: 'aaa' })
    delivery({ cardId: 2, at: T0, commit: 'bbb' })
    cardFile('todo', '1-still-open.md')

    assert.deepEqual((await listed()).map((c) => c.id), [2])
  })

  it('lists a card whose archived file is gone, with no path', async () => {
    delivery({ cardId: 1, at: T0, commit: 'aaa' })

    assert.deepEqual((await listed()).map((c) => [c.id, c.file]), [[1, '']])
  })

  it('lists a card once per landing', async () => {
    delivery({ cardId: 1, at: T0, commit: 'aaa' })
    delivery({ cardId: 1, at: T0 + MINUTE, commit: 'bbb' })

    assert.deepEqual((await listed()).map((c) => c.commit), ['aaa', 'bbb'])
  })

  it('refuses a --since it cannot read, and flags that do not go together', async () => {
    await refuses(root, ['list', '--archived', '--since', 'yesterday'], /cannot read --since "yesterday".*YYYY-MM-DD HH:MM/)
    await refuses(root, ['list', '--archived', '--stale'], /--archived and --stale/)
    await refuses(root, ['list', '--archived', '--module', 'cli'], /--module does not apply/)
    await refuses(root, ['list', '--since', '2026-08-02 14:00'], /--since only applies to --archived/)
    await refuses(root, ['list', '--workflow', 'coding'], /--workflow only applies to --archived/)
  })
})
