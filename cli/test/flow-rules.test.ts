// One rule per agent, in the user's own words (#306, #420).
//
// What is asked here: a rule reaches the prompt and reaches it LAST, a printed flow carries
// the same rule a started session does, and a delivery runs on the rules it started with
// however the files move underneath it.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { chatPrompt } from '../src/lib/agent/chat.ts'
import { cmdSpec } from '../src/commands/spec.ts'
import { readRuns } from '../src/lib/agent/sessions.ts'
import { cmdStartRun } from '../src/commands/run.ts'
import { activeDelivery } from '../src/lib/agent/deliveries.ts'
import { CHAT_RUNTIME_ENV, RUN_ENV } from '../src/lib/agent/env.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { agentHarness, setupInstruction } from '../src/lib/agent/resolve.ts'
import { addRuntime, setAgentRuntime } from '../src/lib/agent/runtimes.ts'
import { ruleFor, setAgentRule } from '../src/lib/agent/rules.ts'
import { readAgents } from '../src/lib/agents/roster.ts'
import { findGuide } from '../src/lib/guide.ts'
import { findSpecAgent } from '../src/lib/agents/index.ts'
import { setLanguage } from '../src/lib/machine/settings.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import { withStore } from '../src/lib/agent/store.ts'
import { RULES, setBoardRoot } from '../src/lib/paths.ts'
import { restoreMachineHome, run as akb } from './helpers/board.ts'

let root = ''
// This machine, for the tests that read the language off it (#337). Pinned for every test
// here, so the developer's own pick can never change what a prompt says.
let home = ''

const card = (id: number, title: string): string =>
  [
    '---',
    `title: ${title}`,
    'priority: med',
    'roi: med',
    'status: ready',
    'release: ""',
    'blocked_by: []',
    'related: []',
    'modules: []',
    'questions: []',
    '---',
    '',
    'What this card is for.',
    '',
    '<!-- agent -->',
    '',
    '## Scope',
    '- **A requirement**: build it.',
    '',
  ].join('\n')

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-rules-'))
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-rules-home-'))
  process.env.AI4KANBAN_HOME = home
  fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo', 'features'), { recursive: true })
  setBoardRoot(root)
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'todo', 'features', '1-card.md'), card(1, 'card one'))
  delete process.env[RUN_ENV]
  delete process.env[CHAT_RUNTIME_ENV]
})

afterEach(() => {
  delete process.env[RUN_ENV]
  delete process.env[CHAT_RUNTIME_ENV]
  restoreMachineHome()
  fs.rmSync(home, { recursive: true, force: true })
  fs.rmSync(root, { recursive: true, force: true })
})

// One session, opened and closed the way the command and the watcher do.
function run(action: 'implement', id: number): string {
  const opened = openRun({ action, id, title: 'card one' }, 'prompt', [])
  if ('error' in opened) throw new Error(opened.error)
  return opened.run.sessionId
}

async function end(sessionId: string): Promise<void> {
  const record = withStore((store) => store.runs.find((r) => r.sessionId === sessionId))
  fs.writeFileSync(record!.logPath, 'log\n')
  await closeRun(sessionId, { status: 'done', ok: true, code: 0 })
}

describe('in-session spec work', () => {
  it('prints specialist instructions and rules without starting a run', async () => {
    setAgentRule('ui-designer', 'Keep to the existing palette.')
    const file = path.join(root, 'docs/kanban/todo/features/1-card.md')
    const before = fs.readFileSync(file, 'utf8')
    const sink = startCollecting()
    try {
      await akb(root, ['spec', 'ui-designer', '1', 'Use scrolling tabs.', '--print'])
    } finally {
      stopCollecting()
    }
    const printed = sink.out.join('\n')
    assert.match(printed, /printed, not started/)
    assert.match(printed, /Use scrolling tabs/)
    assert.match(printed, /Be a spec agent/)
    assert.match(printed, /raw validate <task-id>/)
    assert.match(printed, /continue it in this session/)
    assert.ok(printed.trimEnd().endsWith('Keep to the existing palette.'))
    assert.equal(readRuns().length, 0)
    assert.equal(fs.readFileSync(file, 'utf8'), before)
  })

  it('prints inside a board run without queuing a specialist', async () => {
    process.env[RUN_ENV] = run('implement', 1)
    const before = JSON.stringify(readRuns())
    startCollecting()
    try {
      const result = await cmdSpec({ agent: 'ui-designer', id: 1, print: true })
      assert.equal(result.mode, 'print')
    } finally {
      stopCollecting()
    }
    assert.equal(JSON.stringify(readRuns()), before)
  })

  // #1598: an agent set to another runtime than the caller's never runs in its session.
  it('queues an agent on another runtime than the run asking for it', async () => {
    process.env[RUN_ENV] = run('implement', 1)
    setAgentRuntime('ui-designer', addRuntime('Other', 'codex').id!)
    const sink = startCollecting()
    try {
      const result = await cmdSpec({ agent: 'ui-designer', id: 1, print: true })
      assert.equal(result.queued, true)
    } finally {
      stopCollecting()
    }
    assert.match(sink.out.join('\n'), /asked for the ui-designer spec agent/)
  })

  it("prints in a chat turn on the agent's own runtime", async () => {
    process.env[CHAT_RUNTIME_ENV] = agentHarness('ui-designer').runtime
    startCollecting()
    try {
      assert.equal((await cmdSpec({ agent: 'ui-designer', id: 1, print: true })).mode, 'print')
    } finally {
      stopCollecting()
    }
    assert.equal(readRuns().length, 0)
  })

  it('prints when the caller names no runtime', async () => {
    setAgentRuntime('ui-designer', addRuntime('Other', 'codex').id!)
    startCollecting()
    try {
      assert.equal((await cmdSpec({ agent: 'ui-designer', id: 1, print: true })).mode, 'print')
    } finally {
      stopCollecting()
    }
    assert.equal(readRuns().length, 0)
  })
})

describe('the files', () => {
  it('is nothing until a rule is saved, and nothing again when one is cleared', async () => {
    assert.equal(fs.existsSync(RULES), false)
    assert.deepEqual(setAgentRule('builder', 'Install first.'), { ok: true })
    assert.equal(fs.readFileSync(path.join(RULES, 'builder.md'), 'utf8').trim(), 'Install first.')
    assert.deepEqual(setAgentRule('builder', '   '), { ok: true })
    assert.equal(fs.existsSync(path.join(RULES, 'builder.md')), false)
  })

  it('moves the old planner rule onto the Software planner, once (#858)', () => {
    fs.mkdirSync(RULES, { recursive: true })
    fs.writeFileSync(path.join(RULES, 'planner.md'), 'Keep it short.\n')
    assert.equal(ruleFor({ action: 'create', id: 1 }), 'Keep it short.')
    assert.equal(fs.existsSync(path.join(RULES, 'planner.md')), false)
    assert.equal(fs.readFileSync(path.join(RULES, 'software-planner.md'), 'utf8').trim(), 'Keep it short.')
  })

  it('is named by the agent, so every flow it runs reads one file (#420)', async () => {
    setAgentRule('software-planner', 'Say what changed.')
    assert.equal(fs.readFileSync(path.join(RULES, 'software-planner.md'), 'utf8').trim(), 'Say what changed.')
    for (const action of ['edit', 'create', 'resolve'] as const) {
      assert.equal(ruleFor({ action, id: 1 }), 'Say what changed.', action)
      assert.equal(fs.existsSync(path.join(RULES, `${action}.md`)), false, action)
    }
  })

  it('refuses a name no agent on this board answers to', async () => {
    const agent = setAgentRule('deployer', 'Ship it.')
    assert.equal(agent.ok, false)
    assert.match(agent.error!, /discussion-helper, builder, memory-pruner/)
  })

  it("carries each agent's rule on the roster, and nothing for the ones without one", async () => {
    setAgentRule('builder', 'Install first.')
    const { agents } = await readAgents()
    assert.equal(agents.find((a) => a.name === 'builder')!.rule, 'Install first.')
    assert.equal(agents.find((a) => a.name === 'software-planner')!.rule, '')
    // One rule, every flow that agent runs.
    for (const action of ['implement', 'conflict'] as const) {
      assert.equal(ruleFor({ action, id: 1 }), 'Install first.', action)
    }
  })
})

describe('the prompt', () => {
  it('leaves planning requirements in the guide', () => {
    const prompt = buildPrompt({ action: 'clarify', id: 1, refineRound: 1 })
    assert.match(prompt, /Plan task 1 .*in this one session following `akb guide refine`/)
    assert.doesNotMatch(prompt, /Append the gaps|Do not resolve|don't implement/)
  })

  it('has add-task refine inline only when the source is concrete', () => {
    const guide = findGuide('add-task')!.text
    assert.match(guide, /Repeating work[\s\S]*`schedule` agent[\s\S]*akb guide write-agent/)
    assert.match(guide, /open question[\s\S]*akb guide update-questions/)
    assert.doesNotMatch(guide, /Parallel|--effort/)
    assert.match(guide, /Inline[\s\S]*source already supplies[\s\S]*akb card refine <id> --print/)
    assert.match(guide, /Separate session[\s\S]*akb card refine <id>`/)
  })

  it('keeps the question format in one guide', () => {
    assert.match(findGuide('update-questions')!.text, /--recommended-option[\s\S]*--option/)
    for (const name of ['add-task', 'refine', 'setup', 'spec-agent']) {
      const guide = findGuide(name)!.text
      assert.match(guide, /akb guide\s+update-questions/, name)
      assert.doesNotMatch(guide, /--recommended-option|--mode multi/, name)
    }
  })

  it('has no recurring guide, and asks how a scheduled agent keeps its state (#1414)', () => {
    assert.equal(findGuide('recurring-task'), null)
    const guide = findGuide('write-agent')!.text
    assert.match(guide, /State between runs[\s\S]*assume no file or format/)
    assert.match(guide, /akb workflow schedule <workflow> --on <name> --cadence <cadence\|auto>/)
  })

  it('plans in one clarify session under the refine guide', () => {
    const req = { action: 'clarify' as const, id: 1, refineRound: 1 }
    assert.match(buildPrompt(req), /akb guide refine/)
    startCollecting()
    try {
      assert.deepEqual(printFlow(req).guides, ['refine', 'writing', 'update-questions'])
    } finally {
      stopCollecting()
    }
    for (const gone of ['qa-parallel', 'qa-loop', 'qa-lightweight', 'validate-assumption', 'decide', 'gate', 'review']) {
      assert.equal(findGuide(gone), null, gone)
    }
  })

  it('takes no effort on the refine command', async () => {
    fs.writeFileSync(
      path.join(root, 'docs', 'kanban', 'todo', 'features', '1-card.md'),
      card(1, 'card one').replace('status: ready', 'status: todo'),
    )
    startCollecting()
    try {
      const flow = await cmdStartRun('refine', [1], { print: true })
      assert.deepEqual(flow.guides, ['refine', 'writing', 'update-questions'])
    } finally {
      stopCollecting()
    }
    await assert.rejects(() => akb(root, ['card', 'refine', '1', '--effort', 'standard', '--print']))
  })

  it('has the build run its own checks, since nothing reviews it', () => {
    const build = findGuide('implement')!.text
    assert.match(build, /printed, interactive implementation may stay uncommitted/)
    assert.match(build, /Background runs always keep their delivery\s+path/)
    assert.match(build, /nothing reviews the build after you[\s\S]*repository-required check/)
    assert.doesNotMatch(build, /review path/)
  })

  it('routes implementation blockers through card questions', () => {
    const prompt = buildPrompt({ action: 'implement', id: 1, title: 'card one' })
    const guide = findGuide('implement')!.text
    assert.match(prompt, /akb guide implement/)
    assert.doesNotMatch(prompt, /Leave any questions as open questions/)
    assert.doesNotMatch(prompt, /update-questions/)
    assert.doesNotMatch(guide, /run-blocker/)
    assert.match(guide, /Preserve settled decisions and unrelated questions/)
    assert.match(guide, /akb guide update-questions/)
    assert.match(guide, /Stop only dependent work; resume it/)
    assert.match(findGuide('update-questions')!.text, /### Implementation blockers/)
    const build = buildPrompt({ action: 'implement', description: 'Build a widget' })
    assert.match(build, /blockers needing user action[\s\S]*akb guide update-questions/)
    // Nothing reviews the build, so the build records what it decided (#1203).
    assert.match(guide, /Decisions made while building[\s\S]*Worth noting after implementation/)
  })

  it('loads writing upfront for planning and not for a build', () => {
    for (const action of ['clarify', 'resolve', 'edit'] as const) {
      startCollecting()
      try {
        const flow = printFlow({ action, id: 1, title: 'card one' })
        assert.ok((flow.guides as string[]).includes('writing'), action)
      } finally {
        stopCollecting()
      }
    }
    startCollecting()
    try {
      const flow = printFlow({ action: 'implement', id: 1, title: 'card one' })
      assert.equal((flow.guides as string[]).includes('writing'), false)
    } finally {
      stopCollecting()
    }
  })

  it('keeps each worth-noting entry to one reviewer decision and one sentence', () => {
    const guide = findGuide('writing')!.text
    assert.match(guide, /one entry is one reviewer decision, written as one sentence/)
    assert.match(guide, /omit chronology, evidence trails, exhaustive consequences/)
    assert.match(guide, /Never approve a deviation here/)
  })

  it('routes independent follow-ups without a user placement decision', () => {
    for (const name of ['implement', 'update-questions']) {
      assert.match(findGuide(name)!.text, /`akb guide follow-up`/)
    }
    assert.match(findGuide('update-questions')!.text, /Never ask whether to fix work here or create a card/)
    const followUp = findGuide('follow-up')!.text
    assert.match(followUp, /without asking permission or blocking\s+the original/)
    assert.match(followUp, /never defer a required fix/)
    // Follow-ups queue in triage, where they are judged (#1388); a change to another card is a revise.
    assert.match(followUp, /`akb triage add /)
    assert.match(followUp, /create no card/)
    assert.match(followUp, /`akb card revise <id>/)
  })

  it('makes the latest target authoritative in a conflict', () => {
    const guide = findGuide('conflict')!.text
    assert.match(guide, /target branch as the authoritative current implementation/)
    assert.match(guide, /Do not create or update cards/)
    assert.doesNotMatch(guide, /Review follows/)
    assert.match(buildPrompt({ action: 'conflict', id: 1, title: 'card one' }), /Follow `akb guide conflict`/)
  })

  // Applying answers is the one thing that moves a card under a build, so the pass that does
  // it is the one thing that can say whether the build is still the right build (#637).
  it('makes the pass that applies answers say what they did to a build in flight', () => {
    const resolve = findGuide('resolve')!.text
    assert.match(resolve, /delivery answered <delivery> --unchanged "<why>"/)
    assert.match(resolve, /delivery answered <delivery> --changed "<why>"/)
    assert.match(resolve, /Record it before you drop the questions/)
    assert.match(resolve, /Judge the meaning, not the words/)
    // Confirming work that contradicts what was approved is a change, however finished.
    assert.match(resolve, /A wrong implementation confirmed is still a change/)
    // Nothing here asks anyone to compare the card's text against the approved copy.
    assert.doesNotMatch(resolve, /compare[\s\S]{0,40}approved copy/)
  })

  it('starts resolve and revise on their own guide, with no QA pass after', () => {
    for (const [action, guide] of [['resolve', 'resolve'], ['edit', 'revise']] as const) {
      const req = { action, id: 1, notes: 'Use A.' }
      const prompt = buildPrompt(req)
      assert.match(prompt, new RegExp(`akb guide ${guide}`))
      assert.doesNotMatch(prompt, /qa-lightweight|qa-loop/)
      startCollecting()
      try {
        const guides = printFlow(req).guides as string[]
        assert.ok(guides.includes(guide), action)
        assert.ok(!guides.some((g) => g.startsWith('qa-')), action)
      } finally {
        stopCollecting()
      }
    }
    // A revise that changes what the card delivers plans it again, in the same session.
    assert.match(findGuide('revise')!.text, /akb guide refine/)
  })

  it('shows the spec-agent catalog to every planning session and to no spec run', () => {
    for (const action of ['clarify', 'resolve', 'edit'] as const) {
      const prompt = buildPrompt({ action, id: 1 })
      assert.match(prompt, /<spec-agents>/)
      // The catalog is names, descriptions and ownership — never a skill's own instructions.
      assert.match(prompt, /- `ui-designer`/)
      assert.doesNotMatch(prompt, /You draw the screen a card needs/)
    }
    assert.doesNotMatch(buildPrompt({ action: 'implement', id: 1 }), /<spec-agents>/)
    assert.doesNotMatch(buildPrompt({ action: 'spec', id: 1, specAgent: 'ui-designer' }), /<spec-agents>/)
  })

  it('keeps the card-creation refinement choice in one guide', () => {
    assert.match(
      buildPrompt({ action: 'create', description: 'Add a task.' }),
      /Follow `akb guide add-task`/,
    )
    startCollecting()
    try {
      const flow = printFlow({ action: 'create', description: 'Add a task.' })
      const next = (flow.next as string[]).join('\n')
      assert.doesNotMatch(next, /akb card refine <id>/)
    } finally {
      stopCollecting()
    }
  })

  // Work is judged once, as it leaves triage (#1388).
  it('evaluates a new card only when it is made of a triage item', () => {
    startCollecting()
    try {
      const direct = printFlow({ action: 'create', description: 'Add a task.' }).guides as string[]
      assert.deepEqual(direct, ['board', 'add-task'])
      const fromTriage = printFlow({
        action: 'create',
        triage: { sourceId: 'feedback/x', file: 'docs/kanban/triage/x.md' },
      }).guides as string[]
      assert.deepEqual(fromTriage, ['board', 'evaluate-task', 'add-task'])
      assert.ok((printFlow({ action: 'plan-release', release: 'v1' }).guides as string[]).includes('evaluate-task'))
    } finally {
      stopCollecting()
    }
  })

  it('ends setup after three cards and leaves their refinements to background runs', () => {
    const guide = findGuide('setup')!.text
    assert.match(guide, /Choose exactly three clear, non-duplicate foundational tasks/)
    assert.match(guide, /seed card/)
    assert.match(guide, /do not start or wait for them here/)

    const prompt = buildPrompt({ action: 'setup' })
    assert.match(prompt, /guide setup.*guide board.*together in your first shell call/)
    assert.match(prompt, /guide add-task.*once/)

    startCollecting()
    try {
      const flow = printFlow({ action: 'setup' })
      assert.deepEqual(flow.guides, ['board', 'setup', 'add-task'])
    } finally {
      stopCollecting()
    }
  })

  it('hands no build over from planning', () => {
    startCollecting()
    try {
      const flow = printFlow({ action: 'clarify', id: 1, refineRound: 1 })
      assert.match((flow.close as string[]).join('\n'), /update 1 --status ready/)
      assert.doesNotMatch((flow.next as string[]).join('\n'), /card implement/)
      const resolved = printFlow({ action: 'resolve', id: 1 })
      assert.doesNotMatch((resolved.next as string[]).join('\n'), /card implement/)
    } finally {
      stopCollecting()
    }
  })

  it('names the card’s module copy of a planner file, then the planner’s own (#1484)', () => {
    const facts = (): string => {
      const sink = startCollecting()
      try {
        printFlow({ action: 'resolve', id: 1 })
        return sink.out.join('\n').split('closing it')[0]!
      } finally {
        stopCollecting()
      }
    }
    assert.match(facts(), /memory\/agents\/planner\/decisions\.md/)
    assert.doesNotMatch(facts(), /planner\/\w+\/decisions\.md|## /)

    const file = path.join(root, 'docs', 'kanban', 'todo', 'features', '1-card.md')
    fs.writeFileSync(file, card(1, 'card one').replace('modules: []', 'modules: [skill]'))
    assert.match(facts(), /planner\/skill\/decisions\.md — the card's module `skill`\n.*planner\/decisions\.md — what spans modules/)
  })

  it('keeps the split and its handoff in the refine guide', () => {
    const guide = findGuide('refine')!.text
    assert.match(guide, /\*\*Split\*\*: only when the card holds independently plannable areas and one is still vague/)
    assert.match(guide, /akb guide add-task[\s\S]*--schedule refine[\s\S]*stop/)
    assert.match(guide, /akb raw validate <id>/)
  })

  it('ends on the rule, after everything the board writes', async () => {
    setAgentRule('builder', 'Install dependencies first.')
    const prompt = buildPrompt({ action: 'implement', id: 1, title: 'card one' })
    assert.ok(prompt.trimEnd().endsWith('Install dependencies first.'))
    assert.match(prompt, /`builder` agent carries one rule of its own, on every flow it runs/)
  })

  it('carries no rule when the agent has none', async () => {
    const prompt = buildPrompt({ action: 'implement', id: 1, title: 'card one' })
    assert.doesNotMatch(prompt, /rule of its own/)
  })

  it("reads only its own agent's rule", async () => {
    setAgentRule('ui-designer', 'Keep to the existing palette.')
    assert.doesNotMatch(buildPrompt({ action: 'implement', id: 1 }), /existing palette/)
  })

  it('reaches every flow its agent runs, the refinement passes included', async () => {
    setAgentRule('software-planner', 'Ask about the data model.')
    setAgentRule('builder', 'Install dependencies first.')
    // One planner, so the composite refine and the standalone resolve read the same words.
    for (const req of [
      { action: 'clarify' as const, id: 1, refineRound: 2 },
      { action: 'resolve' as const, id: 1 },
      { action: 'edit' as const, id: 1, notes: 'Use A.' },
      { action: 'create' as const, description: 'a new card' },
    ]) {
      const prompt = buildPrompt(req)
      assert.match(prompt, /data model/, req.action)
      assert.doesNotMatch(prompt, /Install dependencies/, req.action)
    }
  })

  it("puts a spec agent's own rule after its instructions, and no role's", async () => {
    setAgentRule('software-planner', 'Ask about the data model.')
    setAgentRule('ui-designer', 'Keep to the existing palette.')
    const prompt = buildPrompt({ action: 'spec', id: 1, specAgent: 'ui-designer' })
    assert.ok(prompt.trimEnd().endsWith('Keep to the existing palette.'))
    assert.match(prompt, /`ui-designer` agent carries one rule of its own\./)
    assert.doesNotMatch(prompt, /data model/)
  })

  // A printed flow says the same thing in its own words, at the very end. It must name the
  // AGENT too: saying "the rule for `implement`" would tell the reader it stops there.
  it('names the same agent when the flow is printed, last of all', async () => {
    setAgentRule('builder', 'Install dependencies first.')
    const sink = startCollecting()
    try {
      printFlow({ action: 'implement', id: 1, title: 'card one' })
    } finally {
      stopCollecting()
    }
    const printed = sink.out.join('\n')
    assert.match(printed, /`builder` agent carries one rule of its own, on every flow it runs/)
    assert.doesNotMatch(printed, /own rule for `implement`/)
    assert.ok(printed.trimEnd().endsWith('Install dependencies first.'))
  })
})

describe('a delivery', () => {
  it('freezes the rules of the agents it is built by, keyed by agent', async () => {
    setAgentRule('builder', 'Install dependencies first.')
    setAgentRule('software-planner', 'Stay small.')
    const built = run('implement', 1)
    const delivery = activeDelivery(1)!
    assert.deepEqual(delivery.rules, { builder: 'Install dependencies first.' })
    await end(built)
  })

  it('gives its later sessions the rules it started with, not the files as they read now', async () => {
    setAgentRule('builder', 'Run the smoke tests.')
    const built = run('implement', 1)
    setAgentRule('builder', 'Something else entirely.')
    const prompt = buildPrompt({ action: 'implement', id: 1, title: 'card one' })
    assert.match(prompt, /smoke tests/)
    assert.doesNotMatch(prompt, /Something else entirely/)
    await end(built)
  })

  it('reads a delivery frozen before the rules were keyed by agent', async () => {
    const built = run('implement', 1)
    // What a build in flight across the upgrade holds: the flow's name, not the agent's.
    const delivery = activeDelivery(1)!
    const frozen = { implement: 'Install dependencies first.' }
    assert.equal(ruleFor({ action: 'implement', id: delivery.cardId ?? undefined }, frozen), 'Install dependencies first.')
    await end(built)
  })

  it('leaves a flow that is not one of its own reading the file', async () => {
    const built = run('implement', 1)
    setAgentRule('software-planner', 'Ask about the data model.')
    assert.match(buildPrompt({ action: 'clarify', id: 1, refineRound: 1 }), /data model/)
    await end(built)
  })
})

// The language the board is read in (#337). One helper behind three paths — the ask a run is
// given, every turn of a conversation, and the setup line a user pastes — so a board that is
// not English is never half translated. `AI4KANBAN_HOME` is the machine here, as in
// `machine-settings.test.ts`.
describe("the board's language", () => {
  it("names the language and its boundary in a run's ask", () => {
    setLanguage('zh')
    const prompt = buildPrompt({ action: 'implement', id: 1, title: 'card one' })
    assert.match(prompt, /Write this board's prose in 中文/)
    // The boundary rides in the ask itself: `writing`, `refine`, `revise`, `spec-agent`
    // and `changelog` are never given `akb guide board`.
    assert.match(prompt, /section headings/)
    assert.match(prompt, /--slug/)
    assert.match(prompt, /keeps the language that file is already in/)
    assert.match(prompt, /code, comments, commit messages/)
  })

  it('says the same on a chat turn and on the setup line, neither of which goes through the ask', () => {
    setLanguage('zh')
    for (const said of [
      chatPrompt(1, 'hello', { title: 'card one' }),
      chatPrompt(1, 'and the other one?', { resuming: true }),
      chatPrompt(null, 'and the board?', { resuming: true }),
      setupInstruction(),
    ]) {
      assert.match(said, /Write this board's prose in 中文/)
    }
  })

  it("leaves the user's words last in a conversation, told or not", () => {
    setLanguage('zh')
    assert.match(chatPrompt(1, 'and the other one?', { resuming: true }), /and the other one\?$/)
    assert.match(chatPrompt(1, 'what is this about?', { title: 'card one' }), /what is this about\?$/)
  })

  it('says nothing at all on an English machine', () => {
    for (const action of ['implement', 'create', 'changelog'] as const) {
      assert.doesNotMatch(buildPrompt({ action, id: 1, title: 'card one', release: '0.1.0' }), /board's prose/)
    }
    assert.doesNotMatch(chatPrompt(1, 'and the other one?', { resuming: true }), /board's prose/)
    assert.equal(setupInstruction(), '/kanban. Set up this board — follow docs/kanban/setup-checklist.md.')
  })

  it('spells out an English slug where a printed flow writes a card, and only there', () => {
    const printed = (): string => {
      const sink = startCollecting()
      try {
        printFlow({ action: 'create' })
        return sink.out.join('\n')
      } finally {
        stopCollecting()
      }
    }
    // The guides printed below it name `--slug` too, so this asks about the close line.
    assert.match(printed(), /create --title "\.\." —/)
    setLanguage('zh')
    assert.match(printed(), /create --title "\.\." --slug <short-english-slug> —/)
  })

  it('carries the rule in full in `akb guide board`', () => {
    const guide = findGuide('board')!.text
    assert.match(guide, /## The board's language/)
    assert.match(guide, /Prose in frontmatter is still prose/)
    assert.match(guide, /A memory file holding only its seeded header is empty/)
    assert.match(guide, /An edit follows the file, not the setting/)
  })

  it('makes the changelog follow the run over the goal, and the goal when there is no run language', () => {
    const guide = findGuide('changelog')!.text
    assert.match(guide, /Write in the language this run was told to write the board in/)
    assert.match(guide, /Told no language, write in the language of the goal/)
  })
})
