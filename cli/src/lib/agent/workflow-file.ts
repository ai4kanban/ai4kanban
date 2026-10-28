// One workflow's `WORKFLOW.md` (#1890): the built-ins the command ships under `src/workflows/`
// and a board's own under `docs/kanban/workflows/` are the same file, read by the same code.
//
// The id is the folder's name. The frontmatter lists its agents; the body is its card rules.
// What the board changes on a built-in, and every scheduled agent's run state, stay in
// `ui.config.json` (./workflows.ts).

import fs from 'node:fs'
import path from 'node:path'
import { forgetFileMemos } from '../file-memo'

import { WORKFLOWS, rel } from '../paths'
import { yamlScalar } from '../yaml'
import type { WorkflowHelper } from './types'
import { parseWorkflowFile, type WorkflowDef } from './workflow-def'

export { WORKFLOW_ID, parseWorkflowFile, stagesOf, type WorkflowDef } from './workflow-def'

import coding from '../../workflows/coding/WORKFLOW.md'
import hyperframesVideo from '../../workflows/hyperframes-video/WORKFLOW.md'
import slideDeck from '../../workflows/slide-deck/WORKFLOW.md'
import carouselPost from '../../workflows/carousel-post/WORKFLOW.md'
import blogPost from '../../workflows/blog-post/WORKFLOW.md'
import videoClone from '../../workflows/video-clone/WORKFLOW.md'
import workflowBuilder from '../../workflows/workflow-builder/WORKFLOW.md'

/** The built-ins, in the order a board lists them. */
const BUNDLED: [string, string][] = [
  ['coding', coding],
  ['hyperframes-video', hyperframesVideo],
  ['slide-deck', slideDeck],
  ['carousel-post', carouselPost],
  ['blog-post', blogPost],
  ['video-clone', videoClone],
  ['workflow-builder', workflowBuilder],
]

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
  if (def.description) lines.push(`description: ${scalar(def.description)}`)
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

// ---- the built-ins ----------------------------------------------------------

/** The workflows the command ships. A broken one is a broken build, so it throws. */
export const BUILTIN_DEFS: WorkflowDef[] = BUNDLED.map(([id, source]) => {
  const read = parseWorkflowFile(id, source, `the built-in \`${id}\` workflow`)
  if ('problem' in read) throw new Error(read.problem)
  return read.def
})

// ---- a board's own ----------------------------------------------------------

const fileOf = (id: string): string => path.join(WORKFLOWS, id, WORKFLOW_FILE)

/** A board's own workflows, and one line for each folder that could not be used. Folders read
 *  in numeric order, which is the order `wf-N` ids were made in. */
export function boardWorkflowDefs(): { defs: WorkflowDef[]; problems: string[] } {
  let folders: string[]
  try {
    folders = fs
      .readdirSync(WORKFLOWS, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  } catch {
    return { defs: [], problems: [] }
  }
  const defs: WorkflowDef[] = []
  const problems: string[] = []
  for (const id of folders) {
    const from = rel(fileOf(id))
    if (BUILTIN_DEFS.some((d) => d.id === id)) {
      problems.push(`${from}: \`${id}\` is a built-in workflow, so this one is not used. Rename its folder.`)
      continue
    }
    let source: string
    try {
      source = fs.readFileSync(fileOf(id), 'utf8')
    } catch {
      problems.push(`${from} is missing`)
      continue
    }
    const read = parseWorkflowFile(id, source, from)
    if ('problem' in read) problems.push(read.problem)
    else defs.push(read.def)
  }
  return { defs, problems }
}

/** Write one of the board's own. */
export function writeWorkflowDef(def: WorkflowDef): void {
  const file = fileOf(def.id)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, workflowFileText(def))
  forgetFileMemos()
}

/** Whether a board's own workflow already has its file. */
export const workflowFileExists = (id: string): boolean => fs.existsSync(fileOf(id))

/** Drop one of the board's own, folder and all. */
export function removeWorkflowDef(id: string): void {
  fs.rmSync(path.join(WORKFLOWS, id), { recursive: true, force: true })
  forgetFileMemos()
}
