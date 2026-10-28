#!/usr/bin/env node
// Packs the built-in workflows (#2040) into src/v1/builtin-workflows.json: each folder of
// cli/src/workflows with the cli/src/agents folders it runs, checked the way a user's own
// workflow is, plus the skills (`skills/<name>/`) and MCP servers (`mcp.json`) the folder
// declares (#2030). cli/src stays the only copy — the JSON is a build product, not in git.
// `npm run lint`, `npm test` and every wrangler build run it first.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseSpecAgent } from '../../cli/src/lib/agents/parse.ts'
import { checkWorkflowFiles, MCP_FILE, landsOf, WORKFLOW_FILE } from '../src/v1/workflow-files.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const WORKFLOWS = path.join(ROOT, 'cli', 'src', 'workflows')
const AGENTS = path.join(ROOT, 'cli', 'src', 'agents')
const OUT = path.join(ROOT, 'cloud', 'src', 'v1', 'builtin-workflows.json')

// Each built-in's Chinese name, as the legacy board showed it. A new built-in needs one here.
const ZH_NAMES = {
  'blog-post': '博客文章',
  'carousel-post': '社媒帖',
  coding: '软件开发',
  'hyperframes-video': '产品视频',
  'slide-deck': '演示文稿',
  'video-clone': '视频克隆',
  'workflow-builder': '搭建工作流',
}

const dirs = (dir) => fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()

function filesOf(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    return e.isDirectory() ? filesOf(full, base) : [path.relative(base, full).split(path.sep).join('/')]
  })
}

const agentFiles = Object.fromEntries(dirs(AGENTS).map((name) => {
  const dir = path.join(AGENTS, name)
  return [name, Object.fromEntries(filesOf(dir).sort().map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]))]
}))
for (const [name, own] of Object.entries(agentFiles)) {
  const read = parseSpecAgent(own['AGENT.md'] ?? '', `cli/src/agents/${name}/AGENT.md`, (p) => own[p] ?? null, true)
  if ('problem' in read) throw new Error(read.problem)
}

/** Everyone a workflow names: its previews, what lands it and its scheduled agents. */
const named = (def) => [...def.previews, ...def.land, ...def.scheduled].map((h) => h.agent).filter((name) => agentFiles[name])

const parsed = dirs(WORKFLOWS).map((id) => {
  const dir = path.join(WORKFLOWS, id)
  const source = fs.readFileSync(path.join(dir, WORKFLOW_FILE), 'utf8')
  const files = { [WORKFLOW_FILE]: source }
  for (const f of filesOf(dir).sort()) {
    if (f === MCP_FILE || f.startsWith('skills/')) files[f] = fs.readFileSync(path.join(dir, f), 'utf8')
  }
  const read = checkWorkflowFiles({ [WORKFLOW_FILE]: source, ...Object.fromEntries(
    Object.entries(agentFiles).flatMap(([name, own]) => Object.entries(own).map(([f, t]) => [`agents/${name}/${f}`, t]))) })
  if (!read.ok) throw new Error(`cli/src/workflows/${id}: ${read.file}: ${read.reason}`)
  return { id, def: read.def, files }
})

const out = parsed.map(({ id, def, files }) => {
  for (const name of [...new Set(named(def))].sort()) {
    for (const [f, text] of Object.entries(agentFiles[name])) files[`agents/${name}/${f}`] = text
  }
  const checked = checkWorkflowFiles(files, true)
  if (!checked.ok) throw new Error(`cli/src/workflows/${id}: ${checked.file}: ${checked.reason}`)
  const hash = crypto.createHash('sha256').update(JSON.stringify(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1)))).digest('hex')
  if (!ZH_NAMES[id]) throw new Error(`cli/src/workflows/${id}: add its Chinese name to ZH_NAMES in ${path.relative(ROOT, fileURLToPath(import.meta.url))}`)
  return {
    id: `wf_builtin_${id.replace(/-/g, '_')}`,
    name: def.name,
    names: { en: def.name, zh: ZH_NAMES[id] },
    description: def.description,
    ...landsOf(def),
    hash,
    files,
  }
})

const text = `${JSON.stringify(out, null, 1)}\n`
if (!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== text) fs.writeFileSync(OUT, text)
