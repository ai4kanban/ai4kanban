// The spec agents (#403, #419): read from `AGENT.md` rather than written in TypeScript,
// added by a project as well as shipped, and handed to a run one reference at a time.
//
// What is asked here is the whole of the promise: the built-in agents still say what they
// always said; a project's own agent joins the same catalog, from the old folder as well as
// the new one; an agent nobody can read is reported by name instead of vanishing; the
// catalog a planning session sees carries no instructions; and a spec run is handed its
// agent and only the reference its board setting picked.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import {
  findSpecAgent,
  readSpecAgents,
  setSpecAgentSetting,
  specAgentCatalog,
  specAgentInstructions,
  specAgentSelector,
  specHookAgents,
} from '../src/lib/agents/index.ts'
import { parseYamlBlock } from '../src/lib/agents/yaml.ts'
import { move, refuses } from './helpers/board.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')

const board = (cfg: Record<string, unknown> = {}): void => {
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'ui.config.json'), JSON.stringify(cfg, null, 2))
  setBoardRoot(root)
}

/** Say what kind of board this is — `product` unless the line says otherwise. */
const solution = (name: string): void => {
  fs.writeFileSync(path.join(kanban(), 'config.md'), `- **Solution** — ${name}\n`)
}

/** Write one project agent: `AGENT.md` plus whatever else it carries, in `agents/` or —
 *  `folder` says which — the `skills/` folder agents used to live in. */
const project = (name: string, files: Record<string, string>, folder = 'agents'): void => {
  for (const [relative, text] of Object.entries(files)) {
    const file = path.join(kanban(), folder, name, relative)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, text)
  }
}

const AGENT = [
  '---',
  'name: api-contract',
  'description: Use when a card changes an endpoint other software calls.',
  'akb:',
  '  kind: spec',
  '  owns: the request and response shape a card changes',
  '---',
  '',
  'You settle the wire contract a card changes.',
  '',
].join('\n')

/** One card on the board, the shape a spec agent writes into. */
const card = (id: number): string => {
  const file = path.join(kanban(), 'todo', 'skill', `${id}-a-card.md`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(
    file,
    [
      '---',
      'title: A card',
      'priority: med',
      'roi: med',
      'status: ready',
      'release: ""',
      'blocked_by: []',
      'related: []',
      'modules: [skill]',
      'questions: []',
      '---',
      '',
      'A card.',
      '',
    ].join('\n'),
  )
  return file
}

/** What one agent remembers, as it stands on disk. */
const remembered = (name: string): string =>
  fs.readFileSync(path.join(kanban(), 'memory', 'agents', `${name}.md`), 'utf8')

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-spec-agents-'))
  board()
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the agents this command ships', () => {
  it('reads both of them out of their own AGENT.md', () => {
    const { agents, problems } = specAgentCatalog()
    assert.deepEqual(problems, [])
    assert.deepEqual(
      agents.map((a) => a.name),
      ['technology-selection', 'ui-design'],
    )
    const ui = findSpecAgent('ui-design')!
    assert.match(ui.owns, /the screen a card changes/)
    assert.match(ui.description, /^Use when/)
    assert.match(ui.body, /You draw the screen a card needs/)
    assert.equal(ui.builtIn, true)
  })

  it('carries `ui-design`\'s mockup style, its two choices and their references', () => {
    const setting = findSpecAgent('ui-design')!.settings[0]!
    assert.equal(setting.key, 'mockupStyle')
    assert.equal(setting.default, 'full')
    assert.deepEqual(
      setting.choices.map((c) => c.value),
      ['full', 'ascii'],
    )
    for (const choice of setting.choices) assert.match(choice.reference, /^references\//)
  })

  it('still answers to the name `technology-selection` had before', () => {
    assert.equal(findSpecAgent('recommend-tech-stack')?.name, 'technology-selection')
  })
})

describe('an agent the project adds', () => {
  it('joins the same catalog and the same list a screen draws', () => {
    project('api-contract', { 'AGENT.md': AGENT })
    const { agents, problems } = specAgentCatalog()
    assert.deepEqual(problems, [])
    assert.ok(agents.some((a) => a.name === 'api-contract'))
    const view = readSpecAgents().find((s) => s.name === 'api-contract')
    assert.equal(view?.enabled, true)
    assert.deepEqual(view?.settings, [])
  })

  it('is switched off and set like a built-in one', () => {
    project('api-contract', {
      'AGENT.md': AGENT.replace(
        '  owns: the request and response shape a card changes\n',
        [
          '  owns: the request and response shape a card changes',
          '  settings:',
          '    - key: style',
          '      label: Contract style',
          '      default: openapi',
          '      choices:',
          '        - value: openapi',
          '          label: OpenAPI',
          '          cost: a schema fragment per endpoint',
          '          reference: references/openapi.md',
          '        - value: prose',
          '          label: Prose',
          '          cost: one paragraph per endpoint',
          '          reference: references/prose.md',
          '',
        ].join('\n'),
      ),
      'references/openapi.md': 'Write an OpenAPI fragment.',
      'references/prose.md': 'Write a paragraph.',
    })
    assert.equal(setSpecAgentSetting('api-contract', 'style', 'prose').ok, true)
    const agent = findSpecAgent('api-contract')!
    assert.deepEqual(specAgentInstructions(agent).references, [
      { title: 'Contract style: Prose', text: 'Write a paragraph.' },
    ])
  })

  it('is refused rather than allowed to shadow a built-in name', () => {
    project('ui-design', { 'AGENT.md': AGENT.replace('name: api-contract', 'name: ui-design') })
    const { agents, problems } = specAgentCatalog()
    assert.equal(agents.filter((a) => a.name === 'ui-design').length, 1)
    assert.equal(findSpecAgent('ui-design')?.builtIn, true)
    assert.match(problems.join('\n'), /already on this board/)
  })
})

// The folder and the filename agents had before #419. Both are read for one release, so a
// board upgrades without its specialists going quiet — and every hit says to move it.
describe('an agent still in the folder agents used to live in', () => {
  it('is used, and reported so the folder gets moved', () => {
    project('api-contract', { 'AGENT.md': AGENT }, 'skills')
    const { agents, problems } = specAgentCatalog()
    assert.ok(agents.some((a) => a.name === 'api-contract'))
    assert.match(problems.join('\n'), /skills\/api-contract: move it to .*agents\/api-contract\//)
  })

  it('is read from `SKILL.md` as well as `AGENT.md`', () => {
    project('api-contract', { 'SKILL.md': AGENT }, 'skills')
    assert.ok(findSpecAgent('api-contract'))
  })

  it('is reported when the folder was moved but the filename was not', () => {
    project('api-contract', { 'SKILL.md': AGENT })
    const { agents, problems } = specAgentCatalog()
    assert.ok(agents.some((a) => a.name === 'api-contract'))
    assert.match(problems.join('\n'), /agents\/api-contract\/SKILL\.md: rename it to AGENT\.md/)
  })
})

// The two hooks (#419). `write` joins the writer, which only a marketing board has.
describe('the hook an agent declares', () => {
  const WRITE = AGENT.replace('  kind: spec', '  kind: write')

  it('takes a `write` agent on a marketing board, and leaves it off the spec list', () => {
    solution('marketing')
    project('api-contract', { 'AGENT.md': WRITE })
    const { agents, problems } = specAgentCatalog()
    assert.deepEqual(problems, [])
    assert.equal(agents.find((a) => a.name === 'api-contract')?.kind, 'write')
    assert.ok(!specHookAgents().some((a) => a.name === 'api-contract'))
    assert.doesNotMatch(specAgentSelector(12), /api-contract/)
  })

  it('refuses one on a product board rather than registering it', () => {
    project('api-contract', { 'AGENT.md': WRITE })
    const { agents, problems } = specAgentCatalog()
    assert.ok(!agents.some((a) => a.name === 'api-contract'))
    assert.match(problems.join('\n'), /only a marketing board has a writer to join/)
  })
})

describe('an agent nobody can read', () => {
  const problemFor = (files: Record<string, string>): string => {
    project('broken', files)
    return specAgentCatalog().problems.join('\n')
  }

  it('reports a file with no frontmatter', () => {
    assert.match(problemFor({ 'AGENT.md': 'Just instructions.' }), /no `---` frontmatter/)
  })

  it('reports a missing description', () => {
    assert.match(
      problemFor({ 'AGENT.md': ['---', 'name: broken', 'akb:', '  kind: spec', '  owns: x', '---', '', 'Body.'].join('\n') }),
      /has no `description`/,
    )
  })

  it('reports a kind this board does not run', () => {
    assert.match(
      problemFor({
        'AGENT.md': ['---', 'name: broken', 'description: d', 'akb:', '  kind: review', '  owns: x', '---', '', 'Body.'].join('\n'),
      }),
      /an agent is `spec` or `write`/,
    )
  })

  it('reports a choice whose reference is not there', () => {
    assert.match(
      problemFor({
        'AGENT.md': [
          '---',
          'name: broken',
          'description: d',
          'akb:',
          '  kind: spec',
          '  owns: x',
          '  settings:',
          '    - key: style',
          '      label: Style',
          '      default: a',
          '      choices:',
          '        - value: a',
          '          label: A',
          '          cost: c',
          '          reference: references/gone.md',
          '---',
          '',
          'Body.',
        ].join('\n'),
      }),
      /points at a missing references\/gone\.md/,
    )
  })

  it('reports a folder whose AGENT.md calls itself something else', () => {
    assert.match(problemFor({ 'AGENT.md': AGENT }), /make the two match/)
  })

  it('leaves the agents that do parse usable', () => {
    project('broken', { 'AGENT.md': 'Just instructions.' })
    assert.ok(findSpecAgent('ui-design'))
  })
})

describe('what a session is shown', () => {
  it('gives a planning session the names, descriptions and ownership and no instructions', () => {
    const catalog = specAgentSelector(12)
    assert.match(catalog, /<spec-agents>/)
    assert.match(catalog, /- `ui-design`/)
    assert.match(catalog, /owns the screen a card changes/)
    assert.match(catalog, /akb spec <agent> 12 <short note>/)
    assert.doesNotMatch(catalog, /Rendered screen/)
    assert.doesNotMatch(catalog, /You draw the screen a card needs/)
  })

  it('says nothing at all when every agent is switched off', () => {
    board({ specAgents: { 'ui-design': false, 'technology-selection': false } })
    assert.equal(specAgentSelector(12), '')
  })

  it('hands a spec run the contract, its agent and only the picked reference', () => {
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-design' })
    assert.match(prompt, /You are the `ui-design` spec agent on task 12/)
    assert.match(prompt, /Be a spec agent/)
    assert.match(prompt, /You draw the screen a card needs/)
    assert.match(prompt, /Mockup format: a rendered screen/)
    assert.doesNotMatch(prompt, /Mockup format: a plain-text drawing/)
  })

  it('swaps the reference when the board picks the other style', () => {
    board({ specAgents: { 'ui-design': { mockupStyle: 'ascii' } } })
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-design' })
    assert.match(prompt, /Mockup format: a plain-text drawing/)
    assert.doesNotMatch(prompt, /Mockup format: a rendered screen/)
  })

  it('falls back and says so when the saved choice is gone', () => {
    board({ specAgents: { 'ui-design': { mockupStyle: 'sketch' } } })
    const notes: string[] = []
    buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-design' }, notes)
    assert.match(notes.join('\n'), /Mockup style is saved as "sketch"/)
  })
})

describe("the YAML an agent's frontmatter is written in", () => {
  it('reads nested maps, lists of maps and quoted scalars', () => {
    assert.deepEqual(
      parseYamlBlock(
        [
          'name: x',
          'help: "What one is: a screen, or text."',
          'akb:',
          '  kind: spec',
          '  settings:',
          '    - key: style',
          '      choices:',
          '        - value: a',
          '          label: A',
          '        - value: b',
          '          label: B',
        ].join('\n'),
      ),
      {
        name: 'x',
        help: 'What one is: a screen, or text.',
        akb: {
          kind: 'spec',
          settings: [
            {
              key: 'style',
              choices: [
                { value: 'a', label: 'A' },
                { value: 'b', label: 'B' },
              ],
            },
          ],
        },
      },
    )
  })
})

// An agent that remembers (#421): one scope, one file, read into every run it starts and
// written back whole by the move that writes its section.
describe('the memory an agent declares', () => {
  const withMemory = (scope: string): string =>
    AGENT.replace('  kind: spec\n', `  kind: spec\n  memory: ${scope}\n`)

  it('is `project` on `ui-design` and nothing on `technology-selection`', () => {
    assert.equal(findSpecAgent('ui-design')?.memory, 'project')
    assert.equal(findSpecAgent('technology-selection')?.memory, null)
  })

  it('is read the same way off a project agent', () => {
    project('api-contract', { 'AGENT.md': withMemory('project') })
    assert.deepEqual(specAgentCatalog().problems, [])
    assert.equal(findSpecAgent('api-contract')?.memory, 'project')
  })

  it('refuses any other scope, naming the file', () => {
    project('api-contract', { 'AGENT.md': withMemory('user') })
    const { agents, problems } = specAgentCatalog()
    assert.ok(!agents.some((a) => a.name === 'api-contract'))
    assert.match(problems.join('\n'), /agents\/api-contract\/AGENT\.md:/)
    assert.match(problems.join('\n'), /`akb.memory: user` — `project` is the only scope/)
  })

  it('marks in the roster which agents remember, and where', () => {
    const catalog = specAgentSelector(12)
    assert.match(catalog, /remembers docs\/kanban\/memory\/agents\/ui-design\.md/)
    assert.doesNotMatch(catalog, /remembers.*technology-selection/)
  })
})

describe('what a run of an agent that remembers is handed', () => {
  it('inlines the file as one more block, and says how to write it back', () => {
    fs.mkdirSync(path.join(kanban(), 'memory', 'agents'), { recursive: true })
    fs.writeFileSync(
      path.join(kanban(), 'memory', 'agents', 'ui-design.md'),
      '# What `ui-design` learned\n\n- This product never opens a modal.\n',
    )
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-design' })
    assert.match(prompt, /——— what you remember ———/)
    assert.match(prompt, /This product never opens a modal\./)
    assert.match(prompt, /adding `--memory <path>` to that same call/)
    // Beside its own rule, and after it — the board's words end before the agent's do.
    assert.ok(prompt.indexOf('——— you, the `ui-design` agent ———') < prompt.indexOf('——— what you remember ———'))
  })

  it('hands it the empty file rather than nothing, so it knows it has one', () => {
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-design' })
    assert.match(prompt, /——— what you remember ———/)
    assert.match(prompt, /nothing has been written down yet/)
  })

  it('says nothing of memory to an agent that declares none', () => {
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'technology-selection' })
    assert.doesNotMatch(prompt, /——— what you remember ———/)
    assert.doesNotMatch(prompt, /You keep a memory of this board/)
  })
})

describe('writing what an agent remembers', () => {
  const memoryFile = (text: string): string => {
    const file = path.join(root, 'memory.md')
    fs.writeFileSync(file, text)
    return file
  }

  it('starts the file with one heading, beside the section it wrote', async () => {
    card(12)
    await move(root, [
      'spec-write',
      '12',
      'ui-design',
      '--text',
      'a screen',
      '--memory',
      memoryFile('- This product never opens a modal.'),
    ])
    assert.equal(
      remembered('ui-design'),
      '# What `ui-design` learned\n\n- This product never opens a modal.\n',
    )
  })

  it('replaces it whole, and never stacks a second heading', async () => {
    card(12)
    const write = (text: string): Promise<unknown> =>
      move(root, ['spec-write', '12', 'ui-design', '--text', 'a screen', '--memory', memoryFile(text)])
    await write('- One.')
    await write('# What `ui-design` learned\n\n- One.\n- Two.')
    assert.equal(remembered('ui-design'), '# What `ui-design` learned\n\n- One.\n- Two.\n')
    // Handed back with the heading retyped rather than copied, it is still the one heading.
    await write('# What ui-design learned\n\n- One.')
    assert.equal(remembered('ui-design'), '# What `ui-design` learned\n\n- One.\n')
  })

  it('refuses it for an agent that declares no memory', async () => {
    card(12)
    await refuses(
      root,
      ['spec-write', '12', 'technology-selection', '--text', 'a pick', '--memory', memoryFile('- One.')],
      /keeps no memory/,
    )
    assert.ok(!fs.existsSync(path.join(kanban(), 'memory', 'agents')))
  })
})

// `memory/agents/` is the board's own, so a module of that name would scaffold the memory
// set on top of the agents' files.
describe('`agents` as a module name', () => {
  it('is refused by `memory-init`', async () => {
    await refuses(root, ['memory-init', 'agents'], /board's own memory folder/)
  })

  it('still takes any other module name', async () => {
    const made = await move(root, ['memory-init', 'skill'])
    assert.match(String(made.dir), /memory\/skill$/)
  })

  // `init` scaffolds the set for every module the map names, so the map is the other way
  // the four files could land on top of the agents' own.
  it('gets no memory set from `init` when the map names it anyway', async () => {
    fs.writeFileSync(path.join(kanban(), 'modules.md'), '- **agents** — a module someone named\n- **skill** — the command\n')
    fs.mkdirSync(path.join(kanban(), 'memory', 'agents'), { recursive: true })
    fs.writeFileSync(path.join(kanban(), 'memory', 'agents', 'ui-design.md'), '# What `ui-design` learned\n\n- One.\n')
    await move(root, ['init'])
    assert.equal(fs.existsSync(path.join(kanban(), 'memory', 'agents', 'decisions.md')), false)
    assert.equal(remembered('ui-design'), '# What `ui-design` learned\n\n- One.\n')
    // Every other module on the map still gets its set.
    assert.ok(fs.existsSync(path.join(kanban(), 'memory', 'skill', 'decisions.md')))
  })
})
