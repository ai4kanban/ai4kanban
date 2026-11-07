// Creating a card writes it under the number Cloud gave its task (#2105). Invalid group paths
// and stale references stop before anything is written.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, afterEach, beforeEach, describe, it } from 'node:test'

import { cmdCreate } from '../src/commands/card.ts'
import { joinDelivery, listDeliveries } from '../src/lib/agent/deliveries.ts'
import { RUN_ENV } from '../src/lib/agent/env.ts'
import { peekRun } from '../src/lib/agent/sessions.ts'
import { withStore } from '../src/lib/agent/store.ts'
import type { RunRecord } from '../src/lib/agent/types.ts'
import { buildBoardProgram } from '../src/lib/cli/board.ts'
import { runBoard } from '../src/lib/board-cli.ts'
import { BoardError } from '../src/lib/io.ts'
import { validateSpec } from '../src/lib/spec-contract.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, move, refuses } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-card-create-'))
const kanban = path.join(root, 'docs', 'kanban')
const todo = path.join(kanban, 'todo')

beforeEach(() => {
  delete process.env[RUN_ENV]
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(path.join(todo, 'features'), { recursive: true })
  fs.mkdirSync(path.join(todo, 'recurring'), { recursive: true })
  fs.mkdirSync(path.join(todo, '7-group', 'features'), { recursive: true })
  setBoardRoot(root)
})

afterEach(() => delete process.env[RUN_ENV])
after(() => fs.rmSync(root, { recursive: true, force: true }))

const create = (argv: string[]): Promise<Record<string, unknown>> => move(root, ['create', ...argv])

describe('card creation', () => {
  it('缺少 Cloud 编号时指向创建命令，且不写卡（#222）', () => {
    const before = fs.readdirSync(todo, { recursive: true })
    assert.throws(() => cmdCreate({ title: '测试卡片', asked: [], workflow: 'coding' }), (error: unknown) => {
      assert.ok(error instanceof BoardError)
      assert.equal(error.kind, 'needs-cloud')
      assert.equal(error.exitCode, 1)
      assert.match(error.message, /akb raw create/)
      assert.match(error.message, /Cloud 分配编号/)
      assert.doesNotMatch(error.message, /--id|web app|idea/i)
      return true
    })
    assert.deepEqual(fs.readdirSync(todo, { recursive: true }), before)
  })

  it('scaffolds the exact decision sections', async () => {
    const made = await create(['--title', 'A card'])
    assert.ok(typeof made.file === 'string')
    const written = fs.readFileSync(path.join(root, made.file), 'utf8')
    assert.deepEqual(
      written.split('\n').filter((line) => /^(#{2,3}\s|<!-- agent -->)/.test(line)),
      [
        '## Worth noting',
        '<!-- agent -->',
        '## Scope',
        '## Todo',
        '## Decided by the agent',
        '### Overruled by the user',
      ],
    )
  })

  it('scaffolds drafts and moves acceptance into Scope without making build steps', async () => {
    const checklist = '- [ ] First result.\n* [X] Second result.\n- Third result.'
    for (const [i, draft] of ['A $& draft.\n\n```md\n## Done when\n<!-- agent -->\n```\n\nText <!-- hidden\n## Scope\n-->\n', `A draft.\n\n## Done when\n${checklist}`].entries()) {
      const bodyFile = path.join(root, `draft-${i}.md`)
      fs.writeFileSync(bodyFile, draft)
      const made = await create(['--title', `Draft ${i}`, '--body-file', bodyFile])
      const file = path.join(root, String(made.file))
      const written = fs.readFileSync(file, 'utf8')
      assert.deepEqual(validateSpec(file, written), [])
      assert.ok(written.includes(draft.split('\n')[0]!))
      assert.match(written, /## Todo\n- \[ \] every task must have todos/)
      if (i) {
        assert.ok(written.includes(`### Done when\n${checklist}`))
        assert.ok(written.indexOf('## Scope') < written.indexOf('### Done when'))
        assert.ok(written.indexOf('### Done when') < written.indexOf('## Todo'))
        assert.doesNotMatch(written.split('## Todo')[1]!, /First result/)
      } else assert.doesNotMatch(written, /^### Done when$/m)
    }
  })

  it('preserves full bodies and relocates only real acceptance headings', async () => {
    const scaffold = await create(['--title', 'Scaffold'])
    const base = fs.readFileSync(path.join(root, String(scaffold.file)), 'utf8').split('---')[2]!.trim() + '\n'
    const checklist = '### Done when\n- [ ] A result.\n* [x] Another result.\n\n'
    const proper = base.replace('## Todo', checklist + '## Todo')
    const quoted = '````md\n```\n## Done when\n<!-- agent -->\n```\n````\n\nText <!-- hidden\n## Done when\n<!-- agent -->\n-->\n\n'
    for (const [i, body] of [base, proper, base.replace('## Todo', checklist.replace('###', '##') + '## Todo'), base.replace('<!-- agent -->', quoted + '<!-- agent -->')].entries()) {
      const bodyFile = path.join(root, `full-${i}.md`)
      fs.writeFileSync(bodyFile, body)
      const made = await create(['--title', `Full ${i}`, '--body-file', bodyFile])
      const file = path.join(root, String(made.file))
      const written = fs.readFileSync(file, 'utf8')
      assert.deepEqual(validateSpec(file, written), [])
      assert.ok(written.endsWith(i === 2 ? proper : body))
    }
  })

  it('refuses the retired recurring options and points at the agent guide (#1414)', async () => {
    await refuses(root, ['create', '--title', 'A repeated job', '--recurring'], /--recurring is gone[\s\S]*akb guide write-agent/)
    await refuses(root, ['create', '--title', 'A job', '--cadence', '1d'], /--cadence is gone[\s\S]*akb guide write-agent/)
    const made = await create(['--title', 'A card'])
    await refuses(root, ['update', String(made.id), '--cadence', '1d'], /--cadence is gone/)
    await refuses(root, ['record-run', String(made.id)], /unknown command/)
  })

  it('runs a card made of a triage item on the workflow the item named (#2139)', async () => {
    fs.mkdirSync(path.join(kanban, 'triage'), { recursive: true })
    fs.writeFileSync(
      path.join(kanban, 'triage', 'shorter.md'),
      '---\nsource_id: item-1\ntitle: Shorter\nworkflow: hyperframes-video\ncollected_at: 2026-10-27 10:00\nimported_at: 2026-10-27 10:00\n---\n\nCut it.\n',
    )
    const made = await create(['--title', 'Shorter', '--triage', 'item-1'])
    assert.match(fs.readFileSync(path.join(root, String(made.file)), 'utf8'), /^workflow: hyperframes-video$/m)
  })

  it('requires a complete card instead of reserving an id', async () => {
    await refuses(root, ['create'], /required option .*--title/)
    await refuses(root, ['create', '--title', 'A card', '--count', '3'], /unknown option .*--count/)
  })

  it('has no roi to set (#206)', async () => {
    await refuses(root, ['create', '--title', 'A card', '--roi', 'high'], /unknown option '--roi'/)
    await refuses(root, ['update', '1', '--roi', 'high'], /unknown option '--roi'/)
  })

  it('takes no number but the one Cloud gave its task (#2105)', async () => {
    assert.notEqual(await runBoard(['create', '--title', 'A card'], { cwd: root }), 0)
    assert.deepEqual(fs.readdirSync(todo).filter((f) => f.endsWith('.md')), [])
  })

  it('rejects a link to a number that has no open card', async () => {
    await refuses(
      root,
      ['create', '--title', 'Dangling link', '--related', '7'],
      /#7, which is not an open card/,
    )
  })

  it('puts the one-card and group rules in create help', () => {
    const program = buildBoardProgram({ program: 'akb raw', cwd: root, installHint: '通过插件连接云端项目', version: null })
    const create = program.commands.find((c) => c.name() === 'create')
    assert.ok(create)
    // Wrapped to the terminal, so a phrase is matched against one flat line.
    const help = create.helpInformation().replace(/\s+/g, ' ')
    assert.match(help, /write exactly ONE card/i)
    assert.match(help, /existing open cards/)
    assert.match(help, /Group task/)
    assert.doesNotMatch(help, /--count/)
  })

  // A **Start now** writes its own card and then builds it (#470). The delivery it opened
  // with no card takes the id here, and the card is being built from the moment it exists.
  it('hands a card made by a Start now run to the delivery it is building in', async () => {
    const build: RunRecord = {
      sessionId: 'build-run',
      cardId: null,
      action: 'implement',
      status: 'running',
      startedAt: Date.now(),
      harness: 'test',
      logPath: '/dev/null',
    }
    const typed = 'Rename the heading'
    const deliveryId = withStore((store) => {
      store.runs.push(build)
      return joinDelivery(store, build, typed, 'implement', undefined, { title: typed, approved: typed }).deliveryId
    })
    process.env[RUN_ENV] = build.sessionId

    assert.equal(await runBoard(['create', '--title', typed, '--id', '8', '--workflow', 'coding'], { cwd: root }), 0)
    assert.equal(peekRun(build.sessionId)?.cardId, 8)
    assert.equal(listDeliveries().find((d) => d.deliveryId === deliveryId)?.cardId, 8)
    assert.match(fs.readFileSync(path.join(todo, '8-rename-the-heading.md'), 'utf8'), /status: implementing/)
  })
})
