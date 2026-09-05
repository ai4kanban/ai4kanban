// The board's own content, as a board that does not live on this machine needs it (#315):
// the memory set and the per-flow rules as operations of the contract rather than as files
// only a coding agent can edit, and the whole board packed into one payload and written back
// out as a markdown board that reads the same.
//
// What is checked here is what a Cloud workspace would otherwise have to be trusted about:
// that nothing a board keeps out of git travels, that no repository field rides along in a
// delivery record, and that reading a board changes nothing in it.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { board, withLease, type OpEnvelope, type OpResult } from '../src/lib/board/index.ts'
import { boardFingerprint, packBoard, portableDelivery, unpackBoard } from '../src/lib/board/transfer.ts'
import { serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import type { DeliveryRecord } from '../src/lib/agent/types.ts'
import type { Meta } from '../src/lib/types.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-content-'))
const kanban = path.join(root, 'docs', 'kanban')

after(() => fs.rmSync(root, { recursive: true, force: true }))

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  setBoardRoot(root)
  write('next-id', '44\n')
  write('config.md', '# Project\n\n- **Name**: Test board\n')
  write('modules.md', '- **cloud** — the service\n- **skill** — the command\n')
  write('releases.md', '- 0.9.0\n')
  write('memory/readme.md', '# What shipped\n')
  write('todo/README.md', '# The board\n')
})

function write(rel: string, body: string): void {
  const file = path.join(kanban, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
}

const read = (rel: string): string => fs.readFileSync(path.join(kanban, rel), 'utf8')

function card(rel: string, id: number, over: Partial<Meta> = {}): void {
  const meta: Partial<Meta> = {
    title: `Card ${id}`,
    priority: 'med',
    roi: 'med',
    status: 'todo',
    release: '',
    blocked_by: [],
    related: [],
    modules: [],
    questions: [],
    ...over,
  }
  write(rel, `${serializeFrontmatter(meta)}\nThe body of #${id}.\n`)
}

/** One write against the board itself, under a lease taken for it — how a caller that never
 *  read the resource writes it. */
const onBoard = <T extends object>(run: (env: OpEnvelope) => Promise<OpResult<T>>) =>
  withLease({ board: true }, run)

describe('the memory set, as a contract write', () => {
  it('writes one of the four whole, and reads it back', async () => {
    const res = await onBoard((env) => board().saveMemoryFile('decisions', '# Settled\n\n- We chose A.', '', env))
    assert.ok(res.ok)

    const file = await board().readMemoryFile('decisions')
    assert.equal(file?.text, '# Settled\n\n- We chose A.\n')
    assert.equal(file?.written, true)
    assert.equal(read('memory/decisions.md'), '# Settled\n\n- We chose A.\n')
  })

  it('writes a module’s own copy, making the folder on the way', async () => {
    const res = await onBoard((env) => board().saveMemoryFile('redesign', '- Avoid B.', 'cloud', env))
    assert.ok(res.ok)
    assert.equal(read('memory/cloud/redesign.md'), '- Avoid B.\n')

    // And the project's own copy is untouched: memory is never mirrored between levels.
    const project = await board().readMemoryFile('redesign')
    assert.equal(project?.written, false)
  })

  it('refuses a name that is not one of the four, and a module the map does not name', async () => {
    for (const [name, module] of [
      ['notes', ''],
      ['readme', 'nowhere'],
    ] as const) {
      const res = await onBoard((env) => board().saveMemoryFile(name, 'x', module, env))
      assert.equal(res.ok, false)
      assert.equal(res.ok === false && res.kind, 'refused')
    }
    assert.equal(fs.existsSync(path.join(kanban, 'memory', 'notes.md')), false)
    assert.equal(fs.existsSync(path.join(kanban, 'memory', 'nowhere')), false)
  })

  // `memory/agents/` is the agents' own (#421). A map that names a module `agents` does not
  // turn it into one, or the set would be written on top of what an agent remembers.
  it('refuses `agents`, whatever the map says', async () => {
    write('modules.md', '- **agents** — a module someone named\n- **skill** — the command\n')
    const res = await onBoard((env) => board().saveMemoryFile('decisions', 'x', 'agents', env))
    assert.equal(res.ok, false)
    assert.equal(fs.existsSync(path.join(kanban, 'memory', 'agents')), false)
    assert.equal(await board().readMemoryFile('decisions', 'agents'), null)
    assert.deepEqual((await board().readMemoryModules()).map((m) => m.name), ['skill'])
  })
})

describe('the per-flow rules, as a contract write', () => {
  it('saves one, lists it with the flow it belongs to, and clears it with empty text', async () => {
    const saved = await onBoard((env) => board().saveFlowRule('review', 'Run the smoke tests.', env))
    assert.ok(saved.ok)
    assert.equal(read('rules/review.md'), 'Run the smoke tests.\n')

    const listed = await board().readFlowRules()
    assert.equal(listed.find((f) => f.command === 'review')?.rule, 'Run the smoke tests.')
    assert.equal(listed.find((f) => f.command === 'implement')?.rule, '')

    const cleared = await onBoard((env) => board().saveFlowRule('review', '   ', env))
    assert.ok(cleared.ok)
    // A flow with no rule and a flow with an empty rule are the same flow, so the file goes.
    assert.equal(fs.existsSync(path.join(kanban, 'rules', 'review.md')), false)
  })

  it('refuses a command that starts no flow', async () => {
    const res = await onBoard((env) => board().saveFlowRule('deploy', 'Ship it.', env))
    assert.equal(res.ok, false)
    assert.equal(fs.existsSync(path.join(kanban, 'rules', 'deploy.md')), false)
  })

  it('hands a delivery the rules it freezes, and only the flows a delivery is made of', async () => {
    await onBoard((env) => board().saveFlowRule('implement', 'Install dependencies first.', env))
    await onBoard((env) => board().saveFlowRule('propose', 'Stay small.', env))

    const frozen = await board().deliveryRules()
    assert.equal(frozen.implement, 'Install dependencies first.')
    assert.ok(!('propose' in frozen), 'a flow no delivery is made of was frozen into one')
  })
})

describe('packing a board', () => {
  beforeEach(() => {
    card('todo/features/12-first.md', 12, { modules: ['cloud'] })
    card('todo/373-group/root.md', 373, { related: [12] })
    card('todo/373-group/features/374-piece.md', 374)
    card('.archive/9-shipped.md', 9, { status: 'todo' })
    write('rules/revise.md', 'Say what changed.\n')
    write('.gitignore', '.env\nui.config.json\n')
    write('.release-summaries/0.8.0.md', '# 0.8.0\n')
    write('metrics.csv', 'date,completed,created,rejected\n2026-04-02,1,0,0\n')
    write('record.csv', 'date,event,card,detail\n2026-04-02,card-created,12,asked\n2026-04-09,card-archived,9,7\n')
  })

  it('carries every card under its own number, and says which have left the board', () => {
    const payload = packBoard()
    assert.deepEqual(payload.cards.map((c) => c.id), [9, 12, 373, 374])
    assert.equal(payload.cards.find((c) => c.id === 9)?.archived, true)
    assert.equal(payload.cards.find((c) => c.id === 12)?.archived, false)
    // A group's root takes its number from its folder, which is how the board finds it too.
    assert.equal(payload.cards.find((c) => c.id === 373)?.path, 'todo/373-group/root.md')
    assert.equal(payload.nextCardId, 44)
  })

  it('carries the card’s portable fields and its body, not a blob', () => {
    const twelve = packBoard().cards.find((c) => c.id === 12)!
    assert.equal(twelve.meta.title, 'Card 12')
    assert.deepEqual(twelve.meta.modules, ['cloud'])
    assert.match(twelve.body, /The body of #12\./)
  })

  it('sorts every board file into the half it belongs to', () => {
    const kinds = new Map(packBoard().documents.map((d) => [d.path, d.kind]))
    assert.equal(kinds.get('config.md'), 'config')
    assert.equal(kinds.get('modules.md'), 'config')
    assert.equal(kinds.get('releases.md'), 'config')
    assert.equal(kinds.get('todo/README.md'), 'config')
    // The ignore list travels too: a board restored without it would commit the keys and run
    // state it is there to keep out of git.
    assert.equal(kinds.get('.gitignore'), 'config')
    assert.equal(kinds.get('memory/readme.md'), 'memory')
    assert.equal(kinds.get('rules/revise.md'), 'rule')
    assert.equal(kinds.get('.release-summaries/0.8.0.md'), 'summary')
    assert.equal(kinds.get('metrics.csv'), 'history')
    assert.equal(kinds.get('record.csv'), 'history')
  })

  it('turns record.csv into history that keeps its own dates and its own place', () => {
    const events = packBoard().events
    assert.deepEqual(
      events.map((e) => [e.key, e.at, e.action, e.cardId]),
      [
        ['2', '2026-04-02', 'card-created', 12],
        ['3', '2026-04-09', 'card-archived', 9],
      ],
    )
  })

  it('leaves behind everything the board keeps out of git', () => {
    write('.env', 'ANTHROPIC_API_KEY=sk-ant-secret\n')
    write('ui.config.json', '{"harness":"claude-code","apiKey":"sk-ant-secret"}\n')
    write('.sessions.json', '{"runs":[]}\n')
    write('.sessions/3f2a.log', 'a run log\n')
    write('.chats/board.json', '{"messages":[]}\n')
    write('.mockups/12/screen.html', '<html></html>\n')

    const packed = JSON.stringify(packBoard())
    for (const secret of ['sk-ant-secret', 'a run log', 'ANTHROPIC_API_KEY', 'harness']) {
      assert.ok(!packed.includes(secret), `${secret} left the machine`)
    }
    const paths = packBoard().documents.map((d) => d.path)
    for (const kept of ['.env', 'ui.config.json', '.sessions.json']) {
      assert.ok(!paths.includes(kept), `${kept} was packed`)
    }
  })

  it('says which committed files neither half recognised', () => {
    write('todo/recurring/competitor-analysis/result.md', '# Competitors\n')
    write('.DS_Store', 'not board content\n')

    const payload = packBoard()
    // A file nobody has named yet stays on the machine — but the person running the import
    // hears about it, because an export is what a board is restored from.
    assert.deepEqual(payload.leftBehind, ['todo/recurring/competitor-analysis/result.md'])
    // `next-id` travels as the payload's own number, and a dotfile is somebody's editor.
    assert.ok(!payload.leftBehind.includes('next-id'))
    assert.ok(!payload.leftBehind.includes('.DS_Store'))
  })

  it('changes nothing on the board it read', () => {
    const before = snapshot()
    packBoard()
    assert.deepEqual(snapshot(), before)
  })

  it('names the same source board whatever its cards say', () => {
    const first = boardFingerprint()
    card('todo/features/13-second.md', 13)
    fs.rmSync(path.join(kanban, 'todo', 'features', '12-first.md'))
    assert.equal(boardFingerprint(), first)
  })
})

describe('writing a board back out', () => {
  beforeEach(() => {
    card('todo/features/12-first.md', 12, { status: 'ready', release: '0.9.0', modules: ['cloud'] })
    card('.archive/9-shipped.md', 9)
    write('rules/revise.md', 'Say what changed.\n')
    write('record.csv', 'date,event,card,detail\n2026-04-02,card-created,12,asked\n')
  })

  it('reads the same as the board it came from', () => {
    const payload = packBoard()
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-export-'))
    try {
      unpackBoard(payload, out)
      setBoardRoot(out)
      const again = packBoard()

      assert.deepEqual(again.cards.map((c) => [c.id, c.path, c.archived]), payload.cards.map((c) => [c.id, c.path, c.archived]))
      assert.deepEqual(again.cards.map((c) => c.meta), payload.cards.map((c) => c.meta))
      assert.deepEqual(again.documents, payload.documents)
      assert.deepEqual(again.events, payload.events)
      assert.equal(again.nextCardId, payload.nextCardId)
    } finally {
      setBoardRoot(root)
      fs.rmSync(out, { recursive: true, force: true })
    }
  })

  it('writes nothing outside the board, whatever a name it was handed says', () => {
    const payload = packBoard()
    payload.cards = [{ ...payload.cards[0], path: '../../../escaped.md' }]
    payload.documents = [{ path: '/etc/escaped.md', kind: 'config', body: 'no' }]
    payload.deliveries = [
      { deliveryId: '../../../escaped', cardId: 12, record: {}, approved: '', finalBody: '' },
    ]

    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-export-'))
    try {
      const written = unpackBoard(payload, out)
      assert.deepEqual(written, { cards: 0, documents: 0, deliveries: 0 })
      assert.deepEqual(fs.readdirSync(out), ['docs'])
      assert.deepEqual(fs.readdirSync(path.join(out, 'docs', 'kanban')), ['next-id'])
    } finally {
      fs.rmSync(out, { recursive: true, force: true })
    }
  })

  it('writes a card the board itself would have written', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-export-'))
    try {
      unpackBoard(packBoard(), out)
      const written = fs.readFileSync(path.join(out, 'docs', 'kanban', 'todo/features/12-first.md'), 'utf8')
      assert.equal(written, read('todo/features/12-first.md'))
    } finally {
      fs.rmSync(out, { recursive: true, force: true })
    }
  })
})

describe('a delivery, without its repository half', () => {
  const record = {
    deliveryId: '2yfmw37a',
    cardId: 12,
    title: 'First',
    status: 'landed',
    startedAt: 1,
    sessions: ['3f2a1b04'],
    approved: '# the card as approved',
    steps: [{ step: 'implement', at: 1 }],
    base: '9f8e7d6c5b4a',
    targetBranch: 'main',
    branch: 'card/12/2yfmw37a',
    worktree: '.akb/worktrees/12/2yfmw37a',
    reviewed: { mark: 'abc123', diff: '/Users/me/.akb/diffs/12.diff', at: 2 },
    landing: { status: 'landed', attempts: 1, at: 3, commit: '1a2b3c4d', onto: '5e6f7a8b' },
  } as unknown as DeliveryRecord

  it('keeps what another machine can read something true out of', () => {
    const portable = portableDelivery(record) as Record<string, unknown>
    assert.equal(portable.deliveryId, '2yfmw37a')
    assert.equal(portable.status, 'landed')
    assert.deepEqual(portable.landing, { status: 'landed', attempts: 1, at: 3 })
    assert.deepEqual(portable.reviewed, { mark: 'abc123', at: 2 })
  })

  it('drops every field that means something only where the repository is', () => {
    const text = JSON.stringify(portableDelivery(record))
    for (const gone of ['9f8e7d6c5b4a', 'card/12/2yfmw37a', '.akb/worktrees', '1a2b3c4d', '5e6f7a8b', '/Users/me/']) {
      assert.ok(!text.includes(gone), `${gone} would have reached Cloud`)
    }
  })

  it('packs the committed records with their repository half already off', () => {
    write('deliveries/2yfmw37a.json', `${JSON.stringify(record, null, 2)}\n`)
    const packed = packBoard().deliveries
    assert.equal(packed.length, 1)
    assert.equal(packed[0].deliveryId, '2yfmw37a')
    assert.equal(packed[0].approved, '# the card as approved')
    assert.ok(!JSON.stringify(packed).includes('card/12/2yfmw37a'))
  })
})

/** Every committed file on the board and what it holds — what "reading a board changes
 *  nothing in it" is checked against. */
function snapshot(): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (dir: string, prefix = ''): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(path.join(dir, entry.name), rel)
      else out[rel] = fs.readFileSync(path.join(dir, entry.name), 'utf8')
    }
  }
  walk(kanban)
  return out
}
