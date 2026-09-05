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
import { cmdStartRun } from '../src/commands/run.ts'
import { activeDelivery } from '../src/lib/agent/deliveries.ts'
import { RUN_ENV } from '../src/lib/agent/env.ts'
import { FLOWS } from '../src/lib/agent/flows.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { setupInstruction } from '../src/lib/agent/resolve.ts'
import { readFlowRules, ruleFor, setAgentRule, setFlowRule } from '../src/lib/agent/rules.ts'
import { findGuide } from '../src/lib/guide.ts'
import { setLanguage } from '../src/lib/machine/settings.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import { withStore } from '../src/lib/agent/store.ts'
import { RULES, setBoardRoot } from '../src/lib/paths.ts'
import { run as akb } from './helpers/board.ts'

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
})

afterEach(() => {
  delete process.env[RUN_ENV]
  delete process.env.AI4KANBAN_HOME
  fs.rmSync(home, { recursive: true, force: true })
  fs.rmSync(root, { recursive: true, force: true })
})

// One session, opened and closed the way the command and the watcher do.
function run(action: 'implement' | 'review', id: number): string {
  const opened = openRun({ action, id, title: 'card one' }, 'prompt', [])
  if ('error' in opened) throw new Error(opened.error)
  return opened.run.sessionId
}

async function end(sessionId: string): Promise<void> {
  const record = withStore((store) => store.runs.find((r) => r.sessionId === sessionId))
  fs.writeFileSync(record!.logPath, 'log\n')
  await closeRun(sessionId, { status: 'done', ok: true, code: 0 })
}

describe('the files', () => {
  it('is nothing until a rule is saved, and nothing again when one is cleared', async () => {
    assert.equal(fs.existsSync(RULES), false)
    assert.deepEqual(setAgentRule('builder', 'Install first.'), { ok: true })
    assert.equal(fs.readFileSync(path.join(RULES, 'builder.md'), 'utf8').trim(), 'Install first.')
    assert.deepEqual(setAgentRule('builder', '   '), { ok: true })
    assert.equal(fs.existsSync(path.join(RULES, 'builder.md')), false)
  })

  it('is named by the agent that runs the flow, not by the flow (#420)', async () => {
    setFlowRule('revise', 'Say what changed.')
    assert.equal(fs.readFileSync(path.join(RULES, 'planner.md'), 'utf8').trim(), 'Say what changed.')
    for (const gone of ['revise.md', 'edit.md']) {
      assert.equal(fs.existsSync(path.join(RULES, gone)), false, gone)
    }
  })

  it('refuses a flow this board does not have, and a name no agent answers to', async () => {
    const flow = setFlowRule('deploy', 'Ship it.')
    assert.equal(flow.ok, false)
    assert.match(flow.error!, /deploy/)
    const agent = setAgentRule('deployer', 'Ship it.')
    assert.equal(agent.ok, false)
    assert.match(agent.error!, /planner, builder, reviewer/)
  })

  it("lists every flow the board can start, carrying its agent's rule or none", async () => {
    setAgentRule('builder', 'Install first.')
    const listed = readFlowRules()
    assert.equal(listed.length, FLOWS.length)
    // One rule, every flow that agent runs.
    for (const command of ['implement', 'conflict', 'run']) {
      assert.equal(listed.find((f) => f.command === command)!.rule, 'Install first.', command)
    }
    assert.equal(listed.find((f) => f.command === 'propose')!.rule, '')
    // Every flow says what it is, because `plan-release` names nothing a user
    // can guess at.
    assert.ok(listed.every((f) => f.gloss.length > 0))
  })
})

describe('the prompt', () => {
  it('leaves QA requirements in the guide', () => {
    const prompt = buildPrompt({ action: 'clarify', id: 1, refineRound: 1 })
    assert.match(prompt, /akb guide qa-loop/)
    assert.doesNotMatch(prompt, /Append the gaps|Do not resolve|don't implement/)
  })

  it('has add-task choose standard unless the source is concrete', () => {
    const guide = findGuide('add-task')!.text
    assert.match(guide, /Repeating work[\s\S]*akb guide recurring-task/)
    assert.match(guide, /open question[\s\S]*akb guide update-questions/)
    assert.doesNotMatch(guide, /Parallel/)
    assert.match(guide, /akb card refine <id> --effort lightweight --print/)
    assert.match(guide, /Lightweight[\s\S]*source already supplies[\s\S]*build scope/)
    assert.match(guide, /Standard[\s\S]*ordinary user requests[\s\S]*separate session/)
    assert.match(guide, /Choose standard unless/)
  })

  it('keeps the question format in one guide', () => {
    assert.match(findGuide('update-questions')!.text, /--recommended-option[\s\S]*--option/)
    for (const name of ['add-task', 'qa-lightweight', 'qa-loop', 'recurring-task', 'reject', 'review', 'setup', 'spec-agent']) {
      const guide = findGuide(name)!.text
      assert.match(guide, /akb guide\s+update-questions/, name)
      assert.doesNotMatch(guide, /--recommended-option|--mode multi/, name)
    }
  })

  it('keeps recurring state on the card and cadence opt-in', () => {
    const guide = findGuide('recurring-task')!.text
    assert.match(guide, /## Run state/)
    assert.match(guide, /Do not create a sibling log, ledger, or history file/)
    assert.match(guide, /Leave `--cadence` off unless the user explicitly asks/)
    assert.match(guide, /Do not add a step that calls `akb run` or[\s\S]*stamps `last_run`/)

    startCollecting()
    try {
      const flow = printFlow({ action: 'run', id: 1, title: 'card one' })
      assert.match((flow.close as string[]).join('\n'), /update or add the card's ## Run state in place/)
    } finally {
      stopCollecting()
    }
  })

  it('loads only the QA guide selected for the clarify session', () => {
    for (const [effort, guide] of [
      ['lightweight', 'qa-lightweight'],
      ['standard', 'qa-loop'],
    ] as const) {
      const req = { action: 'clarify' as const, id: 1, refineRound: 1, refineEffort: effort }
      assert.match(buildPrompt(req), new RegExp(`akb guide ${guide}`))
      startCollecting()
      try {
        assert.deepEqual(printFlow(req).guides, ['writing', 'update-questions', guide])
      } finally {
        stopCollecting()
      }
    }
    assert.equal(findGuide('qa-parallel'), null)
    assert.doesNotMatch(findGuide('qa-loop')!.text, /Choose the QA effort|Parallel QA handed off/)
  })

  it('accepts the effort on the refine command and prints that guide', async () => {
    fs.writeFileSync(
      path.join(root, 'docs', 'kanban', 'todo', 'features', '1-card.md'),
      card(1, 'card one').replace('status: ready', 'status: todo'),
    )
    startCollecting()
    try {
      const flow = await cmdStartRun('refine', [1], { effort: 'lightweight', print: true })
      assert.deepEqual(flow.guides, ['writing', 'update-questions', 'qa-lightweight'])
    } finally {
      stopCollecting()
    }
  })

  it('rejects the removed parallel effort', async () => {
    fs.writeFileSync(
      path.join(root, 'docs', 'kanban', 'todo', 'features', '1-card.md'),
      card(1, 'card one').replace('status: ready', 'status: todo'),
    )
    // The command declares the two it takes, so the refusal comes from the parse.
    await assert.rejects(
      () => akb(root, ['card', 'refine', '1', '--effort', 'parallel', '--print']),
      /--effort .*lightweight \| standard/,
    )
  })

  it('lets lightweight QA settle the plan automatically without a checklist', () => {
    const qa = findGuide('qa-lightweight')!.text
    assert.match(qa, /Refine the card automatically/)
    assert.match(qa, /settle implementation details/)
    assert.match(qa, /Do not run or retain a question checklist/)
    assert.doesNotMatch(qa, /Use this only|5–10|What observable result/)
    const build = findGuide('implement')!.text
    assert.match(build, /printed, interactive implementation may stay uncommitted/)
    assert.match(build, /Background runs[\s\S]*delivery, review, and landing path/)
    assert.match(build, /focused checks[\s\S]*repository-required check/)
  })

  it('keeps implementation blockers out of card questions', () => {
    const prompt = buildPrompt({ action: 'implement', id: 1, title: 'card one' })
    const guide = findGuide('implement')!.text
    assert.match(prompt, /akb guide implement/)
    assert.doesNotMatch(prompt, /Leave any questions as open questions/)
    assert.doesNotMatch(prompt, /update-questions/)
    assert.match(guide, /run-blocker/)
    assert.match(guide, /Do not add, rewrite, or tag questions/)
    assert.doesNotMatch(guide, /Worth noting after implementation/)
  })

  it('loads the writing contract wherever a flow edits decision prose', () => {
    for (const action of ['clarify', 'resolve', 'edit', 'review'] as const) {
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

  it('keeps implementation discoveries off the board', () => {
    const guide = findGuide('review')!.text
    const prompt = buildPrompt({ action: 'review', id: 1, title: 'card one' })
    assert.match(guide, /Review never creates or updates another card/)
    assert.match(guide, /Drop unrelated implementation\s+discoveries/)
    assert.doesNotMatch(prompt, /create or update a separate card/)
  })

  it('makes the latest target authoritative in a conflict and reviews the result', () => {
    const guide = findGuide('conflict')!.text
    assert.match(guide, /target branch as the authoritative current implementation/)
    assert.match(guide, /Do not create or update cards/)
    assert.match(guide, /Review follows the completed rebase/)
    assert.match(buildPrompt({ action: 'conflict', id: 1, title: 'card one' }), /reviews your resolution before it lands/)
  })

  it('gives review a scope step for a focused post-rebase pass', () => {
    const guide = findGuide('review')!.text
    assert.match(guide, /focused post-rebase review/)
    assert.match(guide, /only the named target delta[\s\S]*shared paths/)
    assert.match(guide, /rerun only the checks those paths affect/)
  })

  it('runs post-answer QA in the resolver session', () => {
    const prompt = buildPrompt({ action: 'resolve', id: 1, notes: 'Use A.' })
    assert.match(prompt, /akb guide resolve/)
    assert.match(prompt, /akb guide qa-loop/)
  })

  it('runs post-revision QA in the revision session', () => {
    const prompt = buildPrompt({ action: 'edit', id: 1, notes: 'Use A.' })
    assert.match(prompt, /akb guide revise/)
    assert.match(prompt, /akb guide qa-loop/)
  })

  it('shows the spec-agent catalog to every QA-carrying session and to no spec run', () => {
    for (const action of ['clarify', 'resolve', 'edit'] as const) {
      const prompt = buildPrompt({ action, id: 1 })
      assert.match(prompt, /<spec-agents>/)
      // The catalog is names, descriptions and ownership — never a skill's own instructions.
      assert.match(prompt, /- `ui-design`/)
      assert.doesNotMatch(prompt, /You draw the screen a card needs/)
    }
    assert.doesNotMatch(buildPrompt({ action: 'implement', id: 1 }), /<spec-agents>/)
    assert.doesNotMatch(buildPrompt({ action: 'spec', id: 1, specAgent: 'ui-design' }), /<spec-agents>/)
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

  it('lets a printed clarify finish the card inline', () => {
    startCollecting()
    try {
      const flow = printFlow({
        action: 'clarify',
        id: 1,
        refineRound: 1,
        refineEffort: 'lightweight',
      })
      assert.deepEqual(flow.next, [])
      assert.match((flow.close as string[]).join('\n'), /update 1 --status ready/)
    } finally {
      stopCollecting()
    }
  })

  it('keeps the split gate and its handoff in the QA guide', () => {
    const guide = findGuide('qa-loop')!.text
    assert.match(guide, /Check task boundaries/)
    assert.match(guide, /decide whether the card is one coherent task/)
    assert.match(guide, /Split only when/)
    assert.match(guide, /multiple independently refinable areas/)
    assert.match(guide, /at least one is still materially vague/)
    assert.match(guide, /some areas may already be clear/)
    assert.match(guide, /akb guide add-task/)
    assert.match(guide, /akb raw create[\s\S]*--related <root-id> --schedule refine/)
    assert.match(guide, /After creating the group, exit/)
    assert.doesNotMatch(guide, /\*\*Split\*\*:/)
    assert.doesNotMatch(guide, /200 lines|12 todo items/)
  })

  it('separates agent tests from a reproducible human test plan', () => {
    const guide = findGuide('qa-loop')!.text
    assert.match(guide, /## Plan verification/)
    assert.match(guide, /Put checks the implementation agent can run in `## Todo`/)
    assert.match(guide, /Reserve `verify:` for post-build checks/)
    assert.match(guide, /reproducible setup, human action, and expected result/)
    assert.match(guide, /old build without the behavior under test is not one/)
    assert.match(guide, /test seams, fixtures, or recipes to `## Todo`/)
  })

  it('keeps lifecycle bookkeeping out of the writing agent', () => {
    const prompt = buildPrompt({ action: 'writing', id: 1, refineRound: 2 })
    assert.match(prompt, /akb guide writing/)
    assert.match(prompt, /board marks it ready/)
    assert.doesNotMatch(prompt, /akb guide board/)
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
    setAgentRule('reviewer', 'Run the smoke tests.')
    assert.doesNotMatch(buildPrompt({ action: 'implement', id: 1 }), /smoke tests/)
    assert.match(buildPrompt({ action: 'review', id: 1 }), /smoke tests/)
  })

  it('reaches every flow its agent runs, the refinement passes included', async () => {
    setAgentRule('planner', 'Ask about the data model.')
    setAgentRule('builder', 'Install dependencies first.')
    // One planner, so the composite refine and the standalone resolve read the same words.
    for (const req of [
      { action: 'clarify' as const, id: 1, refineRound: 2 },
      { action: 'writing' as const, id: 1, refineRound: 2 },
      { action: 'resolve' as const, id: 1 },
      { action: 'edit' as const, id: 1, notes: 'Use A.' },
      { action: 'propose' as const },
    ]) {
      const prompt = buildPrompt(req)
      assert.match(prompt, /data model/, req.action)
      assert.doesNotMatch(prompt, /Install dependencies/, req.action)
    }
  })

  it("puts a spec agent's own rule after its instructions, and no role's", async () => {
    setAgentRule('planner', 'Ask about the data model.')
    setAgentRule('ui-design', 'Keep to the existing palette.')
    const prompt = buildPrompt({ action: 'spec', id: 1, specAgent: 'ui-design' })
    assert.ok(prompt.trimEnd().endsWith('Keep to the existing palette.'))
    assert.match(prompt, /`ui-design` agent carries one rule of its own\./)
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
    setAgentRule('reviewer', 'Run the smoke tests.')
    setAgentRule('planner', 'Stay small.')
    const built = run('implement', 1)
    const delivery = activeDelivery(1)!
    assert.deepEqual(delivery.rules, {
      builder: 'Install dependencies first.',
      reviewer: 'Run the smoke tests.',
    })
    await end(built)
  })

  it('gives its later sessions the rules it started with, not the files as they read now', async () => {
    setAgentRule('reviewer', 'Run the smoke tests.')
    const built = run('implement', 1)
    await end(built)
    setAgentRule('reviewer', 'Something else entirely.')
    const prompt = buildPrompt({ action: 'review', id: 1, title: 'card one' })
    assert.match(prompt, /smoke tests/)
    assert.doesNotMatch(prompt, /Something else entirely/)
  })

  it('reads a delivery frozen before the rules were keyed by agent', async () => {
    const built = run('implement', 1)
    // What a build in flight across the upgrade holds: the flow's name, not the agent's.
    const delivery = activeDelivery(1)!
    const frozen = { implement: 'Install dependencies first.' }
    assert.equal(ruleFor({ action: 'implement', id: delivery.cardId }, frozen), 'Install dependencies first.')
    await end(built)
  })

  it('leaves a flow that is not one of its own reading the file', async () => {
    const built = run('implement', 1)
    setAgentRule('planner', 'Ask about the data model.')
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
    // The boundary rides in the ask itself: `writing`, `qa-loop`, `revise`, `spec-agent`
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
    for (const action of ['implement', 'review', 'create', 'propose', 'changelog'] as const) {
      assert.doesNotMatch(buildPrompt({ action, id: 1, title: 'card one', release: '0.1.0' }), /board's prose/)
    }
    assert.equal(chatPrompt(1, 'and the other one?', { resuming: true }), 'and the other one?')
    assert.equal(setupInstruction(), '/kanban. Set up this board — follow docs/kanban/setup-checklist.md.')
  })

  it('spells out an English slug where a printed flow writes a card, and only there', () => {
    const printed = (): string => {
      const sink = startCollecting()
      try {
        printFlow({ action: 'propose' })
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
