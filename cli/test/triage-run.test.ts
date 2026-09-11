// Sorting what is waiting in triage (#561).
//
// The judgement itself is an agent's and cannot be asserted here. What can, and what this
// covers, is the machinery around it: the flow is the triager's and nobody else's, the run
// is one at a time, the flow prints the items rather than the folder, a card is written
// whole in one call, each judgement lands through one command, and the two races a manual
// run has — a person ignoring an item mid-run, and a run that died between the create and
// the archive — leave exactly one judgement behind.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { printFlow } from '../src/lib/agent/flow.ts'
import { flowByCommand, flowPath, flowRefusal } from '../src/lib/agent/flows.ts'
import { buildAsk } from '../src/lib/agent/prompts.ts'
import { roleForFlow } from '../src/lib/agent/roles.ts'
import { openRun } from '../src/lib/agent/sessions.ts'
import { cmdCreate } from '../src/commands/card.ts'
import { cmdTriageAdd, cmdTriageArchive, cmdTriageDismiss } from '../src/commands/triage.ts'
import { reconcileTriage } from '../src/lib/signals/carded.ts'
import { readAllDismissed, readInbox } from '../src/lib/signals/inbox.ts'
import { dismissSignal } from '../src/lib/signals/index.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')
const todo = (): string => path.join(kanban(), 'todo')
const dismissed = (): string => path.join(kanban(), 'triage', 'dismissed')
const archived = (): string => path.join(kanban(), 'triage', 'archived')

/** One item waiting to be sorted, and the source id it was given. */
async function waiting(title: string): Promise<string> {
  startCollecting()
  try {
    await cmdTriageAdd({ title, text: `https://example.test/${title.replace(/\s+/g, '-')}` })
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

describe('the flow', () => {
  it('is typed `triage run` and belongs to the triager alone', () => {
    const flow = flowByCommand('triage')!
    assert.equal(flowPath(flow), 'triage run')
    assert.equal(flow.argument, '')
    assert.equal(roleForFlow('triage')!.name, 'triage')
    // Refused by admission rather than by solution, so the GONE table says nothing about it.
    assert.equal(flowRefusal('triage'), null)
  })

  it('prints the items themselves, and what each judgement lands through', async () => {
    const id = await waiting('Conventions keep getting reverted')
    const { said } = quiet(() => printFlow({ action: 'triage' }))
    assert.match(said, new RegExp(`${id} — Conventions keep getting reverted`))
    assert.match(said, /--schedule refine --body-file/)
    assert.match(said, /triage archive <source-id> --card <id>/)
    assert.match(said, /triage dismiss <source-id> --reason/)
    assert.match(said, /report the count judged/)
  })

  it('says there is nothing to judge rather than asking for a card', () => {
    const { said } = quiet(() => printFlow({ action: 'triage' }))
    assert.match(said, /\(nothing\)/)
    assert.match(said, /write nothing/)
    assert.doesNotMatch(said, /1\. akb raw create/)
  })

  it('runs one at a time, so a second ask is refused rather than started', () => {
    const first = openRun({ action: 'triage' }, 'sort it')
    assert.ok(!('error' in first))
    const second = openRun({ action: 'triage' }, 'sort it')
    assert.equal('error' in second ? second.error : '', 'triage is already being sorted')
  })

  it('asks the run to record every judgement through the two commands', () => {
    const ask = buildAsk({ action: 'triage' })
    assert.match(ask, /akb guide triage/)
    assert.match(ask, /triage archive/)
    assert.match(ask, /triage dismiss/)
    assert.match(ask, /no existing card, no open question, no build/)
  })
})

describe('a card written in one call', () => {
  it('writes the body with the card, so nothing is scheduled onto a scaffold', () => {
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, '\nWhat it does.\n\n## Todo\n- [ ] Build it.\n\n## Source\n- t3_abc\n')
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
    dismissSignal(id)
    assert.throws(() => quiet(() => cmdTriageDismiss(id, 'too small')), /nothing waiting in triage is/)
  })
})

describe('a card that was written and an item that was ignored (#561)', () => {
  it('records the card on the ignore and leaves it ignored', async () => {
    const id = await waiting('Ignored mid-run')
    dismissSignal(id)
    const { value, said } = quiet(() => cmdTriageArchive(id, 11))
    assert.equal(value.where, 'dismissed')
    assert.match(said, /it stays ignored/)
    assert.equal(fs.existsSync(archived()), false)
    assert.match(fs.readFileSync(path.join(dismissed(), fs.readdirSync(dismissed())[0]!), 'utf8'), /card_id: 11/)
    assert.equal(readAllDismissed().length, 1)
  })
})

describe('the reconciliation a run starts with', () => {
  it('archives an item an open card already names, so nothing is judged twice', async () => {
    const id = await waiting('Already carded')
    fs.writeFileSync(
      path.join(todo(), '4-already-carded.md'),
      `---\ntitle: Already carded\n---\n\nWords.\n\n## Source\n- ${id} — docs/kanban/triage/archived/x.md\n`,
    )
    assert.deepEqual(
      reconcileTriage().map((item) => [item.sourceId, item.cardId]),
      [[id, 4]],
    )
    assert.equal(readInbox().length, 0)
    assert.match(fs.readFileSync(path.join(archived(), fs.readdirSync(archived())[0]!), 'utf8'), /card_id: 4/)
    // And again: the second call finds nothing, because the first moved the file out.
    assert.deepEqual(reconcileTriage(), [])
  })

  it('leaves an item a card only mentions outside its ## Source', async () => {
    const id = await waiting('Only mentioned')
    fs.writeFileSync(
      path.join(todo(), '5-mentions.md'),
      `---\ntitle: Mentions it\n---\n\nSomebody said ${id} once.\n\n## Source\n- #12\n`,
    )
    assert.deepEqual(reconcileTriage(), [])
    assert.equal(readInbox().length, 1)
  })

  it('does not take a longer id for a shorter one', async () => {
    const long = await waiting('Longer')
    fs.writeFileSync(
      path.join(todo(), '6-prefix.md'),
      `---\ntitle: Prefix\n---\n\nWords.\n\n## Source\n- ${long.slice(0, 6)}\n`,
    )
    assert.deepEqual(reconcileTriage(), [])
    assert.equal(readInbox().length, 1)
  })
})
