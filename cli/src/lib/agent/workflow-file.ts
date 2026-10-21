// One workflow's `WORKFLOW.md` (#1890): the built-ins the command ships under `src/workflows/`
// and a board's own under `docs/kanban/workflows/` are the same file, read by the same code.
//
// The id is the folder's name. The frontmatter carries the definition; the body is free.
// What the board changes on a built-in, and every scheduled agent's run state, stay in
// `ui.config.json` (./workflows.ts).

import fs from 'node:fs'
import path from 'node:path'

import { parseYamlBlock, splitFrontmatter, type YamlValue } from '../agents/yaml'
import { canonicalSpecAgent } from '../spec-agent-names'
import { WORKFLOWS, rel } from '../paths'
import { yamlScalar } from '../yaml'
import { WORKFLOW_STAGES, type DeliveryStage, type WorkflowHelper, type WorkflowStage } from './types'

import coding from '../../workflows/coding/WORKFLOW.md'
import hyperframesVideo from '../../workflows/hyperframes-video/WORKFLOW.md'
import slideDeck from '../../workflows/slide-deck/WORKFLOW.md'
import carouselPost from '../../workflows/carousel-post/WORKFLOW.md'
import blogPost from '../../workflows/blog-post/WORKFLOW.md'
import videoClone from '../../workflows/video-clone/WORKFLOW.md'

/** The built-ins, in the order a board lists them. */
const BUNDLED: [string, string][] = [
  ['coding', coding],
  ['hyperframes-video', hyperframesVideo],
  ['slide-deck', slideDeck],
  ['carousel-post', carouselPost],
  ['blog-post', blogPost],
  ['video-clone', videoClone],
]

/** `every`: every agent on the board that declares this stage and no other workflow names. */
export type DefHelpers = 'every' | WorkflowHelper[]

export interface WorkflowDef {
  id: string
  name: string
  /** What it is for. Optional on a board's own. */
  description: string
  needsArtifact: boolean
  delivers: DeliveryStage
  /** `helpers` absent is a stage whose hooks nobody has chosen. */
  stages: Record<WorkflowStage, { lead: string; helpers?: DefHelpers }>
  /** The scheduled agents it starts with; their run state lives in the board's settings. */
  scheduled: { agent: string; cadence?: string }[]
}

/** What a workflow may be called on disk: the same shape an agent's name takes. */
export const WORKFLOW_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/

const WORKFLOW_FILE = 'WORKFLOW.md'

// A ` #` would read back as a comment.
const scalar = (value: string): string => (/\s#/.test(value) ? JSON.stringify(value) : yamlScalar(value))

const box = (value: YamlValue | undefined): Record<string, YamlValue> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const text = (value: YamlValue | undefined): string => (typeof value === 'string' ? value.trim() : '')

function readHelpers(value: YamlValue | undefined): DefHelpers | undefined {
  if (text(value) === 'every') return 'every'
  if (!Array.isArray(value)) return undefined
  const out: WorkflowHelper[] = []
  for (const item of value) {
    const row = typeof item === 'string' ? { agent: item } : box(item)
    const agent = canonicalSpecAgent(text(row.agent))
    if (!agent || out.some((h) => h.agent === agent)) continue
    out.push({ agent, extra: typeof row.extra === 'string' ? row.extra : '', ...(text(row.off) === 'true' ? { off: true } : {}) })
  }
  return out
}

/** Read one `WORKFLOW.md`. Lenient past the name: a field it cannot read takes its default. */
export function parseWorkflowFile(id: string, source: string, from: string): { def: WorkflowDef } | { problem: string } {
  if (!WORKFLOW_ID.test(id)) return { problem: `${from}: \`${id}\` is not a workflow id — use lowercase letters, digits and dashes` }
  const { meta } = splitFrontmatter(source)
  if (meta === null) return { problem: `${from}: no \`---\` frontmatter` }
  const raw = parseYamlBlock(meta)
  const name = text(raw.name).replace(/\s+/g, ' ')
  if (!name) return { problem: `${from}: its frontmatter has no \`name\`` }
  const stages = box(raw.stages)
  const scheduled: WorkflowDef['scheduled'] = []
  for (const item of Array.isArray(raw.scheduled) ? raw.scheduled : []) {
    const row = typeof item === 'string' ? { agent: item } : box(item)
    const agent = canonicalSpecAgent(text(row.agent))
    if (!agent || scheduled.some((s) => s.agent === agent)) continue
    scheduled.push({ agent, ...(text(row.cadence) ? { cadence: text(row.cadence) } : {}) })
  }
  return {
    def: {
      id,
      name,
      description: text(raw.description),
      needsArtifact: text(raw.needsArtifact) === 'true',
      delivers: text(raw.delivers) === 'plan' ? 'plan' : 'execute',
      stages: Object.fromEntries(
        WORKFLOW_STAGES.map((stage) => {
          const one = box(stages[stage])
          const helpers = readHelpers(one.helpers)
          return [stage, { lead: canonicalSpecAgent(text(one.lead)), ...(helpers ? { helpers } : {}) }]
        }),
      ) as WorkflowDef['stages'],
      scheduled,
    },
  }
}

/** The frontmatter of one `WORKFLOW.md`, written the way the built-ins are. */
export function workflowFileText(def: WorkflowDef, body = ''): string {
  const lines = ['---', `name: ${scalar(def.name)}`]
  if (def.description) lines.push(`description: ${scalar(def.description)}`)
  lines.push(`needsArtifact: ${def.needsArtifact}`, `delivers: ${def.delivers}`, 'stages:')
  for (const stage of WORKFLOW_STAGES) {
    const { lead, helpers } = def.stages[stage]
    lines.push(`  ${stage}:`, `    lead: ${scalar(lead)}`)
    if (helpers === 'every') lines.push('    helpers: every')
    else if (helpers && !helpers.length) lines.push('    helpers: []')
    else if (helpers) {
      lines.push('    helpers:')
      for (const h of helpers) {
        if (!h.extra && !h.off) lines.push(`      - ${scalar(h.agent)}`)
        else {
          lines.push(`      - agent: ${scalar(h.agent)}`)
          if (h.extra) lines.push(`        extra: ${JSON.stringify(h.extra)}`)
          if (h.off) lines.push('        off: true')
        }
      }
    }
  }
  if (def.scheduled.length) {
    lines.push('scheduled:')
    for (const s of def.scheduled) {
      lines.push(`  - agent: ${scalar(s.agent)}`)
      if (s.cadence) lines.push(`    cadence: ${scalar(s.cadence)}`)
    }
  }
  lines.push('---')
  return `${lines.join('\n')}\n${body}`
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

/** Write one of the board's own, keeping whatever body its file already has. */
export function writeWorkflowDef(def: WorkflowDef): void {
  const file = fileOf(def.id)
  let body = ''
  try {
    body = splitFrontmatter(fs.readFileSync(file, 'utf8')).body
  } catch {
    // A new workflow.
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, workflowFileText(def, body))
}

/** Whether a board's own workflow already has its file. */
export const workflowFileExists = (id: string): boolean => fs.existsSync(fileOf(id))

/** Drop one of the board's own, folder and all. */
export function removeWorkflowDef(id: string): void {
  fs.rmSync(path.join(WORKFLOWS, id), { recursive: true, force: true })
}
