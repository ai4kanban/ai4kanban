// The pictures pasted into Add task and Start now (#517).
//
// The run that starts takes the box as its own folder beside its log, so the log prune takes
// the pictures with it and nothing lands in git. The run is handed the FILES — in the words
// for a connector that opens a path, on the command line for one with a flag per file.

import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { KEEP_LOGS, pruneLogs } from '../src/lib/agent/log.ts'
import { claimRunPictures, pictureBox, returnRunPictures } from '../src/lib/agent/pictures.ts'
import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { openRun } from '../src/lib/agent/sessions.ts'
import { runAsk } from '../src/lib/agent/start.ts'
import { readStore } from '../src/lib/agent/store.ts'
import { setBoardRoot, SESSIONS_DIR } from '../src/lib/paths.ts'
import { uiConfigOf } from './helpers/board.ts'

let root = ''

// One real PNG, one pixel of it — enough that what is written back is what went in.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const BOX = '11111111-1111-4111-8111-111111111111'
const RUN = '22222222-2222-4222-8222-222222222222'

const config = (harness: string): void => {
  const kanban = path.join(root, 'docs', 'kanban')
  fs.mkdirSync(kanban, { recursive: true })
  fs.writeFileSync(uiConfigOf(kanban), JSON.stringify({ harness }))
  setBoardRoot(root)
}

const paste = (box = BOX): string => {
  const name = `${randomUUID()}.png`
  fs.mkdirSync(pictureBox(box), { recursive: true })
  fs.writeFileSync(path.join(pictureBox(box), name), PNG)
  return name
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-run-images-'))
  config('claude-code')
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the box a run takes over', () => {
  it('is renamed after the run, and answers with the files in the order they went in', () => {
    const one = paste()
    const two = paste()
    const files = claimRunPictures(BOX, RUN, [one, two])
    assert.deepEqual(files, [
      path.join(pictureBox(RUN), one),
      path.join(pictureBox(RUN), two),
    ])
    assert.ok(!fs.existsSync(pictureBox(BOX)))
    assert.deepEqual(fs.readFileSync(files[0]!), PNG)
  })

  it('drops a name that is not one of the board’s', () => {
    const name = paste()
    assert.deepEqual(claimRunPictures(BOX, RUN, [name, '../../../etc/passwd']), [
      path.join(pictureBox(RUN), name),
    ])
  })

  it('is nothing at all for a run that was pasted into nothing', () => {
    assert.deepEqual(claimRunPictures(undefined, RUN, []), [])
    assert.deepEqual(claimRunPictures(BOX, RUN, []), [])
  })

  it('goes back to the box when the run is refused, so the sheet still draws them', () => {
    const name = paste()
    claimRunPictures(BOX, RUN, [name])
    returnRunPictures(RUN, BOX)
    assert.ok(fs.existsSync(path.join(pictureBox(BOX), name)))
    assert.ok(!fs.existsSync(pictureBox(RUN)))
  })
})

describe('what the run is told about them', () => {
  it('names each file for a connector that reads a path out of the words', () => {
    const prompt = buildPrompt({ action: 'create', description: 'fix this', pictures: ['/a.png', '/b.png'] })
    assert.match(prompt, /2 pictures came with this/)
    assert.ok(prompt.includes('/a.png') && prompt.includes('/b.png'))
  })

  it('says nothing for one whose CLI takes a flag per file — that is where they went', () => {
    config('codex')
    const prompt = buildPrompt({ action: 'create', description: 'fix this', pictures: ['/a.png'] })
    assert.doesNotMatch(prompt, /picture came|pictures came/)
  })

  it('says nothing at all for a run that carried none', () => {
    assert.doesNotMatch(buildPrompt({ action: 'create', description: 'fix this' }), /picture came|pictures came/)
  })
})

describe('the run that was handed them', () => {
  it('keeps their paths on its record, so its spawn and a restart can name them again', () => {
    const name = paste()
    const files = claimRunPictures(BOX, RUN, [name])
    const opened = openRun({ action: 'create', description: 'fix this', pictures: files }, 'go', [], RUN)
    assert.ok('run' in opened)
    assert.deepEqual(opened.run.pictures, files)
  })

  it('is handed no file the request named itself — only what its own box held', () => {
    const name = paste()
    assert.deepEqual(runAsk({ action: 'create', description: 'fix this', box: BOX, shots: [name] }, RUN).pictures, [
      path.join(pictureBox(RUN), name),
    ])
    // A browser sends the request, so a path in it is not a file this run may be told about.
    const named = runAsk({ action: 'create', description: 'fix this', pictures: ['/etc/passwd'] }, RUN)
    assert.equal(named.pictures, undefined)
    assert.doesNotMatch(buildPrompt(named), /etc\/passwd/)
  })

  it('keeps none when it was pasted into nothing', () => {
    const opened = openRun({ action: 'create', description: 'fix this' }, 'go', [], RUN)
    assert.ok('run' in opened)
    assert.equal(opened.run.pictures, undefined)
  })

  it('reads them back off the record, which is where its own spawn finds them', () => {
    const name = paste()
    const files = claimRunPictures(BOX, RUN, [name])
    openRun({ action: 'create', description: 'fix this', pictures: files }, 'go', [], RUN)
    assert.deepEqual(readStore().runs.find((r) => r.sessionId === RUN)?.pictures, files)
  })
})

describe('the log prune', () => {
  it('takes a run’s pictures with its log', () => {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
    const name = paste()
    claimRunPictures(BOX, RUN, [name])
    fs.writeFileSync(path.join(SESSIONS_DIR, `${RUN}.log`), 'old')
    // Enough newer runs to push this one past the ceiling.
    for (let i = 0; i <= KEEP_LOGS; i++) {
      fs.writeFileSync(path.join(SESSIONS_DIR, `newer-${i}.log`), 'newer')
    }
    pruneLogs()
    assert.ok(!fs.existsSync(path.join(SESSIONS_DIR, `${RUN}.log`)))
    assert.ok(!fs.existsSync(pictureBox(RUN)))
  })

  it('leaves a box that no run has taken over yet', () => {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
    const name = paste()
    pruneLogs()
    assert.ok(fs.existsSync(path.join(pictureBox(BOX), name)))
  })
})
