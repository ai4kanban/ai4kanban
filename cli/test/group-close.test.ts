// A group root leaves the board with its last subtask (#299).
//
// The rule is arithmetic on the root's `## Todo`, so these fix exactly which roots it
// closes and which it hands back to a person — and that the subtask's own archive stands
// either way, since it has already happened by the time the root's is tried.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { cmdRemove } from '../src/commands/remove.ts'
import { markBoard, refinementRunsAfter } from '../src/lib/agent/refine.ts'
import type { RunRecord } from '../src/lib/agent/types.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import type { MoveResult } from '../src/lib/types.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-group-close-'))
const kanban = () => path.join(root, 'docs', 'kanban')
const todo = () => path.join(kanban(), 'todo')
const archive = () => path.join(kanban(), '.archive')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(path.join(todo(), 'features'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '90\n')
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

const frontmatter = (id: number, questions: string[] = []): string =>
  [
    '---',
    `title: Card ${id}`,
    'track: features',
    'priority: med',
    'roi: med',
    'status: todo',
    'release: ""',
    'blocked_by: []',
    'related: []',
    'modules: []',
    questions.length ? `questions:\n${questions.map((q) => `  - ${q}`).join('\n')}` : 'questions: []',
    '---',
  ].join('\n')

/** A group folder: `todo/<id>-a-group/root.md` plus one subtask card per id. */
function group(id: number, todoLines: string[], subIds: number[], questions: string[] = []): string {
  const dir = path.join(todo(), `${id}-a-group`)
  fs.mkdirSync(path.join(dir, 'features'), { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'root.md'),
    `${frontmatter(id, questions)}\n\nThe whole job.\n\n## Todo\n${todoLines.join('\n')}\n`,
  )
  for (const sub of subIds) {
    fs.writeFileSync(path.join(dir, 'features', `${sub}-a-part.md`), `${frontmatter(sub)}\n\nOne piece.\n`)
  }
  return dir
}

/** Run a removal and keep both halves of its answer: the fields, and the receipt it
 *  printed — held aside so the test run's own output stays readable. */
function remove(id: number, metric: 'completed' | 'rejected'): MoveResult & { receipt: string } {
  const box = startCollecting()
  try {
    return { ...cmdRemove(id, metric), receipt: box.out.join('\n') }
  } finally {
    stopCollecting()
  }
}

const onBoard = (name: string): boolean => fs.existsSync(path.join(todo(), name))
const archived = (name: string): boolean => fs.existsSync(path.join(archive(), name))

describe('a group whose last subtask leaves', () => {
  it('archives the root in the same run, and says where it went', () => {
    group(50, ['- [x] one #51', '- [ ] two #52'], [52])
    const res = remove(52, 'completed')
    assert.equal(onBoard('50-a-group'), false)
    assert.equal(archived('50-a-group'), true)
    assert.deepEqual(res.group_close, {
      id: 50,
      archived_to: path.join('docs', 'kanban', '.archive', '50-a-group'),
      held: null,
    })
  })

  it('names the root and where it moved to in the subtask\'s own receipt', () => {
    group(50, ['- [ ] one #51'], [51])
    const receipt = remove(51, 'completed').receipt
    assert.match(receipt, /every subtask line on #50 is resolved/)
    assert.match(receipt, /archived #50: moved folder 50-a-group\/ →/)
  })

  it('closes on a reject too, when at least one subtask was archived', () => {
    group(50, ['- [x] one #51', '- [ ] two #52'], [52])
    const res = remove(52, 'rejected')
    assert.equal(archived('50-a-group'), true)
    assert.equal((res.group_close as { id: number }).id, 50)
  })

  it('counts the root, drops its index entry and repairs what pointed at it', () => {
    group(50, ['- [ ] one #51'], [51])
    fs.writeFileSync(
      path.join(todo(), 'README.md'),
      ['# Board', '', '## features', '', '- [#50 a group](50-a-group/)', ''].join('\n'),
    )
    fs.writeFileSync(
      path.join(todo(), 'features', '60-later.md'),
      `${frontmatter(60).replace('blocked_by: []', 'blocked_by: [50]')}\n\nLater.\n`,
    )
    remove(51, 'completed')
    assert.match(fs.readFileSync(path.join(kanban(), 'metrics.csv'), 'utf8'), /,2,/)
    assert.doesNotMatch(fs.readFileSync(path.join(todo(), 'README.md'), 'utf8'), /50-a-group/)
    assert.match(fs.readFileSync(path.join(todo(), 'features', '60-later.md'), 'utf8'), /blocked_by: \[\]/)
  })

  it('leaves the root out of the sentences handed over to be rewritten', () => {
    group(50, ['- [ ] one #51'], [51])
    fs.writeFileSync(
      path.join(todo(), 'features', '60-later.md'),
      `${frontmatter(60)}\n\nFollows on from #50 and #51.\n`,
    )
    const res = remove(51, 'completed')
    const files = (res.mentions as { file: string }[]).map((m) => m.file)
    // The line in the other card is still someone's to rewrite; the root's own body left
    // with it, so nothing in the archive is handed back.
    assert.deepEqual([...new Set(files)], [path.join('docs', 'kanban', 'todo', 'features', '60-later.md')])
  })
})

describe('a finished-looking root the rule holds back', () => {
  let receipt = ''
  const held = (id: number, metric: 'completed' | 'rejected' = 'completed'): string => {
    const res = remove(id, metric)
    receipt = res.receipt
    return (res.group_close as { held: string }).held
  }

  it('keeps a root whose every subtask line was struck out by reject', () => {
    group(50, ['- [ ] one #51'], [51])
    const why = held(51, 'rejected')
    assert.equal(onBoard('50-a-group'), true)
    assert.match(why, /struck out by reject/)
    assert.match(receipt, /every subtask line on #50 is resolved, but the group stays on the board/)
  })

  it('keeps a root carrying an open question of its own', () => {
    group(50, ['- [ ] one #51'], [51], ['What ships first?'])
    const why = held(51)
    assert.equal(onBoard('50-a-group'), true)
    assert.match(why, /open question/)
  })

  it('keeps a root carrying an unticked todo of its own', () => {
    group(50, ['- [ ] one #51', '- [ ] write the guide'], [51])
    const why = held(51)
    assert.equal(onBoard('50-a-group'), true)
    assert.match(why, /todo of its own/)
  })

  it('keeps the subtask archived either way', () => {
    group(50, ['- [ ] one #51'], [51], ['What ships first?'])
    remove(51, 'completed')
    assert.equal(archived('51-a-part.md'), true)
  })
})

describe('a root the rule says nothing about', () => {
  it('stays, silently, while a subtask is still open', () => {
    group(50, ['- [ ] one #51', '- [ ] two #52'], [51, 52])
    assert.equal(remove(51, 'completed').group_close, null)
    assert.equal(onBoard('50-a-group'), true)
  })

  it('stays when it lists no subtasks at all', () => {
    group(50, ['- [ ] write the guide'], [51])
    assert.equal(remove(51, 'completed').group_close, null)
    assert.equal(onBoard('50-a-group'), true)
  })

  it('is not chased from a standalone card', () => {
    fs.writeFileSync(path.join(todo(), 'features', '70-alone.md'), `${frontmatter(70)}\n\nAlone.\n`)
    assert.equal(remove(70, 'completed').group_close, null)
  })
})

describe('the refine a finished run starts on its own', () => {
  // The follow-up picks its cards from the board as it stands after the run, so a root that
  // is no longer in `todo/` is never a candidate. This fixes that it stays that way.
  it('never targets a root that left with the subtask', () => {
    // Ticked and struck: the root's own todo count is 1 of 2, so it would be refinable if
    // it were still there — which is what makes this worth asserting.
    group(50, ['- [x] one #51', '- [ ] two #52'], [52])
    const before = markBoard()
    remove(52, 'rejected')
    const run: RunRecord = {
      sessionId: 's',
      cardId: 52,
      action: 'reject',
      status: 'done',
      startedAt: 0,
      harness: 'test',
      logPath: '/dev/null',
    }
    const { runs } = refinementRunsAfter(run, before)
    assert.deepEqual(runs.map((r) => r.id), [])
  })
})
