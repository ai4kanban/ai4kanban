// An agent's own files (#860). Everything beside its `AGENT.md` is NAMED in every run it
// does — leading, helping and reviewing — and never pasted in, so the run opens one only
// when the work calls for it. A built-in agent's files ship inside the command, where there
// is no path to open, so `akb raw agent-file` prints those.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { buildAsk, buildPrompt } from '../src/lib/agent/prompts.ts'
import { createWorkflow, setWorkflowLead } from '../src/lib/agent/workflows.ts'
import { BUNDLED_AGENT_FILES } from '../src/lib/agents/bundled.ts'
import { findSpecAgent, specAgentCatalog, specAgentList } from '../src/lib/agents/index.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, move, refuses } from './helpers/board.ts'

let root = ''
const kanban = (): string => path.join(root, 'docs', 'kanban')

/** Write one project agent, and whatever else it keeps in its folder. */
function agent(name: string, akb: string[], files: Record<string, string> = {}): void {
  const dir = path.join(kanban(), 'agents', name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'AGENT.md'),
    ['---', `name: ${name}`, `description: Use when a card needs ${name}.`, 'akb:', ...akb, '---', '', `You write the ${name} part.`, ''].join('\n'),
  )
  for (const [where, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, where)), { recursive: true })
    fs.writeFileSync(path.join(dir, where), text)
  }
}

const SAMPLE_FILES = {
  'style.md': 'Name a client after the endpoint it calls.',
  'examples/client.md': 'const client = connect()',
  '.notes.md': 'scratch',
  '.cache/old.md': 'stale',
}

let card = 0

beforeEach(async () => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-agent-files-')))
  fs.mkdirSync(path.join(root, '.git'), { recursive: true })
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  fs.writeFileSync(path.join(kanban(), 'todo', 'README.md'), '# Tasks\n\n## Tasks\n')
  fs.writeFileSync(path.join(kanban(), 'config.md'), '# Configuration\n\n- **Project** — a project.\n')
  setBoardRoot(root)
  agent('sdk-sample', ['  kind: spec'], SAMPLE_FILES)
  agent('api-contract', ['  kind: spec'])
  card = (await move(root, ['create', '--title', 'Change an endpoint'])).id as number
})

afterEach(() => {
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('what an agent offers', () => {
  it('lists its whole folder, at any depth, but its own AGENT.md and anything hidden', () => {
    assert.deepEqual(findSpecAgent('sdk-sample')!.files, ['examples/client.md', 'style.md'])
    assert.deepEqual(findSpecAgent('api-contract')!.files, [])
  })

  it("leaves out a file a setting's choice names — that one is sent whole when it is picked", () => {
    // Both of `ui-designer`'s files are references, so it offers none to go and read.
    assert.deepEqual(findSpecAgent('ui-designer')!.files, [])
  })
})

describe('what a run is told', () => {
  const helperAsk = (name: string): string => buildAsk({ action: 'spec', id: card, title: 'Change an endpoint', specAgent: name })

  it('names every file, as a path and nothing more, on a helper run', () => {
    const ask = helperAsk('sdk-sample')
    assert.match(ask, /——— your own files ———/)
    assert.match(ask, /docs\/kanban\/agents\/sdk-sample\/style\.md/)
    assert.match(ask, /docs\/kanban\/agents\/sdk-sample\/examples\/client\.md/)
    assert.doesNotMatch(ask, /Name a client after the endpoint|const client = connect/)
    assert.doesNotMatch(ask, /\.notes\.md|\.cache/)
  })

  it('names them on a leading run too', async () => {
    agent('clip-editor', ['  kind: lead', '  stage: execute'], { 'style.md': 'Cut on the beat.' })
    const flow = createWorkflow('Clips').id!
    assert.equal(setWorkflowLead(flow, 'plan', 'software-planner').ok, true)
    assert.equal(setWorkflowLead(flow, 'execute', 'clip-editor').ok, true)
    const id = (await move(root, ['create', '--title', 'A clip', '--workflow', flow])).id as number
    const prompt = buildPrompt({ action: 'implement', id })
    assert.match(prompt, /——— your own files ———[\s\S]*docs\/kanban\/agents\/clip-editor\/style\.md/)
    assert.doesNotMatch(prompt, /Cut on the beat/)
  })

  it('names them on a review run too', () => {
    agent('contract-reviewer', ['  kind: spec', '  stage: review'], { 'checklist.md': 'Every endpoint has an error case.' })
    const ask = helperAsk('contract-reviewer')
    assert.match(ask, /`contract-reviewer` reviewer/)
    assert.match(ask, /——— your own files ———[\s\S]*docs\/kanban\/agents\/contract-reviewer\/checklist\.md/)
    assert.doesNotMatch(ask, /Every endpoint has an error case/)
  })

  it('says nothing at all when the agent has no other file', () => {
    assert.doesNotMatch(helperAsk('api-contract'), /your own files/)
  })

  it("keeps the reference nobody picked out of the run, list and all", () => {
    const ask = helperAsk('ui-designer')
    assert.doesNotMatch(ask, /references\/ascii-drawing\.md/)
    assert.doesNotMatch(ask, /your own files/)
    // …and the one that IS picked still arrives whole.
    assert.match(ask, /Mockup style: Rendered screen/)
  })
})

describe('`akb raw agent-file`', () => {
  it("prints a project agent's file", async () => {
    const said = await move(root, ['agent-file', 'sdk-sample', 'examples/client.md'])
    assert.equal(said.text, 'const client = connect()')
  })

  it("prints a built-in agent's file, which has no path to open", async () => {
    BUNDLED_AGENT_FILES['ui-designer/spacing.md'] = 'Eight pixels, or a multiple of it.'
    try {
      assert.deepEqual(findSpecAgent('ui-designer')!.files, ['spacing.md'])
      const said = await move(root, ['agent-file', 'ui-designer', 'spacing.md'])
      assert.equal(said.text, 'Eight pixels, or a multiple of it.')
      assert.match(buildAsk({ action: 'spec', id: card, specAgent: 'ui-designer' }), /agent-file ui-designer spacing\.md/)
    } finally {
      delete BUNDLED_AGENT_FILES['ui-designer/spacing.md']
    }
  })

  it('refuses a path that climbs out of the folder, and one the agent does not offer', async () => {
    await refuses(root, ['agent-file', 'sdk-sample', '../api-contract/AGENT.md'], /has no `\.\.\/api-contract\/AGENT\.md`/)
    await refuses(root, ['agent-file', 'sdk-sample', 'AGENT.md'], /has no `AGENT\.md`/)
    await refuses(root, ['agent-file', 'api-contract', 'style.md'], /It has none\./)
    await refuses(root, ['agent-file', 'nobody', 'style.md'], /is not an agent on this board/)
  })
})

describe('an agent that still declares `akb.dependencies`', () => {
  it('loads as usual, even naming an agent this board does not have', () => {
    agent('release-page', ['  kind: spec', '  dependencies:', '    - agent: api-contract', '    - agent: nobody'])
    assert.ok(findSpecAgent('release-page'))
    assert.deepEqual(specAgentCatalog().problems, [])
  })

  it('is no longer ordered by it — nothing says one agent starts after another', () => {
    assert.doesNotMatch(specAgentList('akb'), /starts only after/)
  })
})
