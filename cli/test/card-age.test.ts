// How long a card has sat, and the listing that reports it (#117).
//
// Age is read from git, so the board here is a real repository with real commits, dated by
// hand — nothing else can pin "100 days ago" down.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { cmdList } from '../src/commands/list.ts'
import { move, forgetMachineState } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-card-age-'))
const kanban = path.join(root, 'docs', 'kanban')
const todo = path.join(kanban, 'todo')

const git = (args: string[], env: NodeJS.ProcessEnv = {}): void => {
  const out = spawnSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } })
  if (out.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${out.stderr}`)
}

const DAY = 24 * 60 * 60 * 1000

interface Fields {
  status?: string
  blocked_by?: number[]
  questions?: string[]
}

function card(title: string, fields: Fields = {}): string {
  return [
    '---',
    `title: ${title}`,
    'priority: med',
    'roi: med',
    `status: ${fields.status ?? 'todo'}`,
    'release: ""',
    `blocked_by: [${(fields.blocked_by ?? []).join(', ')}]`,
    'related: []',
    'modules: []',
    'questions:',
    ...(fields.questions ?? []).map((q) => `  - ${q}`),
    '---',
    '',
    `What ${title} is for.`,
    '',
  ].join('\n')
}

/** Write one card and commit it as of `daysAgo`. */
function committed(relPath: string, body: string, daysAgo: number): void {
  const file = path.join(todo, relPath)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
  const when = new Date(Date.now() - daysAgo * DAY).toISOString()
  git(['add', '--', path.relative(root, file)])
  git(['commit', '--quiet', '-m', relPath], { GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when })
}

const staleIds = async (argv: string[] = []): Promise<number[]> => {
  const answer = await move(root, ['list', '--stale', ...argv])
  return (answer.cards as { id: number }[]).map((c) => c.id)
}

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.rmSync(path.join(root, '.git'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(todo, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '40\n')
  fs.writeFileSync(path.join(kanban, 'config.md'), '# Configuration\n\n- **Project** — test: a board.\n')
  fs.writeFileSync(path.join(kanban, 'modules.md'), '# Modules\n\n- **skill** — the board.\n')
  fs.writeFileSync(path.join(root, '.gitignore'), '.akb/\n')
  git(['init', '--quiet', '-b', 'main'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'test'])
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

describe('raw list --stale', () => {
  it('lists only what is past the threshold, stalest first', async () => {
    committed('10-old.md', card('an old card'), 100)
    committed('11-fresh.md', card('a fresh card'), 2)
    committed('12-middling.md', card('a middling card'), 45)

    assert.deepEqual(await staleIds(), [10, 12])
  })

  it('carries the last-touched date and the day count on every row', async () => {
    committed('10-old.md', card('an old card'), 100)

    const answer = await move(root, ['list', '--stale'])
    const [row] = answer.cards as { lastTouched: string; days: number }[]
    assert.equal(row!.days, 100)
    assert.equal(row!.lastTouched, new Date(Date.now() - 100 * DAY).toISOString().slice(0, 10))
    assert.equal(answer.staleAfter, 30)
  })

  it('reads the threshold from config.md', async () => {
    fs.appendFileSync(path.join(kanban, 'config.md'), '- **Stale after** — 90 days\n')
    committed('10-old.md', card('an old card'), 100)
    committed('12-middling.md', card('a middling card'), 45)

    assert.deepEqual(await staleIds(), [10])
  })

  it('says what holds each card', async () => {
    committed('10-old.md', card('a blocker'), 100)
    committed('12-blocked.md', card('a blocked card', { blocked_by: [10] }), 60)
    committed('13-asked.md', card('an asked card', { questions: ['[user] Which way?'] }), 55)
    committed('14-building.md', card('a card being built', { status: 'implementing' }), 50)

    const said = await prose()
    assert.match(said, /#12 .*\n.*blocked by #10/)
    assert.match(said, /#13 .*\n.*waiting on you/)
    assert.match(said, /#14 .*\n.*being built/)
    assert.match(said, /#10 .*\n.*nothing holding it/)
  })

  it('leaves out group roots, recurring cards and anything git cannot date', async () => {
    committed('20-group/root.md', card('a group'), 200)
    committed('20-group/21-sub.md', card('a subtask'), 200)
    committed('recurring/22-sweep.md', card('a sweep'), 200)
    committed('23-edited.md', card('an edited card'), 200)
    fs.appendFileSync(path.join(todo, '23-edited.md'), 'A later thought.\n')
    fs.writeFileSync(path.join(todo, '24-new.md'), card('a brand new card'))

    assert.deepEqual(await staleIds(), [21])
  })

  it('narrows to one module the way a plain list does', async () => {
    committed('10-old.md', card('an old card'), 100)

    assert.deepEqual(await staleIds(['--module', 'skill']), [])
  })

  // Git names every path it prints from the repository's top folder, which is a folder
  // above a board that belongs to one package of a larger repository.
  it('dates a board that sits under the repository rather than at its top', async () => {
    const pkg = path.join(root, 'pkg')
    const board = path.join(pkg, 'docs', 'kanban')
    fs.rmSync(pkg, { recursive: true, force: true })
    fs.mkdirSync(path.join(board, 'todo'), { recursive: true })
    fs.writeFileSync(path.join(board, 'next-id'), '40\n')
    fs.writeFileSync(path.join(board, 'config.md'), '# Configuration\n\n- **Project** — test: a board.\n')
    fs.writeFileSync(path.join(board, 'modules.md'), '# Modules\n\n- **skill** — the board.\n')
    const file = path.join(board, 'todo', '10-old.md')
    fs.writeFileSync(file, card('an old card'))
    const when = new Date(Date.now() - 100 * DAY).toISOString()
    git(['add', '--', path.relative(root, file)])
    git(['commit', '--quiet', '-m', 'a package card'], { GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when })

    const answer = await move(pkg, ['list', '--stale'])
    const [row] = answer.cards as { id: number; days: number }[]
    assert.equal(row?.id, 10)
    assert.equal(row?.days, 100)
  })

  it('lists nothing and says why outside a git repository', async () => {
    committed('10-old.md', card('an old card'), 100)
    fs.rmSync(path.join(root, '.git'), { recursive: true, force: true })

    const said = await prose()
    assert.match(said, /not a git repository/)
    assert.deepEqual(await staleIds(), [])
  })
})

// The lines the listing prints, rather than the rows it answers with.
async function prose(): Promise<string> {
  const sink = startCollecting()
  try {
    cmdList({ stale: true })
    return sink.out.join('\n')
  } finally {
    stopCollecting()
  }
}
