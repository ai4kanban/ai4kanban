// One workflow's `WORKFLOW.md` (#1890), and where a board finds its workflows (#409): Cloud's,
// through ./cloud-workflows.ts, and the draft a Workflow builder task writes on the board under
// `workflows/<draft>/`. What a board saved on a workflow's scheduled agents stays in
// `ui.config.json` (./workflows.ts).

import fs from 'node:fs'
import path from 'node:path'
import { forgetFileMemos } from '../file-memo'

import { draftFolder } from '../shared/board-files.ts'
import { workspaceTask } from '../cloud/tasks'
import { WORKFLOWS, rel } from '../paths'
import { yamlScalar } from '../yaml'
import { cloudFlows } from './cloud-workflows'
import type { WorkflowHelper } from './types'
import { parseWorkflowFile, type WorkflowDef } from './workflow-def'

export { WORKFLOW_ID, parseWorkflowFile, stagesOf, type WorkflowDef } from './workflow-def'

const WORKFLOW_FILE = 'WORKFLOW.md'

// A ` #` would read back as a comment.
const scalar = (value: string): string => (/\s#/.test(value) ? JSON.stringify(value) : yamlScalar(value))

const plain = (agents: WorkflowHelper[]): boolean => agents.every((h) => !h.extra && !h.off)

// One group's agents as list items at `indent`: a bare name, or a map carrying what the
// workflow asks of it and whether it is off.
function agentLines(agents: WorkflowHelper[], indent: string): string[] {
  return agents.flatMap((h) =>
    !h.extra && !h.off
      ? [`${indent}- ${scalar(h.agent)}`]
      : [
          `${indent}- agent: ${scalar(h.agent)}`,
          ...(h.extra ? [`${indent}  extra: ${JSON.stringify(h.extra)}`] : []),
          ...(h.off ? [`${indent}  off: true`] : []),
        ],
  )
}

const flowList = (agents: WorkflowHelper[]): string => `[${agents.map((h) => scalar(h.agent)).join(', ')}]`

/** One `WORKFLOW.md`, written the way the built-ins are; each group left out when empty. */
export function workflowFileText(def: WorkflowDef): string {
  const lines = ['---', `name: ${scalar(def.name)}`]
  const names = Object.entries(def.names ?? {})
  if (names.length) lines.push('names:', ...names.map(([lang, said]) => `  ${lang}: ${scalar(said)}`))
  if (def.description) lines.push(`description: ${scalar(def.description)}`)
  if (def.when) lines.push(`when: ${scalar(def.when)}`)
  lines.push(`needsArtifact: ${def.needsArtifact}`)
  const group = (key: string, agents: WorkflowHelper[]): string[] =>
    !agents.length ? [] : plain(agents) ? [`${key}: ${flowList(agents)}`] : [`${key}:`, ...agentLines(agents, '  ')]
  lines.push(...group('previews', def.previews), ...group('land', def.land))
  if (def.scheduled.length) {
    lines.push('scheduled:')
    for (const s of def.scheduled) {
      lines.push(`  - agent: ${scalar(s.agent)}`)
      if (s.cadence) lines.push(`    cadence: ${scalar(s.cadence)}`)
    }
  }
  lines.push('---')
  return `${lines.join('\n')}\n${def.rules ? `\n${def.rules}\n` : ''}`
}

// ---- Cloud's -----------------------------------------------------------------

/** The official workflows this board runs, read-only. */
export const builtinDefs = (): WorkflowDef[] => cloudFlows().filter((f) => f.builtIn).map((f) => f.def)

// ---- the board's: a Workflow builder draft ------------------------------------

const fileOf = (id: string): string => path.join(WORKFLOWS, id, WORKFLOW_FILE)

/** The draft this process's Workflow builder task writes, when there is one: Runner places it
 *  before the task's first job. */
export function draftId(): string | null {
  const task = workspaceTask()
  if (!task) return null
  const id = draftFolder(task)
  return fs.existsSync(fileOf(id)) ? id : null
}

export function readFolder(id: string, problems: string[]): WorkflowDef | null {
  let source: string
  try {
    source = fs.readFileSync(fileOf(id), 'utf8')
  } catch {
    problems.push(`${rel(fileOf(id))} is missing`)
    return null
  }
  const read = parseWorkflowFile(id, source, rel(fileOf(id)))
  if ('problem' in read) {
    problems.push(read.problem)
    return null
  }
  return read.def
}

/** The workspace's own workflows, then this task's draft, and one line for each that could not
 *  be used. */
export function boardWorkflowDefs(): { defs: WorkflowDef[]; problems: string[] } {
  const problems: string[] = []
  const defs = cloudFlows().filter((f) => !f.builtIn).map((f) => f.def)
  const draft = draftId()
  const mine = draft ? readFolder(draft, problems) : null
  return { defs: mine ? [...defs, mine] : defs, problems }
}

/** Write the builder draft. */
export function writeWorkflowDef(def: WorkflowDef): void {
  const file = fileOf(def.id)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, workflowFileText(def))
  forgetFileMemos()
}

