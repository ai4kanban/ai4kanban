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
  agentLines,
  agentSettingsView,
  findSpecAgent,
  readSpecAgents,
  setSpecAgentSetting,
  specAgentCatalog,
  specAgentInstructions,
  specAgentList,
  specAgentOutput,
  specAgentSelector,
  specHookAgents,
} from '../src/lib/agents/index.ts'
import { readAgents } from '../src/lib/agents/roster.ts'
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

/** One of the two files an agent remembers in, as it stands on disk. */
const remembered = (name: string, file = 'redesign.md'): string =>
  fs.readFileSync(path.join(kanban(), 'memory', 'agents', name, file), 'utf8')

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-spec-agents-'))
  board()
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe("what an agent says to a reader who doesn't read English", () => {
  it('takes each line from `akb.i18n`, falls back per line, and never changes what a run is given', () => {
    project('api-contract', {
      'AGENT.md': [
        '---',
        'name: api-contract',
        'description: Use when a card changes an endpoint other software calls.',
        'akb:',
        '  kind: spec',
        '  owns: the request and response shape a card changes',
        '  i18n:',
        '    zh:',
        '      owns: 卡片改动的请求与响应结构',
        '---',
        '',
        'You settle the wire contract a card changes.',
        '',
      ].join('\n'),
    })
    const agent = findSpecAgent('api-contract')!
    assert.ok(agent)

    const zh = agentLines(agent, 'zh')
    assert.equal(zh.owns, '卡片改动的请求与响应结构')
    // Only `owns` was translated, so the other line stays the English the file declares
    // rather than going blank.
    assert.equal(zh.description, agent.description)
    assert.deepEqual(agentLines(agent, 'en'), { description: agent.description, owns: agent.owns })

    // The block is drawn, never run: what a spec run is handed is the English pair and the
    // instructions under the frontmatter.
    assert.match(agent.owns, /request and response/)
    assert.equal(agent.body.includes('i18n'), false)
  })

  it('ships both bundled agents with their Chinese lines', () => {
    for (const name of ['ui-designer', 'tech-stack-advisor']) {
      const said = agentLines(findSpecAgent(name)!, 'zh')
      assert.match(said.description, /[\u4e00-\u9fa5]/, name)
      assert.match(said.owns, /[\u4e00-\u9fa5]/, name)
    }
  })

  it('translates the words a setting is drawn by, and nothing a run picks by', () => {
    const agent = findSpecAgent('ui-designer')!
    const setting = agentSettingsView(agent, 'zh').find((s) => s.key === 'mockupStyle')
    assert.ok(setting)
    assert.match(setting.label, /[\u4e00-\u9fa5]/)
    for (const choice of setting.choices) {
      assert.match(choice.label, /[\u4e00-\u9fa5]/, choice.value)
      assert.match(choice.cost, /[\u4e00-\u9fa5]/, choice.value)
    }
    // The values and the default are what a run reads the reference by, so a translation
    // leaves them exactly as the file declares them.
    assert.deepEqual(
      setting.choices.map((c) => c.value),
      agent.settings[0]!.choices.map((c) => c.value),
    )
    assert.equal(setting.default, agent.settings[0]!.default)
    const english = agentSettingsView(agent, 'en').find((s) => s.key === 'mockupStyle')!
    assert.deepEqual(english.choices[0]!.label, agent.settings[0]!.choices[0]!.label)
  })

  it('falls back per word when a setting is only half translated', () => {
    project('api-contract', {
      'references/openapi.md': 'A schema fragment.',
      'references/prose.md': 'A paragraph.',
      'AGENT.md': [
        '---',
        'name: api-contract',
        'description: Use when a card changes an endpoint other software calls.',
        'akb:',
        '  kind: spec',
        '  owns: the request and response shape a card changes',
        '  i18n:',
        '    zh:',
        '      settings:',
        '        style:',
        '          label: \u5951\u7ea6\u683c\u5f0f',
        '          choices:',
        '            openapi:',
        '              cost: \u6bcf\u4e2a\u63a5\u53e3\u4e00\u6bb5 schema\uff0c\u7cbe\u786e\u4f46\u8bfb\u8d77\u6765\u957f',
        '  settings:',
        '    - key: style',
        '      label: Contract style',
        '      help: How precise the contract is.',
        '      default: openapi',
        '      choices:',
        '        - value: openapi',
        '          label: OpenAPI',
        '          cost: a schema fragment per endpoint',
        '          reference: references/openapi.md',
        '        - value: prose',
        '          label: Prose',
        '          cost: a paragraph per endpoint',
        '          reference: references/prose.md',
        '---',
        '',
        'You settle the wire contract a card changes.',
        '',
      ].join('\n'),
    })
    const setting = agentSettingsView(findSpecAgent('api-contract')!, 'zh').find((s) => s.key === 'style')
    assert.ok(setting)
    assert.equal(setting.label, '\u5951\u7ea6\u683c\u5f0f')
    // Nothing was said about the help line or the second choice, so both stay English
    // rather than going blank.
    assert.equal(setting.help, 'How precise the contract is.')
    assert.equal(setting.choices[0]!.label, 'OpenAPI')
    assert.equal(setting.choices[0]!.cost, '\u6bcf\u4e2a\u63a5\u53e3\u4e00\u6bb5 schema\uff0c\u7cbe\u786e\u4f46\u8bfb\u8d77\u6765\u957f')
    assert.equal(setting.choices[1]!.label, 'Prose')
    assert.equal(setting.choices[1]!.cost, 'a paragraph per endpoint')
  })
})

describe('the agents this command ships', () => {
  it('reads both of them out of their own AGENT.md', () => {
    const { agents, problems } = specAgentCatalog()
    assert.deepEqual(problems, [])
    assert.deepEqual(
      agents.map((a) => a.name),
      ['tech-stack-advisor', 'ui-designer'],
    )
    const ui = findSpecAgent('ui-designer')!
    assert.match(ui.owns, /the screen a card changes/)
    assert.match(ui.description, /^Use when/)
    assert.match(ui.description, /user-facing feature/)
    assert.match(ui.description, /Skip only extremely tiny fixes/)
    assert.match(ui.body, /You draw the screen a card needs/)
    assert.equal(ui.builtIn, true)
  })

  it('carries `ui-designer`\'s mockup style, its two choices and their references', () => {
    const setting = findSpecAgent('ui-designer')!.settings[0]!
    assert.equal(setting.key, 'mockupStyle')
    assert.equal(setting.default, 'full')
    assert.deepEqual(
      setting.choices.map((c) => c.value),
      ['full', 'ascii'],
    )
    for (const choice of setting.choices) assert.match(choice.reference ?? '', /^references\//)
  })

  it('still answers to every name each of them had before', () => {
    assert.equal(findSpecAgent('recommend-tech-stack')?.name, 'tech-stack-advisor')
    assert.equal(findSpecAgent('technology-selection')?.name, 'tech-stack-advisor')
    assert.equal(findSpecAgent('ui-design')?.name, 'ui-designer')
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
    // It declares no setting of its own, so the only row on its page is the board's.
    assert.deepEqual(view?.settings.map((s) => s.key), ['output'])
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
    project('ui-designer', { 'AGENT.md': AGENT.replace('name: api-contract', 'name: ui-designer') })
    const { agents, problems } = specAgentCatalog()
    assert.equal(agents.filter((a) => a.name === 'ui-designer').length, 1)
    assert.equal(findSpecAgent('ui-designer')?.builtIn, true)
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
    assert.ok(findSpecAgent('ui-designer'))
  })
})

describe('what a session is shown', () => {
  it('gives a planning session the names, descriptions and ownership and no instructions', () => {
    const catalog = specAgentSelector(12)
    assert.match(catalog, /<spec-agents>/)
    assert.match(catalog, /- `ui-designer`/)
    assert.match(catalog, /owns the screen a card changes/)
    assert.ok(catalog.includes(findSpecAgent('ui-designer')!.description))
    assert.doesNotMatch(catalog, /planned by guess|Asking for none is the usual answer/)
    assert.match(catalog, /akb spec <agent> 12 <short note>/)
    assert.doesNotMatch(catalog, /Rendered screen/)
    assert.doesNotMatch(catalog, /You draw the screen a card needs/)
  })

  it('shows project triggers in both the selector and command listing', () => {
    project('api-contract', { 'AGENT.md': AGENT })
    const trigger = findSpecAgent('api-contract')!.description
    assert.ok(specAgentSelector(12).includes(trigger))
    assert.ok(specAgentList('akb').includes(trigger))
  })

  it('includes trigger checks for standard and lightweight refinement, resolve and revise', () => {
    for (const req of [
      { action: 'clarify', id: 426, refineEffort: 'standard' },
      { action: 'clarify', id: 426, refineEffort: 'lightweight' },
      { action: 'resolve', id: 426 },
      { action: 'edit', id: 426 },
    ] as const) {
      const prompt = buildPrompt(req)
      assert.match(prompt, /Use whenever a card designs or changes a user-facing feature/)
    }
  })

  it('says nothing at all when every agent is switched off', () => {
    board({ specAgents: { 'ui-designer': false, 'tech-stack-advisor': false } })
    assert.equal(specAgentSelector(12), '')
  })

  it('hands a spec run the contract, its agent and only the picked reference', () => {
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-designer' })
    assert.match(prompt, /You are the `ui-designer` spec agent on task 12/)
    assert.match(prompt, /Be a spec agent/)
    assert.match(prompt, /You draw the screen a card needs/)
    assert.match(prompt, /Mockup format: a rendered screen/)
    assert.doesNotMatch(prompt, /Mockup format: a plain-text drawing/)
  })

  it('swaps the reference when the board picks the other style', () => {
    board({ specAgents: { 'ui-designer': { mockupStyle: 'ascii' } } })
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-designer' })
    assert.match(prompt, /Mockup format: a plain-text drawing/)
    assert.doesNotMatch(prompt, /Mockup format: a rendered screen/)
  })

  it('falls back and says so when the saved choice is gone', () => {
    board({ specAgents: { 'ui-designer': { mockupStyle: 'sketch' } } })
    const notes: string[] = []
    buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-designer' }, notes)
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

// An agent that remembers (#421, #473): one scope, a folder of two files, read into every run
// it starts and written back whole by the move that writes its section.
describe('the memory an agent declares', () => {
  const withMemory = (scope: string): string =>
    AGENT.replace('  kind: spec\n', `  kind: spec\n  memory: ${scope}\n`)

  it('is `project` on `ui-designer` and nothing on `tech-stack-advisor`', () => {
    assert.equal(findSpecAgent('ui-designer')?.memory, 'project')
    assert.equal(findSpecAgent('tech-stack-advisor')?.memory, null)
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

  // The mark, and not the path: where the file is is the same for every agent, so the
  // flow that writes one is told once in `akb guide update-questions` rather than in
  // every roster this block goes into.
  it('marks in the roster which agents remember, without naming a file', () => {
    const catalog = specAgentSelector(12)
    const entry = (name: string): string =>
      catalog.split(/^- /m).find((part) => part.startsWith(`\`${name}\``)) ?? ''
    assert.match(entry('ui-designer'), /^ {2}remembers$/m)
    assert.doesNotMatch(entry('tech-stack-advisor'), /remembers/)
    assert.doesNotMatch(catalog, /memory\/agents/)
  })
})

describe('what a run of an agent that remembers is handed', () => {
  const wrote = (file: string, text: string): void => {
    fs.mkdirSync(path.join(kanban(), 'memory', 'agents', 'ui-designer'), { recursive: true })
    fs.writeFileSync(path.join(kanban(), 'memory', 'agents', 'ui-designer', file), text)
  }

  it('inlines both files as one block, each under its own heading', () => {
    wrote('redesign.md', '# What `ui-designer` was corrected on\n\n- One figure per tile was rejected.\n')
    wrote('decisions.md', '# What the user chose for `ui-designer`\n\n- This product never opens a modal.\n')
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-designer' })
    assert.match(prompt, /——— what you remember ———/)
    assert.match(prompt, /One figure per tile was rejected\./)
    assert.match(prompt, /This product never opens a modal\./)
    assert.match(prompt, /# What `ui-designer` was corrected on/)
    assert.match(prompt, /# What the user chose for `ui-designer`/)
    // Beside its own rule, and after it — the board's words end before the agent's do.
    assert.ok(prompt.indexOf('——— you, the `ui-designer` agent ———') < prompt.indexOf('——— what you remember ———'))
  })

  it('names the folder and what each file is for, and asks for neither move nor flag', () => {
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-designer' })
    assert.match(prompt, /two files in `docs\/kanban\/memory\/agents\/ui-designer\/`/)
    assert.match(prompt, /`redesign\.md`, one line per lesson/)
    assert.match(prompt, /`decisions\.md`, one line per durable choice/)
    assert.doesNotMatch(prompt, /spec-write|--redesign|--decisions/)
  })

  // The look is read, never remembered (#473) — said in the run, so an agent with an empty
  // memory starts out knowing where the colours and dimensions actually live.
  it('sends it to the app design docs for how the product looks', () => {
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-designer' })
    assert.match(prompt, /read from the app's own `design\.md` and components, never copied into memory/)
    assert.match(prompt, /product fact worth keeping goes into the lesson or the decision it supports/)
  })

  it('hands it the empty files rather than nothing, so it knows it has them', () => {
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-designer' })
    assert.match(prompt, /——— what you remember ———/)
    assert.equal(prompt.match(/nothing has been written down yet/g)?.length, 2)
  })

  it('says nothing of memory to an agent that declares none', () => {
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'tech-stack-advisor' })
    assert.doesNotMatch(prompt, /——— what you remember ———/)
    assert.doesNotMatch(prompt, /--redesign|Follow your memory below/)
  })

  // A board written before the split kept one file. It is moved in on the first read, so the
  // very run that finds it is handed everything it said (#473).
  it('moves a board’s one old file into the folder, once, without losing a line', () => {
    fs.mkdirSync(path.join(kanban(), 'memory', 'agents'), { recursive: true })
    fs.writeFileSync(
      path.join(kanban(), 'memory', 'agents', 'ui-designer.md'),
      '# What `ui-designer` learned\n\n- This product never opens a modal.\n',
    )
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-designer' })
    assert.match(prompt, /This product never opens a modal\./)
    assert.equal(remembered('ui-designer'), '# What `ui-designer` was corrected on\n\n- This product never opens a modal.\n')
    assert.equal(fs.existsSync(path.join(kanban(), 'memory', 'agents', 'ui-designer.md')), false)
  })

  // The agent was renamed, and what it remembers is kept under its name.
  it('moves what it remembers off the name it had before, once', () => {
    const was = path.join(kanban(), 'memory', 'agents', 'ui-design')
    fs.mkdirSync(was, { recursive: true })
    fs.writeFileSync(path.join(was, 'redesign.md'), '# What `ui-design` was corrected on\n\n- One figure per tile was rejected.\n')
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-designer' })
    assert.match(prompt, /One figure per tile was rejected\./)
    assert.match(prompt, /# What `ui-designer` was corrected on/)
    assert.match(remembered('ui-designer'), /One figure per tile was rejected\./)
    assert.equal(fs.existsSync(was), false)
  })
})

describe('writing what an agent remembers', () => {
  const memoryFile = (text: string, name = 'memory.md'): string => {
    const file = path.join(root, name)
    fs.writeFileSync(file, text)
    return file
  }

  it('starts each file with its own heading, beside the section it wrote', async () => {
    card(12)
    await move(root, [
      'spec-write',
      '12',
      'ui-designer',
      '--text',
      'a screen',
      '--redesign',
      memoryFile('- One figure per tile was rejected.'),
      '--decisions',
      memoryFile('- This product never opens a modal.', 'chose.md'),
    ])
    assert.equal(
      remembered('ui-designer'),
      '# What `ui-designer` was corrected on\n\n- One figure per tile was rejected.\n',
    )
    assert.equal(
      remembered('ui-designer', 'decisions.md'),
      '# What the user chose for `ui-designer`\n\n- This product never opens a modal.\n',
    )
  })

  it('writes only the file the flag names', async () => {
    card(12)
    await move(root, ['spec-write', '12', 'ui-designer', '--text', 'a screen', '--decisions', memoryFile('- One.')])
    assert.equal(remembered('ui-designer', 'decisions.md'), '# What the user chose for `ui-designer`\n\n- One.\n')
    assert.equal(fs.existsSync(path.join(kanban(), 'memory', 'agents', 'ui-designer', 'redesign.md')), false)
  })

  it('replaces it whole, and never stacks a second heading', async () => {
    card(12)
    const write = (text: string): Promise<unknown> =>
      move(root, ['spec-write', '12', 'ui-designer', '--text', 'a screen', '--redesign', memoryFile(text)])
    await write('- One.')
    await write('# What `ui-designer` was corrected on\n\n- One.\n- Two.')
    assert.equal(remembered('ui-designer'), '# What `ui-designer` was corrected on\n\n- One.\n- Two.\n')
    // Handed back with the heading retyped rather than copied, it is still the one heading.
    await write('# What ui-designer was corrected on\n\n- One.')
    assert.equal(remembered('ui-designer'), '# What `ui-designer` was corrected on\n\n- One.\n')
  })

  it('refuses it for an agent that declares no memory', async () => {
    card(12)
    await refuses(
      root,
      ['spec-write', '12', 'tech-stack-advisor', '--text', 'a pick', '--redesign', memoryFile('- One.')],
      /keeps no memory/,
    )
    assert.ok(!fs.existsSync(path.join(kanban(), 'memory', 'agents')))
  })
})

// Who a spec agent's finished output is for (#445): the board's own row on every spec agent,
// saved beside `enabled` and `runtime` rather than among the settings the agent declares.
describe("who a spec agent's output is for", () => {
  const saved = (): Record<string, Record<string, unknown>> =>
    JSON.parse(fs.readFileSync(path.join(kanban(), 'ui.config.json'), 'utf8')).specAgents

  it('is the first row on every spec agent, whoever wrote it', () => {
    project('api-contract', { 'AGENT.md': AGENT })
    for (const name of ['ui-designer', 'tech-stack-advisor', 'api-contract']) {
      const [row] = agentSettingsView(findSpecAgent(name)!)
      assert.equal(row?.key, 'output', name)
      assert.deepEqual(
        row!.choices.map((c) => c.value),
        ['human', 'agent'],
        name,
      )
      // No word about the card's halves: a user picks who reads it, not where it lands.
      assert.doesNotMatch(JSON.stringify(row), /agent half|human half|<!-- agent -->/)
    }
    assert.equal(readSpecAgents().find((a) => a.name === 'ui-designer')?.values.output, 'human')
  })

  it("is on the spec agents in the pane's roster, and on none of the roles", () => {
    const rows = (name: string): string[] =>
      readAgents().agents.find((a) => a.name === name)!.settings.map((setting) => setting.key)
    assert.deepEqual(rows('ui-designer'), ['output', 'mockupStyle'])
    assert.deepEqual(rows('tech-stack-advisor'), ['output'])
    assert.deepEqual(rows('planner'), [])
  })

  it('starts `ui-designer` at human review and every other agent at agent use', () => {
    project('api-contract', { 'AGENT.md': AGENT })
    assert.equal(specAgentOutput(findSpecAgent('ui-designer')!), 'human')
    assert.equal(specAgentOutput(findSpecAgent('tech-stack-advisor')!), 'agent')
    assert.equal(specAgentOutput(findSpecAgent('api-contract')!), 'agent')
  })

  it('is not offered on a `write` agent, which writes files rather than a section', () => {
    solution('marketing')
    project('api-contract', { 'AGENT.md': AGENT.replace('  kind: spec', '  kind: write') })
    assert.deepEqual(agentSettingsView(findSpecAgent('api-contract')!), [])
  })

  it("saves under the entry's own key, and drops it when it goes back to the default", () => {
    assert.equal(setSpecAgentSetting('ui-designer', 'output', 'agent').ok, true)
    assert.deepEqual(saved()['ui-designer'], { output: 'agent' })
    assert.equal(specAgentOutput(findSpecAgent('ui-designer')!), 'agent')
    assert.equal(setSpecAgentSetting('ui-designer', 'output', 'human').ok, true)
    assert.equal(saved(), undefined)
    assert.equal(specAgentOutput(findSpecAgent('ui-designer')!), 'human')
  })

  // A `runtime` left by a board written before #443 goes: named runtimes are gone, and the
  // agent it pointed at runs the connector the board gives it now.
  it("leaves the switch and the agent's own values beside it, and drops a stale runtime", () => {
    board({ specAgents: { 'ui-designer': { enabled: false, runtime: 'cheap', mockupStyle: 'ascii' } } })
    assert.equal(setSpecAgentSetting('ui-designer', 'output', 'agent').ok, true)
    assert.deepEqual(saved()['ui-designer'], {
      enabled: false,
      output: 'agent',
      mockupStyle: 'ascii',
    })
  })

  it('refuses a word it does not offer, and runs the default when the file holds one', () => {
    const refused = setSpecAgentSetting('ui-designer', 'output', 'nobody')
    assert.equal(refused.ok, false)
    assert.match(refused.error!, /not one of the choices for Output/)
    board({ specAgents: { 'ui-designer': { output: 'nobody' } } })
    assert.equal(specAgentOutput(findSpecAgent('ui-designer')!), 'human')
  })

  it("is the board's key, so no agent may declare a setting or a value of its own for it", () => {
    project('api-contract', {
      'AGENT.md': AGENT.replace(
        '  owns: the request and response shape a card changes\n',
        [
          '  owns: the request and response shape a card changes',
          '  settings:',
          '    - key: output',
          '      label: Output',
          '      default: one',
          '      choices:',
          '        - value: one',
          '          label: One',
          '          cost: one line',
          '          reference: references/one.md',
          '',
        ].join('\n'),
      ),
      'references/one.md': 'One.',
    })
    assert.match(specAgentCatalog().problems.join('\n'), /`output` is the board's own key/)
  })

  it('refuses an `akb.output` naming nobody', () => {
    project('api-contract', { 'AGENT.md': AGENT.replace('  kind: spec', '  kind: spec\n  output: nobody') })
    assert.match(specAgentCatalog().problems.join('\n'), /`akb\.output: nobody`/)
  })

  it('tells the run which half it writes in, and prints it where a flow can read it', () => {
    assert.match(
      buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-designer' }),
      /put your section above `<!-- agent -->`/,
    )
    assert.match(specAgentList('akb'), /Output: Human review/)
    board({ specAgents: { 'ui-designer': { output: 'agent' } } })
    assert.match(
      buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-designer' }),
      /put your section below `<!-- agent -->`/,
    )
    assert.match(specAgentList('akb'), /Output: Agent use/)
  })

  it('is drawn in the language the reader reads, from the board rather than the agent', () => {
    const [row] = agentSettingsView(findSpecAgent('ui-designer')!, 'zh')
    assert.equal(row?.label, '\u4ea7\u51fa')
    for (const choice of row!.choices) {
      assert.match(choice.label, /[\u4e00-\u9fa5]/, choice.value)
      assert.match(choice.cost, /[\u4e00-\u9fa5]/, choice.value)
    }
    assert.equal(agentSettingsView(findSpecAgent('ui-designer')!, 'en')[0]?.label, 'Output')
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
    fs.mkdirSync(path.join(kanban(), 'memory', 'agents', 'ui-designer'), { recursive: true })
    fs.writeFileSync(
      path.join(kanban(), 'memory', 'agents', 'ui-designer', 'redesign.md'),
      '# What `ui-designer` was corrected on\n\n- One.\n',
    )
    await move(root, ['init'])
    assert.equal(fs.existsSync(path.join(kanban(), 'memory', 'agents', 'decisions.md')), false)
    assert.equal(remembered('ui-designer'), '# What `ui-designer` was corrected on\n\n- One.\n')
    // Every other module on the map still gets its set.
    assert.ok(fs.existsSync(path.join(kanban(), 'memory', 'skill', 'decisions.md')))
  })
})
