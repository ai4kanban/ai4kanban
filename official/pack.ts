// The official workflows as Cloud keeps them (#409): each folder of `workflows/` with the
// `agents/` folders it names, plus its own skills and `mcp.json`. Read by the publish script and
// by akb's tests; nothing ships this folder.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseSpecAgent } from '../cli/src/lib/agents/parse.ts'
import { parseWorkflowFile } from '../cli/src/lib/agent/workflow-def.ts'
import { checkWorkflowFiles, isAboutFile, landsOf, MCP_FILE, WORKFLOW_FILE, type WorkflowFiles } from '../cli/src/lib/shared/workflow-files.ts'

export const OFFICIAL = path.dirname(fileURLToPath(import.meta.url))

export interface OfficialWorkflow {
  id: string
  name: string
  names: Record<string, string>
  description: string
  when: string
  lands: boolean
  /** What tells one version of its files from another. */
  hash: string
  files: WorkflowFiles
}

const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

const dirs = (dir: string) => fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()

function filesOf(dir: string, base = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    return e.isDirectory() ? filesOf(full, base) : [path.relative(base, full).split(path.sep).join('/')]
  })
}

export const officialId = (folder: string) => `wf_builtin_${folder.replace(/-/g, '_')}`

export const hashOf = (files: WorkflowFiles) =>
  crypto.createHash('sha256').update(JSON.stringify(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1)))).digest('hex')

/** Every official workflow under `root`. A broken one throws; `loose`, it is packed as it is,
 *  what akb's tests read. */
export function packOfficial(root = OFFICIAL, loose = false): OfficialWorkflow[] {
  const agentsDir = path.join(root, 'agents')
  const agentFiles = Object.fromEntries(dirs(agentsDir).map((name) => {
    const dir = path.join(agentsDir, name)
    return [name, Object.fromEntries(filesOf(dir).sort().map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]))]
  })) as Record<string, WorkflowFiles>
  for (const [name, own] of Object.entries(loose ? {} : agentFiles)) {
    const read = parseSpecAgent(own['AGENT.md'] ?? '', `official/agents/${name}/AGENT.md`, (p) => own[p] ?? null, true)
    if ('problem' in read) throw new Error(read.problem)
  }
  const workflowsDir = path.join(root, 'workflows')
  return dirs(workflowsDir).map((folder) => {
    const dir = path.join(workflowsDir, folder)
    const files: WorkflowFiles = {}
    for (const f of filesOf(dir).sort()) {
      if (f === WORKFLOW_FILE || f === MCP_FILE || f.startsWith('skills/') || /^ABOUT(\.[a-z]{2})?\.md$/.test(f)) files[f] = fs.readFileSync(path.join(dir, f), 'utf8')
      else if (isAboutFile(f)) files[f] = `data:${MIME[path.extname(f)]};base64,${fs.readFileSync(path.join(dir, f)).toString('base64')}`
    }
    const read = checkWorkflowFiles({ [WORKFLOW_FILE]: files[WORKFLOW_FILE], ...Object.fromEntries(
      Object.entries(agentFiles).flatMap(([name, own]) => Object.entries(own).map(([f, t]) => [`agents/${name}/${f}`, t]))) })
    if (!read.ok && !loose) throw new Error(`official/workflows/${folder}: ${read.file}: ${read.reason}`)
    const parsed = parseWorkflowFile(folder, files[WORKFLOW_FILE] ?? '', WORKFLOW_FILE)
    if ('problem' in parsed) throw new Error(parsed.problem)
    const def = parsed.def
    for (const name of [...new Set([...def.previews, ...def.land, ...def.scheduled].map((h) => h.agent))].sort()) {
      for (const [f, text] of Object.entries(agentFiles[name] ?? {})) files[`agents/${name}/${f}`] = text
    }
    const checked = loose ? { ok: true as const } : checkWorkflowFiles(files, true)
    if (!checked.ok) throw new Error(`official/workflows/${folder}: ${checked.file}: ${checked.reason}`)
    if (!def.names?.zh && !loose) throw new Error(`official/workflows/${folder}/${WORKFLOW_FILE}: add its Chinese name under \`names: zh\``)
    return {
      id: officialId(folder),
      name: def.name,
      names: { en: def.name, ...def.names },
      description: def.description,
      when: def.when,
      ...landsOf(def),
      hash: hashOf(files),
      files,
    }
  })
}
