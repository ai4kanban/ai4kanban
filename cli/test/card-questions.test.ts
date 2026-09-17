// A question an agent hands to the user always carries choices to tick, exclusive unless it
// says otherwise. `update-questions` is that handoff, so it enforces the shape rather than
// quietly writing a bare line.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { buildBoardProgram } from '../src/lib/cli/board.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, move, refuses } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-card-questions-'))
const kanban = path.join(root, 'docs', 'kanban')
const todo = path.join(kanban, 'todo')

beforeEach(async () => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(todo, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '1\n')
  setBoardRoot(root)
  await move(root, ['create', '--title', 'A card'])
})

const questions = (argv: string[]): Promise<Record<string, unknown>> =>
  move(root, ['update-questions', '1', ...argv])

after(() => fs.rmSync(root, { recursive: true, force: true }))

const card = (): string =>
  fs.readFileSync(path.join(todo, fs.readdirSync(todo).find((f) => f.endsWith('.md'))!), 'utf8')

describe('a question handed to the user carries choices', () => {
  it('shows the operations and points to the canonical format guide', () => {
    const program = buildBoardProgram({ program: 'akb raw', cwd: root, installHint: '`akb install`', version: null })
    const declared = program.commands.find((c) => c.name() === 'update-questions')
    assert.ok(declared)
    const help = declared.helpInformation()
    assert.match(help, /--append <text>/)
    assert.match(help, /--update <n> <text\.\.\.>/)
    assert.match(help, /--recommended-option <text>/)
    assert.match(help, /--drop <positions>/)
    assert.match(help, /--to-verify <positions>/)
    assert.match(help, /--clear/)
    assert.match(help, /akb guide update-questions/)
    assert.equal(
      program.commands.find((c) => c.name() === 'review-verdict'),
      undefined,
    )
  })

  it('refuses a question with no options', async () => {
    await refuses(root, ['update-questions', '1', '--append', 'which region?'], /needs choices to tick/)
  })

  it('refuses a bare user question during create', async () => {
    await refuses(
      root,
      ['create', '--title', 'Another card', '--question', '[user] Which region?'],
      /needs choices to tick/,
    )
  })

  it('keeps a plain untagged refinement question during create', async () => {
    await move(root, ['create', '--title', 'Another card', '--question', 'Which region?'])
    const written = fs.readFileSync(
      path.join(todo, fs.readdirSync(todo).find((name) => name.startsWith('2-'))!),
      'utf8',
    )
    assert.match(written, /questions:\n  - Which region\?/)
  })

  it('refuses a question with only one option', async () => {
    await refuses(
      root,
      ['update-questions', '1', '--append', 'which region?', '--option', 'eu-central-1 — nearest'],
      /needs at least 2/,
    )
  })

  it('writes an exclusive question unless told otherwise', async () => {
    await questions([
      '--append',
      '[user] Which region?',
      '--recommended-option',
      'eu-central-1 — nearest to the users',
      '--option',
      'us-east-1 — cheapest',
    ])
    const written = card()
    assert.match(written, /- question: "\[user\] Which region\?"/)
    assert.match(written, /mode: single/)
    assert.match(written, /- eu-central-1 — nearest to the users/)
    assert.match(written, /recommend: \[1\]/)
  })

  it('takes --mode multi when the picks may be combined', async () => {
    await questions([
      '--append',
      '[user] Which regions?',
      '--mode',
      'multi',
      '--recommended-option',
      'eu-central-1 — nearest to the users',
      '--recommended-option',
      'us-east-1 — cheapest',
    ])
    const written = card()
    assert.match(written, /mode: multi/)
    assert.match(written, /recommend: \[1, ?2\]/)
  })

  it('refuses two recommendations on an exclusive question', async () => {
    await refuses(
      root,
      ['update-questions', '1', '--append', 'which region?', '--recommended-option', 'a — why', '--recommended-option', 'b — why'],
      /at most one --recommended-option/,
    )
  })

  it('leaves the ops that only remove questions alone', async () => {
    await questions(['--append', 'Which region?', '--option', 'a — why', '--option', 'b — why'])
    await questions(['--to-verify', '1'])
    assert.match(card(), /verify:\n {2}- Which region\?/)
    await questions(['--clear'])
    assert.match(card(), /questions: \[\]/)
  })
})

describe('a question the user skipped', () => {
  const user = ['--append', '[user] Which region?', '--recommended-option', 'a — why', '--option', 'b — why']

  it('stays on the card as a record, keeps its recommendation unpicked, and counts as not open', async () => {
    await questions(user)
    const res = await questions(['--skip', '1'])
    assert.equal(res.open, 0)
    assert.match(card(), /- question: "?\[user\] Which region\?"?\n    mode: single\n    options:\n      - a — why\n      - b — why\n    recommend: \[1\]\n    skipped: true/)
    assert.doesNotMatch(card(), /^decided:/m)
    await move(root, ['update', '1', '--status', 'ready'])
    assert.match(card(), /status: ready/)
  })

  it('refuses rewriting, dropping or moving it until it is reopened', async () => {
    await questions(user)
    await questions(['--skip', '1'])
    await refuses(root, ['update-questions', '1', '--drop', '1'], /--unskip 1/)
    await refuses(root, ['update-questions', '1', '--to-verify', '1'], /--unskip 1/)
    await refuses(root, ['update-questions', '1', '--update', '1', '[user] Other?', '--option', 'a', '--option', 'b'], /--unskip 1/)
    await questions(['--clear'])
    assert.match(card(), /skipped: true/)
    await questions(['--unskip', '1'])
    assert.doesNotMatch(card(), /skipped/)
    await questions(['--drop', '1'])
    assert.match(card(), /questions: \[\]/)
  })

  it('is the user\'s call alone: a run cannot skip or reopen one', async () => {
    await questions(user)
    process.env.KANBAN_RUN = 'a-run'
    try {
      await refuses(root, ['update-questions', '1', '--skip', '1'], /only the user skips/)
    } finally {
      delete process.env.KANBAN_RUN
    }
    await questions(['--skip', '1'])
    const again = await questions(['--skip', '1'])
    assert.equal(again.open, 0)
  })

  it('takes only the user\'s own questions, and sends a ready card back once reopened', async () => {
    await questions(['--append', 'Which region?', '--option', 'a — why', '--option', 'b — why'])
    await refuses(root, ['update-questions', '1', '--skip', '1'], /not a \[user\] question/)
    await questions(['--drop', '1', ...user, '--skip', '1'])
    await move(root, ['update', '1', '--status', 'ready'])
    await questions(['--unskip', '1'])
    assert.match(card(), /status: todo/)
  })
})
