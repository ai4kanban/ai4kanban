// A board the Local Runner keeps at `<project>/.akb/kanban` (#2020): its project root with
// and without git, a build in a folder that is not a repository, and `--follow` reading the
// whole job.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { followRun } from '../src/commands/run.ts'
import { listDeliveries } from '../src/lib/agent/deliveries.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import { eventsPathOf, logPathOf, withStore } from '../src/lib/agent/store.ts'
import { resolveBoard } from '../src/lib/board-cli.ts'
import { projectStateDir, stateRootOf } from '../src/lib/machine/project.ts'
import { SESSIONS_DIR, setBoardDir } from '../src/lib/paths.ts'
import { move } from './helpers/board.ts'

let root = ''
const board = (): string => path.join(root, '.akb', 'kanban')

const find = (cwd: string, named: string) =>
  resolveBoard('list', { board: named, dir: null, cwd, installHint: '`akb install`' })

const CARD = [
  '---',
  'title: Say hello',
  'priority: med',
  'roi: med',
  'status: ready',
  'blocked_by: []',
  'related: []',
  'modules: []',
  'questions: []',
  '---',
  '',
  'Add hello.txt.',
  '',
  '## Worth noting',
  '- **Tiny**: one file.',
  '',
  '<!-- agent -->',
  '',
  '## Scope',
  '- **File**: hello.txt says hi.',
  '',
  '## Todo',
  '- [ ] Write hello.txt',
  '',
  '## Decided by the agent',
  '- **Name**: hello.txt.',
  '',
].join('\n')

// Printing is the command's business; these tests read what it returns.
async function quietly<T>(work: () => Promise<T>): Promise<T> {
  const was = { log: console.log, write: process.stdout.write }
  console.log = () => {}
  process.stdout.write = (() => true) as typeof process.stdout.write
  try {
    return await work()
  } finally {
    console.log = was.log
    process.stdout.write = was.write
  }
}

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-project-board-')))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('a board under .akb/', () => {
  it('belongs to the folder holding .akb/, with or without git', () => {
    fs.mkdirSync(path.join(board(), 'todo'), { recursive: true })
    fs.writeFileSync(path.join(board(), 'config.md'), '# Configuration\n')
    assert.equal(find(root, '.akb/kanban').root, root)
    assert.equal(stateRootOf(board()), root)
    assert.equal(projectStateDir(board()), path.join(root, '.akb', 'boards', '.akb', 'kanban'))
    fs.mkdirSync(path.join(root, '.git'))
    assert.equal(find(root, '.akb/kanban').root, root)
    assert.equal(stateRootOf(board()), root)
  })

  it('is set up in a plain folder without a nested .akb/.akb, writing nothing else there', async () => {
    await move(root, ['init', '--board', '.akb/kanban'])
    assert.ok(fs.existsSync(path.join(board(), 'todo')))
    assert.ok(fs.existsSync(path.join(root, '.akb', 'boards', '.akb', 'kanban')))
    assert.ok(!fs.existsSync(path.join(root, '.gitignore')))
    assert.ok(!fs.existsSync(path.join(root, '.akb', '.akb')))
    assert.ok(!fs.existsSync(path.join(root, '.akb', '.gitignore')))
  })

  it('leaves the repository’s .gitignore alone when git already ignores .akb/', async () => {
    spawnSync('git', ['init', '-q', root])
    fs.writeFileSync(path.join(root, '.git', 'info', 'exclude'), '.akb/\n')
    await move(root, ['init', '--board', '.akb/kanban'])
    assert.ok(fs.existsSync(path.join(board(), 'todo')))
    assert.ok(!fs.existsSync(path.join(root, '.gitignore')))
  })
})

describe('a build in a folder that is not a repository', () => {
  it('edits the folder, commits nothing, and archives the card', async () => {
    fs.mkdirSync(path.join(board(), 'todo'), { recursive: true })
    fs.writeFileSync(path.join(board(), 'config.md'), '# Configuration\n')
    fs.writeFileSync(path.join(board(), 'todo', '1-say-hello.md'), CARD)
    setBoardDir(board())
    const opened = openRun({ action: 'implement', id: 1, title: 'Say hello' }, 'prompt', [])
    if ('error' in opened) throw new Error(opened.error)
    const delivery = listDeliveries().find((d) => d.cardId === 1)!
    assert.equal(delivery.commitMode, 'manual')
    assert.equal(delivery.worktree, undefined)
    fs.writeFileSync(path.join(root, 'hello.txt'), 'hi\n')
    fs.writeFileSync(opened.run.logPath, 'built\n')
    await closeRun(opened.run.sessionId, { status: 'done', ok: true, code: 0 })

    assert.equal(listDeliveries().find((d) => d.cardId === 1)!.status, 'finished')
    assert.ok(fs.existsSync(path.join(board(), '.archive', '1-say-hello.md')))
    assert.ok(fs.existsSync(path.join(root, 'hello.txt')))
    assert.notEqual(spawnSync('git', ['rev-parse', '--git-dir'], { cwd: root }).status, 0)

    const followed = await quietly(() => followRun(opened.run.sessionId))
    assert.equal(followed.status, 'done')
    assert.equal(followed.failed, undefined)
    assert.deepEqual(followed.delivery, { id: delivery.deliveryId, status: 'finished', line: 'finished, nothing committed' })
  })
})

describe('--follow', () => {
  // Two sessions of one flow, written down the way a watcher leaves them: the first ended and
  // handed on, the second is the job's last word.
  function flow(second: 'done' | 'error'): string {
    fs.mkdirSync(path.join(board(), 'todo'), { recursive: true })
    fs.writeFileSync(path.join(board(), 'config.md'), '# Configuration\n')
    setBoardDir(board())
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
    const run = (sessionId: string, status: string, startedAt: number) => {
      fs.writeFileSync(logPathOf(sessionId), `${sessionId}\n`)
      return { sessionId, cardId: 1, action: 'clarify', status, startedAt, flowId: 'f1', logPath: logPathOf(sessionId) }
    }
    withStore((store) => {
      store.runs.push(run('first', 'done', 1) as never, run('second', second, 2) as never)
    })
    return 'first'
  }

  it('reads the outcome off the last session of the job', async () => {
    const failed = await quietly(() => followRun(flow('error')))
    assert.equal(failed.status, 'error')
    assert.equal(failed.lastSessionId, 'second')
    assert.match(String(failed.failed), /^run second ended error/)
  })

  it('says nothing failed when the last session finished', async () => {
    const done = await quietly(() => followRun(flow('done')))
    assert.equal(done.status, 'done')
    assert.equal(done.failed, undefined)
  })

  it('prints every session\'s whole event lines with --events, and none of the log', async () => {
    const first = flow('done')
    fs.writeFileSync(eventsPathOf('first'), '{"kind":"message","data":{"text":"a"}}\n{"kind":"log"')
    fs.writeFileSync(eventsPathOf('second'), '{"kind":"plan","data":{"entries":[]}}\n')
    const printed: string[] = []
    const done = await quietly(async () => {
      process.stdout.write = ((chunk: string) => printed.push(chunk) > 0) as typeof process.stdout.write
      return followRun(first, '', 'akb', true)
    })
    assert.equal(done.status, 'done')
    assert.deepEqual(printed, ['{"kind":"message","data":{"text":"a"}}\n', '{"kind":"plan","data":{"entries":[]}}\n'])
  })
})
