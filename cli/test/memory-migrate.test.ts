// Bringing an older board's memory over to who owns it (#805, #1484).
//
// Before this the same four files sat at the board root and again under every module. What
// is asked here: the board's planning files land in the planner's folder, a module's in the
// planner's folder for that module, a `## <module>` topic in a planner file moves into that
// module's folder, each module's `readme.md` lands in the board's own, nothing is
// overwritten, no module folder is left behind, and a second upgrade finds nothing to move.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { memoryTarget, migrateMemory } from '../src/lib/memory.ts'
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

  it('moves a module’s files into the planner’s folder for that module', () => {
    write(memory('cloud', 'decisions.md'), '# Decisions\n\n## sessions\n\n- One session per run.\n')

    migrateMemory()

    assert.equal(read(memory('agents', 'planner', 'cloud', 'decisions.md')), '# Decisions\n\n## sessions\n\n- One session per run.\n')
    assert.doesNotMatch(read(memory('agents', 'planner', 'decisions.md')), /cloud|sessions/)
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
    for (const line of ['Still here', 'Old → ✅ New']) assert.match(now, new RegExp(line))
    const skill = read(memory('agents', 'planner', 'skill', 'redesign.md'))
    assert.match(skill, /Module → ✅ Topic/)

    // A second upgrade finds nothing left at the old addresses and changes nothing.
    assert.deepEqual(migrateMemory(), [])
    assert.equal(read(memory('agents', 'planner', 'redesign.md')), now)
    assert.equal(read(memory('agents', 'planner', 'skill', 'redesign.md')), skill)
  })

  it('leaves a file holding only its starter behind, and takes the folder with it', () => {
    write(memory('local-ui', 'rejected.md'), '# Rejected\n\nIdeas we turned down, grouped by topic.\n')

    migrateMemory()

    assert.equal(fs.existsSync(memory('local-ui')), false)
    assert.equal(fs.existsSync(memory('agents', 'planner', 'local-ui')), false)
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

describe('a planner file with module topics', () => {
  const planner = (...parts: string[]): string => memory('agents', 'planner', ...parts)

  beforeEach(() => {
    write(path.join(board(), 'modules.md'), '- **skill** — the command\n- **cloud** — the service\n')
  })

  it('moves each `## <module>` topic into that module’s folder', () => {
    write(
      planner('decisions.md'),
      '# Decisions\n\nIntro.\n\n## Pricing\n\n- Free.\n\n## skill\n\n- Loose.\n\n### Runs\n\n- One run.\n\n## cloud\n\n- Hosted.\n',
    )
    write(planner('skill', 'decisions.md'), '# Decisions\n\nThis module.\n\n## Memory\n\n- Kept.\n')

    const moved = migrateMemory()

    assert.deepEqual(moved.sort(), [
      'docs/kanban/memory/agents/planner/decisions.md ## cloud',
      'docs/kanban/memory/agents/planner/decisions.md ## skill',
    ])
    assert.equal(read(planner('decisions.md')), '# Decisions\n\nIntro.\n\n## Pricing\n\n- Free.\n')
    // Loose entries go above the copy's topics; the topic's own headings come up a level, at the end.
    assert.equal(
      read(planner('skill', 'decisions.md')),
      '# Decisions\n\nThis module.\n\n- Loose.\n\n## Memory\n\n- Kept.\n\n## Runs\n\n- One run.\n',
    )
    // A module with no copy yet gets the starter first.
    assert.match(read(planner('cloud', 'decisions.md')), /^# Decisions\n[\s\S]*- Hosted\.\n$/)

    const after = [read(planner('decisions.md')), read(planner('skill', 'decisions.md'))]
    assert.deepEqual(migrateMemory(), [])
    assert.deepEqual([read(planner('decisions.md')), read(planner('skill', 'decisions.md'))], after)
  })

  it('keeps a topic no module is named after', () => {
    write(planner('rejected.md'), '# Rejected\n\n## local-ui\n\n- No.\n')

    assert.deepEqual(migrateMemory(), [])
    assert.match(read(planner('rejected.md')), /## local-ui/)
  })

  it('never takes a reserved name for a module', () => {
    write(path.join(board(), 'modules.md'), '- **decisions** — a module someone named\n')
    write(planner('redesign.md'), '# Redesign\n\n## decisions\n\n- ❌ A → ✅ B.\n')
    write(planner('rejected', 'old.md'), '- A split.\n')

    assert.deepEqual(migrateMemory(), [])
    assert.match(read(planner('redesign.md')), /## decisions/)
    assert.equal(fs.existsSync(planner('decisions')), false)
    assert.equal(read(planner('rejected', 'old.md')), '- A split.\n')
  })
})

describe('where a note goes', () => {
  it('names the module’s copy, made with its starter, and its topics', () => {
    write(path.join(board(), 'modules.md'), '- **skill** — the command\n')
    const target = memoryTarget('rejected.md', 'skill')
    assert.equal(target.file, memory('agents', 'planner', 'skill', 'rejected.md'))
    assert.match(read(target.file), /^# Rejected\n/)
    assert.deepEqual(target.topics, [])

    write(target.file, '# Rejected\n\n## Runs\n\n- No.\n')
    assert.deepEqual(memoryTarget('rejected.md', 'skill').topics, [{ name: 'Runs', entries: 1 }])
  })

  it('names the planner’s own for a card with no module, or a reserved one', () => {
    assert.equal(memoryTarget('decisions.md').file, memory('agents', 'planner', 'decisions.md'))
    assert.equal(memoryTarget('decisions.md', 'redesign').file, memory('agents', 'planner', 'decisions.md'))
    assert.equal(memoryTarget('readme.md', 'skill').file, memory('readme.md'))
  })
})
