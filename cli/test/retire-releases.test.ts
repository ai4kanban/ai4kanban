// Releases are retired (#1671): the board repair deletes `releases.md` and every card's
// `release:` line, open or archived, and keeps `.release-summaries/` as the record.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, move } from './helpers/board.ts'

let root = ''
const kanban = (...parts: string[]): string => path.join(root, 'docs', 'kanban', ...parts)

const write = (rel: string, text: string): void => {
  fs.mkdirSync(path.dirname(kanban(rel)), { recursive: true })
  fs.writeFileSync(kanban(rel), text)
}

const card = (title: string, extra: string[] = []): string =>
  [
    '---',
    `title: ${title}`,
    'priority: high',
    'roi: med',
    'status: todo',
    'release: v1',
    'blocked_by: []',
    'related: []',
    'modules: [cloud]',
    ...extra,
    'questions: []',
    '---',
    '',
    'release: v1 stays in the body.',
    '',
  ].join('\n')

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-retire-releases-'))
  write('next-id', '20\n')
  write('config.md', '# Project\n')
  write('todo/README.md', '# Tasks\n\n## Tasks\n')
  write('releases.md', '# Releases\n\n- **v1** — the first one\n')
  write('todo/features/12-open.md', card('Open'))
  write('.archive/9-shipped.md', card('Shipped', ['archived: 2026-09-01']))
  write('.release-summaries/v1.md', '# v1\n\nWhat shipped.\n')
  setBoardRoot(root)
})

afterEach(() => {
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the board repair on a board that had releases', () => {
  it('deletes releases.md and every card’s release line, and keeps the summaries', async () => {
    await move(root, ['init'])

    assert.equal(fs.existsSync(kanban('releases.md')), false)
    assert.equal(fs.readFileSync(kanban('.release-summaries', 'v1.md'), 'utf8'), '# v1\n\nWhat shipped.\n')
    for (const [file, expected] of [
      [kanban('todo', 'features', '12-open.md'), card('Open')],
      [kanban('.archive', '9-shipped.md'), card('Shipped', ['archived: 2026-09-01'])],
    ]) {
      assert.equal(fs.readFileSync(file, 'utf8'), expected.replace('release: v1\n', ''), file)
    }
  })
})
