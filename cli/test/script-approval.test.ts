// A product video is finished during planning (#1057): the user approves the script once,
// nothing is produced before that, and a finished film is archived rather than built.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { decidable } from '../src/lib/agent/decide.ts'
import { RUN_ENV } from '../src/lib/agent/env.ts'
import { gateable } from '../src/lib/agent/gate.ts'
import { claimChanges, markBoard, refinementRunsAfter } from '../src/lib/agent/refine.ts'
import { setDecider } from '../src/lib/agent/settings.ts'
import { workflowRefusal } from '../src/lib/agent/start.ts'
import { withStore } from '../src/lib/agent/store.ts'
import type { AgentAction, RunRecord } from '../src/lib/agent/types.ts'
import { createWorkflow, setWorkflowLead, workflowProblems } from '../src/lib/agent/workflows.ts'
import { setBoardProvider } from '../src/lib/board/index.ts'
import { answerNotes } from '../src/lib/cloud/events.ts'
import { ASSETS, SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import { validateSpec } from '../src/lib/spec-contract.ts'
import { findCard } from '../src/lib/view/read.ts'
import { canImplement, canRefine, planDeliveryGap, scheduleWouldDoNothing } from '../src/lib/view/rules.ts'
import { forgetMachineState, move, run } from './helpers/board.ts'

let root = ''
const file = (): string => path.join(root, 'docs', 'kanban', 'todo', '1-a-video.md')
const text = (): string => fs.readFileSync(file(), 'utf8')

const SCRIPT = ['### 脚本', '', '- **受众**：新用户', '- **旁白**：“三步把想法变成卡片。”']
const FILM = '<Asset src=".assets/1/a-video.mp4" label="成片" />'

interface Shape {
  workflow?: string
  status?: string
  legacy?: boolean
  script?: string[]
  film?: boolean
  todos?: string[]
}

const write = ({ workflow = 'hyperframes-video', status = 'todo', legacy = false, script = SCRIPT, film = false, todos = ['- [x] 写好脚本'] }: Shape = {}): void => {
  fs.writeFileSync(
    file(),
    [
      '---',
      'title: A video',
      'priority: med',
      'roi: med',
      `status: ${status}`,
      'release: ""',
      'blocked_by: []',
      'related: []',
      'modules: []',
      `workflow: ${workflow}`,
      ...(legacy ? ['preview_approved: true'] : []),
      'questions: []',
      '---',
      '',
      'One product video.',
      '',
      ...(film ? [FILM, ''] : []),
      '## Worth noting',
      '',
      '## By `scriptwriter` agent',
      '',
      ...script,
      '',
      '<!-- agent -->',
      '',
      '## Scope',
      '',
      '- **成片**：一段产品视频。',
      '',
      '## Todo',
      '',
      ...todos,
      '',
      '## Decided by the agent',
      '',
    ].join('\n'),
  )
}

// A card whose film is done: approved script, the video on disk, the command recorded.
const finished = async (): Promise<void> => {
  await askApproval()
  await move(root, ['update-questions', '1', '--approve', '1'])
  const approved = text().match(/^script_approved: .*$/m)![0]
  write({ film: true, todos: ['- [x] 写好脚本', '- [x] 渲染成片：`npm run render`'] })
  fs.writeFileSync(file(), text().replace('workflow: hyperframes-video', `workflow: hyperframes-video\n${approved}`))
  fs.mkdirSync(path.join(ASSETS, '1'), { recursive: true })
  fs.writeFileSync(path.join(ASSETS, '1', 'a-video.mp4'), 'mp4')
}

const askApproval = (): Promise<Record<string, unknown>> =>
  move(root, ['update-questions', '1', '--append', '[user] 确认脚本？', '--option', '批准脚本', '--option', '需要修改', '--script-approval'])
const approved = (): boolean => findCard(1)!.scriptApproved === true
const produce = () => workflowRefusal({ action: 'spec', id: 1, title: 'A video', specAgent: 'hyperframes-editor' })

// Stand inside a board run of `action` whose user answers are `notes`.
const inside = (action: AgentAction, notes?: string): void => {
  const record: RunRecord = {
    sessionId: `${action}-1`,
    cardId: 1,
    action,
    status: 'running',
    startedAt: Date.now(),
    harness: 'test',
    logPath: path.join(SESSIONS_DIR, `${action}-1.log`),
    ...(notes ? { input: notes } : {}),
  }
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  fs.writeFileSync(record.logPath, '')
  withStore((store) => store.runs.push(record))
  process.env[RUN_ENV] = record.sessionId
}
const answered = (picked: string[], typed = ''): string =>
  answerNotes([{ question: '确认脚本？', picked, typed }])!

const resolved = (): RunRecord => ({
  sessionId: 'resolve-1',
  cardId: 1,
  action: 'resolve',
  status: 'done',
  startedAt: 0,
  harness: 'test',
  logPath: '/dev/null',
})

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-script-approval-'))
  fs.mkdirSync(path.dirname(file()), { recursive: true })
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'todo', 'README.md'), '# Open tasks\n\n- [ ] #1 [A video](1-a-video.md)\n')
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'next-id'), '2\n')
  forgetMachineState(root)
  setBoardRoot(root)
  setBoardProvider(null)
  write()
})
afterEach(() => {
  delete process.env[RUN_ENV]
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the script approval', () => {
  it('asks about the script as it reads, and records the user approving it', async () => {
    await askApproval()
    assert.match(text(), /^ {4}approves: [0-9a-f]{12}$/m)
    assert.equal(approved(), false)
    assert.equal(produce()?.reason, 'scriptUnapproved')
    await move(root, ['update-questions', '1', '--approve', '1'])
    assert.equal(approved(), true)
    assert.match(text(), /^questions: \[\]$/m)
    assert.equal(produce(), null)
    assert.deepEqual(validateSpec(file(), text(), 1), [])
  })

  it('is refused on a workflow built after planning, and before there is a script', async () => {
    write({ workflow: 'coding' })
    await assert.rejects(askApproval, /no script to approve/)
    write({ script: [] })
    await assert.rejects(askApproval, /write the script before asking/)
  })

  it('never comes from dropping a question, or from a question that asks something else', async () => {
    await askApproval()
    await move(root, ['update-questions', '1', '--drop', '1'])
    assert.equal(approved(), false)
    await move(root, ['update-questions', '1', '--append', '[user] 能访问演示环境吗？', '--option', '能', '--option', '不能'])
    await assert.rejects(() => move(root, ['update-questions', '1', '--approve', '1']), /does not ask for script approval/)
    assert.equal(approved(), false)
  })

  it('lapses when the script changes, and cannot approve a script newer than the question', async () => {
    await askApproval()
    write({ script: [...SCRIPT, '- **结尾**：新增一句'] })
    fs.writeFileSync(file(), text().replace('questions: []', `questions:\n  - question: "[user] 确认脚本？"\n    mode: single\n    options:\n      - 批准脚本\n      - 需要修改\n    recommend: []\n    approves: 000000000000`))
    await assert.rejects(() => move(root, ['update-questions', '1', '--approve', '1']), /changed after this question was asked/)

    write()
    await askApproval()
    await move(root, ['update-questions', '1', '--approve', '1'])
    assert.equal(approved(), true)
    const kept = text().match(/^script_approved: .*$/m)![0]
    write({ script: [...SCRIPT, '- **结尾**：新增一句'] })
    fs.writeFileSync(file(), text().replace('workflow: hyperframes-video', `workflow: hyperframes-video\n${kept}`))
    assert.equal(approved(), false)
    assert.equal(produce()?.reason, 'scriptUnapproved')
  })

  it('survives the film being embedded inside the script section', async () => {
    await askApproval()
    await move(root, ['update-questions', '1', '--approve', '1'])
    fs.writeFileSync(file(), text().replace('\n<!-- agent -->', `\n${FILM}\n\n<!-- agent -->`))
    assert.equal(approved(), true)
  })

  it('is withdrawn by asking again', async () => {
    await askApproval()
    await move(root, ['update-questions', '1', '--approve', '1'])
    await askApproval()
    assert.doesNotMatch(text(), /^script_approved:/m)
    assert.equal(approved(), false)
  })

  it('is not granted by an approval from before this workflow', () => {
    write({ legacy: true })
    assert.equal(findCard(1)!.scriptApproved, false)
    assert.equal(produce()?.reason, 'scriptUnapproved')
  })

  it('inside a run, counts only the user picking the approval and asking for nothing else', async () => {
    await askApproval()
    const approve = () => move(root, ['update-questions', '1', '--approve', '1'])
    for (const [action, notes] of [
      ['decide', undefined],
      ['clarify', answered(['批准脚本'])],
      ['resolve', answered(['需要修改'])],
      ['resolve', answered(['批准脚本'], '顺便把结尾改短')],
      ['resolve', 'Approve it'],
    ] as const) {
      inside(action, notes)
      await assert.rejects(approve, /only the user approves/, `${action}: ${notes}`)
      delete process.env[RUN_ENV]
      withStore((store) => (store.runs = []))
    }
    inside('resolve', answered(['批准脚本']))
    await approve()
    assert.equal(approved(), true)
  })

  it('is never answered by the decider', async () => {
    setDecider(true)
    await askApproval()
    assert.equal(decidable(findCard(1)!), false)
    write()
    await move(root, ['update-questions', '1', '--append', '[user] 能访问演示环境吗？', '--option', '能', '--option', '不能'])
    assert.equal(decidable(findCard(1)!), true)
  })
})

describe('production', () => {
  it('is refused before approval, both as a run and as a printed flow', async () => {
    assert.equal(produce()?.reason, 'scriptUnapproved')
    await assert.rejects(() => run(root, ['spec', 'hyperframes-editor', '1', '--print']), /script is not approved yet/)
    await askApproval()
    await move(root, ['update-questions', '1', '--approve', '1'])
    await run(root, ['spec', 'hyperframes-editor', '1', '--print'])
  })

  it('is never a build', () => {
    assert.equal(workflowRefusal({ action: 'implement', id: 1, title: 'A video' })?.reason, 'planDelivered')
    write({ workflow: 'coding' })
    assert.equal(workflowRefusal({ action: 'implement', id: 1, title: 'A video' }), null)
  })

  it('leaves the execute stage empty only on a workflow that finishes in planning', () => {
    assert.deepEqual(workflowProblems('hyperframes-video'), [])
    const mine = createWorkflow('Mine').id!
    assert.equal(setWorkflowLead(mine, 'plan', 'software-planner').ok, true)
    assert.match(workflowProblems(mine).join(' '), /no agent leading its execute stage/)
  })
})

describe('after the user answers', () => {
  const after = async (answer: () => Promise<unknown>) => {
    const before = markBoard()
    await answer()
    const r = resolved()
    return refinementRunsAfter(r, claimChanges(before, r.sessionId), before).runs
  }
  const clarify = { action: 'clarify', id: 1, title: 'A video', refineRound: 1, refineEffort: 'standard' }

  it('goes back to the scriptwriter to have the film made, and stops after a pass that asks nothing', async () => {
    await askApproval()
    assert.deepEqual(await after(() => move(root, ['update-questions', '1', '--approve', '1'])), [clarify])
    const qa = { ...resolved(), sessionId: 'clarify-1', action: 'clarify' as const, refineRound: 1 }
    assert.deepEqual(refinementRunsAfter(qa, [], markBoard()).runs, [])
  })

  it('goes back to the scriptwriter when the user asked for changes', async () => {
    await askApproval()
    assert.deepEqual(await after(() => move(root, ['update-questions', '1', '--drop', '1'])), [clarify])
  })

  it('writes up a finished film once, and leaves a ready one for the user', async () => {
    await finished()
    const qa = { ...resolved(), sessionId: 'clarify-1', action: 'clarify' as const, refineRound: 1 }
    assert.deepEqual(refinementRunsAfter(qa, [], markBoard()).runs, [
      { action: 'writing', id: 1, title: 'A video', refineRound: 2, refineEffort: 'standard' },
    ])
    await move(root, ['update', '1', '--status', 'ready'])
    assert.deepEqual(refinementRunsAfter(qa, [], markBoard()).runs, [])
  })
})

describe('archiving', () => {
  it('is what a finished film offers, never Implement', async () => {
    await finished()
    const card = findCard(1)!
    assert.equal(planDeliveryGap(card), null)
    assert.equal(canImplement(card), false)
    assert.equal(canRefine(card), false)
    await move(root, ['update', '1', '--status', 'ready'])
    assert.equal(gateable(findCard(1)!), false)
    assert.equal(scheduleWouldDoNothing({ ...findCard(1)!, schedule: { action: 'implement', notes: '' } }), true)
    await move(root, ['archive', '1'])
    assert.equal(fs.existsSync(file()), false)
  })

  for (const [what, spoil, words] of [
    ['an open question', () => askApproval(), /open questions|not approved as it now reads/],
    ['the film', () => fs.writeFileSync(file(), text().replace(FILM, '')), /no finished video or PowerPoint/],
    ['the re-render command', () => fs.writeFileSync(file(), text().replace('：`npm run render`', '')), /rebuilds it/],
    ['a revision still open', () => fs.writeFileSync(file(), text().replace('## Todo\n', '## Todo\n\n- [ ] 按反馈缩短结尾并重新渲染')), /not every todo is ticked/],
    ['the approved script', () => fs.writeFileSync(file(), text().replace('三步', '四步')), /not approved as it now reads/],
    ['the file itself', () => fs.rmSync(path.join(ASSETS, '1', 'a-video.mp4')), /is not on this machine/],
  ] as const) {
    it(`is refused without ${what}`, async () => {
      await finished()
      await spoil()
      await assert.rejects(() => move(root, ['archive', '1']), words)
      assert.equal(fs.existsSync(file()), true)
    })
  }

  // A slide deck finishes the same way (#1075): the approved slides, the deck on disk.
  const deck = async (): Promise<void> => {
    write({ workflow: 'slide-deck', todos: ['- [x] 写好逐页文案', '- [x] 生成演示文稿：`npm run build`'] })
    fs.writeFileSync(
      file(),
      text()
        .replace('## By `scriptwriter` agent', '## By `deck-planner` agent')
        .replace('<!-- agent -->', '<Asset src=".assets/1/a-deck.pptx" label="A deck" />\n\n<!-- agent -->'),
    )
    await askApproval()
    await move(root, ['update-questions', '1', '--approve', '1'])
    fs.mkdirSync(path.join(ASSETS, '1'), { recursive: true })
    fs.writeFileSync(path.join(ASSETS, '1', 'a-deck.pptx'), 'pptx')
  }

  it('archives a finished slide deck, never builds it', async () => {
    await deck()
    const card = findCard(1)!
    assert.equal(planDeliveryGap(card), null)
    assert.equal(canImplement(card), false)
    await move(root, ['archive', '1'])
    assert.equal(fs.existsSync(file()), false)
  })

  it('refuses a slide deck whose .pptx is gone', async () => {
    await deck()
    fs.rmSync(path.join(ASSETS, '1', 'a-deck.pptx'))
    await assert.rejects(() => move(root, ['archive', '1']), /a-deck\.pptx is not on this machine/)
  })

  it('keeps a revision in planning until it is done again', async () => {
    await finished()
    await move(root, ['update', '1', '--status', 'ready'])
    fs.writeFileSync(file(), text().replace('## Todo\n', '## Todo\n\n- [ ] 按反馈缩短结尾并重新渲染'))
    const card = findCard(1)!
    assert.equal(planDeliveryGap(card), 'todos')
    assert.equal(canRefine(card), true)
    assert.equal(canImplement(card), false)
  })
})
