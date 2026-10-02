// Sorting what is waiting in triage (#561).
//
// The sort itself is in triage-judge.test.ts. This covers the moves around it: a card
// written whole in one call, a judgement landed by hand through one command, and the two
// races — a person ignoring an item mid-run, and a run that died between the create and the
// archive — leaving exactly one judgement behind.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { flowByCommand } from '../src/lib/agent/flows.ts'
import { buildAsk } from '../src/lib/agent/prompts.ts'
import { roleForFlow } from '../src/lib/agent/roles.ts'
import { cmdCreate, cmdUpdate } from '../src/commands/card.ts'
import { cmdTriageAdd, cmdTriageArchive, cmdTriageDismiss } from '../src/commands/triage.ts'
import { reconcileTriage } from '../src/lib/signals/carded.ts'
import { readAllDismissed, readInbox } from '../src/lib/signals/inbox.ts'
import { dismissSignal } from '../src/lib/signals/index.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { triageShut } from './helpers/triage.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')
const todo = (): string => path.join(kanban(), 'todo')
const dismissed = (): string => path.join(kanban(), 'triage', 'dismissed')
const archived = (): string => path.join(kanban(), 'triage', 'archived')

/** One item waiting to be sorted, and the source id it was given. */
async function waiting(title: string): Promise<string> {
  startCollecting()
  try {
    await triageShut(() => cmdTriageAdd({ title, text: `https://example.test/${title.replace(/\s+/g, '-')}` }))
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
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  setBoardRoot(root)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the sort', () => {
  it('is no agent\'s, and no flow an agent is handed', () => {
    assert.equal(flowByCommand('triage'), undefined)
    assert.equal(roleForFlow('triage'), undefined)
    assert.equal(buildAsk({ action: 'triage' }), '')
  })
})

describe('a card written in one call', () => {
  it('writes the body with the card, so nothing is scheduled onto a scaffold', () => {
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, '\nWhat it does.\n\n## Todo\n- [ ] Build it.\n')
    const { value } = quiet(() => cmdCreate({ title: 'Share conventions', bodyFile: body, schedule: 'refine', asked: [] }))
    const written = fs.readFileSync(path.join(root, String(value.file)), 'utf8')
    assert.match(written, /What it does\./)
    assert.match(written, /- \[ \] Build it\./)
    assert.doesNotMatch(written, /replace this line with the real steps/)
    assert.equal(value.schedule, 'refine')
  })

  it('refuses a body file that is not there, and takes no id for it', () => {
    assert.throws(() => cmdCreate({ title: 'Nope', bodyFile: path.join(root, 'gone.md'), asked: [] }), /write the body to a file/)
    assert.equal(fs.readFileSync(path.join(kanban(), 'next-id'), 'utf8').trim(), '1')
  })

  it('refuses --body-file and --no-body together', () => {
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, 'Words.\n')
    assert.throws(() => cmdCreate({ title: 'Nope', bodyFile: body, body: false, asked: [] }), /not both/)
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

describe('the reconciliation a run starts with', () => {
  it('archives an item an open card was made of, so nothing is judged twice', async () => {
    const id = await waiting('Already carded')
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, 'Words.\n\n## Todo\n- [ ] Build it.\n')
    const { value } = quiet(() => cmdCreate({ title: 'Already carded', bodyFile: body, triage: id, asked: [] }))
    const written = fs.readFileSync(path.join(root, String(value.file)), 'utf8')
    assert.match(written, new RegExp(`^triage: ${id}$`, 'm'))
    assert.deepEqual(
      reconcileTriage().map((item) => [item.sourceId, item.cardId]),
      [[id, value.id]],
    )
    assert.equal(readInbox().length, 0)
    assert.match(fs.readFileSync(path.join(archived(), fs.readdirSync(archived())[0]!), 'utf8'), new RegExp(`card_id: ${value.id}`))
    // And again: the second call finds nothing, because the first moved the file out.
    assert.deepEqual(reconcileTriage(), [])
  })

  it('leaves an item a card only names in its body', async () => {
    const id = await waiting('Only mentioned')
    fs.writeFileSync(
      path.join(todo(), '5-mentions.md'),
      `---\ntitle: Mentions it\n---\n\nSomebody said ${id} once.\n\n## Source\n- ${id}\n`,
    )
    assert.deepEqual(reconcileTriage(), [])
    assert.equal(readInbox().length, 1)
  })

  it('does not take a longer id for a shorter one', async () => {
    const long = await waiting('Longer')
    fs.writeFileSync(path.join(todo(), '6-prefix.md'), `---\ntitle: Prefix\ntriage: ${long.slice(0, 6)}\n---\n\nWords.\n`)
    assert.deepEqual(reconcileTriage(), [])
    assert.equal(readInbox().length, 1)
  })

  it('keeps the field through a later rewrite of the card', async () => {
    const id = await waiting('Rewritten')
    const { value } = quiet(() => cmdCreate({ title: 'Rewritten', triage: id, asked: [] }))
    quiet(() => cmdUpdate(Number(value.id), { priority: 'high' }))
    assert.match(fs.readFileSync(path.join(root, String(value.file)), 'utf8'), new RegExp(`^triage: ${id}$`, 'm'))
  })
})
