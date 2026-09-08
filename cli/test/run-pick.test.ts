// The runtime one Add task or Build now run goes on (#518).
//
// The promise is the same one a conversation's pick makes, one level up: the pick belongs to
// the run it starts. The board's settings are untouched, the next run of that flow is back on
// its agent's own runtime, and the pick reaches the spawn rather than only the screen.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { runRuntimePick } from '../src/lib/agent/resolve.ts'
import { openRun } from '../src/lib/agent/sessions.ts'
import { readRuns } from '../src/lib/agent/store.ts'
import type { AgentRequest } from '../src/lib/agent/types.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

let root = ''

const runtime = (id: string, harness: string, settings: Record<string, string>) => ({
  id,
  name: id === 'global' ? 'Global default' : id,
  harness,
  settings,
})

// Three rows and two agents pointed at two of them, so "the flow's own agent's" is a
// different answer for each of the sheet's two run modes.
const BOARD = {
  runtimes: [
    runtime('global', 'claude-code', { model: 'claude-sonnet-5' }),
    runtime('strong', 'claude-code', { model: 'claude-opus-5' }),
    runtime('cheap', 'codex', { model: 'gpt-5.1-codex' }),
  ],
  agentRuntime: { builder: 'cheap' },
}

const config = (cfg: Record<string, unknown>): void => {
  const kanban = path.join(root, 'docs', 'kanban')
  fs.mkdirSync(kanban, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'ui.config.json'), JSON.stringify(cfg, null, 2))
  setBoardRoot(root)
}

const held = (): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(root, 'docs', 'kanban', 'ui.config.json'), 'utf8'))

// A create names no card and opens no delivery, so it is the one run this file can start
// without a git repository under it.
const create = (runtime?: string) =>
  openRun({ action: 'create', description: 'something to build', ...(runtime ? { runtime } : {}) }, 'prompt')

// The model list a row offers is read partly off the CLIs' own files under $HOME, so the home
// is a scratch one too.
let home = ''
let realHome: string | undefined

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-run-pick-'))
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-run-pick-home-'))
  realHome = process.env.HOME
  process.env.HOME = home
  config(BOARD)
})

afterEach(() => {
  if (realHome === undefined) delete process.env.HOME
  else process.env.HOME = realHome
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(home, { recursive: true, force: true })
})

describe('what the sheet opens on', () => {
  it("is the flow's own agent's runtime — the planner's, and the builder's", () => {
    assert.equal(runRuntimePick('create').runtime, 'global')
    assert.equal(runRuntimePick('implement').runtime, 'cheap')
  })

  it('offers every runtime the board holds, in the board’s own order, each with its model', () => {
    assert.deepEqual(
      runRuntimePick('create').runtimes.map((r) => [r.id, r.model]),
      [
        ['global', 'claude-sonnet-5'],
        ['strong', 'claude-opus-5'],
        ['cheap', 'gpt-5.1-codex'],
      ],
    )
  })

  it('gates nothing — a row whose CLI is not here is marked and still offered', () => {
    config({ runtimes: [runtime('global', 'claude-code', { command: '/nowhere/claude' })] })
    const [row] = runRuntimePick('create').runtimes
    assert.equal(row?.id, 'global')
    assert.equal(row?.installed, false)
  })
})

describe('the pick reaching the run', () => {
  it('spawns the picked runtime and records it, leaving the board alone', () => {
    const opened = create('strong')
    assert.ok('run' in opened)
    assert.equal(opened.run.runtime, 'strong')
    assert.equal(opened.run.harness, 'claude-code')
    assert.ok(opened.spec.plan.argv.includes('claude-opus-5'))
    assert.deepEqual(held(), BOARD)
  })

  it("runs the flow's own agent's runtime when the send picked none", () => {
    const opened = create()
    assert.ok('run' in opened)
    assert.equal(opened.run.runtime, 'global')
    assert.ok(opened.spec.plan.argv.includes('claude-sonnet-5'))
  })

  it('is the one run’s alone — the next one is back on the agent’s own', () => {
    create('strong')
    create()
    assert.deepEqual(
      readRuns().map((r) => r.runtime),
      ['strong', 'global'],
    )
  })

  it('is what the prompt calls the skill by — the CLI spawned, not the agent’s own', () => {
    // The builder runs Codex here, so its own prompt says `$kanban`; a build picked onto a
    // Claude Code row must say `/kanban`, or the skill never loads.
    assert.match(buildPrompt({ action: 'implement', id: 1, title: 'card 1' }), /\$kanban/)
    assert.match(buildPrompt({ action: 'implement', id: 1, title: 'card 1', runtime: 'strong' }), /\/kanban/)
  })

  it('is what the pictures follow too — the CLI spawned decides where they go (#517)', () => {
    // The builder runs Codex, which takes a flag per file, so its own prompt says nothing
    // about them; picked onto a Claude Code row the same run must NAME them, or the pictures
    // reach neither the words nor the command line.
    const build: AgentRequest = { action: 'implement', id: 1, title: 'card 1', pictures: ['/a.png'] }
    assert.doesNotMatch(buildPrompt(build), /picture came/)
    assert.match(buildPrompt({ ...build, runtime: 'strong' }), /A picture came with this[\s\S]*\/a\.png/)
    // And the other way: the planner reads a path out of the words, and a create picked onto
    // Codex leaves them to the command line.
    const card: AgentRequest = { action: 'create', description: 'fix this', pictures: ['/a.png'] }
    assert.match(buildPrompt(card), /A picture came with this/)
    assert.doesNotMatch(buildPrompt({ ...card, runtime: 'cheap' }), /picture came/)
  })

  it('refuses a runtime this board does not have rather than quietly running another', () => {
    const opened = create('nonesuch')
    assert.ok('error' in opened && /no runtime called "nonesuch"/.test(opened.error))
    assert.equal(readRuns().length, 0)
  })
})
