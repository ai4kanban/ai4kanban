import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { agentComponents, componentDocsText, workflowComponents } from '../src/lib/components.ts'
import { parseSpecAgent } from '../src/lib/agents/parse.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { AGENTS, setBoardRoot } from '../src/lib/paths.ts'
import { run } from './helpers/board.ts'
import { resetOfficial, writeOfficial } from './helpers/official.ts'

let root = ''
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-components-'))
  fs.mkdirSync(path.join(root, 'docs/kanban/todo'), { recursive: true })
  setBoardRoot(root)
})
afterEach(() => {
  resetOfficial()
  fs.rmSync(root, { recursive: true, force: true })
})

async function outputOf(argv: string[]): Promise<string> {
  const sink = startCollecting()
  try {
    await run(root, argv)
    return sink.out.join('\n')
  } finally { stopCollecting() }
}

const names = (docs: { name: string }[]) => docs.map((doc) => doc.name)
const agentText = (components = '') => `---\nname: example\ndescription: An example.\n${components}---\n\nWrite a draft.\n`

function ownAgent(name: string, components: string): void {
  const dir = path.join(AGENTS, name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'AGENT.md'), agentText(`akb:\n  components: ${components}\n`).replace('name: example', `name: ${name}`))
}

describe('preview component context', () => {
  it('defaults legacy agents to Asset, preserves empty lists and rejects malformed declarations', () => {
    for (const [declaration, expected] of [['', ['Asset']], ['akb:\n  components: []\n', []], ['akb:\n  components: [Storyboard, Storyboard]\n', ['Storyboard']]] as const) {
      const parsed = parseSpecAgent(agentText(declaration), 'AGENT.md', () => null)
      assert.ok('agent' in parsed)
      assert.deepEqual(parsed.agent.components, expected)
    }
    const parsed = parseSpecAgent(agentText('akb:\n  components: Asset\n'), 'AGENT.md', () => null)
    assert.ok('problem' in parsed)
    assert.match(parsed.problem, /example.*akb.components/)
  })

  it('supplies only each specialist’s declarations in runs and printed flows', async () => {
    fs.writeFileSync(path.join(root, 'docs/kanban/todo/1-example.md'), '---\ntitle: Example\nstatus: ready\n---\nA draft.\n')
    for (const [agent, expected] of [
      ['prompt-writer', ['Asset']], ['video-cloner', ['Compare', 'Storyboard']],
      ['deck-planner', ['Storyboard']], ['deck-builder', ['Asset', 'Storyboard']],
    ] as const) {
      assert.deepEqual(names(agentComponents([agent])), expected)
      const prompt = buildPrompt({ action: 'spec', specAgent: agent, id: 1 })
      const sink = startCollecting()
      try {
        printFlow({ action: 'spec', specAgent: agent, id: 1 })
        assert.ok(sink.out.join('\n').replace(/^  /gm, '').includes(componentDocsText(agentComponents([agent]))))
      } finally { stopCollecting() }
      for (const component of ['Asset', 'Compare', 'Storyboard']) {
        assert.equal(prompt.includes(`# ${component}\n`), (expected as readonly string[]).includes(component))
      }
    }
  })

  it('uses the same deduplicated workflow union for commands and every planning phase', async () => {
    ownAgent('first', '[Storyboard, Asset]')
    ownAgent('second', '[Asset]')
    ownAgent('scheduled-example', '[Compare]')
    writeOfficial('workflows/example/WORKFLOW.md', '---\nname: Example\npreviews: [first]\nland: [second, builder]\nscheduled:\n  - agent: scheduled-example\n---\nWrite a card.\n')
    const docs = workflowComponents('example')
    assert.deepEqual(names(docs), ['Storyboard', 'Asset', 'Compare'])
    const command = await outputOf(['components', '--workflow', 'example', '--docs'])
    assert.ok(command.includes(componentDocsText(docs)))
    for (const action of ['clarify', 'edit', 'resolve', 'approve'] as const) {
      const prompt = buildPrompt({ action, workflow: 'example', id: 1 })
      assert.ok(prompt.includes(componentDocsText(docs)))
      for (const component of names(docs)) assert.equal(prompt.split(`# ${component}\n`).length - 1, 1)
    }
    assert.deepEqual(names(workflowComponents('coding')), ['Asset', 'Compare', 'Storyboard'])
  })

  it('reports missing component docs', () => {
    ownAgent('empty', '[]')
    assert.deepEqual(agentComponents(['empty']), [])
    ownAgent('unknown', '[Missing]')
    assert.throws(() => agentComponents(['unknown']), /unknown.*Missing/)
    assert.throws(() => agentComponents(['prompt-writer'], {}), /prompt-writer.*Asset/)
  })

  it('requires exactly one selector and supports docs through the CLI', async () => {
    const result = await outputOf(['components', '--agent', 'prompt-writer', '--docs'])
    assert.match(result, /^Asset\n\n# Asset/)
    await assert.rejects(run(root, ['components']), /exactly one/)
    await assert.rejects(run(root, ['components', '--agent', 'prompt-writer', '--workflow', 'coding']), /exactly one/)
    await assert.rejects(run(root, ['components', '--agent', 'absent']), /absent/)
    await assert.rejects(run(root, ['components', '--workflow', 'absent']), /absent/)
  })
})
