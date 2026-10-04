// How many of a project's own agents are on, and the board's report of it (#1471).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import type { SentEvent } from '../../telemetry/contract.ts'
import { addWorkflowHelper, switchWorkflowAgent } from '../src/lib/agent/workflows.ts'
import { createAgent, customAgentsOn, isCustomAgent } from '../src/lib/agents/roster.ts'
import { setUsageReporting, usageQueueFile, usageStateFile } from '../src/lib/machine/telemetry.ts'
import { reportBoardNumbers, reportRun, usageDay } from '../src/lib/machine/usage.ts'
import { BOARD_STATE, setBoardRoot } from '../src/lib/paths.ts'
import { restoreMachineHome } from './helpers/board.ts'

let root = ''
const kanban = (): string => path.join(root, 'docs', 'kanban')


const queued = (): SentEvent[] =>
  fs.existsSync(usageQueueFile())
    ? fs.readFileSync(usageQueueFile(), 'utf8').trim().split('\n').map((line) => JSON.parse(line) as SentEvent)
    : []

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-custom-agents-'))
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  fs.writeFileSync(path.join(kanban(), 'todo', 'README.md'), '# Tasks\n\n## Tasks\n')
  process.env.AI4KANBAN_HOME = path.join(root, 'home')
  delete process.env.KANBAN_RUN
  delete process.env.KANBAN_DESKTOP
  setBoardRoot(root)
  // Today's batch is already out, so nothing here reaches the network.
  fs.mkdirSync(process.env.AI4KANBAN_HOME, { recursive: true })
  fs.writeFileSync(usageStateFile(), JSON.stringify({ sentDay: usageDay(), dayEvent: usageDay() }))
})

afterEach(() => {
  restoreMachineHome()
  fs.rmSync(root, { recursive: true, force: true })
})

describe("a project's own agents", () => {
  it('counts the ones a workflow runs, and never a shipped one', () => {
    // Made in no workflow, so off.
    assert.equal(createAgent('outliner', 'plan').ok, true)
    assert.equal(createAgent('checker', 'plan').ok, true)
    assert.deepEqual(customAgentsOn(), [])

    assert.equal(addWorkflowHelper('coding', 'plan', 'outliner').ok, true)
    assert.equal(addWorkflowHelper('coding', 'plan', 'checker').ok, true)
    assert.deepEqual(customAgentsOn().sort(), ['checker', 'outliner'])

    assert.equal(switchWorkflowAgent('coding', 'plan', 'outliner', false).ok, true)
    assert.deepEqual(customAgentsOn(), ['checker'])
    // Nothing runs after a build (#1507).
    assert.equal(createAgent('after', 'execute').ok, false)
  })

  it("tells a project's agent from one the board ships", () => {
    assert.equal(createAgent('reviewer', 'plan').ok, true)
    assert.equal(isCustomAgent('reviewer'), true)
    assert.equal(isCustomAgent('ui-designer'), false)
    assert.equal(isCustomAgent('software-planner'), false)
    assert.equal(isCustomAgent(undefined), false)
  })
})

describe("the board's report", () => {
  it('sends how many are on once a day, under a board id that stays', () => {
    reportBoardNumbers(() => 2)
    reportBoardNumbers(() => 3)
    const sent = queued().filter((e) => e.name === 'board_numbers')
    assert.equal(sent.length, 1)
    assert.equal(sent[0]!.custom_agents_on, 2)
    const { id } = JSON.parse(fs.readFileSync(path.join(BOARD_STATE, 'usage-board.json'), 'utf8')) as { id: string }
    assert.equal(sent[0]!.board, id)
  })

  it('sends nothing for a board with none on, or from a machine that said no', () => {
    reportBoardNumbers(() => 0)
    assert.equal(fs.existsSync(path.join(BOARD_STATE, 'usage-board.json')), false)
    setUsageReporting(false)
    reportBoardNumbers(() => 1)
    assert.equal(fs.existsSync(path.join(BOARD_STATE, 'usage-board.json')), false)
    assert.deepEqual(queued().filter((e) => e.name === 'board_numbers'), [])
  })

  it("marks a run by the project's own agent", () => {
    reportRun('started', 'claude-code', true)
    reportRun('failed', 'claude-code', false)
    assert.deepEqual(
      queued().filter((e) => e.name.startsWith('run_')).map((e) => [e.name, e.custom_agent]),
      [['run_started', true], ['run_failed', false]],
    )
  })
})
