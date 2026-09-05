// The roles the board ships, and the rule each agent carries (#420).
//
// What is asked here: every flow the board can start belongs to exactly one agent, the
// roster names the roles before the specialists, a board written when rules were per flow
// is folded onto its agents once and says so, and `akb raw rule` writes the same file the
// board reads.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { FLOWS } from '../src/lib/agent/flows.ts'
import { buildRun } from '../src/lib/agent/prompts.ts'
import { agentNames, agentRoster, roleForFlow, roles } from '../src/lib/agent/roles.ts'
import { migrateFlowRules, readRule, ruleFor } from '../src/lib/agent/rules.ts'
import { specAgentProblems } from '../src/lib/agents/index.ts'
import { RULES, setBoardRoot } from '../src/lib/paths.ts'
import { move, refuses } from './helpers/board.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')

/** Say what kind of board this is — `product` unless the line says otherwise. */
const solution = (name: string): void => {
  fs.writeFileSync(path.join(kanban(), 'config.md'), `- **Solution** — ${name}\n`)
}

/** A rule file as a board written before #420 had it: named by the flow. */
const rule = (name: string, text: string): void => {
  fs.mkdirSync(RULES, { recursive: true })
  fs.writeFileSync(path.join(RULES, `${name}.md`), `${text}\n`)
}

const ruleText = (name: string): string => fs.readFileSync(path.join(RULES, `${name}.md`), 'utf8').trim()

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-roles-'))
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  setBoardRoot(root)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the roles', () => {
  it('gives every flow the board can start exactly one agent', () => {
    for (const name of ['product', 'marketing']) {
      solution(name)
      for (const flow of FLOWS) {
        const owners = roles().filter((role) => role.flows.includes(flow.command))
        assert.equal(owners.length, 1, `${name}: ${flow.command} is run by ${owners.length} agents`)
      }
    }
  })

  it('names the writer on a marketing board and the builder on a product one', () => {
    solution('product')
    assert.deepEqual(
      roles().map((r) => r.name),
      ['planner', 'builder', 'reviewer'],
    )
    assert.equal(roleForFlow('implement')!.name, 'builder')
    // `akb channel` is the writer's and exists nowhere else.
    assert.equal(roleForFlow('channel'), undefined)

    solution('marketing')
    assert.deepEqual(
      roles().map((r) => r.name),
      ['planner', 'writer', 'reviewer'],
    )
    assert.equal(roleForFlow('implement')!.name, 'writer')
    assert.equal(roleForFlow('channel')!.name, 'writer')
  })

  it('says what each role remembers, in files that are the board it is on', () => {
    solution('product')
    assert.ok(roles().find((r) => r.name === 'planner')!.memory.includes('memory/goal.md'))
    solution('marketing')
    // No goal on a marketing board, so the planner cannot claim one.
    assert.ok(!roles().find((r) => r.name === 'planner')!.memory.includes('memory/goal.md'))
    assert.ok(roles().find((r) => r.name === 'writer')!.memory.includes('memory/writing.md'))
  })

  it("refuses a project agent that takes a role's name, so no two share a rule", () => {
    solution('product')
    const home = path.join(kanban(), 'agents', 'builder')
    fs.mkdirSync(home, { recursive: true })
    fs.writeFileSync(
      path.join(home, 'AGENT.md'),
      ['---', 'name: builder', 'description: Use when.', 'akb:', '  kind: spec', '  owns: the build', '---', '', 'You build.']
        .join('\n')
        .concat('\n'),
    )
    assert.deepEqual(agentNames(), ['planner', 'builder', 'reviewer', 'technology-selection', 'ui-design'])
    assert.match(specAgentProblems().join('\n'), /`builder` is one of the roles the board ships/)
  })

  it('rosters the roles first, then the specialists the command ships', () => {
    solution('product')
    const names = agentNames()
    assert.deepEqual(names.slice(0, 3), ['planner', 'builder', 'reviewer'])
    assert.deepEqual(names.slice(3), ['technology-selection', 'ui-design'])
    assert.deepEqual(
      agentRoster().map((a) => a.kind),
      ['role', 'role', 'role', 'spec', 'spec'],
    )
    // A role says which flows it runs; a specialist is asked for by name and runs none.
    assert.ok(agentRoster()[0]!.flows.length > 0)
    assert.deepEqual(agentRoster()[3]!.flows, [])
  })
})

describe("the one-time move onto the agents", () => {
  it('folds a per-flow rule file into its agent, in flow order, and deletes it', () => {
    solution('product')
    rule('implement', 'Install dependencies first.')
    rule('conflict', 'Keep the target branch.')
    rule('review', 'Run the smoke tests.')

    const notes = migrateFlowRules()
    assert.equal(ruleText('builder'), 'Install dependencies first.\n\nKeep the target branch.')
    assert.equal(ruleText('reviewer'), 'Run the smoke tests.')
    for (const gone of ['implement', 'conflict', 'review']) {
      assert.equal(fs.existsSync(path.join(RULES, `${gone}.md`)), false, gone)
    }
    // Said out loud: what the user wrote for one flow now reaches two more.
    assert.equal(notes.length, 2)
    assert.match(notes.join('\n'), /implement\.md, conflict\.md/)
    assert.match(notes.join('\n'), /builder\.md/)
  })

  it('runs once — the second read finds nothing to move and says nothing', () => {
    solution('product')
    rule('implement', 'Install dependencies first.')
    assert.equal(readRule('builder'), 'Install dependencies first.')
    assert.deepEqual(migrateFlowRules(), [])
    assert.deepEqual(buildRun({ action: 'propose' }).notes, [])
  })

  it("keeps a rule the agent already had in front of the flows'", () => {
    solution('product')
    rule('builder', 'The board rule.')
    rule('run', 'The recurring rule.')
    migrateFlowRules()
    assert.equal(ruleText('builder'), 'The board rule.\n\nThe recurring rule.')
  })

  it('reports the move in the run log the first time a run is built', () => {
    solution('product')
    rule('review', 'Run the smoke tests.')
    const { notes, prompt } = buildRun({ action: 'review', id: 1, title: 'card one' })
    assert.match(notes.join('\n'), /a rule is one per agent now/)
    assert.match(prompt, /smoke tests/)
  })

  it('leaves a board that never had a rule alone', () => {
    solution('product')
    assert.deepEqual(migrateFlowRules(), [])
    assert.equal(fs.existsSync(RULES), false)
    assert.equal(readRule('builder'), '')
    assert.equal(ruleFor({ action: 'implement', id: 1 }), '')
  })
})

describe('akb raw rule', () => {
  it('writes one agent\'s rule from a file, replaces it, and clears it', async () => {
    solution('product')
    const file = path.join(root, 'rule.md')
    fs.writeFileSync(file, 'Install dependencies first.\n')
    const wrote = await move(root, ['rule', 'builder', '--file', file])
    assert.equal(wrote.agent, 'builder')
    assert.equal(ruleText('builder'), 'Install dependencies first.')

    await move(root, ['rule', 'builder', '--text', 'Something else.'])
    assert.equal(ruleText('builder'), 'Something else.')

    const cleared = await move(root, ['rule', 'builder', '--text', ''])
    assert.equal(cleared.cleared, true)
    assert.equal(fs.existsSync(path.join(RULES, 'builder.md')), false)
  })

  it('takes a spec agent by name too, and refuses a name no agent answers to', async () => {
    solution('product')
    await move(root, ['rule', 'ui-design', '--text', 'Keep to the existing palette.'])
    assert.equal(ruleText('ui-design'), 'Keep to the existing palette.')
    await refuses(root, ['rule', 'designer', '--text', 'Anything.'], /planner, builder, reviewer/)
  })

  it('refuses two sources, and no source at all', async () => {
    solution('product')
    await refuses(root, ['rule', 'builder', '--file', 'a.md', '--text', 'b'], /not both/)
    await refuses(root, ['rule', 'builder'], /--file <path>/)
  })
})
