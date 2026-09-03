// What the board reports about its own integrity, and what it stays quiet about.
//
// `boardComplaints` is the read a finished run is checked against (agent/watch.ts): an
// agent that took a card off the board with `rm` instead of `akb raw archive` leaves
// other cards pointing at an id that isn't there, and nothing else notices. These fix what
// counts as broken — and, just as importantly, that it repairs nothing while looking.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { setBoardRoot } from '../src/lib/paths.ts'
import { boardComplaints } from '../src/lib/reconcile.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-reconcile-'))
const todo = () => path.join(root, 'docs', 'kanban', 'todo')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(path.join(todo(), 'feature'), { recursive: true })
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

// One card, with whatever frontmatter the test is about.
function card(id: number, slug: string, extra = ''): string {
  const rel = path.join('feature', `${id}-${slug}.md`)
  fs.writeFileSync(
    path.join(todo(), rel),
    `---\nid: ${id}\ntitle: ${slug}\ntrack: feature\nstatus: todo\n${extra}---\n\nthe card.\n`,
  )
  return rel
}

// The index, one link per card, each numbered from the id at the front of its filename —
// the same way the board writes it.
const index = (...rels: string[]): void =>
  fs.writeFileSync(
    path.join(todo(), 'README.md'),
    [
      '# Board',
      '',
      '## feature',
      '',
      ...rels.map((r) => `- [#${path.basename(r).split('-')[0]} a card](${r})`),
      '',
    ].join('\n'),
  )

describe('a board that holds together', () => {
  it('says nothing', () => {
    const one = card(1, 'one')
    const two = card(2, 'two', 'related: [1]\n')
    index(one, two)
    assert.deepEqual(boardComplaints(), [])
  })

  it('says nothing when there is no index to read', () => {
    card(1, 'one', 'related: [99]\n')
    assert.deepEqual(boardComplaints(), [])
  })
})

describe('a card taken off the board by hand', () => {
  it('reports the blocked_by left pointing at it', () => {
    const one = card(1, 'one', 'blocked_by: [4]\n')
    index(one)
    const said = boardComplaints()
    assert.equal(said.length, 1)
    assert.match(said[0]!, /#1 blocked_by #4/)
  })

  it('reports a related the same way', () => {
    const one = card(1, 'one', 'related: [4]\n')
    index(one)
    assert.match(boardComplaints()[0]!, /#1 related #4/)
  })

  it('reports the index entry it left behind', () => {
    index('feature/4-gone.md')
    assert.match(boardComplaints()[0]!, /README links #4 .* no card with that id exists/)
  })

  it('reports every one of them at once', () => {
    const one = card(1, 'one', 'blocked_by: [4]\nrelated: [3]\n')
    index(one, 'feature/3-gone.md')
    assert.equal(boardComplaints().length, 3)
  })
})

describe('a card the index never learned about', () => {
  it('is reported', () => {
    const one = card(1, 'one')
    card(2, 'two')
    index(one)
    assert.match(boardComplaints()[0]!, /2-two\.md \(#2\) is not in the README index/)
  })
})

describe('looking is not repairing', () => {
  it('leaves a moved card\'s stale link exactly as it found it', () => {
    const moved = card(1, 'one')
    index('feature/1-somewhere-else.md')
    const readme = path.join(todo(), 'README.md')
    const before = fs.readFileSync(readme, 'utf8')
    const said = boardComplaints()
    assert.match(said[0]!, /README links #1/)
    assert.equal(fs.readFileSync(readme, 'utf8'), before)
    assert.ok(fs.existsSync(path.join(todo(), moved)))
  })
})
