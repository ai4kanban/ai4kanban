// 验证规则传递、流程路由和交付期间的规则冻结。

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { cmdSpec } from '../src/commands/spec.ts'
import { cmdGuide } from '../src/commands/guide.ts'
import { readRuns } from '../src/lib/agent/sessions.ts'
import { cmdStartRun } from '../src/commands/run.ts'
import { activeDelivery } from '../src/lib/agent/deliveries.ts'
import { RUN_ENV } from '../src/lib/agent/env.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { openPlan, planRun } from '../src/lib/agent/resolve.ts'
import { addRuntime, setAgentRuntime } from '../src/lib/agent/runtimes.ts'
import { readRule, ruleFor, setAgentRule } from '../src/lib/agent/rules.ts'
import { findGuide, guideNames } from '../src/lib/guide.ts'
import { setLanguage } from '../src/lib/machine/settings.ts'
import { runLanguage, LANGUAGE_ENV, translating } from '../src/lib/agent/language.ts'
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
    'status: ready',
    'blocked_by: []',
    'related: []',
    'modules: []',
    'workflow: coding',
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
  restoreMachineHome()
  fs.rmSync(home, { recursive: true, force: true })
  fs.rmSync(root, { recursive: true, force: true })
})

// One session, opened and closed the way the command and the watcher do.
// The user's rule for the Coding workflow's cards (#2152).
const workflowRule = (text: string): void => {
  fs.mkdirSync(path.join(RULES, 'workflows'), { recursive: true })
  fs.writeFileSync(path.join(RULES, 'workflows', 'coding.md'), `${text}\n`)
}

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
      await akb(root, ['previews', 'ui-designer', '1', 'Use scrolling tabs.', '--print'])
    } finally {
      stopCollecting()
    }
    const printed = sink.out.join('\n')
    assert.match(printed, /printed, not started/)
    assert.match(printed, /Use scrolling tabs/)
    assert.match(printed, /guide preview-agent/)
    assert.doesNotMatch(printed, /Be a preview agent/)
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
    assert.match(sink.out.join('\n'), /asked for the ui-designer preview agent/)
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

  it('gives planning no rule of its own: what it is asked is its workflow\'s (#2152)', async () => {
    workflowRule('Say what changed.')
    for (const action of ['edit', 'resolve'] as const) {
      assert.equal(ruleFor({ action, id: 1 }), '', action)
      assert.match(buildPrompt({ action, id: 1 }), /<workflow name="Coding">[\s\S]*Say what changed\./, action)
    }
    assert.equal(setAgentRule('planner', 'Say what changed.').ok, false)
  })

  it('refuses a name no agent on this board answers to', async () => {
    const agent = setAgentRule('deployer', 'Ship it.')
    assert.equal(agent.ok, false)
    assert.match(agent.error!, /discussion-helper, memory-pruner, .*, builder, /)
  })

  it("reads back each agent's rule, and nothing for the ones without one", async () => {
    setAgentRule('builder', 'Install first.')
    assert.equal(readRule('builder'), 'Install first.')
    assert.equal(readRule('ui-designer'), '')
    // One rule, every flow that agent runs.
    for (const action of ['implement'] as const) {
      assert.equal(ruleFor({ action, id: 1 }), 'Install first.', action)
    }
  })
})

describe('the prompt', () => {
  it('leaves planning requirements in the guide', () => {
    const prompt = buildPrompt({ action: 'clarify', id: 1, refineRound: 1 })
    assert.match(prompt, /akb guide refine/)
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

  it('gives a finishing run the archive page, and a build the shipped line beside board', () => {
    startCollecting()
    try {
      assert.deepEqual(printFlow({ action: 'archive', id: 1, title: 'card one' }).guides, ['archive'])
      assert.deepEqual(printFlow({ action: 'implement', id: 1, title: 'card one' }).guides, ['board', 'archive', 'implement'])
    } finally {
      stopCollecting()
    }
    assert.match(buildPrompt({ action: 'archive', id: 1, title: 'card one' }), /Follow `akb guide archive`/)
  })

  it('构建提示词引用执行指南，无卡入口直接构建需求', () => {
    assert.match(buildPrompt({ action: 'implement', id: 1, title: 'card one' }), /akb guide implement/)
    for (const requirement of [{ description: 'Build a widget' }, { plan: 'plans/widget.md' }]) {
      const prompt = buildPrompt({ action: 'implement', ...requirement })
      assert.match(prompt, /akb guide implement/)
      assert.match(prompt, /create no card/)
      assert.doesNotMatch(prompt, /write its card|raw create|on the card/)
    }
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
  })

  it('shows the spec-agent catalog to every planning session and to no spec run', () => {
    for (const action of ['clarify', 'resolve', 'edit'] as const) {
      const prompt = buildPrompt({ action, id: 1 })
      assert.match(prompt, /<preview-agents>/)
      // A card with no `previews` is asked to choose them, never shown a skill's own instructions.
      assert.match(prompt, /akb previews --triggers --workflow/)
      assert.doesNotMatch(prompt, /You draw the screen a card needs/)
    }
    assert.doesNotMatch(buildPrompt({ action: 'implement', id: 1 }), /<preview-agents>/)
    assert.doesNotMatch(buildPrompt({ action: 'spec', id: 1, specAgent: 'ui-designer' }), /<preview-agents>/)
  })

  it('removes the evaluation guide and keeps revisions on the same card', () => {
    assert.ok(!guideNames().includes('evaluate-task'))
    assert.equal(findGuide('evaluate-task'), null)
    assert.throws(() => cmdGuide('evaluate-task'), /no guide called "evaluate-task"/)
    assert.match(findGuide('revise')!.text, /revision, then plan the card in this session as `akb guide refine` says/)
    for (const name of guideNames()) {
      assert.doesNotMatch(findGuide(name)!.text, /evaluate-task/)
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
        printFlow({ action: 'edit', id: 1, notes: 'Use A.' })
        return sink.out.join('\n').split('closing it')[0]!
      } finally {
        stopCollecting()
      }
    }
    assert.match(facts(), /memory\/agents\/planner\/decisions\.md/)
    assert.doesNotMatch(facts(), /planner\/\w+\/decisions\.md/)

    const file = path.join(root, 'docs', 'kanban', 'todo', 'features', '1-card.md')
    fs.writeFileSync(file, card(1, 'card one').replace('modules: []', 'modules: [skill]'))
    assert.match(facts(), /planner\/skill\/decisions\.md — the card's module `skill`\n.*planner\/decisions\.md — what spans modules/)
  })

  it('leaves planning memory out of a resolve: the memory review writes it (#212)', () => {
    const sink = startCollecting()
    try {
      const printed = printFlow({ action: 'resolve', id: 1 })
      assert.deepEqual(printed.guides, ['writing', 'resolve', 'update-questions'])
      assert.doesNotMatch(sink.out.join('\n'), /decisions\.md/)
    } finally {
      stopCollecting()
    }
  })

  it('ends on the rule, after everything the board writes', async () => {
    setAgentRule('builder', 'Install dependencies first.')
    const prompt = buildPrompt({ action: 'implement', id: 1, title: 'card one' })
    assert.ok(prompt.trimEnd().endsWith('Install dependencies first.'))
    assert.match(prompt, /`builder` agent carries one rule of its own\./)
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
    workflowRule('Ask about the data model.')
    setAgentRule('builder', 'Install dependencies first.')
    // One planner, so the composite refine and the standalone resolve read the same words.
    for (const req of [
      { action: 'clarify' as const, id: 1, refineRound: 2 },
      { action: 'resolve' as const, id: 1 },
      { action: 'edit' as const, id: 1, notes: 'Use A.' },
    ]) {
      const prompt = buildPrompt(req)
      assert.match(prompt, /data model/, req.action)
      assert.doesNotMatch(prompt, /Install dependencies/, req.action)
    }
  })

  it("puts a spec agent's own rule after its instructions, and no role's", async () => {
    workflowRule('Ask about the data model.')
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
    assert.match(printed, /`builder` agent carries one rule of its own —/)
    assert.doesNotMatch(printed, /own rule for `implement`/)
    assert.ok(printed.trimEnd().endsWith('Install dependencies first.'))
  })
})

describe('a delivery', () => {
  it('freezes the rules of the agents it is built by, keyed by agent', async () => {
    setAgentRule('builder', 'Install dependencies first.')
    workflowRule('Stay small.')
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
    workflowRule('Ask about the data model.')
    assert.match(buildPrompt({ action: 'clarify', id: 1, refineRound: 1 }), /data model/)
    await end(built)
  })
})

describe("the board's language", () => {
  it('打印流程与正文不再追加语言要求', () => {
    setLanguage('zh')
    assert.doesNotMatch(buildPrompt({ action: 'implement', id: 1, title: 'card one' }), /请用中文/)
    const sink = startCollecting()
    try {
      printFlow({ action: 'clarify', id: 1 })
    } finally {
      stopCollecting()
    }
    assert.doesNotMatch(sink.out.join('\n'), /请用中文回复和写作|对话和解释使用中文/)
  })

  it("Cloud 语言代码及空值优先于本机设置", () => {
    setLanguage('zh')
    try {
      process.env[LANGUAGE_ENV] = 'en'
      assert.equal(runLanguage(), 'en')
      assert.equal(translating(), false)
      process.env[LANGUAGE_ENV] = ''
      assert.equal(runLanguage(), null)
    } finally {
      delete process.env[LANGUAGE_ENV]
    }
    assert.equal(runLanguage(), 'zh')
  })

  it("中英文均通过系统提示词注入", () => {
    assert.ok(openPlan(planRun('s1')).argv.includes('--append-system-prompt'))
    setLanguage('zh')
    assert.equal(openPlan(planRun('s1')).argv[1], '--append-system-prompt')
  })

  it('英文机器选择英文规则', () => {
    assert.equal(runLanguage(), 'en')
  })

})
