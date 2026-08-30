// One rule per flow, in the user's own words (#306).
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
import { readFlowRules, setFlowRule } from '../src/lib/agent/rules.ts'
import { findGuide } from '../src/lib/guide.ts'
import { setLanguage } from '../src/lib/machine/settings.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import { withStore } from '../src/lib/agent/store.ts'
import { RULES, setBoardRoot } from '../src/lib/paths.ts'

let root = ''
// This machine, for the tests that read the language off it (#337). Pinned for every test
// here, so the developer's own pick can never change what a prompt says.
let home = ''

const card = (id: number, title: string): string =>
  [
    '---',
    `title: ${title}`,
    'track: features',
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
    assert.deepEqual(setFlowRule('implement', 'Install first.'), { ok: true })
    assert.equal(fs.readFileSync(path.join(RULES, 'implement.md'), 'utf8').trim(), 'Install first.')
    assert.deepEqual(setFlowRule('implement', '   '), { ok: true })
    assert.equal(fs.existsSync(path.join(RULES, 'implement.md')), false)
  })

  it('is named by the command a user types, not the action the board keeps', async () => {
    setFlowRule('revise', 'Say what changed.')
    assert.equal(fs.existsSync(path.join(RULES, 'revise.md')), true)
    assert.equal(fs.existsSync(path.join(RULES, 'edit.md')), false)
  })

  it('refuses a flow this board does not have', async () => {
    const res = setFlowRule('deploy', 'Ship it.')
    assert.equal(res.ok, false)
    assert.match(res.error!, /deploy/)
  })

  it('lists every flow the board can start, rule or no rule', async () => {
    setFlowRule('review', 'Run the smoke tests.')
    const listed = readFlowRules()
    assert.equal(listed.length, FLOWS.length)
    assert.equal(listed.find((f) => f.command === 'review')!.rule, 'Run the smoke tests.')
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

  it('has add-task choose the effort and refine inline by default', () => {
    const guide = findGuide('add-task')!.text
    assert.match(guide, /Lightweight[\s\S]*Standard/)
    assert.doesNotMatch(guide, /Parallel/)
    assert.match(guide, /akb refine <id> --effort lightweight --print/)
    assert.match(guide, /continue inline/)
    assert.match(guide, /explicitly requests background work, omit `--print`/)
    assert.match(guide, /akb refine <id> --effort standard[\s\S]*separate session/)
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
      const flow = await cmdStartRun('refine', ['1', '--effort', 'lightweight', '--print'])
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
    await assert.rejects(
      () => cmdStartRun('refine', ['1', '--effort', 'parallel', '--print']),
      /--effort takes lightweight or standard/,
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

  it('shows the spec-agent roster to every QA-carrying session', () => {
    for (const action of ['clarify', 'resolve', 'edit'] as const) {
      assert.match(buildPrompt({ action, id: 1 }), /<spec-agents>/)
    }
    assert.doesNotMatch(buildPrompt({ action: 'implement', id: 1 }), /<spec-agents>/)
  })

  it('continues refinement inline after each card created from a printed flow', () => {
    startCollecting()
    try {
      const flow = printFlow({ action: 'create', description: 'Add a task.' })
      const next = (flow.next as string[]).join('\n')
      assert.match(next, /akb refine <id>/)
      assert.match(next, /--effort lightweight --print/)
      assert.match(next, /--effort standard/)
      assert.match(next, /--print/)
      assert.match(next, /after add-task/)
      assert.match(next, /follow lightweight refinement inline/)
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
    assert.match(guide, /akb board create[\s\S]*--related <root-id> --schedule refine/)
    assert.match(guide, /After creating the group, exit/)
    assert.doesNotMatch(guide, /\*\*Split\*\*:/)
    assert.doesNotMatch(guide, /200 lines|12 todo items/)
  })

  it('keeps lifecycle bookkeeping out of the writing agent', () => {
    const prompt = buildPrompt({ action: 'writing', id: 1, refineRound: 2 })
    assert.match(prompt, /akb guide writing/)
    assert.match(prompt, /board marks it ready/)
    assert.doesNotMatch(prompt, /akb guide board/)
  })

  it('ends on the rule, after everything the board writes', async () => {
    setFlowRule('implement', 'Install dependencies first.')
    const prompt = buildPrompt({ action: 'implement', id: 1, title: 'card one' })
    assert.ok(prompt.trimEnd().endsWith('Install dependencies first.'))
    assert.match(prompt, /adds one rule of its own to every `implement` run/)
  })

  it('carries no rule when the flow has none', async () => {
    const prompt = buildPrompt({ action: 'implement', id: 1, title: 'card one' })
    assert.doesNotMatch(prompt, /rule of its own/)
  })

  it('reads only its own flow file', async () => {
    setFlowRule('review', 'Run the smoke tests.')
    assert.doesNotMatch(buildPrompt({ action: 'implement', id: 1 }), /smoke tests/)
    assert.match(buildPrompt({ action: 'review', id: 1 }), /smoke tests/)
  })

  it('uses the refine rule throughout the composite flow', async () => {
    setFlowRule('refine', 'Ask about the data model.')
    setFlowRule('resolve', 'Use the standalone resolver rule.')
    for (const action of ['clarify', 'resolve', 'writing'] as const) {
      const prompt = buildPrompt({ action, id: 1, refineRound: 2 })
      assert.match(prompt, /data model/)
      assert.doesNotMatch(prompt, /standalone resolver/)
    }
    assert.match(buildPrompt({ action: 'resolve', id: 1 }), /standalone resolver/)
  })
})

describe('a delivery', () => {
  it('freezes the rules of the flows it is made of', async () => {
    setFlowRule('implement', 'Install dependencies first.')
    setFlowRule('review', 'Run the smoke tests.')
    setFlowRule('propose', 'Stay small.')
    const built = run('implement', 1)
    const delivery = activeDelivery(1)!
    assert.deepEqual(delivery.rules, {
      implement: 'Install dependencies first.',
      review: 'Run the smoke tests.',
    })
    await end(built)
  })

  it('gives its later sessions the rules it started with, not the files as they read now', async () => {
    setFlowRule('review', 'Run the smoke tests.')
    const built = run('implement', 1)
    await end(built)
    setFlowRule('review', 'Something else entirely.')
    const prompt = buildPrompt({ action: 'review', id: 1, title: 'card one' })
    assert.match(prompt, /smoke tests/)
    assert.doesNotMatch(prompt, /Something else entirely/)
  })

  it('leaves a flow that is not one of its own reading the file', async () => {
    const built = run('implement', 1)
    setFlowRule('refine', 'Ask about the data model.')
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
    assert.match(printed(), /create --title "\.\." --track <track>/)
    setLanguage('zh')
    assert.match(printed(), /create --title "\.\." --slug <short-english-slug> --track <track>/)
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
