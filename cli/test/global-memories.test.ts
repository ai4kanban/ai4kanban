// Global memories (#1575): a built-in or board folder under `memory/<name>/`, read into the
// runs of every agent whose `akb.memory` names it, and written from the board UI.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { buildAsk } from '../src/lib/agent/prompts.ts'
import { findSpecAgent } from '../src/lib/agents/index.ts'
import { parseYamlBlock } from '../src/lib/agents/yaml.ts'
import {
  createGlobalMemory,
  deleteGlobalMemory,
  globalMemories,
  readGlobalMemories,
  saveGlobalMemory,
} from '../src/lib/memories.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, move, refuses } from './helpers/board.ts'

let root = ''
const kanban = (): string => path.join(root, 'docs', 'kanban')

function agent(name: string, akb: string[]): void {
  const dir = path.join(kanban(), 'agents', name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'AGENT.md'),
    ['---', `name: ${name}`, `description: Use when a card needs ${name}.`, 'akb:', ...akb, '---', '', `You write the ${name} part.`, ''].join('\n'),
  )
}

let card = 0

beforeEach(async () => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-global-memory-')))
  fs.mkdirSync(path.join(root, '.git'), { recursive: true })
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  fs.writeFileSync(path.join(kanban(), 'todo', 'README.md'), '# Tasks\n\n## Tasks\n')
  fs.writeFileSync(path.join(kanban(), 'config.md'), '# Configuration\n\n- **Project** — a project.\n')
  setBoardRoot(root)
  card = (await move(root, ['create', '--title', 'Compare boards'])).id as number
})

afterEach(() => {
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('akb.memory', () => {
  it('reads a flow list of scalars', () => {
    assert.deepEqual(parseYamlBlock('akb:\n  memory: [competitors, "interviews"]').akb, { memory: ['competitors', 'interviews'] })
  })

  it('names the memories an agent keeps', () => {
    agent('researcher', ['  hook: plan', '  memory: [competitors]'])
    assert.deepEqual(findSpecAgent('researcher')!.memory, ['competitors'])
  })
})

describe('the catalog', () => {
  it('ships `competitors`, with no folder made for it', () => {
    const competitors = globalMemories().find((m) => m.name === 'competitors')!
    assert.equal(competitors.builtIn, true)
    assert.match(competitors.rules, /last_read/)
    assert.equal(fs.existsSync(path.join(kanban(), 'memory', 'competitors')), false)
  })

  it('creates, saves and deletes a board memory, and lists who keeps it', () => {
    agent('writer', ['  hook: plan', '  memory: [interviews]'])
    assert.deepEqual(createGlobalMemory('interviews', 'Customer interviews.', '- One file each.'), { ok: true })
    const view = readGlobalMemories().find((m) => m.name === 'interviews')!
    assert.equal(view.folder, 'docs/kanban/memory/interviews/')
    assert.deepEqual(view.agents, ['writer'])

    assert.equal(saveGlobalMemory('interviews', 'Interviews: what customers said.', '- Two files each.').ok, true)
    const saved = globalMemories().find((m) => m.name === 'interviews')!
    assert.equal(saved.description, 'Interviews: what customers said.')
    assert.equal(saved.rules, '- Two files each.')

    assert.equal(deleteGlobalMemory('interviews').ok, true)
    assert.equal(fs.existsSync(path.join(kanban(), 'memory', 'interviews')), false)
  })

  it('refuses a taken name and a built-in write', () => {
    assert.equal(createGlobalMemory('competitors', 'Mine.', '').ok, false)
    assert.equal(createGlobalMemory('agents', 'Mine.', '').ok, false)
    assert.equal(createGlobalMemory('Not OK', 'Mine.', '').ok, false)
    assert.equal(saveGlobalMemory('competitors', 'Mine.', '').ok, false)
    assert.equal(deleteGlobalMemory('competitors').ok, false)
  })
})

describe('what a run is told', () => {
  it('lists each memory it keeps, and skips a name no memory has', () => {
    agent('researcher', ['  hook: plan', '  memory: [competitors, pricing]'])
    const ask = buildAsk({ action: 'spec', id: card, title: 'Compare boards', specAgent: 'researcher' })
    assert.match(ask, /——— global memories ———/)
    assert.match(ask, /- `competitors` — What competing products offer[^\n]*competitor: `[^`]*memory\/competitors\/`; rules: `[^`]*raw memory-file competitors/)
    assert.doesNotMatch(ask, /pricing/)
    assert.doesNotMatch(ask, /last_read/)
  })

  it('says nothing when the agent keeps none', () => {
    agent('plain', ['  hook: plan'])
    assert.doesNotMatch(buildAsk({ action: 'spec', id: card, title: 'Compare boards', specAgent: 'plain' }), /global memories/)
  })
})

describe('`akb raw memory-file`', () => {
  it("prints a built-in memory's rules", async () => {
    const said = await move(root, ['memory-file', 'competitors'])
    assert.match(String(said.text), /^---\nname: competitors/)
  })

  it('refuses a name no memory has', async () => {
    await refuses(root, ['memory-file', 'nobody'], /is not a global memory on this board/)
  })
})
