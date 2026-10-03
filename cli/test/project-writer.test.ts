// The project description and the retired goal (#1268).
//
// What a pass writes is the agent's judgement; asserted here is when the board starts one on
// its own, that the window moves only on a pass, and how an older board's goal is carried over.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { formatStamp } from '../src/lib/cadence.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { buildAsk } from '../src/lib/agent/prompts.ts'
import { closeRun } from '../src/lib/agent/sessions.ts'
import { readRule } from '../src/lib/agent/rules.ts'
import { readAgentRuntime } from '../src/lib/agent/runtimes.ts'
import { projectDescription, setProjectDescription, stampProjectDescription } from '../src/lib/agent/settings.ts'
import { readRuns } from '../src/lib/agent/store.ts'
import { findGuide } from '../src/lib/guide.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { renameProductFile, retireGoal, scaffoldProjectMemory } from '../src/lib/memory.ts'
import { setBoardRoot, RULES, SESSIONS, UI_CONFIG } from '../src/lib/paths.ts'
import { readSetupChecklist, tickSetupStep } from '../src/lib/setup.ts'
import { nextWork } from '../src/lib/view/dispatch.ts'
import { forgetMachineState } from './helpers/board.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')
const projectFile = (): string => path.join(kanban(), 'memory', 'project.md')
const goalFile = (): string => path.join(kanban(), 'memory', 'goal.md')
const decisionsFile = (): string => path.join(kanban(), 'memory', 'agents', 'planner', 'decisions.md')

const HOUR = 60 * 60_000
const DAY = 24 * HOUR

const DESCRIBED = '# Project\n\n## What it is\n\n- A board.\n'

function describeProject(text = DESCRIBED): void {
  fs.mkdirSync(path.dirname(projectFile()), { recursive: true })
  fs.writeFileSync(projectFile(), text)
}

function git(args: string[], when?: number): void {
  const date = when === undefined ? {} : { GIT_COMMITTER_DATE: new Date(when).toISOString(), GIT_AUTHOR_DATE: new Date(when).toISOString() }
  const out = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...date },
  })
  assert.equal(out.status, 0, out.stderr)
}

const commitAt = (when: number): void => git(['commit', '--allow-empty', '-q', '-m', 'x'], when)

function pastRuns(...runs: { status: string; startedAt: number }[]): void {
  fs.mkdirSync(path.dirname(SESSIONS), { recursive: true })
  fs.writeFileSync(
    SESSIONS,
    JSON.stringify({
      runs: runs.map((run, i) => ({
        sessionId: `past-${i}`,
        cardId: null,
        action: 'describe-project',
        status: run.status,
        startedAt: run.startedAt,
        ...(run.status === 'running' ? {} : { endedAt: run.startedAt + 1 }),
        harness: 'claude-code',
        logPath: '/dev/null',
      })),
      deliveries: [],
    }),
  )
}

const work = async (): Promise<string[]> =>
  (await nextWork(() => Promise.resolve(true))).map((w) => w.action).filter((a) => a === 'describe-project')

function quiet(job: () => void): string {
  const sink = startCollecting()
  try {
    job()
    return sink.out.join('\n')
  } finally {
    stopCollecting()
  }
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-project-writer-'))
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  forgetMachineState(root)
  setBoardRoot(root)
})

afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe('the description the board starts on its own', () => {
  it('ships on auto, with a header-only file on a new board', () => {
    assert.deepEqual(projectDescription(), { enabled: true, cadence: 'auto', lastRun: '' })
    scaffoldProjectMemory()
    assert.match(fs.readFileSync(projectFile(), 'utf8'), /^# Project\n/)
  })

  it('starts one while the file has no description', async () => {
    scaffoldProjectMemory()
    assert.deepEqual(await work(), ['describe-project'])
  })

  it('starts nothing without a commit since the last pass', async () => {
    git(['init', '-q'])
    commitAt(Date.now() - 3 * DAY)
    describeProject()
    stampProjectDescription(new Date(Date.now() - 2 * DAY))
    assert.deepEqual(await work(), [])
  })

  it('starts one for a commit since the last pass', async () => {
    git(['init', '-q'])
    commitAt(Date.now() - HOUR)
    describeProject()
    stampProjectDescription(new Date(Date.now() - 2 * DAY))
    assert.deepEqual(await work(), ['describe-project'])
  })

  it('waits an hour in auto even with new commits, and a cadence the user set', async () => {
    git(['init', '-q'])
    commitAt(Date.now() - 60_000)
    describeProject()
    stampProjectDescription(new Date(Date.now() - 30 * 60_000))
    assert.deepEqual(await work(), [])
    stampProjectDescription(new Date(Date.now() - 2 * HOUR))
    assert.deepEqual(await work(), ['describe-project'])
    assert.equal(setProjectDescription({ enabled: true, cadence: '1d' }).ok, true)
    assert.deepEqual(await work(), [])
  })

  it('outside git, starts one only while the file has no description', async () => {
    stampProjectDescription(new Date(Date.now() - 2 * DAY))
    describeProject()
    assert.deepEqual(await work(), [])
    describeProject('# Project\n')
    assert.deepEqual(await work(), ['describe-project'])
  })

  it('starts nothing while one is going', async () => {
    pastRuns({ status: 'running', startedAt: Date.now() - 60_000 })
    assert.deepEqual(await work(), [])
  })

  it('does not retry a failure on the next tick, and does a cadence later', async () => {
    pastRuns({ status: 'error', startedAt: Date.now() - 60_000 })
    assert.deepEqual(await work(), [])
    pastRuns({ status: 'error', startedAt: Date.now() - DAY - 60_000 })
    assert.deepEqual(await work(), ['describe-project'])
  })

  it('moves the window to the start of a pass, and not on a failure', async () => {
    const started = Date.now() - 10 * 60_000
    pastRuns({ status: 'running', startedAt: started })
    await closeRun('past-0', { status: 'error' }, { reportEnd: false })
    assert.equal(projectDescription().lastRun, '')
    pastRuns({ status: 'running', startedAt: started })
    await closeRun('past-0', { status: 'done', ok: true, code: 0 }, { reportEnd: false })
    assert.equal(projectDescription().lastRun, formatStamp(new Date(started)))
  })

  it('is handed the one file it writes, and points at the guide', () => {
    const said = quiet(() => printFlow({ action: 'describe-project' }))
    assert.match(said, /memory\/project\.md/)
    assert.match(buildAsk({ action: 'describe-project' }), /akb guide describe-project/)
    assert.match(findGuide('describe-project')!.text, /## Who it is for/)
  })
})

describe('retiring goal.md', () => {
  const header = (): string => fs.readFileSync(decisionsFile(), 'utf8').split('\n')[0]!

  it('moves what the user wrote above every topic, then deletes the file', () => {
    scaffoldProjectMemory()
    fs.appendFileSync(decisionsFile(), '\n## cloud\n\n- **Region**: eu only.\n')
    fs.writeFileSync(goalFile(), '---\nreviewed: good\n---\n\nShip a hosted board by spring.\n')
    assert.match(retireGoal()!, /moved the goal/)
    const text = fs.readFileSync(decisionsFile(), 'utf8')
    assert.equal(header(), '# Decisions')
    assert.ok(text.indexOf('Ship a hosted board by spring.') < text.indexOf('## cloud'))
    assert.match(text, /## cloud\n\n- \*\*Region\*\*: eu only\./)
    assert.equal(fs.existsSync(goalFile()), false)
  })

  it('drops the seeded paragraphs around the words', () => {
    scaffoldProjectMemory()
    fs.writeFileSync(
      goalFile(),
      "# Goal\n\nThe direction, in the user's own words — where this is headed. One short statement. The\nuser owns this file; the agent seeds it but does not invent the goal.\n\nOne board per team.\n",
    )
    retireGoal()
    const text = fs.readFileSync(decisionsFile(), 'utf8')
    assert.match(text, /One board per team\./)
    assert.doesNotMatch(text, /# Goal|the agent seeds it/)
  })

  it('deletes a goal holding only the template or nothing, and writes no decision', () => {
    scaffoldProjectMemory()
    const before = fs.readFileSync(decisionsFile(), 'utf8')
    for (const text of ['---\nreviewed: weak\n---\n', '', '# Goal\n\n_(not filled in yet — the user writes this.)_\n']) {
      fs.writeFileSync(goalFile(), text)
      assert.equal(retireGoal(), 'removed the empty goal')
      assert.equal(fs.existsSync(goalFile()), false)
    }
    assert.equal(fs.readFileSync(decisionsFile(), 'utf8'), before)
  })

  it('does nothing without a goal file', () => {
    assert.equal(retireGoal(), null)
    assert.equal(fs.existsSync(decisionsFile()), false)
  })

  it('creates decisions.md with its header when there is none', () => {
    fs.mkdirSync(path.dirname(goalFile()), { recursive: true })
    fs.writeFileSync(goalFile(), 'Stay local-first.\n')
    retireGoal()
    assert.equal(header(), '# Decisions')
    assert.match(fs.readFileSync(decisionsFile(), 'utf8'), /Stay local-first\.\n$/)
  })
})

describe("an older checklist's goal step", () => {
  it('is read past, and never holds setup open', () => {
    fs.writeFileSync(
      path.join(kanban(), 'setup-checklist.md'),
      [
        '# Setup checklist',
        '',
        '- [x] `install` (script) — Install.',
        '- [ ] `goal` (you) — Write the project goal.',
        '- [ ] `agent` (you) — Pick the agent.',
        '',
      ].join('\n'),
    )
    assert.deepEqual(readSetupChecklist()!.map((s) => s.name), ['install', 'agent'])
    assert.deepEqual(tickSetupStep('goal'), { unknown: true })
    const done = tickSetupStep('agent')
    assert.ok('ok' in done && done.finished)
    assert.equal(fs.existsSync(path.join(kanban(), 'setup-checklist.md')), false)
  })
})

describe('an older board that still says product (#1391)', () => {
  const oldFile = (): string => path.join(kanban(), 'memory', 'product.md')
  const OLD = '# Product\n\n## What it is\n\n- The old words.\n'

  function writeOld(text = OLD): void {
    fs.mkdirSync(path.dirname(oldFile()), { recursive: true })
    fs.writeFileSync(oldFile(), text)
  }

  it('renames the file, and has nothing left to do on a second pass', () => {
    writeOld()
    assert.match(renameProductFile()!, /renamed/)
    assert.equal(fs.existsSync(oldFile()), false)
    assert.equal(fs.readFileSync(projectFile(), 'utf8'), OLD)
    assert.equal(renameProductFile(), null)
    scaffoldProjectMemory()
    assert.equal(fs.readFileSync(projectFile(), 'utf8'), OLD)
  })

  it('renames over a project.md that holds only its starter', () => {
    scaffoldProjectMemory()
    writeOld()
    assert.match(renameProductFile()!, /renamed/)
    assert.equal(fs.readFileSync(projectFile(), 'utf8'), OLD)
  })

  it('keeps a written project.md and drops the old file', () => {
    describeProject()
    writeOld()
    assert.match(renameProductFile()!, /removed/)
    assert.equal(fs.existsSync(oldFile()), false)
    assert.equal(fs.readFileSync(projectFile(), 'utf8'), DESCRIBED)
  })

  it('drops an old file that was never described, so the new starter is written', () => {
    writeOld("# Product\n\nWhat the product is today, from its users' side. Rewritten whole by `akb describe-product`;\nedits here do not last.\n")
    assert.match(renameProductFile()!, /removed/)
    scaffoldProjectMemory()
    assert.match(fs.readFileSync(projectFile(), 'utf8'), /^# Project\n[\s\S]*akb describe-project/)
  })

  it('carries the cadence, the last pass and the runtime pick to the new names', async () => {
    fs.mkdirSync(path.dirname(UI_CONFIG), { recursive: true })
    const lastRun = formatStamp(new Date(Date.now() - HOUR))
    fs.writeFileSync(
      UI_CONFIG,
      JSON.stringify({
        productDescription: { cadence: '3d', lastRun },
        agentRuntime: { 'product-writer': 'fast', builder: 'slow' },
      }),
    )
    describeProject()
    assert.deepEqual(projectDescription(), { enabled: true, cadence: '3d', lastRun })
    assert.deepEqual(readAgentRuntime(), { 'project-writer': 'fast', builder: 'slow' })
    assert.deepEqual(await work(), [])
    stampProjectDescription(new Date())
    const saved = JSON.parse(fs.readFileSync(UI_CONFIG, 'utf8'))
    assert.equal(saved.productDescription, undefined)
    assert.equal(saved.projectDescription.cadence, '3d')
    assert.deepEqual(saved.agentRuntime, { 'project-writer': 'fast', builder: 'slow' })
  })

  it('carries the rule to the new name, never over one already written', () => {
    fs.mkdirSync(RULES, { recursive: true })
    fs.writeFileSync(path.join(RULES, 'product-writer.md'), 'Keep it to one page.\n')
    assert.equal(readRule('project-writer'), 'Keep it to one page.')
    assert.equal(fs.existsSync(path.join(RULES, 'product-writer.md')), false)
    fs.writeFileSync(path.join(RULES, 'product-writer.md'), 'An older rule.\n')
    assert.equal(readRule('project-writer'), 'Keep it to one page.')
  })

  it('still reads a run recorded under the old action', () => {
    pastRuns({ status: 'done', startedAt: Date.now() - DAY })
    const text = fs.readFileSync(SESSIONS, 'utf8').replace('describe-project', 'describe-product')
    fs.writeFileSync(SESSIONS, text)
    assert.deepEqual(readRuns().map((r) => r.action), ['describe-project'])
  })
})
