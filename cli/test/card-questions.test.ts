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
import { move, refuses } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-card-questions-'))
const kanban = path.join(root, 'docs', 'kanban')
const todo = path.join(kanban, 'todo')

beforeEach(async () => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(path.join(todo, 'features'), { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '1\n')
  setBoardRoot(root)
  await move(root, ['create', '--title', 'A card', '--track', 'features'])
})

const questions = (argv: string[]): Promise<Record<string, unknown>> =>
  move(root, ['update-questions', '1', ...argv])

after(() => fs.rmSync(root, { recursive: true, force: true }))

const card = (): string =>
  fs.readFileSync(path.join(todo, 'features', fs.readdirSync(path.join(todo, 'features'))[0]!), 'utf8')

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
      ['create', '--title', 'Another card', '--track', 'features', '--question', '[user] Which region?'],
      /needs choices to tick/,
    )
  })

  it('keeps a plain untagged refinement question during create', async () => {
    await move(root, ['create', '--title', 'Another card', '--track', 'features', '--question', 'Which region?'])
    const written = fs.readFileSync(
      path.join(todo, 'features', fs.readdirSync(path.join(todo, 'features')).find((name) => name.startsWith('2-'))!),
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
