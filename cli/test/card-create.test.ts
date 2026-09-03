// Creating a card and allocating its id are one operation. Invalid group paths and stale
// references stop before next-id moves, so the command cannot burn numbers or hide cards.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, afterEach, beforeEach, describe, it } from 'node:test'

import { RUN_ENV } from '../src/lib/agent/env.ts'
import { peekRun } from '../src/lib/agent/sessions.ts'
import { withStore } from '../src/lib/agent/store.ts'
import type { RunRecord } from '../src/lib/agent/types.ts'
import { buildBoardProgram } from '../src/lib/cli/board.ts'
import { runBoard } from '../src/lib/board-cli.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { move, refuses } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-card-create-'))
const kanban = path.join(root, 'docs', 'kanban')
const todo = path.join(kanban, 'todo')
const nextId = path.join(kanban, 'next-id')

beforeEach(() => {
  delete process.env[RUN_ENV]
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(path.join(todo, 'features'), { recursive: true })
  fs.mkdirSync(path.join(todo, 'recurring'), { recursive: true })
  fs.mkdirSync(path.join(todo, '7-group', 'features'), { recursive: true })
  fs.writeFileSync(nextId, '8\n')
  setBoardRoot(root)
})

afterEach(() => delete process.env[RUN_ENV])
after(() => fs.rmSync(root, { recursive: true, force: true }))

const unchanged = (): void => assert.equal(fs.readFileSync(nextId, 'utf8'), '8\n')

const create = (argv: string[]): Promise<Record<string, unknown>> => move(root, ['create', ...argv])

describe('card creation owns its id', () => {
  it('scaffolds the exact decision sections', async () => {
    const made = await create(['--title', 'A card', '--track', 'features'])
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

  it('scaffolds recurring state and process without an implicit cadence', async () => {
    const made = await create(['--title', 'A repeated job', '--track', 'recurring'])
    assert.ok(typeof made.file === 'string')
    const written = fs.readFileSync(path.join(root, made.file), 'utf8')
    assert.deepEqual(
      written.split('\n').filter((line) => /^(#{2,3}\s|<!-- agent -->)/.test(line)),
      ['## Run state', '## Process'],
    )
    assert.doesNotMatch(written, /^cadence:/m)
    assert.doesNotMatch(written, /^## (Scope|Todo|Decided by the agent)$/m)
  })

  it('writes a recurring cadence only when explicitly requested', async () => {
    const made = await create(['--title', 'A scheduled job', '--track', 'recurring', '--cadence', '1d at 09:30'])
    assert.ok(typeof made.file === 'string')
    const written = fs.readFileSync(path.join(root, made.file), 'utf8')
    assert.match(written, /^cadence: 1d at 09:30$/m)
  })

  it('requires a complete card instead of reserving an id', async () => {
    await refuses(root, ['create'], /required option .*--title/)
    await refuses(root, ['create', '--title', 'A card'], /required option .*--track/)
    await refuses(root, ['create', '--title', 'A card', '--track', 'features', '--count', '3'], /unknown option .*--count/)
    unchanged()
  })

  it('rejects a group folder path as the track', async () => {
    await refuses(
      root,
      ['create', '--title', 'Hidden card', '--track', '7-group/features'],
      /top-level track name, never a group folder path/,
    )
    unchanged()
  })

  it('rejects an allocated number that has no open card', async () => {
    await refuses(
      root,
      ['create', '--title', 'Dangling link', '--track', 'features', '--related', '7'],
      /#7, which is not an open card/,
    )
    unchanged()
  })

  it('puts the one-card and group rules in create help', () => {
    const program = buildBoardProgram({ program: 'akb raw', cwd: root, installHint: '`akb install`', version: null })
    const create = program.commands.find((c) => c.name() === 'create')
    assert.ok(create)
    const help = create.helpInformation()
    assert.match(help, /write exactly ONE card/i)
    assert.match(help, /top-level track name/)
    assert.match(help, /existing open cards/)
    assert.match(help, /Group task/)
    assert.doesNotMatch(help, /--count/)
  })

  it('attaches a card made through the CLI to its cardless create run', async () => {
    const owner: RunRecord = {
      sessionId: 'create-run',
      cardId: null,
      action: 'create',
      status: 'running',
      startedAt: Date.now(),
      harness: 'test',
      logPath: '/dev/null',
    }
    withStore((store) => store.runs.push(owner))
    process.env[RUN_ENV] = owner.sessionId

    assert.equal(
      await runBoard(['create', '--title', 'Owned card', '--track', 'features'], { cwd: root }),
      0,
    )
    assert.deepEqual(peekRun(owner.sessionId)?.createdCardIds, [8])
  })
})
