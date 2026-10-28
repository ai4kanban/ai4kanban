// How many of a project's own agents are on, and the board's report of it (#1471).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import type { SentEvent } from '../src/lib/telemetry-contract.ts'
import { switchWorkflowAgent } from '../src/lib/agent/workflows.ts'
import { customAgentsOn, isCustomAgent } from '../src/lib/agents/roster.ts'
import { setUsageReporting, usageQueueFile, usageStateFile } from '../src/lib/machine/telemetry.ts'
import { reportBoardNumbers, reportRun, usageDay } from '../src/lib/machine/usage.ts'
import { forgetFileMemos } from '../src/lib/file-memo.ts'
import { AGENTS, BOARD_STATE, setBoardRoot } from '../src/lib/paths.ts'
import { restoreMachineHome } from './helpers/board.ts'

let root = ''
const kanban = (): string => path.join(root, 'docs', 'kanban')

/** A project agent, written the way the board's template writes one: in no workflow yet. */
const newAgent = (name: string, title?: string): string => {
  const file = path.join(AGENTS, name, 'AGENT.md')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(
    file,
    [
      '---',
      `name: ${name}`,
      'description: Unwritten — say here when a card needs this agent, and until you do the board asks for it on none.',
      'akb:',
      '  when: A card needs it.',
      ...(title ? ['  i18n:', '    en:', `      title: ${JSON.stringify(title)}`] : []),
      '---',
      '',
      `Unwritten. Write what \`${name}\` does here.`,
      '',
    ].join('\n'),
  )
  forgetFileMemos()
  return name
}


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
    newAgent('outliner')
    newAgent('checker')
    assert.deepEqual(customAgentsOn(), [])

    assert.equal(switchWorkflowAgent('coding', 'outliner', true).ok, true)
    assert.equal(switchWorkflowAgent('coding', 'checker', true).ok, true)
    assert.deepEqual(customAgentsOn().sort(), ['checker', 'outliner'])

    assert.equal(switchWorkflowAgent('coding', 'outliner', false).ok, true)
    assert.deepEqual(customAgentsOn(), ['checker'])
  })

  it("tells a project's agent from one the board ships", () => {
    newAgent('reviewer')
    assert.equal(isCustomAgent('reviewer'), true)
    assert.equal(isCustomAgent('ui-designer'), false)
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
