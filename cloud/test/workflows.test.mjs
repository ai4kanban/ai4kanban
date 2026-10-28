// Workflows as files (#2040): the built-ins are cli/src's, and a workflow is checked as akb
// reads a board.

import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { checkWorkflowFiles, stagesFrom } from '../src/v1/workflow-files.ts'

const CLI = new URL('../../cli/src/', import.meta.url)
const builtins = JSON.parse(readFileSync(new URL('../src/v1/builtin-workflows.json', import.meta.url), 'utf8'))

describe('built-in workflows', () => {
  it('are every folder of cli/src/workflows, with its agents’ files as cli/src holds them', () => {
    const folders = readdirSync(new URL('workflows/', CLI)).sort()
    assert.deepEqual(builtins.map((w) => w.id), folders.map((f) => `wf_builtin_${f.replace(/-/g, '_')}`))
    for (const [i, w] of builtins.entries()) {
      assert.equal(w.files['WORKFLOW.md'], readFileSync(new URL(`workflows/${folders[i]}/WORKFLOW.md`, CLI), 'utf8'))
      for (const [file, text] of Object.entries(w.files)) {
        if (file === 'WORKFLOW.md') continue
        const own = file === 'mcp.json' || file.startsWith('skills/') ? `workflows/${folders[i]}/${file}` : file
        assert.equal(text, readFileSync(new URL(own, CLI), 'utf8'), `${w.id}: ${file}`)
      }
      assert.ok(checkWorkflowFiles(w.files, true).ok, w.id)
    }
  })

  it('are each listed by a migration, so a new workspace installs it (#2030)', () => {
    const migrations = new URL('../migrations/', import.meta.url)
    const sql = readdirSync(migrations).map((f) => readFileSync(new URL(f, migrations), 'utf8')).join('\n')
    const listed = [...sql.matchAll(/insert into cloud\.workflow_listings[^;]*;/g)].map((m) => m[0]).join('\n')
    for (const w of builtins) assert.ok(listed.includes(`'${w.id}'`), `${w.id} has no row in cloud.workflow_listings`)
  })

  it('carry the agents each group names and whether they land', () => {
    const coding = builtins.find((w) => w.id === 'wf_builtin_coding')
    assert.equal(coding.lands, true)
    for (const name of ['qa-manager', 'ui-designer']) assert.ok(coding.files[`agents/${name}/AGENT.md`], name)
    const deck = builtins.find((w) => w.id === 'wf_builtin_slide_deck')
    assert.equal(deck.lands, false)
    assert.deepEqual(stagesFrom(deck.files, ['deck-planner', 'deck-builder']), [['deck-planner'], ['deck-builder']])
    const video = builtins.find((w) => w.id === 'wf_builtin_hyperframes_video')
    assert.ok(video.files['agents/cover-designer/AGENT.md'], 'a land agent was left behind')
    assert.deepEqual(stagesFrom(video.files, ['scriptwriter', 'hyperframes-editor']), [['scriptwriter'], ['hyperframes-editor']])
    assert.ok(deck.files['agents/deck-builder/scripts/pack-pptx.mjs'], 'an agent’s script was left behind')
    assert.ok(!deck.files['agents/ui-designer/AGENT.md'], 'a workflow carried an agent it never runs')
  })
})

describe('checking a workflow’s files', () => {
  const WORKFLOW = '---\nname: Site\npreviews: [writer, checker]\nland: [builder]\n---\n'
  const agent = (name) => `---\nname: ${name}\ndescription: Does it.\n---\n\nDo it.\n`
  const FILES = { 'WORKFLOW.md': WORKFLOW, 'agents/writer/AGENT.md': agent('writer'), 'agents/checker/AGENT.md': agent('checker') }
  const refusal = (files) => {
    const checked = checkWorkflowFiles(files)
    assert.equal(checked.ok, false)
    return `${checked.file} ${checked.reason}`
  }

  it('takes WORKFLOW.md and the agents it names; builder is the board’s own', () => {
    assert.equal(checkWorkflowFiles(FILES).ok, true)
  })

  it('names the file and the reason', () => {
    assert.match(refusal({ 'WORKFLOW.md': WORKFLOW, 'agents/writer/AGENT.md': FILES['agents/writer/AGENT.md'] }), /^WORKFLOW\.md it previews with `checker`/)
    assert.match(refusal({ ...FILES, 'WORKFLOW.md': '---\nname: Site\npreviews:\n  - [writer]\n  - [checker]\n---\n' }), /^WORKFLOW\.md `previews` is one list of agents, not a list of lists/)
    assert.match(refusal({ ...FILES, 'WORKFLOW.md': '---\nname: Site\nland: [writer, deployer]\n---\n' }), /^WORKFLOW\.md it lands with `deployer`/)
    assert.match(refusal({ ...FILES, 'WORKFLOW.md': '---\nname: Site\nstages: {}\n---\n' }), /^WORKFLOW\.md `stages` is no longer read/)
    assert.match(refusal({ ...FILES, 'agents/writer/AGENT.md': agent('scribe') }), /^agents\/writer\/AGENT\.md calls itself `scribe`/)
    assert.match(refusal({ ...FILES, 'WORKFLOW.md': '---\nprevious: []\n---\n' }), /^WORKFLOW\.md its frontmatter has no `name`/)
    assert.match(refusal({ ...FILES, 'notes.md': 'x' }), /^notes\.md is neither/)
    assert.match(refusal({ ...FILES, 'agents/writer/../x.md': 'x' }), /is neither/)
    assert.match(refusal({ ...FILES, 'agents/writer/a.bin': 'a\u0000b' }), /is not a text file/)
    assert.match(refusal({ 'agents/writer/AGENT.md': FILES['agents/writer/AGENT.md'] }), /^WORKFLOW\.md is missing/)
  })

  it('takes skills and MCP servers from an official workflow alone (#2030)', () => {
    const extra = {
      'skills/deck/SKILL.md': '---\nname: deck\n---\n',
      'skills/deck/scripts/run.mjs': 'export {}\n',
      'mcp.json': JSON.stringify({ mcpServers: { files: { command: 'npx', args: ['-y', '@acme/files'] } } }),
    }
    assert.equal(checkWorkflowFiles({ ...FILES, ...extra }, true).ok, true)
    assert.match(refusal({ ...FILES, 'mcp.json': extra['mcp.json'] }), /^mcp\.json is neither/)
    assert.match(refusal({ ...FILES, 'skills/deck/SKILL.md': 'x' }), /^skills\/deck\/SKILL\.md is neither/)
    const official = (files) => {
      const checked = checkWorkflowFiles({ ...FILES, ...files }, true)
      assert.equal(checked.ok, false)
      return `${checked.file} ${checked.reason}`
    }
    assert.match(official({ 'skills/deck/run.mjs': 'x' }), /^skills\/deck\/SKILL\.md is missing/)
    assert.match(official({ 'skills/SKILL.md': 'x' }), /is not inside skills/)
    assert.match(official({ 'mcp.json': '{' }), /^mcp\.json is not JSON/)
    assert.match(official({ 'mcp.json': JSON.stringify({ mcpServers: { files: { args: [] } } }) }), /needs a `command`/)
    assert.match(official({ 'mcp.json': JSON.stringify({ mcpServers: { files: { command: 'x', env: { KEY: 'k' } } } }) }), /takes only `command` and `args`/)
  })

  it('holds a file to 256 KB and all of them to 2 MB', () => {
    const big = checkWorkflowFiles({ ...FILES, 'agents/writer/a.md': 'x'.repeat(257 * 1024) })
    assert.equal(big.tooLarge, true)
    const many = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`agents/writer/${i}.md`, 'x'.repeat(250 * 1024)]))
    assert.match(refusal({ ...FILES, ...many }), /^files are larger than 2 MB together/)
  })
})
