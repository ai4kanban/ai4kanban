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
  findSpecAgent,
  readSpecAgents,
  setSpecAgentSetting,
  specAgentCatalog,
  specAgentInstructions,
  specAgentList,
  specAgentSelector,
  specHookAgents,
} from '../src/lib/agents/index.ts'
import { parseSpecAgent } from '../src/lib/agents/parse.ts'
import { readAgents } from '../src/lib/agents/roster.ts'
import { parseYamlBlock } from '../src/lib/agents/yaml.ts'
import { createWorkflow, switchWorkflowAgent, setWorkflowLead } from '../src/lib/agent/workflows.ts'
import { humanSectionFor } from '../src/lib/agent/runner.ts'
import { move, refuses, run, uiConfigOf } from './helpers/board.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')

const board = (cfg: Record<string, unknown> = {}): void => {
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(uiConfigOf(kanban()), JSON.stringify(cfg, null, 2))
  setBoardRoot(root)
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
  '  hook: plan',
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

/** One file in an agent's memory folder, as it stands on disk. */
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
        '  hook: plan',
        // A file written before `owns` was dropped still reads; the field is ignored.
        '  i18n:',
        '    zh:',
        '      title: 接口契约',
        '      owns: 卡片改动的请求与响应结构',
        '---',
        '',
        'You settle the wire contract a card changes.',
        '',
      ].join('\n'),
    })
    const agent = findSpecAgent('api-contract')!
    assert.ok(agent)

    assert.equal('owns' in agent, false)
    assert.deepEqual(agent.i18n.zh, { title: '接口契约' })

    // Only the title was translated, so the description stays the English the file declares
    // rather than going blank.
    const zh = agentLines(agent, 'zh')
    assert.deepEqual(zh, { title: '接口契约', description: agent.description })
    // A name it never said stays empty rather than falling back: the screen drawing it
    // spells the agent's own name out, which is the answer in English too.
    assert.deepEqual(agentLines(agent, 'en'), { title: '', description: agent.description })

    // The block is drawn, never run: what a spec run is handed is the English description and
    // the instructions under the frontmatter.
    assert.equal(agent.body.includes('i18n'), false)
  })

  it('ships both bundled agents with their Chinese lines', () => {
    for (const name of ['ui-designer', 'tech-stack-advisor']) {
      const said = agentLines(findSpecAgent(name)!, 'zh')
      assert.match(said.title, /[\u4e00-\u9fa5]/, name)
      assert.match(said.description, /[\u4e00-\u9fa5]/, name)
    }
  })

})

describe('the agents this command ships', () => {
  it('reads each of them out of their own AGENT.md', () => {
    const { agents, problems } = specAgentCatalog()
    assert.deepEqual(problems, [])
    assert.deepEqual(
      agents.map((a) => a.name),
      ['blog-illustrator', 'blog-planner', 'carousel-planner', 'competitor-research', 'copywriting', 'cover-designer', 'deck-planner', 'demo-rehearser', 'email-planner', 'hyperframes-editor', 'illustrator', 'prompt-writer', 'qa-manager', 'scriptwriter', 'tech-stack-advisor', 'ui-designer'],
    )
    const ui = findSpecAgent('ui-designer')!
    assert.match(ui.description, /^Use when/)
    assert.match(ui.description, /user-facing feature/)
    assert.match(ui.description, /Skip only extremely tiny fixes/)
    assert.match(ui.body, /You draw the screen a card needs/)
    assert.equal(ui.builtIn, true)
  })

  it('draws no setting on `ui-designer`, and names its reference as a file', () => {
    const agent = findSpecAgent('ui-designer')!
    assert.deepEqual(readSpecAgents().find((a) => a.name === 'ui-designer')?.settings, [])
    assert.ok(agent.files.includes('references/rendered-screen.md'))
    assert.match(agent.body, /Read `references\/rendered-screen\.md` before you draw/)
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
    assert.deepEqual(view?.settings, [])
  })

  // An `akb.settings:` block is read by nothing (#1003). A board that still carries one keeps
  // its agent rather than losing it over a dead key.
  it('keeps its agent when its file still declares settings, and offers none of them', () => {
    project('api-contract', {
      'AGENT.md': AGENT.replace(
        '  hook: plan\n',
        [
          '  hook: plan',
          '  settings:',
          '    - key: style',
          '      label: Contract style',
          '      default: openapi',
          '      choices:',
          '        - value: openapi',
          '          label: OpenAPI',
          '          cost: a schema fragment per endpoint',
          '          reference: references/openapi.md',
          '',
        ].join('\n'),
      ),
      'references/openapi.md': 'Write an OpenAPI fragment.',
    })
    assert.deepEqual(specAgentCatalog().problems, [])
    const agent = findSpecAgent('api-contract')!
    assert.deepEqual(readSpecAgents().find((a) => a.name === 'api-contract')?.settings, [])
    assert.equal(setSpecAgentSetting('api-contract', 'style', 'prose').ok, false)
    // The file it named is an ordinary file beside `AGENT.md` now, offered by its path.
    assert.ok(agent.files.includes('references/openapi.md'))
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

// `write` joined the retired marketing board's writer (#718). A file still declaring it is
// listed as a problem rather than registered as something nothing on the board can call.
describe('the hook an agent declares', () => {
  it('lists a leftover `write` agent as a problem rather than registering it', () => {
    project('api-contract', { 'AGENT.md': AGENT.replace('  hook: plan', '  kind: write') })
    const { agents, problems } = specAgentCatalog()
    assert.ok(!agents.some((a) => a.name === 'api-contract'))
    assert.match(problems.join('\n'), /the marketing board it wrote for is retired/)
    assert.ok(!specHookAgents().some((a) => a.name === 'api-contract'))
    assert.doesNotMatch(specAgentSelector(12), /api-contract/)
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
      problemFor({ 'AGENT.md': ['---', 'name: broken', 'akb:', '  hook: plan', '---', '', 'Body.'].join('\n') }),
      /has no `description`/,
    )
  })

  // One key says the role, its value the stage (#1341).
  describe('the role it declares', () => {
    const read = (...akb: string[]) =>
      parseSpecAgent(['---', 'name: x', 'description: d', 'akb:', ...akb.map((l) => `  ${l}`), '---', '', 'Body.'].join('\n'), 'x', () => null)
    const problem = (...akb: string[]): string => {
      const got = read(...akb)
      assert.ok('problem' in got, akb.join(' + '))
      return got.problem
    }
    const LINES = /one of `lead: plan`, `lead: execute`, `hook: plan`, `hook: schedule`$/

    it('reads each of the stage lines', () => {
      for (const [line, kind, stage] of [
        ['lead: plan', 'lead', 'plan'],
        ['lead: execute', 'lead', 'execute'],
        ['hook: plan', 'spec', 'plan'],
      ] as const) {
        const got = read(line)
        assert.ok('agent' in got, line)
        assert.deepEqual([got.agent.kind, got.agent.stage, got.agent.canLead], [kind, stage, kind === 'lead'], line)
      }
    })

    it('refuses both keys, neither, and a value that is no stage', () => {
      assert.match(problem('lead: plan', 'hook: plan'), /both `akb.lead` and `akb.hook` — keep one/)
      assert.match(problem('output: human'), /neither `akb.lead` nor `akb.hook`/)
      assert.match(problem('output: human'), LINES)
      assert.match(problem('hook: build'), /`akb.hook: build` — it is `plan` or `schedule`/)
      assert.match(problem('hook: execute'), /nothing runs after a build any more — make it `hook: schedule` with `reads: archived-cards`/)
      assert.match(problem('lead: yes'), /`akb.lead: yes` — it is `plan` or `execute`/)
    })

    it('refuses the old keys, naming them and the line that replaces them', () => {
      for (const [old, line] of [
        [['kind: lead', 'stage: plan'], 'lead: plan'],
        [['stage: plan', 'lead: true'], 'lead: plan'],
        [['kind: lead', 'stage: execute'], 'lead: execute'],
        [['stage: execute', 'lead: true'], 'lead: execute'],
        [['kind: spec'], 'hook: plan'],
        [['stage: plan'], 'hook: plan'],
        [['stage: plan', 'lead: false'], 'hook: plan'],
      ] as const) {
        const said = problem(...old)
        for (const key of old) assert.ok(said.includes(`\`${key}\``), `${old.join(' + ')} names ${key}`)
        assert.ok(said.endsWith(`replace ${old.length > 1 ? 'them' : 'it'} with \`${line}\``), `${old.join(' + ')}: ${said}`)
      }
    })

    it('lists every line when the old keys never named a usable agent', () => {
      for (const old of [['kind: lead'], ['lead: true'], ['lead: false'], ['stage: build'], ['stage: execute'], ['kind: review'], ['stage: plan', 'lead: plan']]) {
        assert.match(problem(...old), LINES, old.join(' + '))
        assert.match(problem(...old), /no longer reads/, old.join(' + '))
      }
    })

    it('keeps the retired values their own sentences', () => {
      assert.match(problem('stage: review', 'lead: true'), /builds are no longer reviewed/)
      assert.match(problem('stage: review'), LINES)
      assert.match(problem('kind: write'), /the marketing board it wrote for is retired/)
      assert.match(problem('kind: write'), LINES)
    })
  })

  it('reads who may lead (#846)', () => {
    const lead = (extra: string[]) =>
      ['---', 'name: outliner', 'description: d', 'akb:', ...extra, '---', '', 'Body.'].join('\n')
    const canLead = (name: string) => specAgentCatalog().agents.find((a) => a.name === name)?.canLead
    project('outliner', { 'AGENT.md': lead(['  lead: plan']) })
    assert.equal(canLead('outliner'), true)
    assert.equal(canLead('scriptwriter'), true)
    for (const helper of ['ui-designer', 'copywriting', 'tech-stack-advisor', 'hyperframes-editor']) {
      assert.equal(canLead(helper), false, helper)
    }
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
  it('gives a planning session the names and descriptions and no instructions', () => {
    const catalog = specAgentSelector(12)
    assert.match(catalog, /<spec-agents>/)
    assert.match(catalog, /- `ui-designer`/)
    assert.doesNotMatch(catalog, /\bowns\b/)
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

  it('includes trigger checks for refinement, resolve and revise', () => {
    for (const req of [
      { action: 'clarify', id: 426 },
      { action: 'resolve', id: 426 },
      { action: 'edit', id: 426 },
    ] as const) {
      const prompt = buildPrompt(req)
      assert.match(prompt, /Use whenever a card designs or changes a user-facing feature/)
    }
  })

  // Off in a board written before #749: the switch is folded into the coding plan stage, so
  // the selector lists nobody — and it stays that way once the key is gone.
  it('says nothing at all when the card\'s workflow assigns no one', () => {
    board({ specAgents: { 'ui-designer': false, 'tech-stack-advisor': false, copywriting: false } })
    assert.equal(switchWorkflowAgent('coding', 'plan', 'prompt-writer', false).ok, true)
    assert.equal(switchWorkflowAgent('coding', 'plan', 'email-planner', false).ok, true)
    assert.equal(switchWorkflowAgent('coding', 'plan', 'illustrator', false).ok, true)
    assert.equal(switchWorkflowAgent('coding', 'plan', 'competitor-research', false).ok, true)
    assert.equal(specAgentSelector(12), '')
    assert.equal(specAgentSelector(12), '')
  })

  // The list is printed with no card in hand, so it names every agent on the hook; which of
  // them a card may ask for is its own workflow's answer, and the ask is where that is read.
  it('lists every agent on the hook, whatever a workflow assigns', () => {
    board({ specAgents: { 'ui-designer': false } })
    assert.doesNotMatch(specAgentSelector(12), /- `ui-designer`/)
    const listed = specAgentList('akb')
    assert.match(listed, /ui-designer/)
    assert.doesNotMatch(listed, /Switched off/)
  })

  it('refuses an ask for an agent the card\'s workflow does not assign', async () => {
    card(12)
    board()
    assert.equal(switchWorkflowAgent('coding', 'plan', 'ui-designer', false).ok, true)
    await assert.rejects(
      () => run(root, ['spec', 'ui-designer', '12', 'a note']),
      /is off or not in the workflow of #12/,
    )
  })

  it('hands a spec run the contract, its agent and the paths of its own files', () => {
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-designer' })
    assert.match(prompt, /You are the `ui-designer` spec agent on task 12/)
    assert.match(prompt, /Be a spec agent/)
    assert.match(prompt, /You draw the screen a card needs/)
    assert.match(prompt, /——— your own files ———/)
    assert.match(prompt, /`references\/rendered-screen\.md`/)
    // Named, never pasted in: the run opens it when the work calls for it.
    assert.doesNotMatch(prompt, /How to draw a rendered screen/)
  })

  // A board that saved the retired Mockup style gets its run log told, so somebody who never
  // opens the agent's page is not quietly given a different answer than last time (#1003).
  it('says in the log that a saved mockup style is retired', () => {
    board({ specAgents: { 'ui-designer': { mockupStyle: 'ascii' } } })
    const notes: string[] = []
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-designer' }, notes)
    assert.match(notes.join('\n'), /Mockup style is saved on this board.*rendered screen/)
    assert.doesNotMatch(prompt, /ASCII/)
  })

  it('says nothing about a style no board saved', () => {
    const notes: string[] = []
    buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-designer' }, notes)
    assert.doesNotMatch(notes.join('\n'), /Mockup style/)
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

  it('drops a trailing comment as YAML does, and keeps a `#` that is not one', () => {
    assert.deepEqual(
      parseYamlBlock(
        [
          'name: x  # the folder name',
          'empty: # nothing yet',
          'hash: a#b',
          'lang: C#',
          'double: "a # b"',
          "single: 'a # b'  # quoted",
          'escaped: "say \\"#\\"" # tail',
          'list:',
          '  - one # first',
          '  - "two # kept"',
          '  - key: v\t# tab',
          '    other: "w # kept"',
        ].join('\n'),
      ),
      {
        name: 'x',
        empty: '',
        hash: 'a#b',
        lang: 'C#',
        double: 'a # b',
        single: 'a # b',
        escaped: 'say "#"',
        list: ['one', 'two # kept', { key: 'v', other: 'w # kept' }],
      },
    )
  })

  it('accepts a fixed value with a comment after it', () => {
    project('outliner', {
      'AGENT.md': [
        '---',
        'name: outliner  # me',
        'description: d',
        'akb:',
        '  lead: plan  # its stage',
        '---',
        '',
        'Body.',
      ].join('\n'),
    })
    assert.deepEqual(specAgentCatalog().problems, [])
    assert.equal(specAgentCatalog().agents.find((a) => a.name === 'outliner')?.canLead, true)
  })
})

// An agent's memory (#421, #473, #833): a folder the board hands to every run, holding
// whatever files the agent's own prompt says to keep.
describe("an agent's memory folder", () => {
  const wrote = (agent: string, file: string, text: string): void => {
    fs.mkdirSync(path.join(kanban(), 'memory', 'agents', agent), { recursive: true })
    fs.writeFileSync(path.join(kanban(), 'memory', 'agents', agent, file), text)
  }

  it('still reads an AGENT.md that declares `akb.memory`, whatever its value', () => {
    project('api-contract', { 'AGENT.md': AGENT.replace('  hook: plan\n', '  hook: plan\n  memory: user\n') })
    assert.deepEqual(specAgentCatalog().problems, [])
    assert.ok(findSpecAgent('api-contract'))
  })

  it('marks no agent in the roster', () => {
    assert.doesNotMatch(specAgentSelector(12), /remembers|memory\/agents/)
  })

  it('hands a spec run every file in the folder, whatever it is named', () => {
    wrote('ui-designer', 'redesign.md', '# What `ui-designer` was corrected on\n\n- One figure per tile was rejected.\n')
    wrote('ui-designer', 'preferences.md', '- This product never opens a modal.\n')
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-designer' })
    assert.match(prompt, /——— what you remember ———/)
    assert.match(prompt, /`docs\/kanban\/memory\/agents\/ui-designer\/`/)
    assert.match(prompt, /### `preferences\.md`\n\n- This product never opens a modal\./)
    assert.match(prompt, /### `redesign\.md`\n\n# What `ui-designer` was corrected on/)
    assert.ok(prompt.indexOf('——— you, the `ui-designer` agent ———') < prompt.indexOf('——— what you remember ———'))
    assert.doesNotMatch(prompt, /spec-write|--redesign|--decisions|Follow your memory below/)
  })

  it('puts the memory rule in the contract, and the look in the agent that needs it', () => {
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-designer' })
    assert.match(prompt, /\*\*Memory\*\*: `docs\/kanban\/memory\/agents\/<agent-name>\/` is yours/)
    assert.match(prompt, /## What you remember[\s\S]*`redesign\.md`[\s\S]*`decisions\.md`/)
  })

  it('only names the folder when nothing is in it', () => {
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'tech-stack-advisor' })
    assert.match(prompt, /Your memory folder is `docs\/kanban\/memory\/agents\/tech-stack-advisor\/`\. Nothing is in it yet\./)
    assert.doesNotMatch(prompt, /### `/)
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
    assert.match(remembered('ui-designer'), /One figure per tile was rejected\./)
    assert.equal(fs.existsSync(was), false)
  })

  // `video-assets` became `hyperframes-assets` (#945), then `hyperframes-editor` (#1057), but its
  // catalogue of files on this machine is not worth moving: the folder keeps the name it was
  // written under, and the agent is handed it under its new name.
  it('reads the asset catalogue from the folder its old name wrote, and leaves it there', () => {
    const was = path.join(kanban(), 'memory', 'agents', 'video-assets')
    fs.mkdirSync(was, { recursive: true })
    fs.writeFileSync(path.join(was, 'assets.md'), '# assets\n\n- board.mp4 — the board, 4s.\n')
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'hyperframes-editor' })
    assert.match(prompt, /board\.mp4 — the board, 4s\./)
    assert.match(prompt, /`docs\/kanban\/memory\/agents\/video-assets\/`/)
    assert.ok(fs.existsSync(path.join(was, 'assets.md')))
    assert.equal(fs.existsSync(path.join(kanban(), 'memory', 'agents', 'hyperframes-editor')), false)
  })

  it('is no longer written by `spec-write`', async () => {
    let help = ''
    const write = process.stdout.write.bind(process.stdout)
    process.stdout.write = ((chunk: string | Uint8Array) => {
      help += String(chunk)
      return true
    }) as typeof process.stdout.write
    try {
      await move(root, ['spec-write', '--help']).catch(() => {})
    } finally {
      process.stdout.write = write
    }
    assert.doesNotMatch(help, /--half/)
    assert.doesNotMatch(help, /--redesign|--decisions/)
    card(12)
    await refuses(root, ['spec-write', '12', 'ui-designer', '--text', 'a screen', '--redesign', 'x.md'], /redesign/)
  })
})

// Where a spec agent's section goes (#1574): above the boundary, for every hook. There is no
// setting for it, and what a board saved for the old one stays in the file, acting on nothing.
describe("where a spec agent's section goes", () => {
  const saved = (): Record<string, Record<string, unknown>> =>
    JSON.parse(fs.readFileSync(uiConfigOf(kanban()), 'utf8')).specAgents

  it('is no setting on any spec agent, whoever wrote it', async () => {
    project('api-contract', { 'AGENT.md': AGENT })
    const rows = async (name: string): Promise<string[]> =>
      (await readAgents()).agents.find((a) => a.name === name)!.settings.map((setting) => setting.key)
    for (const name of ['ui-designer', 'tech-stack-advisor', 'hyperframes-editor', 'api-contract']) {
      assert.deepEqual(await rows(name), [], name)
    }
    assert.equal(setSpecAgentSetting('ui-designer', 'output', 'agent').ok, false)
    assert.doesNotMatch(specAgentList('akb'), /Output:/)
  })

  it('tells every spec run nothing about halves, and lands above the boundary', () => {
    board({ specAgents: { 'hyperframes-editor': { output: 'agent' } } })
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'hyperframes-editor' })
    assert.doesNotMatch(prompt, /Your output is set to/)
    assert.match(prompt, /put your section above `<!-- agent -->`/)
    assert.deepEqual(humanSectionFor({ action: 'spec', id: 12, specAgent: 'hyperframes-editor' }), {
      agent: 'hyperframes-editor',
      required: false,
    })
  })

  it('loads an `AGENT.md` that still declares `akb.output`, and ignores it', () => {
    project('api-contract', { 'AGENT.md': AGENT.replace('  hook: plan', '  hook: plan\n  output: nobody') })
    assert.deepEqual(specAgentCatalog().problems, [])
    assert.ok(findSpecAgent('api-contract'))
  })

  // A `runtime` left by a board written before #443 goes: named runtimes are gone, and the
  // agent it pointed at runs the connector the board gives it now.
  it('leaves a key the board no longer reads exactly where it is, and drops a stale runtime', () => {
    board({ specAgents: { proposer: { runtime: 'cheap', output: 'agent' } } })
    assert.equal(setSpecAgentSetting('proposer', 'small-fixes', 'auto').ok, true)
    assert.deepEqual(saved().proposer, { output: 'agent', 'small-fixes': 'auto' })
  })

  // A role's own settings (#1469): saved under its entry by key, and the picked choice's words
  // reach every run it does, before the user's rule.
  it("draws a role's own settings, saves them by key, and tells its runs the pick", async () => {
    const proposer = async () => (await readAgents()).agents.find((a) => a.name === 'proposer')!
    assert.deepEqual((await proposer()).settings.map((s) => s.key), ['small-fixes'])
    assert.deepEqual((await proposer()).settings[0]!.choices.map((c) => c.value), ['auto', 'propose', 'skip'])
    assert.doesNotMatch(JSON.stringify((await proposer()).settings), /prompt/)
    assert.equal((await proposer()).values['small-fixes'], 'propose')
    const reflect = () => buildPrompt({ action: 'reflect', id: 7, title: 'card 7' })
    assert.doesNotMatch(reflect(), /Your settings on this board/)

    assert.equal(setSpecAgentSetting('proposer', 'small-fixes', 'auto').ok, true)
    assert.deepEqual(saved().proposer, { 'small-fixes': 'auto' })
    assert.equal((await proposer()).values['small-fixes'], 'auto')
    assert.match(reflect(), /Your settings on this board:\n- A small fix .*--schedule implement/)
    assert.doesNotMatch(buildPrompt({ action: 'implement', id: 7 }), /Your settings on this board/)

    assert.equal(setSpecAgentSetting('proposer', 'small-fixes', 'skip').ok, true)
    assert.match(reflect(), /Do not propose small fixes/)
    assert.equal(setSpecAgentSetting('proposer', 'small-fixes', 'propose').ok, true)
    assert.equal(saved(), undefined)
    assert.equal(setSpecAgentSetting('proposer', 'small-fixes', 'always').ok, false)
    assert.equal(setSpecAgentSetting('builder', 'small-fixes', 'auto').ok, false)
  })
})

// A lead's own section (#868, #1574): a plan lead writes one above the boundary, an execute
// lead none, whatever its file or the board says.
describe("a lead agent's section", () => {
  const outliner = (stage: string, extra = ''): void =>
    project('outliner', {
      'AGENT.md': ['---', 'name: outliner', 'description: d', 'akb:', `  lead: ${stage}`, ...(extra ? [extra] : []), '---', '', 'You outline.', ''].join('\n'),
    })
  /** Card 12, on a workflow the outliner leads one stage of. */
  const led = (stage: 'plan' | 'execute'): void => {
    const mine = createWorkflow('Mine').id!
    assert.equal(setWorkflowLead(mine, stage, 'outliner').ok, true)
    const file = card(12)
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('questions: []', `questions: []\nworkflow: ${mine}`))
  }
  const refine = { action: 'clarify', id: 12, refineRound: 1 } as const

  it('makes a plan run it leads write its section above the boundary, and tells it so', () => {
    outliner('plan', '  output: agent')
    board({ specAgents: { outliner: { output: 'agent' } } })
    led('plan')
    assert.deepEqual(humanSectionFor(refine), { agent: 'outliner', required: true })
    assert.match(buildPrompt({ action: 'clarify', id: 12 }), /write it in ``## By `outliner` agent``, above `<!-- agent -->`/)
  })

  it('changes nothing for an execute lead, or a card no agent leads', () => {
    outliner('execute', '  output: human')
    led('execute')
    assert.equal(humanSectionFor({ action: 'implement', id: 12 }), null)
    assert.doesNotMatch(buildPrompt({ action: 'implement', id: 12 }), /Your output is reviewed by me/)
    card(13)
    assert.equal(humanSectionFor({ action: 'clarify', id: 13, refineRound: 1 }), null)
    assert.doesNotMatch(buildPrompt({ action: 'clarify', id: 13 }), /Your output is reviewed by me/)
  })

  it('checks where a spec run puts its section, and never asks it for one', () => {
    card(12)
    assert.deepEqual(humanSectionFor({ action: 'spec', id: 12, specAgent: 'ui-designer' }), { agent: 'ui-designer', required: false })
    // A retired review on an old record puts nothing anywhere (#1203).
    assert.equal(humanSectionFor({ action: 'review', id: 12 }), null)
  })
})

// A module's planning memory sits under the planner's folder (#1484), and `init` scaffolds
// none of them — the map cannot reach the agents' own files at all.
describe('`agents` as a module name', () => {
  it('gets no memory folder from `init`, whatever the map says', async () => {
    fs.writeFileSync(path.join(kanban(), 'modules.md'), '- **agents** — a module someone named\n- **skill** — the command\n')
    fs.mkdirSync(path.join(kanban(), 'memory', 'agents', 'ui-designer'), { recursive: true })
    fs.writeFileSync(
      path.join(kanban(), 'memory', 'agents', 'ui-designer', 'redesign.md'),
      '# What `ui-designer` was corrected on\n\n- One.\n',
    )
    await move(root, ['init'])
    assert.equal(fs.existsSync(path.join(kanban(), 'memory', 'agents', 'decisions.md')), false)
    assert.equal(remembered('ui-designer'), '# What `ui-designer` was corrected on\n\n- One.\n')
    assert.equal(fs.existsSync(path.join(kanban(), 'memory', 'skill')), false)
    // The planning memory is the planner's, and the board keeps only its own record.
    assert.ok(fs.existsSync(path.join(kanban(), 'memory', 'agents', 'planner', 'decisions.md')))
    assert.ok(fs.existsSync(path.join(kanban(), 'memory', 'readme.md')))
    assert.equal(fs.existsSync(path.join(kanban(), 'memory', 'decisions.md')), false)
  })
})
