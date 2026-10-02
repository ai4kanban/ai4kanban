// A workflow's scheduled agents (#1401): declared with `akb.hook: schedule`, switched and
// timed per workflow, each pass a card-less delivery that commits and lands like a build.
//
// The board is a real git repository: whether a pass leaves a commit is a git question.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { listDeliveries } from '../src/lib/agent/deliveries.ts'
import { RUN_ENV } from '../src/lib/agent/env.ts'
import { advanceLanding } from '../src/lib/agent/landing.ts'
import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { dueScheduledAgents, scheduledBusy, scheduledRequest } from '../src/lib/agent/scheduled.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import { setAutoCommit } from '../src/lib/agent/settings.ts'
import { withStore } from '../src/lib/agent/store.ts'
import {
  duplicateWorkflow,
  scheduledAgent,
  setWorkflowScheduledCadence,
  setWorkflowScheduledExtra,
  stampScheduledRun,
  switchWorkflowScheduled,
  workflowViews,
} from '../src/lib/agent/workflows.ts'
import { worktreeDir } from '../src/lib/agent/worktree.ts'
import { parseSpecAgent } from '../src/lib/agents/parse.ts'
import { formatStamp } from '../src/lib/cadence.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, move, refuses } from './helpers/board.ts'

let root = ''
const kanban = (): string => path.join(root, 'docs', 'kanban')
const PASS = { workflow: 'coding', agent: 'night-auditor' }
const pro = () => Promise.resolve('pro' as const)

const git = (args: string[], cwd = root): string => {
  const out = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (out.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${out.stderr}`)
  return out.stdout.trim()
}

const agentFile = (name: string, hook = 'schedule'): string =>
  ['---', `name: ${name}`, 'description: Use when.', 'akb:', `  hook: ${hook}`, '---', '', `You are ${name}.`, ''].join('\n')

const scheduleAgent = (name: string): void => {
  const home = path.join(kanban(), 'agents', name)
  fs.mkdirSync(home, { recursive: true })
  fs.writeFileSync(path.join(home, 'AGENT.md'), agentFile(name))
}

const at = (iso: string): Date => new Date(iso)

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-scheduled-'))
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '9\n')
  fs.writeFileSync(path.join(kanban(), 'todo', 'README.md'), '# Tasks\n\n## Tasks\n')
  fs.writeFileSync(path.join(kanban(), 'config.md'), '- **Solution** — product\n')
  fs.writeFileSync(path.join(root, 'shared.txt'), 'base\n')
  git(['init', '--quiet', '-b', 'main'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'test'])
  git(['add', '-A'])
  git(['commit', '--quiet', '-m', 'start'])
  setBoardRoot(root)
  // The one Coding ships stays out of the way: these are about a board's own.
  assert.equal(switchWorkflowScheduled('coding', 'qa-manager', false).ok, true)
  setAutoCommit(true)
  scheduleAgent(PASS.agent)
})

afterEach(() => {
  delete process.env[RUN_ENV]
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

// One pass, opened the way the board opens it.
function open(): string {
  const opened = openRun(scheduledRequest(PASS), 'prompt', [])
  if ('error' in opened) throw new Error(opened.error)
  return opened.run.sessionId
}

async function end(sessionId: string, status: 'done' | 'error' = 'done'): Promise<void> {
  const record = withStore((store) => store.runs.find((r) => r.sessionId === sessionId))
  fs.writeFileSync(record!.logPath, 'log\n')
  await closeRun(sessionId, { status, ok: status === 'done', code: 0 })
}

const enable = (now: Date): void => {
  assert.equal(switchWorkflowScheduled(PASS.workflow, PASS.agent, true, now).ok, true)
}

describe('declaring a scheduled agent', () => {
  it('reads `akb.hook: schedule` as an agent on no stage', () => {
    const read = parseSpecAgent(agentFile('night-auditor'), 'AGENT.md', () => null)
    assert.ok('agent' in read)
    assert.equal(read.agent.schedule, true)
    assert.equal(read.agent.stage, null)
  })

  it('refuses `akb.lead: schedule`', () => {
    const file = agentFile('night-auditor').replace('hook: schedule', 'lead: schedule')
    const read = parseSpecAgent(file, 'AGENT.md', () => null)
    assert.ok('problem' in read)
    assert.match(read.problem, /`plan` or `execute`/)
  })
})

describe("a workflow's scheduled agents", () => {
  it('lists one no workflow has taken under Coding, off', () => {
    const coding = workflowViews().find((w) => w.id === 'coding')!
    assert.deepEqual(
      coding.scheduled?.filter((s) => !s.builtIn).map((s) => ({ agent: s.agent, off: s.off, cadence: s.cadence })),
      [{ agent: PASS.agent, off: true, cadence: '1d' }],
    )
  })

  it('keeps its switch, cadence and extra requirements with the workflow', () => {
    enable(at('2026-10-01T09:00'))
    assert.equal(setWorkflowScheduledCadence(PASS.workflow, PASS.agent, '6h').ok, true)
    assert.equal(setWorkflowScheduledExtra(PASS.workflow, PASS.agent, 'Only the docs.').ok, true)
    const one = scheduledAgent(PASS.workflow, PASS.agent)!
    assert.deepEqual({ off: one.off, cadence: one.cadence, extra: one.extra }, { off: undefined, cadence: '6h', extra: 'Only the docs.' })
    assert.match(buildPrompt(scheduledRequest(PASS)), /what this workflow asks of you here ———\n\nOnly the docs\./)
  })

  it('refuses a cadence it cannot read, and an agent that is not scheduled', () => {
    assert.equal(setWorkflowScheduledCadence(PASS.workflow, PASS.agent, 'weekly').reason, 'cadence')
    assert.equal(switchWorkflowScheduled(PASS.workflow, 'ui-designer', true).reason, 'agentNotSchedule')
  })

  it('copies them with the workflow, never sharing one', () => {
    enable(at('2026-10-01T09:00'))
    const copy = duplicateWorkflow('coding')
    assert.equal(copy.ok, true)
    const copied = workflowViews().find((w) => w.id === copy.id)!.scheduled!
    assert.equal(copied.length, 2)
    assert.ok(copied.every((one) => one.agent !== PASS.agent && one.agent !== 'qa-manager' && one.lastRun === ''))
  })
})

describe('the prompt a pass is given', () => {
  it('says who it is, where the board is and that nobody answers — and nothing about when', () => {
    enable(at('2026-10-01T09:00'))
    const prompt = buildPrompt(scheduledRequest(PASS))
    assert.match(prompt, /^You are the `night-auditor` agent of the `Coding` workflow\./)
    assert.ok(prompt.includes(`The board is at \`${kanban()}\`.`))
    assert.match(prompt, /Nobody is watching: never ask\./)
    assert.match(prompt, /You are night-auditor\./)
    assert.doesNotMatch(prompt.split(root).join(''), /cadence|schedule|last run/i)
  })
})

describe('when a scheduled agent is due', () => {
  it('waits a whole cadence from the moment it was switched on', async () => {
    enable(at('2026-10-01T09:00'))
    assert.deepEqual(await dueScheduledAgents(pro, at('2026-10-01T09:01')), [])
    assert.deepEqual(await dueScheduledAgents(pro, at('2026-10-02T08:59')), [])
    assert.deepEqual(await dueScheduledAgents(pro, at('2026-10-02T09:00')), [scheduledRequest(PASS)])
  })

  it('never starts one that is switched off', async () => {
    assert.deepEqual(await dueScheduledAgents(pro, at('2030-01-01T00:00')), [])
  })

  it('counts from the last run that passed', async () => {
    enable(at('2026-10-01T09:00'))
    assert.equal(stampScheduledRun(PASS.workflow, PASS.agent, at('2026-10-05T10:00')), true)
    assert.deepEqual(await dueScheduledAgents(pro, at('2026-10-06T09:59')), [])
    assert.equal((await dueScheduledAgents(pro, at('2026-10-06T10:00'))).length, 1)
  })

  it('does not start a second pass while one is running', async () => {
    enable(new Date(Date.now() - 3 * 86_400_000))
    assert.equal((await dueScheduledAgents(pro)).length, 1)
    open()
    assert.equal(scheduledBusy(PASS)?.reason, 'scheduledRunning')
    assert.deepEqual(await dueScheduledAgents(pro), [])
  })

  it('passes over a Pro workflow this account cannot run', async () => {
    enable(at('2026-10-01T09:00'))
    const copy = duplicateWorkflow('hyperframes-video')
    scheduleAgent('clip-checker')
    assert.equal(switchWorkflowScheduled(copy.id!, 'clip-checker', true, at('2026-10-01T09:00')).ok, true)
    const free = () => Promise.resolve('free' as const)
    const due = await dueScheduledAgents(free, at('2026-10-03T09:00'))
    assert.deepEqual(due.map((r) => r.specAgent), [PASS.agent])
  })
})

describe('one pass', () => {
  it('refuses an agent that is switched off', () => {
    const opened = openRun(scheduledRequest(PASS), 'prompt', [])
    assert.ok('error' in opened)
    assert.equal(opened.reason, 'scheduledOff')
  })

  it('commits what it changed and lands it, then records when it began', async () => {
    enable(new Date(Date.now() - 3 * 86_400_000))
    const session = open()
    const [delivery] = listDeliveries()
    assert.deepEqual(delivery!.scheduled, PASS)
    assert.equal(delivery!.cardId, null)
    fs.writeFileSync(path.join(worktreeDir(delivery!.worktree!), 'shared.txt'), 'audited\n')
    await end(session)
    await advanceLanding()

    assert.equal(fs.readFileSync(path.join(root, 'shared.txt'), 'utf8'), 'audited\n')
    assert.equal(git(['log', '--format=%s', '-1']), 'night-auditor: scheduled run (Coding)')
    assert.equal(listDeliveries()[0]!.status, 'finished')
    assert.equal(scheduledAgent(PASS.workflow, PASS.agent)!.lastRun, formatStamp(new Date(delivery!.startedAt)))
  })

  it('commits nothing and lands nothing when it changed nothing', async () => {
    enable(new Date(Date.now() - 3 * 86_400_000))
    const head = git(['rev-parse', 'HEAD'])
    await end(open())
    await advanceLanding()

    assert.equal(git(['rev-parse', 'HEAD']), head)
    assert.equal(listDeliveries()[0]!.status, 'finished')
    assert.equal(listDeliveries()[0]!.landing?.commit, undefined)
  })

  it('leaves the last run where it was when it fails, and waits a cadence before the next', async () => {
    enable(new Date(Date.now() - 3 * 86_400_000))
    await end(open(), 'error')
    assert.equal(scheduledAgent(PASS.workflow, PASS.agent)!.lastRun, '')
    assert.deepEqual(await dueScheduledAgents(pro), [])
    assert.equal((await dueScheduledAgents(pro, new Date(Date.now() + 86_400_000 + 60_000))).length, 1)
  })
})

describe('`raw list --archived --since last-run`', () => {
  it('is refused outside a scheduled run', async () => {
    await refuses(root, ['list', '--archived', '--since', 'last-run'], /only works inside a scheduled agent's run/)
  })

  it('lists nothing on the first run', async () => {
    enable(new Date(Date.now() - 3 * 86_400_000))
    process.env[RUN_ENV] = open()
    const out = await move(root, ['list', '--archived', '--since', 'last-run'])
    assert.deepEqual({ cards: out.cards, firstRun: out.firstRun }, { cards: [], firstRun: true })
  })

  it('reads as when the last run that passed began', async () => {
    enable(at('2026-09-01T09:00'))
    stampScheduledRun(PASS.workflow, PASS.agent, at('2026-09-20T08:30'))
    process.env[RUN_ENV] = open()
    const out = await move(root, ['list', '--archived', '--since', 'last-run'])
    assert.equal(out.since, '2026-09-20 08:30')
  })
})
