// The pictures pasted into Add task and Build now (#517).
//
// The promise is four things. A picture is a file the board named, in a box only that name
// can reach. The run that starts takes the box as its own folder beside its log, so the log
// prune takes the pictures with it and nothing lands in git. The run is handed the FILES —
// in the words for a connector that opens a path, on the command line for one with a flag
// per file. And a sheet closed without sending leaves none behind.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { KEEP_LOGS, pruneLogs } from '../src/lib/agent/log.ts'
import {
  addRunPicture,
  claimRunPictures,
  dropRunPicture,
  emptyRunBox,
  pictureBox,
  returnRunPictures,
  runPictureFile,
} from '../src/lib/agent/pictures.ts'
import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { createImageAgents } from '../src/lib/agent/runner.ts'
import { openRun } from '../src/lib/agent/sessions.ts'
import { runAsk } from '../src/lib/agent/start.ts'
import { readStore } from '../src/lib/agent/store.ts'
import { setBoardRoot, SESSIONS_DIR } from '../src/lib/paths.ts'

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
  fs.writeFileSync(path.join(kanban, 'ui.config.json'), JSON.stringify({ harness }))
  setBoardRoot(root)
}

const paste = (box = BOX): string => {
  const saved = addRunPicture(box, new Uint8Array(PNG), 'image/png')
  assert.ok('name' in saved, 'error' in saved ? saved.error : '')
  return saved.name
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-run-images-'))
  config('claude-code')
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('a picture pasted into the create sheet', () => {
  it('is filed in its box under a name of the board’s own, holding the bytes that came in', () => {
    const name = paste()
    const file = runPictureFile(BOX, name)!
    assert.ok(file.startsWith(path.join(SESSIONS_DIR, `${BOX}.images`) + path.sep))
    assert.deepEqual(fs.readFileSync(file), PNG)
  })

  it('is another box’s business alone', () => {
    const name = paste()
    assert.equal(runPictureFile('33333333-3333-4333-8333-333333333333', name), null)
  })

  it('reaches nothing outside its own folder, whatever either name says', () => {
    assert.equal(runPictureFile(BOX, '../../../etc/passwd'), null)
    assert.equal(runPictureFile('../..', 'a.png'), null)
    assert.ok('error' in addRunPicture('../..', new Uint8Array(PNG), 'image/png'))
  })

  it('refuses what is not a picture rather than filing it under a made-up name', () => {
    const saved = addRunPicture(BOX, new Uint8Array(PNG), 'text/plain')
    assert.ok('error' in saved && /not a picture/.test(saved.error))
  })

  it('cannot be written into a folder a run already owns', () => {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
    fs.writeFileSync(path.join(SESSIONS_DIR, `${RUN}.log`), 'working')
    assert.ok('error' in addRunPicture(RUN, new Uint8Array(PNG), 'image/png'))
  })

  it('is not taken back out of a folder a run already owns', () => {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
    const name = paste()
    claimRunPictures(BOX, RUN, [name])
    fs.writeFileSync(path.join(SESSIONS_DIR, `${RUN}.log`), 'working')
    dropRunPicture(RUN, name)
    assert.ok(fs.existsSync(path.join(pictureBox(RUN), name)))
  })

  it('goes when it is taken back out, and when the sheet closes without sending', () => {
    const dropped = paste()
    const kept = paste()
    dropRunPicture(BOX, dropped)
    assert.equal(runPictureFile(BOX, dropped), null)
    assert.ok(runPictureFile(BOX, kept))
    emptyRunBox(BOX)
    assert.equal(runPictureFile(BOX, kept), null)
    assert.ok(!fs.existsSync(pictureBox(BOX)))
  })
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
    assert.ok(runPictureFile(BOX, name))
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

describe('what each mode says it can take', () => {
  it('answers for the agent that mode runs, and names the ones that can', () => {
    config('claude-code')
    assert.equal(createImageAgents().card.seesImages, true)
    assert.equal(createImageAgents().build.seesImages, true)
    config('grok')
    const { card, build } = createImageAgents()
    assert.equal(card.seesImages, false)
    assert.equal(build.seesImages, false)
    assert.deepEqual(card.imagesAble, ['Claude Code', 'Codex', 'Cursor', 'OpenCode'])
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
    assert.ok(runPictureFile(BOX, name))
  })
})
