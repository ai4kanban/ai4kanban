// Bringing an older board's memory over to who owns it (#805).
//
// Before this the same four files sat at the board root and again under every module. What
// is asked here: the three planning files land in the planner's folder whichever level they
// came from, a module's entries land under a `## <module>` topic, each module's `readme.md`
// lands in the board's own, nothing is overwritten, no module folder is left behind, and a
// second upgrade finds nothing to move.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { migrateMemory } from '../src/lib/memory.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

let root = ''

const board = (): string => path.join(root, 'docs', 'kanban')
const memory = (...parts: string[]): string => path.join(board(), 'memory', ...parts)

const write = (file: string, text: string): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}

const read = (file: string): string => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '')

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-memory-'))
  fs.mkdirSync(path.join(board(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(board(), 'next-id'), '1\n')
  setBoardRoot(root)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('an older board’s memory', () => {
  it('merges the board’s own three into the planner’s, keeping their topics', () => {
    write(memory('decisions.md'), '# Decisions\n\nKeep only user-facing calls.\n\n## skill\n\n- We chose A.\n')

    const moved = migrateMemory()

    assert.deepEqual(moved, ['docs/kanban/memory/decisions.md'])
    assert.equal(fs.existsSync(memory('decisions.md')), false)
    const now = read(memory('agents', 'planner', 'decisions.md'))
    assert.match(now, /## skill/)
    assert.match(now, /- We chose A\./)
    // The board's own explanation of the file is not carried over — the starter the
    // scaffold just wrote already has one, and a second copy is all the move would add.
    assert.equal(now.match(/Keep only/g)?.length, 1)
  })

  it('files a module’s entries under its own topic, a level down', () => {
    write(memory('cloud', 'decisions.md'), '# Decisions\n\n## sessions\n\n- One session per run.\n')

    migrateMemory()

    // Under the starter header the scaffold writes, which says what the file is for.
    const now = read(memory('agents', 'planner', 'decisions.md'))
    assert.match(now, /^# Decisions\n/)
    assert.ok(now.endsWith('## cloud\n\n### sessions\n\n- One session per run.\n'))
    assert.equal(fs.existsSync(memory('cloud')), false)
  })

  it('merges a module’s readme into the board’s own record', () => {
    write(memory('readme.md'), '# Shipped\n\n- ✅ The board exists.\n')
    write(memory('site', 'readme.md'), '# Shipped\n\n- ✅ The landing page is live.\n')

    migrateMemory()

    const now = read(memory('readme.md'))
    assert.match(now, /- ✅ The board exists\./)
    assert.match(now, /## site\n\n- ✅ The landing page is live\./)
  })

  it('merges rather than overwrites, and moves everything once', () => {
    write(memory('redesign.md'), '# Redesign\n\n- ❌ Old → ✅ New.\n')
    write(memory('agents', 'planner', 'redesign.md'), '# Redesign\n\n- ❌ Kept → ✅ Still here.\n')
    write(memory('skill', 'redesign.md'), '# Redesign\n\n- ❌ Module → ✅ Topic.\n')

    migrateMemory()

    const now = read(memory('agents', 'planner', 'redesign.md'))
    for (const line of ['Still here', 'Old → ✅ New', 'Module → ✅ Topic']) assert.match(now, new RegExp(line))

    // A second upgrade finds nothing left at the old addresses and changes nothing.
    assert.deepEqual(migrateMemory(), [])
    assert.equal(read(memory('agents', 'planner', 'redesign.md')), now)
  })

  it('leaves a file holding only its starter behind, and takes the folder with it', () => {
    write(memory('local-ui', 'rejected.md'), '# Rejected\n\nIdeas we turned down, grouped by topic.\n')

    migrateMemory()

    assert.equal(fs.existsSync(memory('local-ui')), false)
    // The starter the scaffold wrote, and nothing carried over on top of it.
    const now = read(memory('agents', 'planner', 'rejected.md'))
    assert.match(now, /^# Rejected\n/)
    assert.doesNotMatch(now, /^##\s/m)
  })

  it('never touches what an agent already keeps', () => {
    write(memory('agents', 'ui-designer', 'redesign.md'), '# What `ui-designer` was corrected on\n\n- One.\n')
    write(memory('decisions.md'), '# Decisions\n\n- We chose A.\n')

    migrateMemory()

    assert.equal(
      read(memory('agents', 'ui-designer', 'redesign.md')),
      '# What `ui-designer` was corrected on\n\n- One.\n',
    )
  })

  it('does nothing to a board that is already there', () => {
    write(memory('readme.md'), '# Shipped\n\n- ✅ One.\n')
    write(memory('agents', 'planner', 'decisions.md'), '# Decisions\n\n- We chose A.\n')

    assert.deepEqual(migrateMemory(), [])
  })
})
