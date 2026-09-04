// A board at a path other than docs/kanban (#407): which one a command resolves, what the
// hints it prints carry, which boards a project holds, and which flow text a board reads.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { isBoardDir, resolveBoard, useBoard } from '../src/lib/board-cli.ts'
import { listBoards } from '../src/lib/boards.ts'
import { findGuide } from '../src/lib/guide.ts'
import { BOARD_FLAG, KANBAN, REPO_ROOT, boardText, setBoardRoot } from '../src/lib/paths.ts'
import { solution } from '../src/lib/solution.ts'

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-board-path-')))
const product = path.join(root, 'docs', 'kanban')
const marketing = path.join(root, 'marketing', 'kanban')

const hint = '`akb install`'
const find = (cwd: string, opts: { board?: string | null; dir?: string | null } = {}) =>
  resolveBoard('list', { board: opts.board ?? null, dir: opts.dir ?? null, cwd, installHint: hint })

// A board is `todo/` and `config.md`. That is what an install writes, and the only test
// anything here makes.
function makeBoard(dir: string, solutionLine = ''): void {
  fs.mkdirSync(path.join(dir, 'todo'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'config.md'), `# Configuration\n\n${solutionLine}- **Project** — a project.\n`)
}

beforeEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
  fs.mkdirSync(path.join(root, '.git'), { recursive: true })
  makeBoard(product)
  makeBoard(marketing, '- **Solution** — marketing\n')
  delete process.env.AI4KANBAN_BOARD
  setBoardRoot(root)
})

after(() => {
  fs.rmSync(root, { recursive: true, force: true })
  delete process.env.AI4KANBAN_BOARD
})

describe('which board a command opens', () => {
  it('finds the project the walk up lands on, and its docs/kanban', () => {
    const found = find(path.join(root, 'docs'))
    assert.equal(found.root, root)
    assert.equal(found.board, product)
  })

  it('reaches a board a command is typed inside, under its own name', () => {
    const found = find(marketing)
    assert.equal(found.board, marketing)
    assert.equal(found.root, root)
  })

  it('reaches the board ABOVE a folder that merely sits beside one', () => {
    // `marketing/` holds no board of its own, and nothing guesses at the one under it.
    const found = find(path.join(root, 'marketing'))
    assert.equal(found.board, product)
  })

  it('takes --board against the working directory', () => {
    const found = find(root, { board: 'marketing/kanban' })
    assert.equal(found.board, marketing)
    assert.equal(found.root, root)
  })

  it('lets --board beat --dir, and both beat the walk', () => {
    const found = find(path.join(root, 'docs'), { board: marketing, dir: root })
    assert.equal(found.board, marketing)
  })

  it('takes AI4KANBAN_BOARD when no flag names one, and the flag beats it', () => {
    process.env.AI4KANBAN_BOARD = marketing
    assert.equal(find(root).board, marketing)
    assert.equal(find(root, { board: product }).board, product)
  })

  it('refuses a --board folder that is not a board', () => {
    assert.throws(() => find(root, { board: 'marketing' }), /is not a board/)
  })

  it('derives the project from the nearest .git above the board', () => {
    const bare = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-bare-')))
    makeBoard(path.join(bare, 'kanban'))
    try {
      assert.equal(find(root, { board: path.join(bare, 'kanban') }).root, bare)
    } finally {
      fs.rmSync(bare, { recursive: true, force: true })
    }
  })

  it('reads a folder as a board only when it has both todo/ and config.md', () => {
    assert.equal(isBoardDir(marketing), true)
    assert.equal(isBoardDir(path.join(root, 'marketing')), false)
  })
})

describe('what the board prints', () => {
  it('carries --board in every pasteable hint, and nothing on the default board', () => {
    useBoard(find(root), false)
    assert.equal(BOARD_FLAG, '')
    useBoard(find(root, { dir: root }), true)
    assert.equal(BOARD_FLAG, ` --dir ${root}`)
    useBoard(find(root, { board: marketing }), false)
    assert.equal(BOARD_FLAG, ` --board ${marketing}`)
    assert.equal(REPO_ROOT, root)
    assert.equal(KANBAN, marketing)
  })

  it('names the board in the hint whenever --board named it, docs/kanban included', () => {
    useBoard(find(root, { board: product }), false)
    assert.equal(BOARD_FLAG, ` --board ${product}`)
    assert.equal(REPO_ROOT, root)
  })

  it('keeps the project the walk found, rather than guessing it back from the board', () => {
    // No `.git` anywhere: `projectRootOf` would answer `<root>/docs`, and `.akb/` would move
    // with it. What `resolveBoard` already knows wins.
    fs.rmSync(path.join(root, '.git'), { recursive: true, force: true })
    useBoard(find(path.join(root, 'docs')), false)
    assert.equal(REPO_ROOT, root)
    assert.equal(KANBAN, product)
  })

  it("spells the board's real path in flow text in place of docs/kanban", () => {
    useBoard(find(root, { board: marketing }), false)
    assert.equal(boardText('write it in docs/kanban/memory/'), 'write it in marketing/kanban/memory/')
    useBoard(find(root), false)
    assert.equal(boardText('write it in docs/kanban/memory/'), 'write it in docs/kanban/memory/')
  })

  it('gives a board its solution flow text and inherits the rest', () => {
    useBoard(find(root, { board: marketing }), false)
    assert.equal(solution(), 'marketing')
    assert.match(findGuide('implement')!.text, /Write a settled topic/)
    assert.match(findGuide('reject')!.text, /^# /)

    useBoard(find(root), false)
    assert.equal(solution(), 'product')
    assert.match(findGuide('implement')!.text, /Implement a settled card/)
  })
})

describe('which boards a project holds', () => {
  it('lists every board two levels down, docs/kanban first, with what its work is called', () => {
    const boards = listBoards(root)
    assert.deepEqual(
      boards.map((b) => [b.path, b.work, b.short, b.solution]),
      [
        [product, 'Engineering', 'Eng', 'product'],
        [marketing, 'Marketing', 'Mktg', 'marketing'],
      ],
    )
  })

  it('skips dot-folders, node_modules, and anything deeper than two levels', () => {
    makeBoard(path.join(root, '.hidden', 'kanban'))
    makeBoard(path.join(root, 'node_modules', 'pkg'))
    makeBoard(path.join(root, 'a', 'b', 'kanban'))
    assert.deepEqual(listBoards(root).map((b) => b.path), [product, marketing])
  })
})
