// What a card off the board for a week still holds in .akb (#1177): its assets, old mockups,
// chats and ended delivery worktrees go, except what memory or an open card points at.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { formatDay } from '../src/lib/cadence.ts'
import { pruneLeftovers } from '../src/lib/leftovers.ts'
import { AKB_DIR, ASSETS, CHATS_DIR, DELIVERIES, KANBAN, MEMORY, MOCKUPS, TODO, setBoardRoot } from '../src/lib/paths.ts'
import { nextWork } from '../src/lib/view/dispatch.ts'
import { forgetMachineState } from './helpers/board.ts'

const DAY = 24 * 60 * 60_000
let root = ''

const git = (args: string[], cwd = root): string => {
  const out = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (out.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${out.stderr}`)
  return out.stdout.trim()
}

const write = (file: string, text = 'x'): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}

const card = (title: string, extra = ''): string =>
  `---\ntitle: ${title}\npriority: med\nroi: med\nstatus: todo\nrelease: ""\nblocked_by: []\nrelated: []\nmodules: []\nquestions: []\n${extra}---\n\nBody.\n`

function archive(id: number, daysAgo: number): void {
  write(path.join(KANBAN, '.archive', `${id}-gone.md`), card(`Card ${id}`, `archived: ${formatDay(new Date(Date.now() - daysAgo * DAY))}\n`))
}

function age(p: string, daysAgo: number): void {
  const t = new Date(Date.now() - daysAgo * DAY)
  fs.utimesSync(p, t, t)
}

const asset = (id: number, name: string): string => path.join(ASSETS, String(id), name)

function delivery(id: string, cardId: number, status: string, worktree = `.akb/worktrees/${cardId}/${id}`): void {
  write(path.join(DELIVERIES, `${id}.json`), JSON.stringify({ deliveryId: id, cardId, status, worktree, branch: `card/${cardId}/${id}` }))
}

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-leftovers-')))
  write(path.join(root, 'code.txt'), 'base\n')
  git(['init', '--quiet', '-b', 'main'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'test'])
  git(['add', '-A'])
  git(['commit', '--quiet', '-m', 'start'])
  setBoardRoot(root)
  fs.mkdirSync(TODO, { recursive: true })
  fs.mkdirSync(MEMORY, { recursive: true })
})

afterEach(() => {
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('pruning what departed cards left', () => {
  it('keys the week off the archive day, or the leftover folder when there is no archive file', () => {
    archive(31, 8)
    archive(32, 6)
    write(asset(31, 'a.png'))
    write(asset(32, 'a.png'))
    write(asset(33, 'a.png'))
    age(path.join(ASSETS, '33'), 8)
    write(asset(34, 'a.png'))
    age(path.join(ASSETS, '34'), 6)
    write(path.join(MOCKUPS, '31', 'old.html'))
    write(path.join(KANBAN, '.mockups', '31', 'old.html'))

    pruneLeftovers()

    assert.equal(fs.existsSync(path.join(ASSETS, '31')), false)
    assert.equal(fs.existsSync(path.join(MOCKUPS, '31')), false)
    assert.equal(fs.existsSync(path.join(KANBAN, '.mockups', '31')), false)
    assert.equal(fs.existsSync(asset(32, 'a.png')), true)
    assert.equal(fs.existsSync(path.join(ASSETS, '33')), false)
    assert.equal(fs.existsSync(asset(34, 'a.png')), true)
  })

  it('never touches a card still on the board', () => {
    write(path.join(TODO, '40-open.md'), card('Open'))
    write(asset(40, 'a.png'))
    age(path.join(ASSETS, '40'), 30)

    pruneLeftovers()

    assert.equal(fs.existsSync(asset(40, 'a.png')), true)
  })

  it('keeps the asset files memory names, wildcards included, and removes the rest', () => {
    archive(35, 8)
    for (const f of ['keep.png', 'other.png', 'shots/a.png', 'shots/b.txt', 'x.png', 'y.png', 'z.png', 'v1.mp4', 'v3.mp4', 'deep/in/c.md']) write(asset(35, f))
    write(
      path.join(MEMORY, 'readme.md'),
      [
        '- see `assets/35/keep.png`.',
        '- shots: .akb/boards/docs/kanban/assets/35/shots/*.png',
        '- pair: .assets/35/{x,y}.png and assets/35/v<1|2>.mp4',
        '- folder: assets/35/deep',
      ].join('\n'),
    )

    pruneLeftovers()

    const left = ['keep.png', 'other.png', 'shots/a.png', 'shots/b.txt', 'x.png', 'y.png', 'z.png', 'v1.mp4', 'v3.mp4', 'deep/in/c.md'].filter((f) =>
      fs.existsSync(asset(35, f)),
    )
    assert.deepEqual(left, ['keep.png', 'shots/a.png', 'x.png', 'y.png', 'v1.mp4', 'deep/in/c.md'])
  })

  it('keeps a whole folder an open card names, and drops a folder emptied by the prune', () => {
    archive(36, 8)
    archive(37, 8)
    write(asset(36, 'a.png'))
    write(asset(36, 'sub/b.png'))
    write(asset(37, 'sub/b.png'))
    write(path.join(TODO, '41-open.md'), card('Open').replace('Body.', 'See `.assets/36/` and assets/37/nothing.png'))

    pruneLeftovers()

    assert.equal(fs.existsSync(asset(36, 'a.png')), true)
    assert.equal(fs.existsSync(asset(36, 'sub/b.png')), true)
    assert.equal(fs.existsSync(path.join(ASSETS, '37')), false)
  })

  it('removes a departed card chat, and leaves discussions alone', () => {
    archive(38, 8)
    write(path.join(CHATS_DIR, 'card-38.json'), '{}')
    write(path.join(CHATS_DIR, 'card-38.images', 'a.png'))
    write(path.join(CHATS_DIR, 'card-380.json'), '{}')
    write(path.join(CHATS_DIR, 'discussion-abc.json'), '{}')

    pruneLeftovers()

    assert.equal(fs.existsSync(path.join(CHATS_DIR, 'card-38.json')), false)
    assert.equal(fs.existsSync(path.join(CHATS_DIR, 'card-38.images')), false)
    assert.equal(fs.existsSync(path.join(CHATS_DIR, 'card-380.json')), true)
    assert.equal(fs.existsSync(path.join(CHATS_DIR, 'discussion-abc.json')), true)
  })
})

describe('pruning ended delivery worktrees', () => {
  const wt = (cardId: number, id: string) => path.join(AKB_DIR, 'worktrees', String(cardId), id)
  const addWorktree = (cardId: number, id: string) => git(['worktree', 'add', '--quiet', '-b', `card/${cardId}/${id}`, wt(cardId, id)])

  it('removes an ended delivery worktree, registered or not, and keeps its branch', () => {
    archive(21, 8)
    archive(22, 8)
    delivery('aaaa1111', 21, 'finished')
    delivery('bbbb2222', 22, 'cancelled')
    addWorktree(21, 'aaaa1111')
    addWorktree(22, 'bbbb2222')
    // git forgets 22's worktree, the way a moved checkout does, but the folder stays.
    fs.rmSync(path.join(root, '.git', 'worktrees', 'bbbb2222'), { recursive: true, force: true })

    const out = pruneLeftovers()

    assert.equal(fs.existsSync(path.join(AKB_DIR, 'worktrees', '21')), false)
    assert.equal(fs.existsSync(path.join(AKB_DIR, 'worktrees', '22')), false)
    assert.deepEqual(out.skipped, [])
    assert.match(git(['branch', '--list', 'card/21/*']), /card\/21\/aaaa1111/)
    assert.doesNotMatch(git(['worktree', 'list']), /bbbb2222|aaaa1111/)
  })

  it('keeps an active delivery, one holding uncommitted work, another board’s, and folders that are not cards', () => {
    archive(23, 8)
    archive(24, 8)
    archive(25, 8)
    delivery('cccc3333', 23, 'active')
    delivery('dddd4444', 24, 'finished')
    addWorktree(23, 'cccc3333')
    addWorktree(24, 'dddd4444')
    write(path.join(wt(24, 'dddd4444'), 'wip.txt'))
    // 25's worktree belongs to a delivery on another board, which this board holds no record of.
    addWorktree(25, 'eeee5555')
    write(path.join(AKB_DIR, 'worktrees', 'kanban-ui', 'node_modules', 'x'))
    age(path.join(AKB_DIR, 'worktrees', 'kanban-ui'), 30)

    const out = pruneLeftovers()

    assert.equal(fs.existsSync(wt(23, 'cccc3333')), true)
    assert.equal(fs.existsSync(path.join(wt(24, 'dddd4444'), 'wip.txt')), true)
    assert.equal(out.skipped.length, 1)
    assert.equal(fs.existsSync(wt(25, 'eeee5555')), true)
    assert.equal(fs.existsSync(path.join(AKB_DIR, 'worktrees', 'kanban-ui', 'node_modules', 'x')), true)
  })

  it('waits the week before removing an ended delivery worktree', () => {
    archive(26, 6)
    delivery('ffff6666', 26, 'finished')
    addWorktree(26, 'ffff6666')

    pruneLeftovers()

    assert.equal(fs.existsSync(wt(26, 'ffff6666')), true)
  })
})

describe('the prune on the dispatch tick', () => {
  it('runs once a day', async () => {
    archive(31, 8)
    write(asset(31, 'a.png'))

    await nextWork(() => Promise.resolve(true))
    assert.equal(fs.existsSync(path.join(ASSETS, '31')), false)

    write(asset(31, 'a.png'))
    await nextWork(() => Promise.resolve(true))
    assert.equal(fs.existsSync(asset(31, 'a.png')), true)
    assert.match(fs.readFileSync(path.join(KANBAN, 'ui.config.json'), 'utf8'), new RegExp(`"leftoverPrune"[^}]*${formatDay()}`))
  })
})
