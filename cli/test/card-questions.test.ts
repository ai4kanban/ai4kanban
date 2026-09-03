// A question an agent hands to the user always carries choices to tick, exclusive unless it
// says otherwise. `update-questions` is that handoff, so it enforces the shape rather than
// quietly writing a bare line.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { cmdCreate, cmdUpdateQuestions } from '../src/commands/card.ts'
import { findMove, moveHelp } from '../src/lib/help.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-card-questions-'))
const kanban = path.join(root, 'docs', 'kanban')
const todo = path.join(kanban, 'todo')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(path.join(todo, 'features'), { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '1\n')
  setBoardRoot(root)
  cmdCreate(['--title', 'A card', '--track', 'features'])
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

const card = (): string =>
  fs.readFileSync(path.join(todo, 'features', fs.readdirSync(path.join(todo, 'features'))[0]!), 'utf8')

describe('a question handed to the user carries choices', () => {
  it('shows the operations and points to the canonical format guide', () => {
    const move = findMove('update-questions')
    assert.ok(move)
    const help = moveHelp(move, 'akb board')
    assert.match(help, /--append <question> --recommended-option <choice> --option <choice>/)
    assert.match(help, /--update <n> <question> --recommended-option <choice> --option <choice>/)
    assert.match(help, /--drop <n\[,n\.\.\.\]>/)
    assert.match(help, /--to-verify <n\[,n\.\.\.\]>/)
    assert.match(help, /--clear/)
    assert.match(help, /akb guide update-questions/)
    assert.doesNotMatch(help, /Which retry behavior should apply\?|behavior — outcome and cost/)
    assert.equal(findMove('review-verdict'), null)
  })

  it('refuses a question with no options', () => {
    assert.throws(() => cmdUpdateQuestions(['1', '--append', 'which region?']), /needs choices to tick/)
  })

  it('refuses a bare user question during create', () => {
    assert.throws(
      () => cmdCreate(['--title', 'Another card', '--track', 'features', '--question', '[user] Which region?']),
      /needs choices to tick/,
    )
  })

  it('keeps a plain untagged refinement question during create', () => {
    cmdCreate(['--title', 'Another card', '--track', 'features', '--question', 'Which region?'])
    const written = fs.readFileSync(
      path.join(todo, 'features', fs.readdirSync(path.join(todo, 'features')).find((name) => name.startsWith('2-'))!),
      'utf8',
    )
    assert.match(written, /questions:\n  - Which region\?/)
  })

  it('refuses a question with only one option', () => {
    assert.throws(
      () => cmdUpdateQuestions(['1', '--append', 'which region?', '--option', 'eu-central-1 — nearest']),
      /needs at least 2/,
    )
  })

  it('writes an exclusive question unless told otherwise', () => {
    cmdUpdateQuestions([
      '1',
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

  it('takes --mode multi when the picks may be combined', () => {
    cmdUpdateQuestions([
      '1',
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

  it('refuses two recommendations on an exclusive question', () => {
    assert.throws(
      () =>
        cmdUpdateQuestions([
          '1',
          '--append',
          'which region?',
          '--recommended-option',
          'a — why',
          '--recommended-option',
          'b — why',
        ]),
      /at most one --recommended-option/,
    )
  })

  it('leaves the ops that only remove questions alone', () => {
    cmdUpdateQuestions(['1', '--append', 'Which region?', '--option', 'a — why', '--option', 'b — why'])
    cmdUpdateQuestions(['1', '--to-verify', '1'])
    assert.match(card(), /verify:\n {2}- Which region\?/)
    cmdUpdateQuestions(['1', '--clear'])
    assert.match(card(), /questions: \[\]/)
  })
})
