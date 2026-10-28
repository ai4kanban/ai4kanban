// Landing a triage judgement by hand (#561): a card written whole in one call, a judgement
// landed through one command, and a person ignoring an item mid-run leaving exactly one
// judgement behind.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { cmdCreate, cmdUpdate } from '../src/commands/card.ts'
import { cmdTriageAdd, cmdTriageArchive, cmdTriageDismiss } from '../src/commands/triage.ts'
import { fileName, readAllDismissed, readInbox, writeSignal } from '../src/lib/signals/inbox.ts'
import { dismissSignal } from '../src/lib/signals/index.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')
const todo = (): string => path.join(kanban(), 'todo')
const dismissed = (): string => path.join(kanban(), 'triage', 'dismissed')
const archived = (): string => path.join(kanban(), 'triage', 'archived')

/** One item waiting to be sorted, and the source id it was given. */
async function waiting(title: string, slug?: string): Promise<string> {
  startCollecting()
  try {
    await cmdTriageAdd({ title, text: `https://example.test/${title.replace(/\s+/g, '-')}`, slug, workflow: 'coding' })
  } finally {
    stopCollecting()
  }
  return readInbox().find((item) => item.title === title)!.sourceId
}

/** Everything printed while `work` ran — these commands say rather than return. */
function quiet<T>(work: () => T): { value: T; said: string } {
  const sink = startCollecting()
  try {
    return { value: work(), said: sink.out.join('\n') }
  } finally {
    stopCollecting()
  }
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-triage-run-'))
  fs.mkdirSync(todo(), { recursive: true })
  fs.writeFileSync(path.join(todo(), 'README.md'), '# Open tasks\n')
  setBoardRoot(root)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('a card written in one call', () => {
  it('writes the body with the card, so nothing is scheduled onto a scaffold', () => {
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, '\nWhat it does.\n\n## Todo\n- [ ] Build it.\n')
    const { value } = quiet(() => cmdCreate({ title: 'Share conventions', bodyFile: body, schedule: 'refine', asked: [], id: 1 }))
    const written = fs.readFileSync(path.join(root, String(value.file)), 'utf8')
    assert.match(written, /What it does\./)
    assert.match(written, /- \[ \] Build it\./)
    assert.doesNotMatch(written, /replace this line with the real steps/)
    assert.equal(value.schedule, 'refine')
  })

  it('refuses a body file that is not there, and writes no card for it', () => {
    assert.throws(() => cmdCreate({ title: 'Nope', bodyFile: path.join(root, 'gone.md'), asked: [], id: 1 }), /write the body to a file/)
    assert.deepEqual(fs.readdirSync(todo()), ['README.md'])
  })

  it('refuses --body-file and --no-body together', () => {
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, 'Words.\n')
    assert.throws(() => cmdCreate({ title: 'Nope', bodyFile: body, body: false, asked: [], id: 1 }), /not both/)
  })
})

describe('landing one judgement', () => {
  it('archives the item onto the card it became', async () => {
    const id = await waiting('Conventions keep getting reverted')
    const { value } = quiet(() => cmdTriageArchive(id, 7))
    assert.equal(value.where, 'archived')
    assert.equal(readInbox().length, 0)
    assert.match(fs.readFileSync(path.join(archived(), fs.readdirSync(archived())[0]!), 'utf8'), /card_id: 7/)
  })

  it('ignores one in the agent’s name, with the reason', async () => {
    const id = await waiting('A duplicate')
    quiet(() => cmdTriageDismiss(id, '  already on #4  '))
    const record = fs.readFileSync(path.join(dismissed(), fs.readdirSync(dismissed())[0]!), 'utf8')
    assert.match(record, /dismissed_by: agent/)
    assert.match(record, /dismissed_reason: already on #4/)
  })

  it('refuses a dismissal with no reason', async () => {
    const id = await waiting('A duplicate')
    assert.throws(() => quiet(() => cmdTriageDismiss(id, '   ')), /say why it is being ignored/)
    assert.equal(readInbox().length, 1)
  })

  it('treats an item somebody else landed as gone, not as a failure of this run', async () => {
    const id = await waiting('Taken already')
    dismissSignal(id, 'not now')
    assert.throws(() => quiet(() => cmdTriageDismiss(id, 'too small')), /nothing waiting in triage is/)
  })
})

describe('a card that was written and an item that was ignored (#561)', () => {
  it('records the card on the ignore and leaves it ignored', async () => {
    const id = await waiting('Ignored mid-run')
    dismissSignal(id, 'not now')
    const { value, said } = quiet(() => cmdTriageArchive(id, 11))
    assert.equal(value.where, 'dismissed')
    assert.match(said, /it stays ignored/)
    assert.equal(fs.existsSync(archived()), false)
    assert.match(fs.readFileSync(path.join(dismissed(), fs.readdirSync(dismissed())[0]!), 'utf8'), /card_id: 11/)
    assert.equal(readAllDismissed().length, 1)
  })
})

describe('a card made of a triage item', () => {
  it('keeps the field through a later rewrite of the card', async () => {
    const id = await waiting('Rewritten')
    const { value } = quiet(() => cmdCreate({ title: 'Rewritten', triage: id, asked: [], id: 1 }))
    quiet(() => cmdUpdate(Number(value.id), { priority: 'high' }))
    assert.match(fs.readFileSync(path.join(root, String(value.file)), 'utf8'), new RegExp(`^triage: ${id}$`, 'm'))
  })
})

describe("a new item's file name", () => {
  it('is the slug its writer gave, the endpoint sent, or the title made', async () => {
    await waiting('导出看板为 CSV', 'Export board as CSV')
    await waiting('Dark mode for the board')
    const sent = writeSignal(
      { sourceId: 't3_a', title: 'Whatever it says', summary: 'Words.', sourceType: '', meta: [], url: '', collectedAt: '2026-10-01 09:00' },
      '2026-10-01 09:00',
      'from-the-endpoint',
    )
    const names = fs.readdirSync(path.join(kanban(), 'triage')).filter((name) => name.endsWith('.md')).sort()
    assert.deepEqual(names, ['dark-mode-for-the-board.md', 'export-board-as-csv.md', 'from-the-endpoint.md'])
    assert.equal(sent.relPath, 'docs/kanban/triage/from-the-endpoint.md')
  })

  it('falls back to `item`, and numbers a name already taken', async () => {
    assert.equal(fileName('看板'), 'item.md')
    assert.equal(fileName('看板', '!!'), 'item.md')
    await waiting('Dark mode')
    startCollecting()
    try {
      await cmdTriageAdd({ title: 'Dark mode', text: 'Another one entirely.', workflow: 'coding' })
      await cmdTriageAdd({ title: 'Dark mode', text: 'And a third.', workflow: 'coding' })
    } finally {
      stopCollecting()
    }
    const names = fs.readdirSync(path.join(kanban(), 'triage')).filter((name) => name.endsWith('.md')).sort()
    assert.deepEqual(names, ['dark-mode-2.md', 'dark-mode-3.md', 'dark-mode.md'])
  })
})
