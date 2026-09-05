import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { setBoardRoot, SESSIONS_DIR } from '../src/lib/paths'
import { formatContractErrors, snapshotSpecs, validateRunSpecs, validateSpec } from '../src/lib/spec-contract'
import { openRun, patch, peekRun } from '../src/lib/agent/sessions'
import { setBoardProvider } from '../src/lib/board'
import type { AgentAction } from '../src/lib/agent/types'
import { watchRun } from '../src/lib/agent/watch'
import { move, refuses } from './helpers/board'

let root: string
let file: string
const valid = `---
title: A feature
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: []
modules: []
questions: []
---

An observable feature.

## Worth noting

<!-- agent -->

## Scope
A requirement.

## Todo
- [ ] Implement it.

## Decided by the agent

### Overruled by the user
`

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-contract-'))
  setBoardRoot(root)
  setBoardProvider(null)
  file = path.join(root, 'docs/kanban/todo/1-feature.md')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, valid)
  fs.writeFileSync(path.join(root, 'docs/kanban/next-id'), '3\n')
  fs.writeFileSync(path.join(path.dirname(file), 'README.md'), '# Tasks\n\n- [ ] #1 [A feature](1-feature.md)\n')
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe('the card format contract', () => {
  it('accepts ordinary cards, group roots and recurring processes', () => {
    assert.deepEqual(validateSpec(file, valid), [])
    assert.deepEqual(validateSpec(path.join(path.dirname(file), '1-group/root.md'), valid), [])
    const recurring = valid.slice(0, valid.indexOf('An observable')) + 'A repeating job.\n\n## Run state\nNone.\n\n## Process\n1. Do the job.\n'
    assert.deepEqual(validateSpec(path.join(path.dirname(file), 'recurring/1-job.md'), recurring), [])
  })

  it('reports exact lines and repair instructions without modifying the card', async () => {
    const broken = valid.replace('## Scope', '## Scpoe').replace('status: todo', 'status: invented')
    fs.writeFileSync(file, broken)
    const errors = validateSpec(file, broken)
    const section = errors.find((e) => e.rule === 'section-name')!
    assert.equal(section.line, broken.split('\n').indexOf('## Scpoe') + 1)
    assert.match(formatContractErrors(errors), /1-feature.md:\d+ \[section-name\] Unknown ## Scpoe/)
    assert.ok(errors.some((e) => e.rule === 'status'))
    await refuses(root, ['validate', '1'], /Spec format validation failed/)
    assert.equal(fs.readFileSync(file, 'utf8'), broken)
  })

  it('checks all requested cards through the CLI', async () => {
    assert.equal((await move(root, ['validate', '1'])).valid, true)
    fs.writeFileSync(path.join(path.dirname(file), '2-feature.md'), valid.replace('<!-- agent -->', ''))
    await refuses(root, ['validate'], /2-feature.md.*\[boundary\]/)
    await refuses(root, ['validate', '999'], /no task with id 999/)
  })

  it('detects duplicate sections, misplaced sections, missing todos and mockup formatting', () => {
    const bad = valid.replace('<!-- agent -->', '<!-- agent -->\n\n## Worth noting')
      .replace('- [ ] Implement it.', 'Implement it.\n\n<Mockup src=".mockups/1/a.tsx" label="A" /> caption')
    const rules = validateSpec(file, bad).map((e) => e.rule)
    for (const rule of ['duplicate-section', 'section-half', 'todos', 'mockup-block']) assert.ok(rules.includes(rule), rule)
  })

  it('validates specialist sections while ignoring examples inside code fences', () => {
    const example = '\n## By `ui-design` agent\n\n### Layout\n\n````md\n```\n## Scope\n<!-- agent -->\n<Mockup broken>\n```\n````\n'
    assert.deepEqual(validateSpec(file, valid.replace('## Decided by the agent', example + '\n## Decided by the agent')), [])
    assert.ok(validateSpec(file, valid + '\n```md\ntext').some((e) => e.rule === 'code-fence'))
  })

  it('catches raw malformed files, including cards created by non-spec runs, and excludes unrelated work', () => {
    const before = snapshotSpecs()
    const bad = path.join(path.dirname(file), '2-broken.md')
    fs.writeFileSync(bad, 'no frontmatter')
    assert.ok(validateRunSpecs(before, snapshotSpecs(), null).some((e) => e.file.endsWith('2-broken.md')))
    assert.deepEqual(validateRunSpecs(before, snapshotSpecs(), null, new Set([2])), [])
    assert.deepEqual(validateRunSpecs(snapshotSpecs(), snapshotSpecs(), null), [])
  })
})

async function fakeRun(repairable: boolean, action: AgentAction = 'writing') {
  const script = path.join(root, 'fake-agent.cjs')
  fs.writeFileSync(script, `
    const fs = require('node:fs');
    const file = ${JSON.stringify(file)};
    const prompt = process.argv.at(-1);
    fs.appendFileSync(${JSON.stringify(path.join(root, 'prompts.log'))}, JSON.stringify(prompt) + '\\n');
    fs.appendFileSync(${JSON.stringify(path.join(root, 'args.log'))}, JSON.stringify(process.argv) + '\\n');
    let text = fs.readFileSync(file, 'utf8');
    if (prompt.includes('Spec format validation failed.') && ${repairable}) text = text.replace('## Scpoe', '## Scope');
    else text = text.replace('## Scope', '## Scpoe');
    fs.writeFileSync(file, text);
    console.log(JSON.stringify({type: 'result', result: 'Done', total_cost_usd: 0.1, usage: {input_tokens: 10, output_tokens: 5}}));
  `)
  fs.writeFileSync(path.join(root, 'docs/kanban/ui.config.json'), JSON.stringify({ harness: 'claude-code', harnessSettings: { 'claude-code': { command: `${process.execPath} ${script}` } } }))
  const opened = openRun({ action, id: 1, ...(action === 'spec' ? { specAgent: 'ui-design' } : {}) }, 'Write the spec.', [])
  if ('error' in opened) throw new Error(opened.error)
  opened.spec.plan.argv = [process.execPath, script]
  opened.spec.plan.harness = 'claude-code'
  fs.writeFileSync(path.join(SESSIONS_DIR, `${opened.run.sessionId}.plan.json`), JSON.stringify(opened.spec))
  patch(opened.run.sessionId, (r) => { r.pid = process.pid })
  return opened.run.sessionId
}

describe('run completion validation', () => {
  it('returns errors to the agent and only marks writing ready after a successful repair', async () => {
    const id = await fakeRun(true)
    assert.equal(await watchRun(id), 0)
    const prompts = fs.readFileSync(path.join(root, 'prompts.log'), 'utf8').trim().split('\n').map((line) => JSON.parse(line) as string)
    assert.equal(prompts.length, 2)
    assert.match(prompts[1]!, /1-feature.md:\d+ \[section-name\]/)
    assert.match(fs.readFileSync(file, 'utf8'), /status: ready/)
    assert.equal(peekRun(id)?.status, 'done')
    assert.equal(peekRun(id)?.costUsd, 0.2)
    assert.equal(peekRun(id)?.usage?.input, 20)
    const args = fs.readFileSync(path.join(root, 'args.log'), 'utf8').trim().split('\n').map((line) => JSON.parse(line) as string[])
    assert.ok(args[1]!.includes('--resume'))
    assert.ok(!args[1]!.includes('--session-id'))
  })

  it('also blocks spec, refinement, and revision runs when formatting stays invalid', async () => {
    for (const action of ['spec', 'clarify', 'edit'] as const) {
      fs.writeFileSync(file, valid)
      const id = await fakeRun(false, action)
      assert.equal(await watchRun(id), 1, action)
      assert.equal(peekRun(id)?.status, 'error', action)
      assert.match(peekRun(id)?.error ?? '', /Spec format validation failed/)
    }
  })

  it('fails with detailed errors after bounded repair attempts and never marks the card ready', async () => {
    const id = await fakeRun(false)
    assert.equal(await watchRun(id), 1)
    assert.equal(peekRun(id)?.status, 'error')
    assert.equal(peekRun(id)?.ok, false)
    assert.match(peekRun(id)?.error ?? '', /1-feature.md:\d+ \[section-name\]/)
    assert.match(fs.readFileSync(file, 'utf8'), /status: todo/)
    assert.equal(fs.readFileSync(path.join(root, 'prompts.log'), 'utf8').trim().split('\n').length, 4)
  })
})
