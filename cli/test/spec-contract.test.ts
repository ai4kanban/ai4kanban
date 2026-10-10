import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { setBoardRoot, SESSIONS_DIR } from '../src/lib/paths'
import { parseFrontmatter } from '../src/lib/frontmatter'
import { formatContractErrors, snapshotSpecs, validateRunSpecs, validateSpec } from '../src/lib/spec-contract'
import { openRun, openResume, patch, peekRun } from '../src/lib/agent/sessions'
import { setBoardProvider } from '../src/lib/board'
import type { AgentAction } from '../src/lib/agent/types'
import { watchRun } from '../src/lib/agent/watch'
import { move, refuses } from './helpers/board'
import { PROMPT_OF } from './helpers/fake-agent'

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
  it('accepts ordinary cards and group roots', () => {
    assert.deepEqual(validateSpec(file, valid), [])
    assert.deepEqual(validateSpec(path.join(path.dirname(file), '1-group/root.md'), valid), [])
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

  it('reports a card blocked by a group it is in', async () => {
    const dir = path.join(path.dirname(file), '5-outer')
    fs.mkdirSync(path.join(dir, '6-inner'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'root.md'), valid)
    fs.writeFileSync(path.join(dir, '6-inner/root.md'), valid)
    const blocked = valid.replace('blocked_by: []', 'blocked_by: [1, 5]')
    const errors = validateSpec(path.join(dir, '6-inner/7-part.md'), blocked)
    assert.deepEqual(errors.map((e) => [e.rule, e.line]), [['dependency-cycle', 7]])
    assert.match(errors[0]!.message, /#5, a group this card is in/)
    assert.deepEqual(validateSpec(path.join(dir, 'root.md'), valid.replace('blocked_by: []', 'blocked_by: [6]')), [])
  })

  it('reports a cycle a group member closes through other cards', () => {
    const todo = path.dirname(file)
    const card = (at: string, blockedBy: string) => {
      const text = valid.replace('blocked_by: []', `blocked_by: [${blockedBy}]`)
      fs.mkdirSync(path.dirname(path.join(todo, at)), { recursive: true })
      fs.writeFileSync(path.join(todo, at), text)
      return text
    }
    card('5-outer/root.md', '')
    card('8-x.md', '5')
    const member = card('5-outer/7-m.md', '8')
    const errors = validateSpec(path.join(todo, '5-outer/7-m.md'), member, 7)
    assert.deepEqual(errors.map((e) => [e.rule, e.line]), [['dependency-cycle', 7]])
    assert.match(errors[0]!.message, /#7 → #8 → #5 → #7/)

    const inner = card('5-outer/6-inner/root.md', '8')
    assert.match(validateSpec(path.join(todo, '5-outer/6-inner/root.md'), inner, 6)[0]!.message, /#6 → #8 → #5 → #6/)

    const direct = card('5-outer/7-m.md', '5')
    assert.equal(validateSpec(path.join(todo, '5-outer/7-m.md'), direct, 7).length, 1)

    card('8-x.md', '')
    fs.rmSync(path.join(todo, '5-outer/6-inner'), { recursive: true })
    assert.deepEqual(validateSpec(path.join(todo, '5-outer/7-m.md'), member, 7), [])
  })

  it('checks all requested cards through the CLI', async () => {
    assert.equal((await move(root, ['validate', '1'])).valid, true)
    fs.writeFileSync(path.join(path.dirname(file), '2-feature.md'), valid.replace('<!-- agent -->', ''))
    await refuses(root, ['validate'], /2-feature.md.*\[boundary\]/)
    await refuses(root, ['validate', '999'], /no task with id 999/)
  })

  it('reads, validates and rewrites a card still carrying the retired decided: block', async () => {
    const old = valid.replace('questions: []\n', 'questions: []\ndecided:\n  - question: "Which region?"\n    chose: "eu"\n    from: memory/goal.md\n')
    fs.writeFileSync(file, old)
    const { meta } = parseFrontmatter(old)
    assert.equal(meta!.title, 'A feature')
    assert.equal(meta!.status, 'todo')
    assert.deepEqual(meta!.questions, [])
    assert.ok(!('decided' in meta!))
    assert.equal((await move(root, ['validate', '1'])).valid, true)
    await move(root, ['update', '1', '--priority', 'high'])
    const written = fs.readFileSync(file, 'utf8')
    assert.match(written, /priority: high/)
    assert.doesNotMatch(written, /decided:|chose:/)
  })

  it('detects duplicate sections, misplaced sections, missing todos and mockup formatting', () => {
    const bad = valid.replace('<!-- agent -->', '<!-- agent -->\n\n## Worth noting')
      .replace('- [ ] Implement it.', 'Implement it.\n\n<Mockup src=".mockups/1/a.tsx" label="A" /> caption')
    const rules = validateSpec(file, bad).map((e) => e.rule)
    for (const rule of ['duplicate-section', 'section-half', 'todos', 'mockup-block']) assert.ok(rules.includes(rule), rule)
  })

  it('places ## Source after Worth noting, and still accepts it last', () => {
    const source = '## Source\n- plans/1-a.md\n\n'
    const human = valid.replace('<!-- agent -->', source + '## By `ui-designer` agent\n\n<!-- agent -->')
    assert.deepEqual(validateSpec(file, human), [])
    assert.deepEqual(validateSpec(file, valid + '\n' + source), [])
    const late = valid.replace('<!-- agent -->', '## By `ui-designer` agent\n\n' + source + '<!-- agent -->')
    assert.deepEqual(validateSpec(file, late).map((e) => e.rule), ['section-order'])
  })

  it('accepts only mobile or desktop as a mockup device', () => {
    const tag = (device: string) => valid.replace('- [ ] Implement it.', `- [ ] Implement it.\n\n<Asset src=".assets/1/a.tsx" label="A" ${device}/>\n`)
    const rules = (device: string) => validateSpec(file, tag(device)).map((e) => e.rule)
    for (const ok of ['', 'device="mobile" ', 'device="desktop" ']) assert.ok(!rules(ok).includes('mockup-device'), ok)
    assert.ok(rules('device="phone" ').includes('mockup-device'))
  })

  it('validates specialist sections while ignoring examples inside code fences', () => {
    const example = '\n## By `ui-designer` agent\n\n### Layout\n\n````md\n```\n## Scope\n<!-- agent -->\n<Mockup broken>\n```\n````\n'
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
    assert.ok(validateRunSpecs(snapshotSpecs(), snapshotSpecs(), null, new Set(), new Set([2])).some((e) => e.file.endsWith('2-broken.md')))
  })
})

describe("a human-facing agent's own section (#868)", () => {
  const section = '## By `outliner` agent\n\nAn outline.\n\n'
  const above = valid.replace('<!-- agent -->', section + '<!-- agent -->')
  const below = valid.replace('## Decided by the agent', section + '## Decided by the agent')
  const check = (text: string, cards = new Set([1])) => {
    const before = snapshotSpecs()
    fs.writeFileSync(file, text)
    return validateRunSpecs(before, snapshotSpecs(), 1, new Set(), new Set(), { agent: 'outliner', cards })
  }

  it('lets a run leave it out, but not below the boundary', () => {
    assert.deepEqual(check(valid), [])
    assert.match(check(below).map((e) => e.message).join('\n'), /Move ## By `outliner` agent above <!-- agent -->/)
    assert.deepEqual(check(above), [])
  })

  it('checks only the cards the run owns', () => {
    assert.deepEqual(check(valid, new Set()), [])
    const other = path.join(path.dirname(file), '2-other.md')
    fs.writeFileSync(other, below)
    assert.deepEqual(check(above).filter((e) => e.file.endsWith('2-other.md')), [])
    assert.deepEqual(validateSpec(other, below), [])
  })
})

async function fakeRun(repairable: boolean, action: AgentAction = 'clarify') {
  const script = path.join(root, 'fake-agent.cjs')
  fs.writeFileSync(script, `${PROMPT_OF}
    (async () => {
    const fs = require('node:fs');
    const file = ${JSON.stringify(file)};
    const prompt = await promptOf();
    fs.appendFileSync(${JSON.stringify(path.join(root, 'prompts.log'))}, JSON.stringify(prompt) + '\\n');
    fs.appendFileSync(${JSON.stringify(path.join(root, 'args.log'))}, JSON.stringify(process.argv) + '\\n');
    let text = fs.readFileSync(file, 'utf8');
    if (prompt.includes('Spec format validation failed.') && ${repairable}) text = text.replace('## Scpoe', '## Scope');
    else text = text.replace('## Scope', '## Scpoe');
    fs.writeFileSync(file, text);
    const turns = fs.readFileSync(${JSON.stringify(path.join(root, 'prompts.log'))}, 'utf8').trim().split('\\n').length;
    console.log(JSON.stringify({type: 'result', result: 'Done', total_cost_usd: turns * 0.1, usage: {input_tokens: 10, output_tokens: 5}}));
    })();
  `)
  fs.writeFileSync(path.join(root, 'docs/kanban/ui.config.json'), JSON.stringify({ harness: 'claude-code', harnessSettings: { 'claude-code': { command: `${process.execPath} ${script}` } } }))
  const opened = openRun({ action, id: 1, ...(action === 'spec' ? { specAgent: 'ui-designer' } : {}) }, 'Write the spec.', [])
  if ('error' in opened) throw new Error(opened.error)
  opened.spec.plan.argv = [process.execPath, script]
  opened.spec.plan.harness = 'claude-code'
  fs.writeFileSync(path.join(SESSIONS_DIR, `${opened.run.sessionId}.plan.json`), JSON.stringify(opened.spec))
  patch(opened.run.sessionId, (r) => { r.pid = process.pid })
  return opened.run.sessionId
}

async function watchWithResume(id: string): Promise<string> {
  let last = id
  await watchRun(id, async (previous) => {
    assert.equal(peekRun(previous)?.status, 'error')
    const opened = await openResume(previous)
    if ('error' in opened) return opened
    assert.equal(peekRun(previous), undefined)
    patch(opened.run.sessionId, (r) => { r.pid = process.pid })
    last = await watchWithResume(opened.run.sessionId)
    return { run: opened.run, spawned: true }
  })
  return last
}

describe('run completion validation', () => {
  it('returns errors to the agent, and a repaired run finishes', async () => {
    const id = await fakeRun(true)
    const last = await watchWithResume(id)
    const prompts = fs.readFileSync(path.join(root, 'prompts.log'), 'utf8').trim().split('\n').map((line) => JSON.parse(line) as string)
    assert.equal(prompts.length, 2)
    assert.match(prompts[1]!, /1-feature.md:\d+ \[section-name\]/)
    assert.match(fs.readFileSync(file, 'utf8'), /## Scope/)
    assert.equal(peekRun(last)?.status, 'done')
    assert.equal(peekRun(last)?.costUsd, 0.1)
    assert.equal(peekRun(last)?.usage?.input, 10)
    const args = fs.readFileSync(path.join(root, 'args.log'), 'utf8').trim().split('\n').map((line) => JSON.parse(line) as string[])
    assert.ok(args[1]!.includes('--resume'))
    assert.ok(!args[1]!.includes('--session-id'))
  })

  it('also blocks spec, refinement, and revision runs when formatting stays invalid', async () => {
    for (const action of ['spec', 'clarify', 'edit'] as const) {
      fs.writeFileSync(file, valid)
      const id = await fakeRun(false, action)
      const last = await watchWithResume(id)
      assert.equal(peekRun(last)?.status, 'error', action)
      assert.match(peekRun(last)?.error ?? '', /Spec format validation failed/)
    }
  })

  it('keeps the failure when no harness conversation id is available', async () => {
    const id = await fakeRun(false)
    patch(id, (r) => { r.harness = 'dsh'; r.resumeId = undefined })
    await watchRun(id, async (previous) => {
      const opened = await openResume(previous)
      assert.ok('error' in opened)
      return opened
    })
    assert.equal(peekRun(id)?.status, 'error')
    assert.match(peekRun(id)?.error ?? '', /never reported a session id/)
    assert.equal(fs.readFileSync(path.join(root, 'prompts.log'), 'utf8').trim().split('\n').length, 1)
  })

  it('fails with detailed errors after bounded repair attempts and never marks the card ready', async () => {
    const id = await fakeRun(false)
    const last = await watchWithResume(id)
    assert.equal(peekRun(last)?.status, 'error')
    assert.equal(peekRun(last)?.ok, false)
    assert.match(peekRun(last)?.error ?? '', /1-feature.md:\d+ \[section-name\]/)
    assert.match(fs.readFileSync(file, 'utf8'), /status: todo/)
    assert.equal(fs.readFileSync(path.join(root, 'prompts.log'), 'utf8').trim().split('\n').length, 4)
  })
})
