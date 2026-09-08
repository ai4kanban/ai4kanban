import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { RUN_ENV } from '../src/lib/agent/env'
import { buildPrompt } from '../src/lib/agent/prompts'
import { agentForRun } from '../src/lib/agent/runner'
import { openRun, peekRun } from '../src/lib/agent/sessions'
import { readAction } from '../src/lib/agent/store'
import { holdsCard } from '../src/lib/agent/types'
import type { AgentRequest } from '../src/lib/agent/types'
import { setBoardProvider } from '../src/lib/board'
import { findGuide } from '../src/lib/guide'
import { setBoardRoot } from '../src/lib/paths'
import { run } from './helpers/board'

let root: string
let board: string
let oldRun: string | undefined
const write = (name: string, text: string): void => {
  const file = path.join(board, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}
const ask: AgentRequest = { action: 'marketing-polish-loop', id: 1, channel: 'x' }

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-polish-loop-'))
  board = path.join(root, 'docs/kanban')
  setBoardRoot(root)
  setBoardProvider(null)
  oldRun = process.env[RUN_ENV]
  delete process.env[RUN_ENV]
  write('config.md', '# Project\n\n- **Solution** — marketing\n')
  write('todo/1-topic.md', '---\ntitle: A topic\nstatus: todo\nblocked_by: []\nrelated: []\nmodules: []\nchannels:\n  - name: x\n    status: draft\n---\n')
  write('todo/README.md', '# Tasks\n\n- [ ] #1 [A topic](1-topic.md)\n')
  write('next-id', '2\n')
  write('memory/writing.md', 'Shared rule')
  write('content/1-topic/x.md', 'Draft')
})
afterEach(() => {
  if (oldRun === undefined) delete process.env[RUN_ENV]
  else process.env[RUN_ENV] = oldRun
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the marketing polish loop', () => {
  it('runs as the reviewer, on the reviewer rule alone', () => {
    write('rules/reviewer.md', 'Reviewer-only instruction')
    write('rules/writer.md', 'Writer-only instruction')
    assert.equal(agentForRun(ask), 'reviewer')
    const prompt = buildPrompt(ask)
    assert.match(prompt, /Reviewer-only instruction/)
    assert.doesNotMatch(prompt, /Writer-only instruction/)
  })

  it('is asked for the draft, both memory paths and the cap', () => {
    const prompt = buildPrompt(ask)
    assert.match(prompt, /Edit only docs\/kanban\/content\/1-topic\/x.md/)
    assert.match(prompt, /docs\/kanban\/memory\/writing.md/)
    assert.match(prompt, /docs\/kanban\/memory\/writing\//)
    assert.match(prompt, /after 3 passes/)
    assert.match(prompt, /akb guide marketing-polish-loop/)
  })

  it('opens one run that keeps its channel and no chained session behind it', () => {
    const opened = openRun(ask, buildPrompt(ask), [])
    assert.ok(!('error' in opened))
    const record = peekRun(opened.run.sessionId)!
    assert.equal(record.action, 'marketing-polish-loop')
    assert.equal(record.channel, 'x')
    assert.equal(record.agent, 'reviewer')
  })

  it('reads a verify or a fix left by an older build as the loop that replaced them', () => {
    for (const was of ['marketing-verify', 'marketing-fix']) {
      assert.equal(readAction(was), 'marketing-polish-loop', was)
      // …so a record the upgrade inherited stays card-free rather than holding a card it
      // never held, and still has a word to be listed under.
      assert.equal(holdsCard(readAction(was)), false, was)
      assert.equal(findGuide(was)?.name, 'marketing-polish-loop', was)
    }
  })

  it('refuses product boards, inline runs, unknown channels and missing drafts through the command', async () => {
    await assert.rejects(() => run(root, ['marketing', 'verify', 'x', '1', '--print']), /no --print/)
    await assert.rejects(() => run(root, ['marketing', 'verify', 'source', '1']), /Unknown channel/)
    await assert.rejects(() => run(root, ['marketing', 'verify', 'linkedin', '1']), /does not go/)
    await assert.rejects(() => run(root, ['marketing', 'verify', 'x', '9']), /No topic/)
    fs.rmSync(path.join(board, 'content/1-topic/x.md'))
    await assert.rejects(() => run(root, ['marketing', 'verify', 'x', '1']), /No draft/)
    process.env[RUN_ENV] = 'some-run'
    await assert.rejects(() => run(root, ['marketing', 'verify', 'x', '1']), /cannot start the polish loop/)
    delete process.env[RUN_ENV]
    write('config.md', '# Project\n')
    await assert.rejects(() => run(root, ['marketing', 'verify', 'x', '1']), /requires a marketing board/)
  })
})
