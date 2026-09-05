// The writer's own specialists (#424): a `write` agent adds to the bundled writer rather
// than replacing it — it is asked for by name while the draft is being written, and the
// board starts it once that run ends.
//
// What is asked here is the whole of the promise: each solution's flows carry the roster
// that is theirs and no other, a specialist is never shown the list of specialists, the ask
// is written down inside a run and started after it, an agent that is off or a card that has
// gone drops the ask rather than starting it, `akb write` is refused where there is no
// writer, and a live write agent leaves its card free for the run that asked for it.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, afterEach, beforeEach, describe, it } from 'node:test'

import { RUN_ENV } from '../src/lib/agent/env.ts'
import { writeRunsAfter } from '../src/lib/agent/follow.ts'
import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { askForWrite, clearAsks, openRun, readWriteAsks } from '../src/lib/agent/sessions.ts'
import { setBoardProvider } from '../src/lib/board/index.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { run } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-write-agent-'))
const kanban = path.join(root, 'docs', 'kanban')
const todo = path.join(kanban, 'todo')
const card = path.join(todo, '2-a-topic.md')

const CARD = [
  '---',
  'title: A topic',
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
  'One topic, wanting a picture.',
  '',
].join('\n')

const POSTER = [
  '---',
  'name: poster',
  'description: Use when a draft needs an image made for it.',
  'akb:',
  '  kind: write',
  '  owns: the images a draft links to',
  '---',
  '',
  'You make the images a draft asks for.',
  '',
].join('\n')

// A second one, so a write agent asking for another write agent is the real case rather
// than an agent asking for itself.
const CHARTER = POSTER.replace('name: poster', 'name: charter')
  .replace('an image made for it', 'a chart made for it')
  .replace('the images a draft links to', 'the charts a draft links to')

/** A board of one solution, with the two write agents on it. */
function board(which = 'marketing', cfg: Record<string, unknown> = {}): void {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(todo, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '3\n')
  fs.writeFileSync(path.join(kanban, 'config.md'), `# Project\n\n- **Name**: Test\n- **Solution** — ${which}\n`)
  fs.writeFileSync(path.join(kanban, 'ui.config.json'), JSON.stringify(cfg, null, 2))
  fs.writeFileSync(path.join(todo, 'README.md'), '# The board\n\n## Tasks\n\n- #2 A topic — 2-a-topic.md\n')
  fs.writeFileSync(card, CARD)
  for (const [name, text] of [['poster', POSTER], ['charter', CHARTER]] as const) {
    const agent = path.join(kanban, 'agents', name, 'AGENT.md')
    fs.mkdirSync(path.dirname(agent), { recursive: true })
    fs.writeFileSync(agent, text)
  }
  setBoardRoot(root)
  setBoardProvider(null)
}

const refusesRun = (argv: string[], pattern: RegExp): Promise<void> =>
  assert.rejects(() => run(root, argv), pattern)

/** One run on the record, so what it does to the card's lock can be asked. */
function open(action: 'write' | 'implement', agent?: string): string {
  const opened = openRun({ action, id: 2, title: 'A topic', specAgent: agent }, 'prompt', [])
  if ('error' in opened) throw new Error(opened.error)
  return opened.run.sessionId
}

beforeEach(() => {
  delete process.env[RUN_ENV]
  board()
})

afterEach(() => delete process.env[RUN_ENV])
after(() => fs.rmSync(root, { recursive: true, force: true }))

describe('the roster each run carries', () => {
  it("puts the write agents on the writer's implement and channel, and no spec agents", () => {
    for (const req of [
      { action: 'implement' as const, id: 2 },
      { action: 'channel' as const, id: 2, channel: 'x' },
    ]) {
      const prompt = buildPrompt(req)
      assert.match(prompt, /<write-agents>/)
      assert.match(prompt, /- `poster`/)
      assert.match(prompt, /owns the images a draft links to/)
      assert.match(prompt, /akb write <agent> 2 <short note>/)
      assert.doesNotMatch(prompt, /<spec-agents>/)
      // A roster is a catalog, never the agent's own instructions.
      assert.doesNotMatch(prompt, /You make the images a draft asks for/)
    }
  })

  it('stops offering spec agents on a marketing board at all', () => {
    for (const action of ['clarify', 'resolve', 'edit'] as const) {
      const prompt = buildPrompt({ action, id: 2, notes: 'a note' })
      assert.doesNotMatch(prompt, /<spec-agents>/)
      assert.doesNotMatch(prompt, /<write-agents>/)
    }
  })

  it('leaves a product board with the spec roster and no write one', () => {
    board('product')
    const prompt = buildPrompt({ action: 'clarify', id: 2 })
    assert.match(prompt, /<spec-agents>/)
    assert.doesNotMatch(prompt, /<write-agents>/)
    assert.doesNotMatch(buildPrompt({ action: 'implement', id: 2 }), /<write-agents>/)
  })

  it('gives a write run neither block, so an agent cannot ask for itself', () => {
    const prompt = buildPrompt({ action: 'write', id: 2, specAgent: 'poster', notes: 'draw the hero image' })
    assert.doesNotMatch(prompt, /<write-agents>/)
    assert.doesNotMatch(prompt, /<spec-agents>/)
  })

  it('says nothing where every write agent is switched off', () => {
    board('marketing', { specAgents: { poster: false, charter: false } })
    assert.doesNotMatch(buildPrompt({ action: 'implement', id: 2 }), /<write-agents>/)
  })
})

describe('what a write run is handed', () => {
  it('names the draft folder, the contract, its own instructions and the ask', () => {
    const prompt = buildPrompt({ action: 'write', id: 2, specAgent: 'poster', notes: 'the hero image' })
    assert.match(prompt, /You are the `poster` write agent on task 2/)
    assert.match(prompt, /docs\/kanban\/content\/2-a-topic/)
    assert.match(prompt, /Be a write agent/)
    assert.match(prompt, /You make the images a draft asks for/)
    assert.match(prompt, /the hero image/)
    // The draft is finished and points at its files; nothing it writes may reach back.
    assert.match(prompt, /Never `source\.md`/)
  })
})

describe('asking for one', () => {
  it('writes the ask down inside a run rather than starting it, once per agent', async () => {
    const sessionId = open('implement')
    process.env[RUN_ENV] = sessionId
    await run(root, ['write', 'poster', '2', 'the', 'hero', 'image'])
    assert.deepEqual(readWriteAsks(sessionId), [{ specAgent: 'poster', cardId: 2, notes: 'the hero image' }])
    assert.equal(askForWrite(sessionId, { specAgent: 'poster', cardId: 2 }), 'already')
    clearAsks(sessionId)
  })

  it('turns the ask into a run of its own once the asking run has ended', () => {
    const asked = writeRunsAfter([{ specAgent: 'poster', cardId: 2, notes: 'the hero image' }])
    assert.deepEqual(asked, [
      { action: 'write', id: 2, title: 'A topic', specAgent: 'poster', notes: 'the hero image' },
    ])
  })

  it('drops an ask for an agent switched off since, and for a card that has gone', () => {
    board('marketing', { specAgents: { poster: false } })
    assert.deepEqual(writeRunsAfter([{ specAgent: 'poster', cardId: 2 }]), [])
    board()
    assert.deepEqual(writeRunsAfter([{ specAgent: 'poster', cardId: 99 }]), [])
  })

  it('refuses an agent that is off, a name nobody has, a spec agent and --print', async () => {
    await refusesRun(['write', 'nobody', '2'], /"nobody" is not a write agent on this board/)
    await refusesRun(['write', 'ui-design', '2'], /is not a write agent on this board/)
    await refusesRun(['write', 'poster', '2', '--print'], /a write agent has no --print/)
    board('marketing', { specAgents: { poster: false } })
    await refusesRun(['write', 'poster', '2'], /switched off for this board/)
  })

  it('refuses a write agent asking for another write agent', async () => {
    const sessionId = open('write', 'poster')
    process.env[RUN_ENV] = sessionId
    await refusesRun(['write', 'charter', '2'], /a write agent does not ask for another write agent/)
  })

  it('is refused on a product board, which has no writer to add to', async () => {
    board('product')
    await refusesRun(['write'], /is the marketing solution's/)
  })
})

describe('a live write run', () => {
  it('leaves its card free for the run that asked for it, and the other way round', () => {
    open('write', 'poster')
    assert.doesNotThrow(() => open('implement'))
    assert.doesNotThrow(() => open('write', 'poster'))
  })

  it('still refuses a second run of the same flow on that card', () => {
    open('implement')
    assert.throws(() => open('implement'), /already being implemented/)
  })
})
