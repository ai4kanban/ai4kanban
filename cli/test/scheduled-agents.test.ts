// A workflow's scheduled agents (#1401): listed by a workflow, each pass a card-less delivery
// that commits and lands like a build. Switching and timing them is the project's Agents page.
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
import { completeDelivery } from '../src/lib/agent/complete.ts'
import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { scheduledBusy, scheduledRequest } from '../src/lib/agent/scheduled.ts'
import { cmdTriageAdd } from '../src/commands/triage.ts'
import { cmdWorkflowList } from '../src/commands/workflow.ts'
import { runAgent } from '../src/lib/agent-cli.ts'
import { archiveInboxItem, readInbox } from '../src/lib/signals/inbox.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import { startRun } from '../src/lib/agent/start.ts'
import { withStore } from '../src/lib/agent/store.ts'
import {
  listedScheduled,
  scheduledAgent,
  stampScheduledRun,
  scheduledMembers,
  workflowById,
} from '../src/lib/agent/workflows.ts'
import { worktreeDir } from '../src/lib/agent/worktree.ts'
import { agentRoster } from '../src/lib/agent/roles.ts'
import { parseSpecAgent } from '../src/lib/agents/parse.ts'
import { formatStamp } from '../src/lib/cadence.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, move, refuses, saveScheduled } from './helpers/board.ts'

let root = ''
const kanban = (): string => path.join(root, 'docs', 'kanban')
// No workflow lists it, so it sits in the first one.
const PASS = { workflow: 'blog-post', agent: 'night-auditor' }

const git = (args: string[], cwd = root): string => {
  const out = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (out.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${out.stderr}`)
  return out.stdout.trim()
}

const agentFile = (name: string, reads = ''): string =>
  ['---', `name: ${name}`, 'description: Use when.', ...(reads ? ['akb:', `  reads: ${reads}`] : []), '---', '', `You are ${name}.`, ''].join('\n')

const scheduleAgent = (name: string, reads = ''): void => {
  const home = path.join(kanban(), 'agents', name)
  fs.mkdirSync(home, { recursive: true })
  fs.writeFileSync(path.join(home, 'AGENT.md'), agentFile(name, reads))
}

const at = (iso: string): Date => new Date(iso)

const QA_OFF = { agent: 'qa-manager', extra: '', off: true }

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
  saveScheduled(root, 'coding', [QA_OFF])
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

const enable = (now: Date, more: Record<string, unknown> = {}): void => {
  saveScheduled(root, PASS.workflow, [QA_OFF, { agent: PASS.agent, extra: '', since: formatStamp(now), ...more }])
}

describe('declaring a scheduled agent', () => {
  it('reads `akb.reads`, and refuses a value it does not know', () => {
    const read = parseSpecAgent(agentFile('night-auditor', 'chats'), 'AGENT.md', () => null)
    assert.ok('agent' in read)
    assert.equal(read.agent.reads, 'chats')
    const bad = parseSpecAgent(agentFile('night-auditor', 'tweets'), 'AGENT.md', () => null)
    assert.ok('problem' in bad)
    assert.match(bad.problem, /`archived-cards` or `chats` or `dismissals`$/)
  })

  it('reads the retired `akb.reads: commits` as archived cards', () => {
    const read = parseSpecAgent(agentFile('night-auditor', 'commits'), 'AGENT.md', () => null)
    assert.ok('agent' in read)
    assert.equal(read.agent.reads, 'archived-cards')
  })

  it('refuses `akb.hook: schedule`, from before its workflow listed it', () => {
    const file = agentFile('night-auditor', 'chats').replace('akb:', 'akb:\n  hook: schedule')
    const read = parseSpecAgent(file, 'AGENT.md', () => null)
    assert.ok('problem' in read)
    assert.match(read.problem, /declares `akb.hook`, which the board no longer reads/)
  })
})

describe("a workflow's scheduled agents", () => {
  it('lists one no workflow has taken under the first workflow, off', () => {
    const builtIn = new Set(agentRoster().filter((e) => e.builtIn).map((e) => e.name))
    assert.deepEqual(
      scheduledMembers(workflowById(PASS.workflow)!).filter((s) => !builtIn.has(s.agent)).map((s) => ({ agent: s.agent, off: s.off, cadence: s.cadence })),
      [{ agent: PASS.agent, off: true, cadence: 'auto' }],
    )
  })

  it('asks a pass for the extra requirements the board saved', () => {
    enable(at('2026-10-01T09:00'), { cadence: '6h', extra: 'Only the docs.' })
    const one = scheduledAgent(PASS.workflow, PASS.agent)!
    assert.deepEqual({ off: one.off, cadence: one.cadence, extra: one.extra }, { off: undefined, cadence: '6h', extra: 'Only the docs.' })
    assert.match(buildPrompt(scheduledRequest(PASS)), /what this workflow asks of you here ———\n\nOnly the docs\./)
  })

})

describe('`workflow list`', () => {
  it('names only what WORKFLOW.md lists, whatever is saved here', () => {
    enable(at('2026-10-01T09:00'), { cadence: '6h', lastRun: '2026-10-02 09:00' })
    assert.deepEqual(listedScheduled(workflowById('coding')!), ['qa-manager'])
    const { workflows } = cmdWorkflowList() as { workflows: { id: string; scheduled: unknown }[] }
    assert.deepEqual(workflows.find((w) => w.id === 'coding')!.scheduled, ['qa-manager'])
  })

  it('has no `workflow schedule` to report changes from', async () => {
    assert.notEqual(await runAgent(['workflow', 'schedule', 'coding', '--off', 'qa-manager'], { program: 'akb', cwd: root }), 0)
  })
})

describe('the prompt a pass is given', () => {
  it('says who it is, where the board is and that nobody answers — and nothing about when', () => {
    enable(at('2026-10-01T09:00'))
    const prompt = buildPrompt(scheduledRequest(PASS))
    assert.match(prompt, /^You are the `night-auditor` agent of the `Blog post` workflow\./)
    assert.ok(prompt.includes(`The board is at \`${kanban()}\`, in the project at \`${root}\`.`))
    assert.match(prompt, /Nobody is watching: never ask\./)
    assert.match(prompt, /You are night-auditor\./)
    assert.doesNotMatch(prompt.split(root).join(''), /cadence|schedule|last run/i)
  })
})

describe('what a pass sends to triage', () => {
  it('claims what it sends to triage', async () => {
    enable(new Date(Date.now() - 3 * 86_400_000))
    process.env[RUN_ENV] = open()
    await cmdTriageAdd({ title: 'A gap', text: 'Something to do.', workflow: 'coding' })
    delete process.env[RUN_ENV]
    assert.equal(readInbox()[0]!.agent, PASS.agent)
  })

  it('leaves an item added outside a run unclaimed', async () => {
    await cmdTriageAdd({ title: 'By hand', text: 'Typed in.', workflow: 'coding' })
    assert.equal(readInbox()[0]!.agent, undefined)
  })
})

describe('one pass', () => {
  it('runs an agent that is switched off when started by hand, and leaves it off', async () => {
    const session = open()
    const [delivery] = listDeliveries()
    assert.deepEqual(delivery!.scheduled, PASS)
    assert.equal(scheduledAgent(PASS.workflow, PASS.agent)!.off, true)
    process.env[RUN_ENV] = session
    completeDelivery(delivery!.deliveryId)
    delete process.env[RUN_ENV]
    await end(session)

    const one = scheduledAgent(PASS.workflow, PASS.agent)!
    assert.equal(one.off, true)
    assert.equal(one.lastRun, formatStamp(new Date(delivery!.startedAt)))
  })

  it('does not start a second pass while one is running', () => {
    enable(new Date(Date.now() - 3 * 86_400_000))
    assert.equal(scheduledBusy(PASS), null)
    open()
    assert.equal(scheduledBusy(PASS)?.reason, 'scheduledRunning')
  })

  it('still refuses a second pass of a switched-off agent while one is running', async () => {
    open()
    const again = await startRun(scheduledRequest(PASS))
    assert.ok('error' in again)
    assert.equal(again.reason, 'scheduledRunning')
  })

  it('records explicit completion and leaves Git changes with the agent', async () => {
    enable(new Date(Date.now() - 3 * 86_400_000))
    const session = open()
    const [delivery] = listDeliveries()
    assert.deepEqual(delivery!.scheduled, PASS)
    assert.equal(delivery!.cardId, null)
    fs.writeFileSync(path.join(root, 'shared.txt'), 'audited\n')
    process.env[RUN_ENV] = session
    completeDelivery(delivery!.deliveryId)
    delete process.env[RUN_ENV]
    await end(session)

    assert.equal(fs.readFileSync(path.join(root, 'shared.txt'), 'utf8'), 'audited\n')
    assert.equal(git(['log', '--format=%s', '-1']), 'start')
    assert.equal(listDeliveries()[0]!.status, 'finished')
    assert.equal(scheduledAgent(PASS.workflow, PASS.agent)!.lastRun, formatStamp(new Date(delivery!.startedAt)))
  })

  it('commits nothing and lands nothing when it changed nothing', async () => {
    enable(new Date(Date.now() - 3 * 86_400_000))
    const head = git(['rev-parse', 'HEAD'])
    const session = open()
    process.env[RUN_ENV] = session
    completeDelivery(listDeliveries()[0]!.deliveryId)
    delete process.env[RUN_ENV]
    await end(session)

    assert.equal(git(['rev-parse', 'HEAD']), head)
    assert.equal(listDeliveries()[0]!.status, 'finished')
    assert.equal(listDeliveries()[0]!.landing?.commit, undefined)
  })

  it('leaves the last run where it was when it fails', async () => {
    enable(new Date(Date.now() - 3 * 86_400_000))
    await end(open(), 'error')
    assert.equal(scheduledAgent(PASS.workflow, PASS.agent)!.lastRun, '')
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
