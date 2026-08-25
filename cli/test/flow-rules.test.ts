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

import { activeDelivery } from '../src/lib/agent/deliveries.ts'
import { RUN_ENV } from '../src/lib/agent/env.ts'
import { FLOWS } from '../src/lib/agent/flows.ts'
import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { readFlowRules, setFlowRule } from '../src/lib/agent/rules.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import { withStore } from '../src/lib/agent/store.ts'
import { RULES, setBoardRoot } from '../src/lib/paths.ts'

let root = ''

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
  fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo', 'features'), { recursive: true })
  setBoardRoot(root)
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'todo', 'features', '1-card.md'), card(1, 'card one'))
  delete process.env[RUN_ENV]
})

afterEach(() => {
  delete process.env[RUN_ENV]
  fs.rmSync(root, { recursive: true, force: true })
})

// One session, opened and closed the way the command and the watcher do.
function run(action: 'implement' | 'review', id: number): string {
  const opened = openRun({ action, id, title: 'card one' }, 'prompt', [])
  if ('error' in opened) throw new Error(opened.error)
  return opened.run.sessionId
}

function end(sessionId: string): void {
  const record = withStore((store) => store.runs.find((r) => r.sessionId === sessionId))
  fs.writeFileSync(record!.logPath, 'log\n')
  closeRun(sessionId, { status: 'done', ok: true, code: 0 })
}

describe('the files', () => {
  it('is nothing until a rule is saved, and nothing again when one is cleared', () => {
    assert.equal(fs.existsSync(RULES), false)
    assert.deepEqual(setFlowRule('implement', 'Install first.'), { ok: true })
    assert.equal(fs.readFileSync(path.join(RULES, 'implement.md'), 'utf8').trim(), 'Install first.')
    assert.deepEqual(setFlowRule('implement', '   '), { ok: true })
    assert.equal(fs.existsSync(path.join(RULES, 'implement.md')), false)
  })

  it('is named by the command a user types, not the action the board keeps', () => {
    setFlowRule('revise', 'Say what changed.')
    assert.equal(fs.existsSync(path.join(RULES, 'revise.md')), true)
    assert.equal(fs.existsSync(path.join(RULES, 'edit.md')), false)
  })

  it('refuses a flow this board does not have', () => {
    const res = setFlowRule('deploy', 'Ship it.')
    assert.equal(res.ok, false)
    assert.match(res.error!, /deploy/)
  })

  it('lists every flow the board can start, rule or no rule', () => {
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
  it('ends on the rule, after everything the board writes', () => {
    setFlowRule('implement', 'Install dependencies first.')
    const prompt = buildPrompt({ action: 'implement', id: 1, title: 'card one' })
    assert.ok(prompt.trimEnd().endsWith('Install dependencies first.'))
    assert.match(prompt, /adds one rule of its own to every `implement` run/)
  })

  it('carries no rule when the flow has none', () => {
    const prompt = buildPrompt({ action: 'implement', id: 1, title: 'card one' })
    assert.doesNotMatch(prompt, /rule of its own/)
  })

  it('reads only its own flow file', () => {
    setFlowRule('review', 'Run the smoke tests.')
    assert.doesNotMatch(buildPrompt({ action: 'implement', id: 1 }), /smoke tests/)
    assert.match(buildPrompt({ action: 'review', id: 1 }), /smoke tests/)
  })
})

describe('a delivery', () => {
  it('freezes the rules of the flows it is made of', () => {
    setFlowRule('implement', 'Install dependencies first.')
    setFlowRule('review', 'Run the smoke tests.')
    setFlowRule('propose', 'Stay small.')
    const built = run('implement', 1)
    const delivery = activeDelivery(1)!
    assert.deepEqual(delivery.rules, {
      implement: 'Install dependencies first.',
      review: 'Run the smoke tests.',
    })
    end(built)
  })

  it('gives its later sessions the rules it started with, not the files as they read now', () => {
    setFlowRule('review', 'Run the smoke tests.')
    const built = run('implement', 1)
    end(built)
    setFlowRule('review', 'Something else entirely.')
    const prompt = buildPrompt({ action: 'review', id: 1, title: 'card one' })
    assert.match(prompt, /smoke tests/)
    assert.doesNotMatch(prompt, /Something else entirely/)
  })

  it('leaves a flow that is not one of its own reading the file', () => {
    const built = run('implement', 1)
    setFlowRule('refine', 'Ask about the data model.')
    assert.match(buildPrompt({ action: 'refine', id: 1 }), /data model/)
    end(built)
  })
})
