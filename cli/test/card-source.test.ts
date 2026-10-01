// A card's source, in frontmatter and as the card page links it (#1306).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { cmdCreate, cmdUpdate } from '../src/commands/card.ts'
import { cardScreenFrom } from '../src/lib/board/assemble.ts'
import { cardSources, plansNamed, readCardSource } from '../src/lib/card-sources.ts'
import { parseFrontmatter, serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { PLANS, PLANS_ARCHIVE, setBoardRoot } from '../src/lib/paths.ts'
import { planPathInText } from '../src/lib/plans.ts'
import { legacySourceRefs, withoutSourceSection } from '../src/lib/source.ts'
import { readArchivedCard } from '../src/lib/view/archive.ts'
import { findCard } from '../src/lib/view/read.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')
const todo = (): string => path.join(kanban(), 'todo')
const triage = (...parts: string[]): string => path.join(kanban(), 'triage', ...parts)

function quiet<T>(work: () => T): T {
  startCollecting()
  try {
    return work()
  } finally {
    stopCollecting()
  }
}

const create = (opts: Partial<Parameters<typeof cmdCreate>[0]> = {}) =>
  quiet(() => cmdCreate({ title: 'A card', asked: [], ...opts }))

const metaOf = (id: number) => {
  const name = fs.readdirSync(todo()).find((f) => f.startsWith(`${id}-`))!
  return parseFrontmatter(fs.readFileSync(path.join(todo(), name), 'utf8')).meta!
}

// A card written by hand, the way an old one sits on disk.
const card = (id: number, frontmatter: string, body: string): void => {
  fs.writeFileSync(path.join(todo(), `${id}-old.md`), `---\ntitle: Old ${id}\n${frontmatter}---\n\n${body}\n`)
}

const item = (folder: string, name: string, fields: string, words = 'What somebody said.'): void => {
  fs.mkdirSync(triage(folder), { recursive: true })
  fs.writeFileSync(
    triage(folder, name),
    `---\nsource_id: ${name.replace('.md', '')}\ntitle: Item ${name}\ncollected_at: 2026-01-01 10:00\nimported_at: 2026-01-01 10:00\n${fields}---\n\n${words}\n`,
  )
}

const plan = (name: string, text: string, archived = false): void => {
  const dir = archived ? PLANS_ARCHIVE : PLANS
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, name), text)
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-card-source-'))
  fs.mkdirSync(todo(), { recursive: true })
  fs.writeFileSync(path.join(todo(), 'README.md'), '# Open tasks\n')
  fs.writeFileSync(path.join(kanban(), 'next-id'), '20\n')
  setBoardRoot(root)
})

afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe('--source', () => {
  it('takes a plan path, plan:<id>, #<id> and a URL, and stores the plan by id', () => {
    plan('12-one-outcome.md', '# One outcome\n')
    card(7, '', 'Words.')
    const { id } = create({
      source: [planPathInText('plans/12-one-outcome.md'), 'plan:13', '#7', 'https://example.test/a?x=1,2'],
    })
    assert.deepEqual(metaOf(id as number).source, ['plan:12', 'plan:13', '#7', 'https://example.test/a?x=1,2'])
  })

  it('reads a relative and an archived plan path the same way', () => {
    const { id } = create({ source: ['docs/kanban/plans/archive/12-one-outcome.md', 'plans/14-x.md'] })
    assert.deepEqual(metaOf(id as number).source, ['plan:12', 'plan:14'])
  })

  it('refuses anything else, and a card id nothing has', () => {
    assert.throws(() => create({ source: ['some discussion'] }), /is not a source/)
    assert.throws(() => create({ source: ['notes/plan.md'] }), /is not a source/)
    assert.throws(() => create({ source: ['#99'] }), /no card has that id/)
    assert.equal(fs.readFileSync(path.join(kanban(), 'next-id'), 'utf8').trim(), '20')
  })

  it('refuses a body carrying ## Source, but not one quoted in a fence', () => {
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, 'Words.\n\n## Source\n- plans/12-a.md\n\n## Todo\n- [ ] Build it.\n')
    assert.throws(() => create({ bodyFile: body }), /pass --source/)
    fs.writeFileSync(body, '```\n## Source\n```\n\n## Todo\n- [ ] Build it.\n')
    assert.doesNotThrow(() => create({ bodyFile: body }))
  })

  it('replaces on update, appends with --add-source, and clears on ""', () => {
    const id = create({ source: ['plan:12'] }).id as number
    quiet(() => cmdUpdate(id, { addSource: ['https://example.test/b', 'plan:12'] }))
    assert.deepEqual(metaOf(id).source, ['plan:12', 'https://example.test/b'])
    quiet(() => cmdUpdate(id, { source: ['plan:13'] }))
    assert.deepEqual(metaOf(id).source, ['plan:13'])
    assert.throws(() => cmdUpdate(id, { source: ['plan:1'], addSource: ['plan:2'] }), /pass one/)
    quiet(() => cmdUpdate(id, { source: [''] }))
    assert.deepEqual(metaOf(id).source, [])
  })
})

describe('source: in frontmatter', () => {
  it('round-trips an address with commas, colons and a hash', () => {
    const source = ['https://example.test/a,b?c=1,2#top', '#7', 'plan:12', 'https://example.test/q?a=b: c']
    const text = serializeFrontmatter({ title: 'T', priority: 'med', roi: 'med', status: 'todo', source })
    assert.deepEqual(parseFrontmatter(text + '\n').meta!.source, source)
  })

  it('writes no key on a card with none, and reads a card without one as empty', () => {
    const text = serializeFrontmatter({ title: 'T', priority: 'med', roi: 'med', status: 'todo' })
    assert.doesNotMatch(text, /^source:/m)
    assert.deepEqual(parseFrontmatter(text + '\n').meta!.source, [])
  })
})

describe('what a card links', () => {
  it('links a plan by id wherever the file went, and drops one that cannot be read', () => {
    plan('12-renamed-since.md', '# One outcome\n\n## Problem\nWords.\n', true)
    assert.deepEqual(cardSources({ source: ['plan:12', 'plan:99'], triage: '' }, ''), [
      { kind: 'plan', ref: '12', title: 'One outcome' },
    ])
  })

  it('links an open card, an archived one, and drops one that is gone', () => {
    card(7, '', 'Words.')
    fs.mkdirSync(path.join(kanban(), '.archive'), { recursive: true })
    fs.writeFileSync(path.join(kanban(), '.archive', '5-done.md'), '---\ntitle: Done\n---\n\nWords.\n')
    assert.deepEqual(cardSources({ source: ['#7', '#5', '#6'], triage: '' }, ''), [
      { kind: 'card', ref: '7', title: 'Old 7' },
      { kind: 'card', ref: '5', title: 'Done', archived: true },
    ])
  })

  it('links a triage card to its item\'s original link', () => {
    item('archived', 'linked.md', 'url: https://example.test/post\nmeta:\n  source: "#7"\n')
    assert.deepEqual(cardSources({ source: [], triage: 'linked' }, ''), [
      { kind: 'url', ref: 'https://example.test/post', title: 'example.test' },
    ])
  })

  it('else to the card that prompted the item', () => {
    card(7, '', 'Words.')
    item('dismissed', 'prompted.md', 'meta:\n  source: "#7"\n')
    assert.deepEqual(cardSources({ source: [], triage: 'prompted' }, ''), [{ kind: 'card', ref: '7', title: 'Old 7' }])
  })

  it('else to the item itself, however long ago it was filed', () => {
    item('archived', 'typed.md', 'archived_at: 2020-01-01 10:00\ncard_id: 9\n')
    assert.deepEqual(cardSources({ source: [], triage: 'typed' }, ''), [
      { kind: 'triage', ref: 'typed', title: 'Item typed.md' },
    ])
  })

  it('shows nothing for a triage item that is not here', () => {
    assert.deepEqual(cardSources({ source: [], triage: 'elsewhere' }, ''), [])
  })
})

describe('an old ## Source', () => {
  it('reads plan paths, item paths, and a line that is only an id or an address', () => {
    const body = [
      'Words.',
      '',
      '## Source',
      `- \`${path.join(root, '.akb/boards/docs/kanban/plans/archive/12-one.md')}\``,
      '- docs/kanban/plans/13-two.md',
      '- `docs/kanban/triage/archived/typed.md`',
      '- #7',
      '<https://example.test/post>',
      '- from the discussion about #8 and https://example.test/other',
      '',
      '## By `ui-designer` agent',
      '- #9',
    ].join('\n')
    assert.deepEqual(legacySourceRefs(body), [
      { kind: 'plan', id: 12 },
      { kind: 'plan', id: 13 },
      { kind: 'item', file: 'typed.md' },
      { kind: 'card', id: 7 },
      { kind: 'url', url: 'https://example.test/post' },
    ])
    assert.deepEqual(plansNamed({ source: [] }, body), [12, 13])
  })

  it('resolves an item path by the triage rule', () => {
    item('archived', 'typed.md', '')
    item('archived', 'linked.md', 'url: https://example.test/post\n')
    const body = '## Source\n- docs/kanban/triage/archived/typed.md\n- docs/kanban/triage/linked.md\n'
    assert.deepEqual(
      cardSources({ source: [], triage: '' }, body).map((s) => [s.kind, s.ref]),
      [
        ['triage', 'typed'],
        ['url', 'https://example.test/post'],
      ],
    )
  })

  it('is left alone on a card that names sources in frontmatter', () => {
    plan('12-one.md', '# One\n')
    assert.deepEqual(cardSources({ source: ['plan:99'], triage: '' }, '## Source\n- plans/12-one.md\n'), [])
  })

  it('comes out of the body, and only when it is a section', () => {
    assert.equal(withoutSourceSection('Words.\n\n## Source\n- x\n\n## Todo\n- [ ] a'), 'Words.\n\n## Todo\n- [ ] a')
    assert.equal(withoutSourceSection('Words.\n\n## Source\n- x\n\n<!-- agent -->\n\n## Scope'), 'Words.\n\n<!-- agent -->\n\n## Scope')
    const fenced = 'Words.\n\n```\n## Source\n```\n\n## Todo'
    assert.equal(withoutSourceSection(fenced), fenced)
  })
})

describe('the card page', () => {
  it('carries the sources on one card read and keeps the file as written', () => {
    plan('12-one-outcome.md', '# One outcome\n\n## Problem\nWords.\n')
    const body = 'Words.\n\n## Source\n- docs/kanban/plans/12-one-outcome.md\n\n## Todo\n- [ ] a'
    card(7, 'priority: med\nroi: med\nstatus: todo\n', body)
    card(8, 'priority: med\nroi: med\nstatus: todo\n', 'Words.\n\n## Source\n- somebody asked\n')
    const before = fs.readFileSync(path.join(todo(), '7-old.md'), 'utf8')
    assert.deepEqual(findCard(7)!.sources, [{ kind: 'plan', ref: '12', title: 'One outcome' }])
    assert.equal(findCard(8)!.sources, undefined)
    assert.equal(fs.readFileSync(path.join(todo(), '7-old.md'), 'utf8'), before)
  })

  it('carries them on an archived card too', () => {
    fs.mkdirSync(path.join(kanban(), '.archive'), { recursive: true })
    fs.writeFileSync(path.join(kanban(), '.archive', '5-done.md'), '---\ntitle: Done\nsource:\n  - https://example.test/x\n---\n\nWords.\n')
    assert.deepEqual(readArchivedCard(5)!.sources, [{ kind: 'url', ref: 'https://example.test/x', title: 'example.test' }])
  })

  it('opens a plan and an item the card names, and nothing it does not', () => {
    plan('12-one-outcome.md', '# One outcome\n\n## Problem\nWords.\n')
    plan('13-another.md', '# Another\n')
    item('archived', 'typed.md', '', 'The item, whole.')
    card(7, 'source:\n  - plan:12\ntriage: typed\n', 'Words.')
    assert.deepEqual(readCardSource(7, 'plan', '12'), { title: 'One outcome', text: '## Problem\nWords.', url: '' })
    assert.deepEqual(readCardSource(7, 'triage', 'typed'), { title: 'Item typed.md', text: 'The item, whole.', url: '' })
    assert.equal(readCardSource(7, 'plan', '13'), null)
    assert.equal(readCardSource(7, 'plan', '../../secret'), null)
    assert.equal(readCardSource(99, 'plan', '12'), null)
  })
})

describe('a hosted card page', () => {
  it('links other open cards and addresses, and nothing a browser cannot open', () => {
    const stored = (id: number, meta: object, body = 'Words.') => ({ id, revision: 'r', data: { path: `todo/${id}-c.md`, meta: { title: `Card ${id}`, ...meta }, body } })
    const read = {
      workspace: { id: 'w', name: 'W' },
      documents: [],
      cards: [
        stored(1, { source: ['plan:12', '#2', '#9', 'https://example.test/a,b'] }),
        stored(2, { triage: 'typed' }, 'Words.\n\n## Source\n- https://example.test/post\n- plans/12-a.md\n'),
        stored(3, {}),
      ],
    }
    assert.deepEqual(cardScreenFrom(read, 1)!.card.sources, [
      { kind: 'card', ref: '2', title: 'Card 2' },
      { kind: 'url', ref: 'https://example.test/a,b', title: 'example.test' },
    ])
    assert.deepEqual(cardScreenFrom(read, 2)!.card.sources, [{ kind: 'url', ref: 'https://example.test/post', title: 'example.test' }])
    assert.equal(cardScreenFrom(read, 3)!.card.sources, undefined)
  })
})
