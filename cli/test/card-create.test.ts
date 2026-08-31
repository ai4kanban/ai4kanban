// Creating a card and allocating its id are one operation. Invalid group paths and stale
// references stop before next-id moves, so the command cannot burn numbers or hide cards.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { cmdCreate } from '../src/commands/card.ts'
import { findMove, moveHelp } from '../src/lib/help.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-card-create-'))
const kanban = path.join(root, 'docs', 'kanban')
const todo = path.join(kanban, 'todo')
const nextId = path.join(kanban, 'next-id')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(path.join(todo, 'features'), { recursive: true })
  fs.mkdirSync(path.join(todo, 'recurring'), { recursive: true })
  fs.mkdirSync(path.join(todo, '7-group', 'features'), { recursive: true })
  fs.writeFileSync(nextId, '8\n')
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

const unchanged = (): void => assert.equal(fs.readFileSync(nextId, 'utf8'), '8\n')

describe('card creation owns its id', () => {
  it('scaffolds the exact decision sections', () => {
    const made = cmdCreate(['--title', 'A card', '--track', 'features'])
    assert.ok(typeof made.file === 'string')
    const written = fs.readFileSync(path.join(root, made.file), 'utf8')
    assert.deepEqual(
      written.split('\n').filter((line) => /^(#{2,3}\s|<!-- agent -->)/.test(line)),
      [
        '## Worth noting',
        '<!-- agent -->',
        '## Scope',
        '## Todo',
        '## Decided by the agent',
        '### Overruled by the user',
      ],
    )
  })

  it('scaffolds recurring state and process without an implicit cadence', () => {
    const made = cmdCreate(['--title', 'A repeated job', '--track', 'recurring'])
    assert.ok(typeof made.file === 'string')
    const written = fs.readFileSync(path.join(root, made.file), 'utf8')
    assert.deepEqual(
      written.split('\n').filter((line) => /^(#{2,3}\s|<!-- agent -->)/.test(line)),
      ['## Run state', '## Process'],
    )
    assert.doesNotMatch(written, /^cadence:/m)
    assert.doesNotMatch(written, /^## (Scope|Todo|Decided by the agent)$/m)
  })

  it('writes a recurring cadence only when explicitly requested', () => {
    const made = cmdCreate([
      '--title',
      'A scheduled job',
      '--track',
      'recurring',
      '--cadence',
      '1d at 09:30',
    ])
    assert.ok(typeof made.file === 'string')
    const written = fs.readFileSync(path.join(root, made.file), 'utf8')
    assert.match(written, /^cadence: 1d at 09:30$/m)
  })

  it('requires a complete card instead of reserving an id', () => {
    assert.throws(() => cmdCreate([]), /create writes exactly one card/)
    assert.throws(() => cmdCreate(['--count', '3']), /unknown option "--count"/)
    unchanged()
  })

  it('rejects a group folder path as the track', () => {
    assert.throws(
      () => cmdCreate(['--title', 'Hidden card', '--track', '7-group/features']),
      /top-level track name, never a group folder path/,
    )
    unchanged()
  })

  it('rejects an allocated number that has no open card', () => {
    assert.throws(
      () => cmdCreate(['--title', 'Dangling link', '--track', 'features', '--related', '7']),
      /#7, which is not an open card/,
    )
    unchanged()
  })

  it('puts the one-card and group rules in create help', () => {
    const move = findMove('create')
    assert.ok(move)
    const help = moveHelp(move, 'akb board')
    assert.match(help, /write exactly ONE card/)
    assert.match(help, /top-level track name/)
    assert.match(help, /existing open cards/)
    assert.match(help, /Group task/)
    assert.doesNotMatch(help, /--count/)
  })
})
