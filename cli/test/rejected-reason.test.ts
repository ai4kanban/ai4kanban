// The reason a card was rejected with, kept on the archived card (#1379).
//
// Three ways it arrives — `--reason`, the reject run's own record, and the quoted word a
// printed flow's closing command carries — and one way it is read: off the archived card.

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { RUN_ENV } from '../src/lib/agent/env.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { logPathOf, withStore } from '../src/lib/agent/store.ts'
import type { RunRecord } from '../src/lib/agent/types.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import { validateSpec } from '../src/lib/spec-contract.ts'
import { readArchive, readArchivedCard } from '../src/lib/view/archive.ts'
import { forgetMachineState, move } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-rejected-reason-'))
const kanban = path.join(root, 'docs', 'kanban')
const todo = path.join(kanban, 'todo')
const archive = path.join(kanban, '.archive')

const WHY = 'Insights already covers this: "counting".\nAn export is one more thing to keep — it\'s not worth it.'

beforeEach(() => {
  delete process.env[RUN_ENV]
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(todo, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '90\n')
  setBoardRoot(root)
})

after(() => {
  delete process.env[RUN_ENV]
  fs.rmSync(root, { recursive: true, force: true })
})

const cardText = (id: number, body: string): string =>
  ['---', `title: Card ${id}`, 'priority: low', 'roi: low', 'status: todo', 'release: ""', 'blocked_by: []', 'related: []', 'modules: []', 'questions: []', '---', '', body, ''].join('\n')

function card(id: number): void {
  fs.writeFileSync(path.join(todo, `${id}-an-idea.md`), cardText(id, 'One idea.'))
}

function group(id: number, subIds: number[]): void {
  const dir = path.join(todo, `${id}-a-group`)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'root.md'), cardText(id, `The whole job.\n\n## Todo\n${subIds.map((s) => `- [ ] A piece #${s}`).join('\n')}`))
  for (const sub of subIds) fs.writeFileSync(path.join(dir, `${sub}-a-part.md`), cardText(sub, 'One piece.'))
}

/** A live reject run on `cardId`, and this process inside it. */
function insideRejectRun(cardId: number, input: string | undefined): void {
  const run = {
    sessionId: 'reject-run',
    cardId,
    action: 'reject',
    status: 'running',
    startedAt: Date.now(),
    pid: process.pid,
    harness: 'test',
    logPath: logPathOf('reject-run'),
    ...(input ? { input } : {}),
  } as RunRecord
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  fs.writeFileSync(run.logPath, '')
  withStore((store) => store.runs.push(run))
  process.env[RUN_ENV] = run.sessionId
}

describe('raw reject --reason', () => {
  it('keeps a multi-line reason with quotes and colons, word for word', async () => {
    card(80)
    await move(root, ['reject', '80', '--reason', WHY])
    const file = path.join(archive, '80-an-idea.md')
    const text = fs.readFileSync(file, 'utf8')
    assert.match(text, /^rejected_reason: /m)
    // Validation knows the field on a rejected card, and refuses it anywhere else.
    const flagged = (t: string) => validateSpec(file, t).filter((e) => e.rule === 'rejected_reason' || e.rule === 'frontmatter')
    assert.deepEqual(flagged(text), [])
    assert.equal(flagged(text.replace('rejected: true\n', '')).length, 1)
    assert.equal(readArchivedCard(80)?.rejectedReason, WHY)
    // The list carries no reason — only the opened card does.
    assert.equal('rejectedReason' in readArchive().cards[0]!, false)
  })

  it('writes no field on a discard with no reason', async () => {
    card(80)
    await move(root, ['reject', '80', '--discard'])
    assert.doesNotMatch(fs.readFileSync(path.join(archive, '80-an-idea.md'), 'utf8'), /rejected_reason/)
    const read = readArchivedCard(80)!
    assert.equal(read.rejected, true)
    assert.equal('rejectedReason' in read, false)
  })

  it('keeps the reason a discard was given', async () => {
    card(80)
    await move(root, ['reject', '80', '--discard', '--reason', 'a duplicate of #12'])
    assert.equal(readArchivedCard(80)?.rejectedReason, 'a duplicate of #12')
  })

  it('stamps every subtask a group takes with it', async () => {
    group(80, [81, 82])
    await move(root, ['reject', '80', '--reason', WHY])
    for (const id of [80, 81, 82]) assert.equal(readArchivedCard(id)?.rejectedReason, WHY)
  })

  it('leaves a finished card without one', async () => {
    card(80)
    await move(root, ['archive', '80'])
    assert.equal('rejectedReason' in readArchivedCard(80)!, false)
  })
})

describe('raw reject inside a reject run', () => {
  it('takes the reason the run was started with', async () => {
    card(80)
    insideRejectRun(80, WHY)
    await move(root, ['reject', '80'])
    assert.equal(readArchivedCard(80)?.rejectedReason, WHY)
  })

  it('lets --reason win over the run', async () => {
    card(80)
    insideRejectRun(80, WHY)
    await move(root, ['reject', '80', '--reason', 'said here'])
    assert.equal(readArchivedCard(80)?.rejectedReason, 'said here')
  })

  it("does not borrow another card's reason", async () => {
    card(80)
    card(81)
    insideRejectRun(80, WHY)
    await move(root, ['reject', '81'])
    assert.equal('rejectedReason' in readArchivedCard(81)!, false)
  })
})

describe('the printed reject flow', () => {
  function closing(reason: string, discard = false): string {
    startCollecting()
    try {
      const flow = printFlow({ action: 'reject', id: 80, title: 'Card 80', reason, ...(discard ? { discard: true } : {}) })
      return (flow.close as string[]).find((line) => / raw reject 80/.test(line))!
    } finally {
      stopCollecting()
    }
  }

  /** The reason as a shell reads it off the printed command. */
  function typed(line: string): string {
    assert.doesNotMatch(line, /\n/)
    const word = line.slice(line.indexOf('--reason ') + '--reason '.length, line.indexOf(' — this files'))
    return execFileSync('bash', ['-c', `printf '%s' ${word}`], { encoding: 'utf8' })
  }

  for (const [name, reason] of [
    ['multi-line, with quotes', WHY],
    ['one line, with quotes', `it's "done" already: $HOME \`x\` \\n`],
    ['a backslash across lines', 'C:\\new\\table\nit\'s fine'],
  ] as const) {
    it(`carries the reason so it reads back unchanged — ${name}`, async () => {
      card(80)
      const reasonRead = typed(closing(reason))
      assert.equal(reasonRead, reason)
      await move(root, ['reject', '80', '--reason', reasonRead])
      assert.equal(readArchivedCard(80)?.rejectedReason, reason)
    })
  }

  it('carries it on a discard too, and nothing when there is none', () => {
    card(80)
    assert.match(closing('just clearing', true), /raw reject 80 --discard --reason 'just clearing' — /)
    assert.match(closing('', true), /raw reject 80 --discard — /)
  })
})
