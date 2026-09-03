// The spec skills (#403): read from `SKILL.md` rather than written in TypeScript, added by
// a project as well as shipped, and handed to a run one reference at a time.
//
// What is asked here is the whole of the promise: the built-in skills still say what they
// always said; a project's own skill joins the same catalog; a skill nobody can read is
// reported by name instead of vanishing; the catalog a planning session sees carries no
// instructions; and a spec run is handed its skill and only the reference its board setting
// picked.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import {
  findSpecSkill,
  readSpecSkills,
  setSpecSkillSetting,
  specSkillCatalog,
  specSkillInstructions,
  specSkillSelector,
} from '../src/lib/spec-skills/index.ts'
import { parseYamlBlock } from '../src/lib/spec-skills/yaml.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')

const board = (cfg: Record<string, unknown> = {}): void => {
  fs.mkdirSync(kanban(), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'ui.config.json'), JSON.stringify(cfg, null, 2))
  setBoardRoot(root)
}

/** Write one project skill: `SKILL.md` plus whatever else it carries. */
const project = (name: string, files: Record<string, string>): void => {
  for (const [relative, text] of Object.entries(files)) {
    const file = path.join(kanban(), 'skills', name, relative)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, text)
  }
}

const SKILL = [
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

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-spec-skills-'))
  board()
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the skills this command ships', () => {
  it('reads both of them out of their own SKILL.md', () => {
    const { skills, problems } = specSkillCatalog()
    assert.deepEqual(problems, [])
    assert.deepEqual(
      skills.map((s) => s.name),
      ['technology-selection', 'ui-design'],
    )
    const ui = findSpecSkill('ui-design')!
    assert.match(ui.owns, /the screen a card changes/)
    assert.match(ui.description, /^Use when/)
    assert.match(ui.body, /You draw the screen a card needs/)
    assert.equal(ui.builtIn, true)
  })

  it('carries `ui-design`\'s mockup style, its two choices and their references', () => {
    const setting = findSpecSkill('ui-design')!.settings[0]!
    assert.equal(setting.key, 'mockupStyle')
    assert.equal(setting.default, 'full')
    assert.deepEqual(
      setting.choices.map((c) => c.value),
      ['full', 'ascii'],
    )
    for (const choice of setting.choices) assert.match(choice.reference, /^references\//)
  })

  it('still answers to the name `technology-selection` had before', () => {
    assert.equal(findSpecSkill('recommend-tech-stack')?.name, 'technology-selection')
  })
})

describe('a skill the project adds', () => {
  it('joins the same catalog and the same list a screen draws', () => {
    project('api-contract', { 'SKILL.md': SKILL })
    const { skills, problems } = specSkillCatalog()
    assert.deepEqual(problems, [])
    assert.ok(skills.some((s) => s.name === 'api-contract'))
    const view = readSpecSkills().find((s) => s.name === 'api-contract')
    assert.equal(view?.enabled, true)
    assert.deepEqual(view?.settings, [])
  })

  it('is switched off and set like a built-in one', () => {
    project('api-contract', {
      'SKILL.md': SKILL.replace(
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
    assert.equal(setSpecSkillSetting('api-contract', 'style', 'prose').ok, true)
    const skill = findSpecSkill('api-contract')!
    assert.deepEqual(specSkillInstructions(skill).references, [
      { title: 'Contract style: Prose', text: 'Write a paragraph.' },
    ])
  })

  it('is refused rather than allowed to shadow a built-in name', () => {
    project('ui-design', { 'SKILL.md': SKILL.replace('name: api-contract', 'name: ui-design') })
    const { skills, problems } = specSkillCatalog()
    assert.equal(skills.filter((s) => s.name === 'ui-design').length, 1)
    assert.equal(findSpecSkill('ui-design')?.builtIn, true)
    assert.match(problems.join('\n'), /already on this board/)
  })
})

describe('a skill nobody can read', () => {
  const problemFor = (files: Record<string, string>): string => {
    project('broken', files)
    return specSkillCatalog().problems.join('\n')
  }

  it('reports a file with no frontmatter', () => {
    assert.match(problemFor({ 'SKILL.md': 'Just instructions.' }), /no `---` frontmatter/)
  })

  it('reports a missing description', () => {
    assert.match(
      problemFor({ 'SKILL.md': ['---', 'name: broken', 'akb:', '  kind: spec', '  owns: x', '---', '', 'Body.'].join('\n') }),
      /has no `description`/,
    )
  })

  it('reports a kind this board does not run', () => {
    assert.match(
      problemFor({
        'SKILL.md': ['---', 'name: broken', 'description: d', 'akb:', '  kind: review', '  owns: x', '---', '', 'Body.'].join('\n'),
      }),
      /this board runs `spec` skills/,
    )
  })

  it('reports a choice whose reference is not there', () => {
    assert.match(
      problemFor({
        'SKILL.md': [
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

  it('reports a folder whose SKILL.md calls itself something else', () => {
    assert.match(problemFor({ 'SKILL.md': SKILL }), /make the two match/)
  })

  it('leaves the skills that do parse usable', () => {
    project('broken', { 'SKILL.md': 'Just instructions.' })
    assert.ok(findSpecSkill('ui-design'))
  })
})

describe('what a session is shown', () => {
  it('gives a planning session the names, descriptions and ownership and no instructions', () => {
    const catalog = specSkillSelector(12)
    assert.match(catalog, /<spec-skills>/)
    assert.match(catalog, /- `ui-design`/)
    assert.match(catalog, /owns the screen a card changes/)
    assert.match(catalog, /akb spec <skill> 12 <short note>/)
    assert.doesNotMatch(catalog, /Rendered screen/)
    assert.doesNotMatch(catalog, /You draw the screen a card needs/)
  })

  it('says nothing at all when every skill is switched off', () => {
    board({ specAgents: { 'ui-design': false, 'technology-selection': false } })
    assert.equal(specSkillSelector(12), '')
  })

  it('hands a spec run the contract, its skill and only the picked reference', () => {
    const prompt = buildPrompt({ action: 'spec', id: 12, specAgent: 'ui-design' })
    assert.match(prompt, /You are the `ui-design` spec skill on task 12/)
    assert.match(prompt, /Be a spec skill/)
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

describe("the YAML a skill's frontmatter is written in", () => {
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
