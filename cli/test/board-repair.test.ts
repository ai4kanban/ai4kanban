// The repair steps `akb update` runs on a board an older version wrote.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { dropRecordFile } from '../src/commands/install.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-repair-'))
const board = path.join(root, 'docs', 'kanban')

after(() => fs.rmSync(root, { recursive: true, force: true }))

beforeEach(() => {
  fs.rmSync(board, { recursive: true, force: true })
  fs.mkdirSync(board, { recursive: true })
})

describe('a board left holding record.csv', () => {
  it('deletes it and says so', () => {
    const file = path.join(board, 'record.csv')
    fs.writeFileSync(file, 'date,event,card,detail\n2026-04-02,card-created,12,asked\n')

    const line = dropRecordFile(board)

    assert.equal(fs.existsSync(file), false)
    assert.match(String(line), /record\.csv/)
  })

  it('says nothing when the board has none', () => {
    assert.equal(dropRecordFile(board), null)
  })

  it('leaves metrics.csv alone — the daily chart still reads it', () => {
    const metrics = path.join(board, 'metrics.csv')
    fs.writeFileSync(metrics, 'date,completed,created,rejected\n2026-04-02,1,0,0\n')

    dropRecordFile(board)

    assert.equal(fs.existsSync(metrics), true)
  })
})
