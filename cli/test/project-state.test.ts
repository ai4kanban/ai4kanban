import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { runAgent } from '../src/lib/agent-cli.ts'
import { readChat } from '../src/lib/agent/chat.ts'
import { logPathOf, readRuns, withStore } from '../src/lib/agent/store.ts'
import { projectStateDir, legacyProjectStateDir, recordedBoard } from '../src/lib/machine/project.ts'
import { mockupsDir } from '../src/lib/mockups.ts'
import { CHATS_DIR, COMMENTS, MOCKUPS, SESSIONS, SESSIONS_DIR, setBoardDir, setBoardRoot, useProjectState } from '../src/lib/paths.ts'

let home = ''
let root = ''
const wasHome = process.env.AI4KANBAN_HOME

/** One finished run in the record, log and all — the record drops a finished run whose log
 *  has been pruned, so the two go in together. */
function record(sessionId: string): void {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  fs.writeFileSync(logPathOf(sessionId), 'a log\n')
  withStore((store) => {
    store.runs.push({
      sessionId,
      cardId: 1,
      action: 'refine',
      status: 'done',
      startedAt: 1,
      logPath: logPathOf(sessionId),
    } as never)
  })
}

/** A board is `todo/` and `config.md` — what an install writes, and the whole test. */
function makeBoard(dir: string): string {
  fs.mkdirSync(path.join(dir, 'todo'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'config.md'), '# Configuration\n\n- **Project** — a project.\n')
  return dir
}

/** What a board looked like before the move: the run record and its log, a conversation, a
 *  drawing and a comment batch, all inside the board folder. */
function oldState(board: string, sessionId: string): void {
  fs.writeFileSync(
    path.join(board, '.sessions.json'),
    JSON.stringify({ runs: [{ sessionId, action: 'refine', id: 1, startedAt: 1, status: 'done' }] }),
  )
  fs.mkdirSync(path.join(board, '.sessions'), { recursive: true })
  fs.writeFileSync(path.join(board, '.sessions', `${sessionId}.log`), 'what the agent said\n')
  fs.mkdirSync(path.join(board, '.chats'), { recursive: true })
  fs.writeFileSync(
    path.join(board, '.chats', 'board.json'),
    JSON.stringify({ harness: 'claude-code', messages: [{ role: 'you', text: 'where did my runs go' }] }),
  )
  fs.mkdirSync(path.join(board, '.mockups', '12'), { recursive: true })
  fs.writeFileSync(path.join(board, '.mockups', '12', 'a.tsx'), 'export default () => null\n')
  fs.mkdirSync(path.join(board, '.comments', '12'), { recursive: true })
  fs.writeFileSync(path.join(board, '.comments', '12', 'post.md'), '# Comments on the `post` draft\n')
}

/** Every file under a folder, by path relative to it, with what is in it. */
function contentsOf(dir: string): Record<string, string> {
  const found: Record<string, string> = {}
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    const at = path.join(entry.parentPath, entry.name)
    if (entry.isFile()) found[path.relative(dir, at)] = fs.readFileSync(at, 'utf8')
  }
  return found
}

/** A command line run for what it leaves on disk rather than for what it prints. */
async function quietly(argv: string[], cwd: string): Promise<void> {
  const said = { log: console.log, error: console.error }
  console.log = () => {}
  console.error = () => {}
  try {
    await runAgent(argv, { cwd })
  } finally {
    console.log = said.log
    console.error = said.error
  }
}

beforeEach(() => {
  home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-home-')))
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-project-')))
  process.env.AI4KANBAN_HOME = home
})

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true })
  fs.rmSync(root, { recursive: true, force: true })
  if (wasHome === undefined) delete process.env.AI4KANBAN_HOME
  else process.env.AI4KANBAN_HOME = wasHome
})

describe('which folder a board keeps its machine state in', () => {
  it('keeps state in the checkout under its board path', () => {
    const board = makeBoard(path.join(root, 'my-app', 'docs', 'kanban'))
    const dir = projectStateDir(board)
    assert.equal(dir, path.join(root, 'my-app/.akb/boards/docs/kanban'))
  })

  it('names a second board in a repository after the folder holding it', () => {
    const board = makeBoard(path.join(root, 'my-app', 'marketing', 'kanban'))
    assert.equal(projectStateDir(board, path.join(root, 'my-app')), path.join(root, 'my-app/.akb/boards/marketing/kanban'))
  })

  it('gives two checkouts of one name two folders', () => {
    const one = makeBoard(path.join(root, 'a', 'app', 'docs', 'kanban'))
    const two = makeBoard(path.join(root, 'b', 'app', 'docs', 'kanban'))
    assert.notEqual(projectStateDir(one), projectStateDir(two))
  })

  it('reads a symlinked path as the board it points at', () => {
    const board = makeBoard(path.join(root, 'app', 'docs', 'kanban'))
    fs.symlinkSync(path.join(root, 'app'), path.join(root, 'link'))
    assert.equal(projectStateDir(path.join(root, 'link', 'docs', 'kanban')), projectStateDir(board))
  })

  it('writes down which board the folder is for, so a moved project is findable', () => {
    const board = makeBoard(path.join(root, 'app', 'docs', 'kanban'))
    setBoardRoot(path.join(root, 'app'))
    useProjectState()
    assert.equal(recordedBoard(projectStateDir(board)), board)
  })
})

describe('what the project folder is left holding', () => {
  it('keeps state outside the tracked board content', () => {
    const project = path.join(root, 'app')
    const board = makeBoard(path.join(project, 'docs', 'kanban'))
    setBoardRoot(project)
    useProjectState()
    record('r1')

    const state = projectStateDir(board)
    assert.equal(SESSIONS, path.join(state, 'sessions.json'))
    assert.ok(fs.existsSync(SESSIONS))
    assert.ok(fs.existsSync(path.join(state, 'sessions', 'r1.log')))
    // The board folder has gained nothing but what an install put there.
    assert.deepEqual(fs.readdirSync(board).sort(), ['config.md', 'todo'])
  })

  it("never lets two boards see each other's runs", () => {
    const one = makeBoard(path.join(root, 'one', 'docs', 'kanban'))
    const two = makeBoard(path.join(root, 'two', 'docs', 'kanban'))

    setBoardRoot(path.join(root, 'one'))
    useProjectState()
    record('in-one')

    setBoardRoot(path.join(root, 'two'))
    useProjectState()
    assert.deepEqual(readRuns(), [])

    setBoardRoot(path.join(root, 'one'))
    assert.deepEqual(readRuns().map((r) => r.sessionId), ['in-one'])
    assert.notEqual(projectStateDir(one), projectStateDir(two))
  })

  it('reads and writes the new folder for runs, chats, drawings and comments alike', () => {
    const project = path.join(root, 'app')
    const board = makeBoard(path.join(project, 'docs', 'kanban'))
    setBoardDir(board, project)
    useProjectState()
    const state = projectStateDir(board)

    record('r1')
    fs.mkdirSync(path.join(mockupsDir(), '12'), { recursive: true })
    fs.writeFileSync(path.join(mockupsDir(), '12', 'a.tsx'), 'export default () => null\n')
    fs.mkdirSync(path.join(COMMENTS, '12'), { recursive: true })
    fs.writeFileSync(path.join(COMMENTS, '12', 'post.md'), '# Comments\n')

    assert.deepEqual(readRuns().map((r) => r.sessionId), ['r1'])
    assert.equal(fs.readFileSync(logPathOf('r1'), 'utf8'), 'a log\n')
    assert.equal(CHATS_DIR, path.join(state, 'chats'))
    assert.equal(MOCKUPS, path.join(state, 'mockups'))
    assert.ok(fs.existsSync(path.join(state, 'mockups', '12', 'a.tsx')))
    assert.ok(fs.existsSync(path.join(state, 'comments', '12', 'post.md')))
  })
})

describe('a board that held it all in docs/kanban', () => {
  it('starts from nothing rather than reading what is still there', () => {
    const project = path.join(root, 'app')
    const board = makeBoard(path.join(project, 'docs', 'kanban'))
    oldState(board, 'r1')

    setBoardRoot(project)
    useProjectState()

    assert.deepEqual(readRuns(), [])
    assert.equal(readChat(null), null)
    assert.equal(fs.existsSync(path.join(mockupsDir(), '12', 'a.tsx')), false)
    assert.equal(fs.existsSync(path.join(COMMENTS, '12', 'post.md')), false)
  })

  it('leaves every one of those files exactly where it was, unchanged', () => {
    const project = path.join(root, 'app')
    const board = makeBoard(path.join(project, 'docs', 'kanban'))
    oldState(board, 'r1')
    const before = contentsOf(board)

    setBoardRoot(project)
    useProjectState()
    record('new')

    assert.deepEqual(contentsOf(board), before)
    assert.deepEqual(fs.readdirSync(board).sort(), ['.chats', '.comments', '.mockups', '.sessions', '.sessions.json', 'config.md', 'todo'])
  })

  it('writes the new record beside the old one, and neither reads the other', () => {
    const project = path.join(root, 'app')
    const board = makeBoard(path.join(project, 'docs', 'kanban'))
    setBoardRoot(project)
    useProjectState()
    record('new')

    // The old files are put back — a copied project, or a checkout someone restored.
    oldState(board, 'old')
    useProjectState()

    assert.deepEqual(readRuns().map((r) => r.sessionId), ['new'])
    assert.equal(
      fs.readFileSync(path.join(board, '.sessions', 'old.log'), 'utf8'),
      'what the agent said\n',
    )
  })

  it('keeps history when the checkout is renamed', () => {
    const was = path.join(root, 'app')
    makeBoard(path.join(was, 'docs', 'kanban'))
    setBoardRoot(was)
    useProjectState()
    record('r1')
    const old = projectStateDir(path.join(was, 'docs', 'kanban'))

    fs.renameSync(was, path.join(root, 'renamed'))
    setBoardRoot(path.join(root, 'renamed'))
    const now = useProjectState()
    assert.notEqual(now, old)

    assert.equal(fs.readFileSync(readRuns()[0]!.logPath, 'utf8'), 'a log\n')
    // And the write a second run makes keeps it, rather than pruning it as a dead pointer.
    record('r2')
    assert.deepEqual(readRuns().map((r) => r.sessionId), ['r1', 'r2'])
  })

  it('leaves a board named outright alone the same way', () => {
    const board = makeBoard(path.join(root, 'app', 'marketing', 'kanban'))
    oldState(board, 'r1')

    setBoardDir(board, path.join(root, 'app'))
    useProjectState()

    assert.deepEqual(readRuns(), [])
    assert.ok(fs.existsSync(path.join(board, '.sessions.json')))
    assert.equal(CHATS_DIR, path.join(projectStateDir(board, path.join(root, 'app')), 'chats'))
    assert.equal(MOCKUPS, path.join(projectStateDir(board, path.join(root, 'app')), 'mockups'))
  })
})

describe('a command line typed in a folder nested inside another project', () => {
  it("writes nothing into the outer board, and moves and deletes nothing of its own", async () => {
    // What a real checkout looks like: a board with a run recorded in it the way one written
    // before the move holds it, and a working folder nested well below it.
    const outer = makeBoard(path.join(root, 'outer', 'docs', 'kanban'))
    oldState(outer, 'a-real-run')
    const before = contentsOf(outer)
    const nested = path.join(root, 'outer', '.akb', 'worktrees', '1', 'abcd')
    fs.mkdirSync(nested, { recursive: true })

    // The command names its own board rather than letting one be found: left to look, it
    // would climb out of the nested folder and open the outer one (#602).
    const project = path.join(root, 'fixture')
    makeBoard(path.join(project, 'docs', 'kanban'))
    await quietly(['--dir', project, '__watch', 'no-such-run'], nested)

    assert.deepEqual(contentsOf(outer), before)
    assert.equal(fs.existsSync(projectStateDir(outer)), false)
  })
})

 it('imports machine-home history once and preserves both copies', () => {
  const board = makeBoard(path.join(root, 'docs/kanban'))
  const old = legacyProjectStateDir(board)
  fs.mkdirSync(path.join(old, 'plans'), { recursive: true })
  fs.mkdirSync(path.join(old, 'sessions.lock'))
  fs.writeFileSync(path.join(old, 'plans/8-outcome.md'), '# Original\n')
  setBoardRoot(root)
  const local = useProjectState()
  assert.equal(fs.readFileSync(path.join(local, 'plans/8-outcome.md'), 'utf8'), '# Original\n')
  assert.equal(fs.existsSync(path.join(local, 'sessions.lock')), false)
  fs.writeFileSync(path.join(local, 'plans/8-outcome.md'), '# Revised\n')
  useProjectState()
  assert.equal(fs.readFileSync(path.join(local, 'plans/8-outcome.md'), 'utf8'), '# Revised\n')
  assert.equal(fs.readFileSync(path.join(old, 'plans/8-outcome.md'), 'utf8'), '# Original\n')
 })
