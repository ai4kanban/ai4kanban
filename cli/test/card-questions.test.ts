// A question the board hands to the user always carries choices to tick, exclusive unless it
// says otherwise. `update-questions` is the only way one reaches a card, so it is where that
// shape is enforced — a bare line is refused rather than quietly written.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { cmdCreate, cmdUpdateQuestions } from '../src/commands/card.ts'
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
  it('refuses a question with no options', () => {
    assert.throws(() => cmdUpdateQuestions(['1', '--append', 'which region?']), /needs choices to tick/)
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
