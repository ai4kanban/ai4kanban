// The record format's contract. `docs/kanban/record.csv` is written by board moves and read
// by nothing an agent operates, so these tests — not a guide — are what fixes its shape:
// every event that is allowed, every shape that is refused, and how a line reads back.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { setBoardRoot } from '../src/lib/paths.ts'
import { BoardError } from '../src/lib/io.ts'
import {
  countDecisions,
  countsForRecord,
  EVENT_NAMES,
  formatFact,
  originOf,
  readFacts,
  recordFact,
  RECORD_HEADER,
  recordFile,
  type RecordEvent,
} from '../src/lib/record.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-record-'))

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo'), { recursive: true })
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

const refusal = (fn: () => unknown): BoardError => {
  try {
    fn()
  } catch (err) {
    assert.ok(err instanceof BoardError, `expected a refusal, got ${String(err)}`)
    return err
  }
  assert.fail('expected a refusal, got none')
}

const TODAY = /^\d{4}-\d{2}-\d{2}$/

describe('allowed event shapes', () => {
  const allowed: [RecordEvent, number | null, string | number, string][] = [
    ['card-created', 7, 'asked', 'asked'],
    ['card-created', 7, 'proposed', 'proposed'],
    ['card-archived', 7, 'asked', 'asked'],
    ['card-archived', 7, 'proposed', 'proposed'],
    ['card-rejected', 7, 'asked', 'asked'],
    ['card-rejected', 7, 'proposed', 'proposed'],
    ['question-closed', 7, 'board', 'board'],
    ['question-closed', 7, 'user', 'user'],
    ['question-closed', 7, 'verify', 'verify'],
    ['decisions-stood', 7, 0, '0'],
    ['decisions-stood', 7, 12, '12'],
    ['decisions-overruled', 7, 3, '3'],
    ['release-closed', null, 'v0.7.1', 'v0.7.1'],
  ]

  for (const [event, card, detail, written] of allowed) {
    it(`${event} carries ${JSON.stringify(detail)}`, () => {
      const [date, name, id, value] = formatFact(event, card, detail).split(',')
      assert.match(date!, TODAY)
      assert.equal(name, event)
      assert.equal(id, card === null ? '' : String(card))
      assert.equal(value, written)
    })
  }

  it('covers every event the format allows', () => {
    assert.deepEqual(new Set(allowed.map(([e]) => e)), new Set(EVENT_NAMES))
  })
})

describe('refused event shapes', () => {
  it('refuses an event it does not know', () => {
    assert.match(refusal(() => formatFact('card-refined', 7, 'asked')).message, /not a record event/)
  })

  it('refuses a card event with no card', () => {
    assert.equal(refusal(() => formatFact('card-created', null, 'asked')).kind, 'bad-record-card')
  })

  it('refuses a card id that is not a positive whole number', () => {
    for (const bad of [0, -3, 1.5, Number.NaN]) {
      assert.equal(refusal(() => formatFact('card-created', bad, 'asked')).kind, 'bad-record-card')
    }
  })

  it('refuses a card id on the release boundary, which is about a version', () => {
    assert.equal(refusal(() => formatFact('release-closed', 7, 'v1')).kind, 'bad-record-card')
  })

  it('refuses an origin that is neither asked nor proposed', () => {
    for (const bad of ['', 'board', 'Asked', 'proposed by the board']) {
      assert.equal(refusal(() => formatFact('card-created', 7, bad)).kind, 'bad-record-detail')
    }
  })

  it('refuses an answerer outside board | user | verify', () => {
    for (const bad of ['', 'asked', 'agent']) {
      assert.equal(refusal(() => formatFact('question-closed', 7, bad)).kind, 'bad-record-detail')
    }
  })

  it('refuses a decision count that is not a whole number', () => {
    for (const bad of ['', '-1', '2.5', 'two']) {
      assert.equal(refusal(() => formatFact('decisions-stood', 7, bad)).kind, 'bad-record-detail')
      assert.equal(refusal(() => formatFact('decisions-overruled', 7, bad)).kind, 'bad-record-detail')
    }
  })

  it('refuses a release boundary with no version id', () => {
    assert.equal(refusal(() => formatFact('release-closed', null, '   ')).kind, 'bad-record-detail')
  })
})

describe('one line per fact', () => {
  it('quotes a value holding a comma or a quote', () => {
    assert.equal(formatFact('release-closed', null, 'v1, the "first" one').split(',').length > 1, true)
    const line = formatFact('release-closed', null, 'v1, the "first" one')
    assert.ok(line.endsWith('"v1, the ""first"" one"'), line)
  })

  it('never runs a value onto a second line', () => {
    const line = formatFact('release-closed', null, 'v1\nreally v1')
    assert.equal(line.split('\n').length, 1)
    assert.ok(line.endsWith('v1 really v1'), line)
  })
})

describe('the file itself', () => {
  it('writes the header once and only ever appends', () => {
    recordFact('card-created', 4, 'proposed')
    recordFact('question-closed', 4, 'user')
    recordFact('release-closed', null, 'v1')
    const lines = fs.readFileSync(recordFile(), 'utf8').trim().split('\n')
    assert.equal(lines[0], RECORD_HEADER)
    assert.equal(lines.length, 4)
    assert.match(lines[1]!, /,card-created,4,proposed$/)
    assert.match(lines[3]!, /,release-closed,,v1$/)
  })

  it('reads its facts back in the order they were written', () => {
    recordFact('card-created', 4, 'proposed')
    recordFact('decisions-stood', 4, 2)
    const facts = readFacts()
    assert.deepEqual(
      facts.map((f) => [f.event, f.card, f.detail]),
      [
        ['card-created', 4, 'proposed'],
        ['decisions-stood', 4, '2'],
      ],
    )
  })

  it('has no facts before any move has written one', () => {
    assert.deepEqual(readFacts(), [])
    assert.equal(originOf(4), null)
  })

  it('reads a card back to where it came from', () => {
    recordFact('card-created', 4, 'proposed')
    recordFact('card-created', 5, 'asked')
    assert.equal(originOf(4), 'proposed')
    assert.equal(originOf(5), 'asked')
    assert.equal(originOf(6), null)
  })
})

describe('what is counted', () => {
  const card = (...parts: string[]) => path.join(root, 'docs', 'kanban', 'todo', ...parts)

  it('counts an ordinary card and a group subtask', () => {
    assert.equal(countsForRecord(card('feature', '4-a-thing.md')), true)
    assert.equal(countsForRecord(card('221-a-group', 'skill', '223-a-part.md')), true)
  })

  it('leaves the recurring cards out', () => {
    assert.equal(countsForRecord(card('recurring', '3-prune-the-memory.md')), false)
    assert.equal(countsForRecord(card('recurring', '9-a-job', 'root.md')), false)
  })

  it('leaves the setup questions card out', () => {
    assert.equal(countsForRecord(card('feature', "1-answer-the-questions-setup-couldnt-settle.md")), false)
  })

  it('leaves anything off the board out', () => {
    assert.equal(countsForRecord(path.join(root, 'docs', 'kanban', '.archive', '4-a-thing.md')), false)
  })
})

describe("the calls the board made on its own", () => {
  it('counts the top-level bullets under the section', () => {
    const body = [
      '## Scope',
      '- not a call',
      '',
      '## Decided by the agent',
      '- **One?** Yes.',
      '  a continuation line, not a second call',
      '- **Two?** No.',
      '',
      '## Todo',
      '- [ ] not a call either',
    ].join('\n')
    assert.deepEqual(countDecisions(body), { stood: 2, overruled: 0 })
  })

  it('counts the overruled ones apart', () => {
    const body = [
      '## Decided by the agent',
      '- **One?** Yes.',
      '',
      '### Overruled by the user',
      '- **Two?** The user said no.',
      '- **Three?** The user said no.',
    ].join('\n')
    assert.deepEqual(countDecisions(body), { stood: 1, overruled: 2 })
  })

  it("counts the human half's Worth noting lines as calls of the board's own", () => {
    const body = [
      'What the task does.',
      '',
      '## Worth noting',
      '- **A choice that could have gone the other way**: it went this way.',
      '- **A limit**: the task stops here.',
      '',
      '<!-- agent -->',
      '',
      '## Todo',
      '- [ ] not a call',
      '',
      '## Decided by the agent',
      '- **One?** Yes.',
    ].join('\n')
    assert.deepEqual(countDecisions(body), { stood: 3, overruled: 0 })
  })

  it('counts an unrepaired card under its old subsection too', () => {
    const body = [
      '## Decided by the agent',
      '- **One?** Yes.',
      '',
      '### Worth noting',
      '- a choice a reviewer could refuse',
      '',
      '### Overruled by the user',
      '- **Two?** The user said no.',
    ].join('\n')
    assert.deepEqual(countDecisions(body), { stood: 2, overruled: 1 })
  })

  it('counts nothing on a card with no section', () => {
    assert.deepEqual(countDecisions('## Scope\n- a step\n'), { stood: 0, overruled: 0 })
  })
})
