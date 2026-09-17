// Declared dependencies between spec agents (#782): `akb.dependencies` is read and checked
// like the rest of an agent, a question can name the agent it is about, and every way a spec
// run starts refuses one whose dependency on the card is not ready — saying why, starting
// nothing, and retrying nothing.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { dependencyRefusal } from '../src/lib/agent/dependencies.ts'
import { helperRound } from '../src/lib/agent/follow.ts'
import { refinementRunsAfter } from '../src/lib/agent/refine.ts'
import { askForSpec, noteSpecRefusals, openResume, readSpecRefusals } from '../src/lib/agent/sessions.ts'
import { startRun } from '../src/lib/agent/start.ts'
import { logPathOf, readRuns, withStore } from '../src/lib/agent/store.ts'
import type { AgentRequest, RunRecord } from '../src/lib/agent/types.ts'
import { findSpecAgent, specAgentCatalog, specAgentSelector } from '../src/lib/agents/index.ts'
import { serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import type { Meta, Question } from '../src/lib/types.ts'
import { findCard } from '../src/lib/view/read.ts'
import { forgetMachineState, move, refuses, run } from './helpers/board.ts'

let root = ''
const kanban = (): string => path.join(root, 'docs', 'kanban')

const agentFile = (name: string, extra: string[] = []): string =>
  [
    '---',
    `name: ${name}`,
    `description: Use when a card needs ${name}.`,
    'akb:',
    '  kind: spec',
    ...extra,
    '---',
    '',
    `You write the ${name} part.`,
    '',
  ].join('\n')

const needs = (...names: string[]): string[] => ['  dependencies:', ...names.map((n) => `    - agent: ${n}`)]

const agent = (name: string, extra: string[] = []): void => {
  const file = path.join(kanban(), 'agents', name, 'AGENT.md')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, agentFile(name, extra))
}

const cardPath = (): string => path.join(kanban(), 'todo', '12-a-card.md')

function card(sections: Record<string, string> = {}, questions: Question[] = []): void {
  const meta: Partial<Meta> = {
    title: 'A card',
    priority: 'med',
    roi: 'med',
    status: 'todo',
    release: '',
    blocked_by: [],
    related: [],
    modules: [],
    questions,
    schedule: null,
  }
  const body = Object.entries(sections).map(([name, text]) => `## By \`${name}\` agent\n\n${text}\n`)
  fs.writeFileSync(cardPath(), `${serializeFrontmatter(meta)}\n\nA card.\n\n${body.join('\n')}\n## Todo\n\n- [ ] Build it.\n`)
}

const ask = (question: string, agentName?: string): Question => ({
  text: `[user] ${question}`,
  mode: 'single',
  options: ['Yes — ship it', 'No — rework it'],
  recommend: [1],
  ...(agentName ? { agent: agentName } : {}),
})

const record = (run: Partial<RunRecord> & Pick<RunRecord, 'sessionId' | 'action'>): void => {
  const logPath = logPathOf(run.sessionId)
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  fs.writeFileSync(logPath, '')
  withStore((store) => {
    store.runs.push({
      cardId: 12,
      status: 'done',
      startedAt: Date.now(),
      code: null,
      harness: 'claude',
      logPath,
      ...run,
    })
  })
}

const specRun = (id: string, specAgent: string, rest: Partial<RunRecord> = {}): void =>
  record({ sessionId: id, action: 'spec', specAgent, ...rest })

const liveRun = (id: string, rest: Partial<RunRecord> = {}): void =>
  record({ sessionId: id, action: 'clarify', status: 'running', pid: process.pid, ...rest })

const helper = (specAgent: string): AgentRequest => ({ action: 'spec', id: 12, title: 'A card', specAgent })

const refusal = (name: string, scope = {}): string => dependencyRefusal(12, name, scope) ?? ''

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-deps-'))
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '13\n')
  setBoardRoot(root)
  agent('api-contract')
  agent('sdk-sample', needs('api-contract'))
  agent('free-agent')
  card()
})

afterEach(() => {
  delete process.env.KANBAN_RUN
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the declaration', () => {
  it('reads `akb.dependencies` off any agent, and nothing when it declares none', () => {
    assert.deepEqual(findSpecAgent('sdk-sample')!.dependencies, ['api-contract'])
    assert.deepEqual(findSpecAgent('api-contract')!.dependencies, [])
    assert.deepEqual(findSpecAgent('ui-designer')!.dependencies, ['copywriting'])
    assert.deepEqual(specAgentCatalog().problems, [])
  })

  it('takes several', () => {
    agent('release-page', needs('api-contract', 'sdk-sample'))
    assert.deepEqual(findSpecAgent('release-page')!.dependencies, ['api-contract', 'sdk-sample'])
  })

  for (const [what, extra, why] of [
    ['a flow list', ['  dependencies: [{ agent: api-contract }]'], /has to be a list/],
    ['a condition', ['  dependencies:', '    - agent: api-contract', '      when: always'], /no other key/],
    ['a bare name', ['  dependencies:', '    - api-contract'], /no other key/],
    ['itself', needs('broken'), /lists itself/],
    ['one agent twice', needs('api-contract', 'api-contract'), /twice/],
  ] as const) {
    it(`refuses ${what}`, () => {
      agent('broken', [...extra])
      assert.equal(findSpecAgent('broken'), null)
      assert.match(specAgentCatalog().problems.join('\n'), why)
    })
  }

  it('refuses an agent the board does not have, and whatever depends on the refused one', () => {
    agent('broken', needs('nobody-here'))
    agent('downstream', needs('broken'))
    assert.equal(findSpecAgent('broken'), null)
    assert.equal(findSpecAgent('downstream'), null)
    const problems = specAgentCatalog().problems.join('\n')
    assert.match(problems, /depends on `nobody-here`/)
    assert.match(problems, /depends on `broken`/)
  })

  it('tells the planner who waits for whom', () => {
    const roster = specAgentSelector(12)
    assert.match(roster, /- `sdk-sample`\n(.*\n)*? {2}starts only after `api-contract`/)
    assert.doesNotMatch(roster.split('- `free-agent`')[1]!.split('- `sdk-sample`')[0]!, /starts only after/)
  })
})

describe('a question that names its agent', () => {
  const written = (): Question[] => findCard(12)!.questions

  it('is written and read back with its agent, and `--update` keeps it', async () => {
    await move(root, ['update-questions', '12', '--append', '[user] Ship this contract?', '--option', 'Yes', '--option', 'No', '--agent', 'api-contract'])
    assert.equal(written()[0]!.agent, 'api-contract')
    assert.match(fs.readFileSync(cardPath(), 'utf8'), /\n {4}agent: api-contract\n/)
    await move(root, ['update-questions', '12', '--update', '1', '[user] Ship the reworked contract?', '--option', 'Yes', '--option', 'No'])
    assert.equal(written()[0]!.agent, 'api-contract')
    assert.equal(written()[0]!.text, '[user] Ship the reworked contract?')
  })

  it('keeps an agent on a plain question too', () => {
    card({}, [{ text: 'Which endpoint?', agent: 'api-contract' }])
    assert.deepEqual(written(), [{ text: 'Which endpoint?', agent: 'api-contract' }])
  })

  it('leaves an old question without one', () => {
    card({}, [ask('Ship it?')])
    assert.equal(written()[0]!.agent, undefined)
  })

  it('refuses an agent the board does not have', async () => {
    await refuses(root, ['update-questions', '12', '--append', '[user] Ship?', '--option', 'Yes', '--option', 'No', '--agent', 'nobody-here'], /not an agent on this board/)
  })

  it('is claimed by the spec run that asks it', async () => {
    specRun('api-run', 'api-contract', { status: 'running', pid: process.pid })
    process.env.KANBAN_RUN = 'api-run'
    await move(root, ['update-questions', '12', '--append', '[user] Ship?', '--option', 'Yes', '--option', 'No'])
    assert.equal(written()[0]!.agent, 'api-contract')
  })
})

describe('whether a dependency is ready', () => {
  it('lets an agent start when what it depends on never joined the card', () => {
    assert.equal(dependencyRefusal(12, 'sdk-sample'), null)
    assert.equal(dependencyRefusal(12, 'free-agent'), null)
  })

  it('refuses while the dependency has no section', () => {
    specRun('api-1', 'api-contract')
    assert.match(refusal('sdk-sample'), /`api-contract` has not written its section yet/)
    card({ 'api-contract': '' })
    assert.match(refusal('sdk-sample'), /has not written its section yet/)
  })

  it('lets it start once the section is there and nothing is open', () => {
    card({ 'api-contract': 'POST /things' })
    assert.equal(dependencyRefusal(12, 'sdk-sample'), null)
  })

  it('refuses while the dependency has an open question, and not one of another agent', () => {
    card({ 'api-contract': 'POST /things' }, [ask('Ship this contract?', 'api-contract')])
    const why = refusal('sdk-sample')
    assert.match(why, /`sdk-sample` can't start on #12 yet/)
    assert.match(why, /`api-contract` has an open question waiting for the user/)
    assert.match(why, /ask for `sdk-sample` again/)

    card({ 'api-contract': 'POST /things' }, [ask('Ship this sample?', 'free-agent'), ask('Unclaimed?')])
    assert.equal(dependencyRefusal(12, 'sdk-sample'), null)
  })

  it('counts a claimed question as joining the card', () => {
    card({}, [ask('Which endpoint?', 'api-contract')])
    assert.match(refusal('sdk-sample'), /has not written its section yet/)
  })

  it('refuses while the dependency is updating, or waiting to', () => {
    card({ 'api-contract': 'POST /things' })
    specRun('api-live', 'api-contract', { status: 'running', pid: process.pid })
    assert.match(refusal('sdk-sample'), /is still updating its section/)
    forgetMachineState(root)

    assert.match(refusal('sdk-sample', { queued: ['api-contract'] }), /has an update waiting to run/)
    liveRun('planner')
    askForSpec('planner', { specAgent: 'api-contract', cardId: 12 })
    assert.match(refusal('sdk-sample'), /has an update waiting to run/)
  })

  it('does not pass on what a failed or stopped run left behind, and does once a later run finishes', () => {
    card({ 'api-contract': 'POST /things' })
    specRun('api-old', 'api-contract', { startedAt: 1 })
    specRun('api-failed', 'api-contract', { status: 'error', startedAt: 2 })
    assert.match(refusal('sdk-sample'), /did not finish its last run \(it failed\)/)
    specRun('api-stopped', 'api-contract', { status: 'stopped', startedAt: 3 })
    assert.match(refusal('sdk-sample'), /it was stopped/)
    specRun('api-fixed', 'api-contract', { startedAt: 4 })
    assert.equal(dependencyRefusal(12, 'sdk-sample'), null)
  })

  it('reads the closing run as finished', () => {
    card({ 'api-contract': 'POST /things' })
    specRun('api-closing', 'api-contract', { status: 'running', pid: process.pid })
    assert.equal(dependencyRefusal(12, 'sdk-sample', { self: 'api-closing' }), null)
  })

  it('names every dependency that is not ready', () => {
    agent('release-page', needs('api-contract', 'sdk-sample'))
    card({ 'api-contract': 'POST /things', 'sdk-sample': '' }, [ask('Ship?', 'api-contract')])
    const why = refusal('release-page')
    assert.match(why, /`api-contract` has an open question/)
    assert.match(why, /`sdk-sample` has not written its section yet/)
  })

  it('refuses a loop between agents on the card, and ignores it off the card', () => {
    agent('left', needs('right'))
    agent('right', needs('left'))
    assert.equal(dependencyRefusal(12, 'left'), null)
    card({ right: 'text' })
    assert.match(refusal('left'), /loop back to it \(left → right → left\)/)
  })
})

describe('every way a spec run starts', () => {
  beforeEach(() => card({ 'api-contract': 'POST /things' }, [ask('Ship this contract?', 'api-contract')]))

  it('refuses a direct start and records no run', async () => {
    const before = readRuns().length
    const started = await startRun(helper('sdk-sample'))
    assert.ok('error' in started)
    assert.match(started.error, /open question/)
    assert.equal(readRuns().length, before)
    await assert.rejects(() => run(root, ['spec', 'sdk-sample', '12']), /can't start on #12 yet/)
    assert.equal(readRuns().length, before)
  })

  it('refuses a printed one', async () => {
    await assert.rejects(() => run(root, ['spec', 'sdk-sample', '12', '--print']), /`api-contract` has an open question/)
  })

  it('refuses a resume, before anything is recorded', async () => {
    specRun('sdk-failed', 'sdk-sample', { status: 'error', resumeId: 'abc' })
    const before = readRuns().length
    const opened = await openResume('sdk-failed')
    assert.ok('error' in opened)
    assert.match(opened.error, /open question/)
    assert.equal(readRuns().length, before)
  })

  it('refuses an ask inside a run, unless the dependency is asked for first in the same run', async () => {
    liveRun('planner')
    process.env.KANBAN_RUN = 'planner'
    await assert.rejects(() => run(root, ['spec', 'sdk-sample', '12']), /open question/)

    await run(root, ['spec', 'api-contract', '12'])
    await run(root, ['spec', 'sdk-sample', '12'])
  })

  it('refuses a helper asked before its dependency in one round, and starts the rest', () => {
    card()
    const round = helperRound([helper('sdk-sample'), helper('api-contract'), helper('free-agent')])
    assert.deepEqual(round.start.map((h) => h.specAgent), ['api-contract', 'free-agent'])
    assert.equal(round.refused.length, 1)
    assert.match(round.refused[0]!, /`sdk-sample` can't start.*`api-contract` has an update waiting to run/)

    const inOrder = helperRound([helper('api-contract'), helper('sdk-sample')])
    assert.deepEqual(inOrder.start.map((h) => h.specAgent), ['api-contract', 'sdk-sample'])
  })

  it('skips a refused helper and still starts the next one', () => {
    const round = helperRound([helper('sdk-sample'), helper('free-agent')])
    assert.deepEqual(round.start.map((h) => h.specAgent), ['free-agent'])
    assert.equal(round.refused.length, 1)
  })

  it('hands the refusals to the planner when the round ends, and retries nothing', () => {
    specRun('free-run', 'free-agent', { status: 'running', pid: process.pid })
    noteSpecRefusals('free-run', ['`sdk-sample` can\'t start on #12 yet: reason.'])
    assert.deepEqual(readSpecRefusals('free-run'), ['`sdk-sample` can\'t start on #12 yet: reason.'])

    card()
    const closing = readRuns().find((r) => r.sessionId === 'free-run')!
    const next = refinementRunsAfter(closing, [], new Map(), false, readSpecRefusals('free-run'))
    assert.match(next.stalled ?? '', /Spec agents not started: `sdk-sample`/)
    const lead = next.runs.find((r) => r.action === 'clarify')
    assert.ok(lead)
    assert.match(lead.notes ?? '', /`sdk-sample` can't start on #12 yet/)
    assert.equal(next.runs.some((r) => r.action === 'spec'), false)
  })

  it('says nothing while another helper of the round is still to run', () => {
    const closing: RunRecord = { sessionId: 'x', action: 'spec', specAgent: 'free-agent', cardId: 12, status: 'running', startedAt: 0, code: null, harness: 'claude', logPath: '' }
    const next = refinementRunsAfter(closing, [], new Map(), true, ['refused'])
    assert.equal(next.stalled, undefined)
    assert.equal(next.runs.length, 0)
  })

  it('starts the dependent agent once the question is answered', async () => {
    card({ 'api-contract': 'POST /things' })
    assert.equal(dependencyRefusal(12, 'sdk-sample'), null)
    assert.equal(helperRound([helper('sdk-sample')]).start.length, 1)
  })
})

describe('the copy that comes before the screen', () => {
  it('ships copywriting as a human-facing agent that keeps writing.md, with a Chinese name', () => {
    const copy = findSpecAgent('copywriting')!
    assert.equal(copy.builtIn, true)
    assert.match(copy.body, /## What you remember\n\n- \*\*`writing\.md`\*\*/)
    assert.equal(copy.output, 'human')
    assert.equal(copy.stage, 'plan')
    assert.equal(copy.i18n.zh?.title, '宣传文案')
    assert.ok(copy.i18n.zh?.description)
    assert.match(copy.description, /README/)
    assert.match(copy.description, /Skip user documentation/)
  })

  it('holds ui-designer back until the copy is confirmed, and not on a card without copy', () => {
    assert.equal(dependencyRefusal(12, 'ui-designer'), null)
    card({ copywriting: 'Plan cards with agents.' }, [ask('Use this copy?', 'copywriting')])
    assert.match(refusal('ui-designer'), /`copywriting` has an open question/)
    card({ copywriting: 'Plan cards with agents, faster.' }, [ask('Use the reworked copy?', 'copywriting')])
    assert.match(refusal('ui-designer'), /`copywriting` has an open question/)
    card({ copywriting: 'Plan cards with agents, faster.' })
    assert.equal(dependencyRefusal(12, 'ui-designer'), null)
  })
})
