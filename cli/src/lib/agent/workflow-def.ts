// Reading one `WORKFLOW.md`, with no file access: the board (./workflow-file.ts) and the
// Cloud Worker (#2040) read it with the same code. Imports keep their `.ts` so Node can load
// this file as it is.
//
// The frontmatter lists the workflow's agents in three groups (#2152): `previews`, the agents
// whose work a person approves, each waiting on the approval of those its `after` names
// (#2154); `land`, run in order once the last approval is in; and `scheduled`. The body is how
// a card on this workflow is written.

import { parseYamlBlock, splitFrontmatter, type YamlValue } from '../agents/yaml.ts'
import { canonicalSpecAgent } from '../spec-agent-names.ts'
import type { WorkflowHelper } from './types.ts'

export interface WorkflowDef {
  id: string
  name: string
  /** What it is for. Optional on a board's own. */
  description: string
  needsArtifact: boolean
  /** Its preview agents, in order. */
  previews: WorkflowHelper[]
  /** What runs, in order, once the last approval is in. Empty: approving it archives the card. */
  land: WorkflowHelper[]
  /** The scheduled agents it starts with; their run state lives in the board's settings. */
  scheduled: { agent: string; cadence?: string }[]
  /** Its body: the rules a card on this workflow is written by. */
  rules: string
}

/** What a workflow may be called on disk: the same shape an agent's name takes. */
export const WORKFLOW_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Keys a `WORKFLOW.md` written before #2152 has. */
const OLD_KEYS = ['stages', 'delivers', 'helpers', 'every']

const box = (value: YamlValue | undefined): Record<string, YamlValue> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const text = (value: YamlValue | undefined): string => (typeof value === 'string' ? value.trim() : '')

function readAgent(item: YamlValue): WorkflowHelper | null {
  const row = typeof item === 'string' ? { agent: item } : box(item)
  const agent = canonicalSpecAgent(text(row.agent))
  if (!agent) return null
  return { agent, extra: typeof row.extra === 'string' ? row.extra : '', ...(text(row.off) === 'true' ? { off: true } : {}) }
}

const readGroup = (value: YamlValue | undefined): WorkflowHelper[] =>
  (Array.isArray(value) ? value : []).map(readAgent).filter((h): h is WorkflowHelper => !!h)

// Rounds, a list of lists (#2152), are gone: an agent's `after` makes a later approval (#2154).
function readPreviews(value: YamlValue | undefined): WorkflowHelper[] | string {
  if (value === undefined || value === '') return []
  if (!Array.isArray(value)) return '`previews` is a list of agents'
  if (value.some(Array.isArray)) {
    return '`previews` is one list of agents, not a list of lists — flatten it, and give an agent `after` to make it wait on another\'s approval'
  }
  return readGroup(value)
}

/** The approvals a card's chosen previews make (#2154), in workflow order: an agent is one past
 *  the latest of those its `after` names that were chosen too, or first when none. Shared with
 *  Cloud, which reads `after` from the workflow's own files. */
export function stagesOf(chosen: string[], after: (name: string) => string[]): string[][] {
  const at = new Map<string, number>()
  const stageOf = (name: string): number => {
    if (!at.has(name)) {
      at.set(name, 0)
      const before = after(name).filter((other) => other !== name && chosen.includes(other))
      at.set(name, Math.max(-1, ...before.map(stageOf)) + 1)
    }
    return at.get(name)!
  }
  const stages: string[][] = []
  for (const name of chosen) (stages[stageOf(name)] ??= []).push(name)
  return stages.filter(Boolean)
}

/** Read one `WORKFLOW.md`. Lenient past the name and the groups: a field it cannot read takes
 *  its default. */
export function parseWorkflowFile(id: string, source: string, from: string): { def: WorkflowDef } | { problem: string } {
  if (!WORKFLOW_ID.test(id)) return { problem: `${from}: \`${id}\` is not a workflow id — use lowercase letters, digits and dashes` }
  const { meta, body } = splitFrontmatter(source)
  if (meta === null) return { problem: `${from}: no \`---\` frontmatter` }
  const raw = parseYamlBlock(meta)
  const name = text(raw.name).replace(/\s+/g, ' ')
  if (!name) return { problem: `${from}: its frontmatter has no \`name\`` }
  const old = OLD_KEYS.filter((key) => key in raw)
  if (old.length) {
    return {
      problem:
        `${from}: \`${old.join('`, `')}\` ${old.length > 1 ? 'are' : 'is'} no longer read — list the agents under ` +
        '`previews`, `land` and `scheduled` instead (`akb guide write-agent`), or ask the Workflow builder to rewrite it',
    }
  }
  const previews = readPreviews(raw.previews)
  if (typeof previews === 'string') return { problem: `${from}: ${previews}` }
  const land = readGroup(raw.land)
  const seen = new Set<string>()
  for (const { agent } of [...previews, ...land]) {
    if (seen.has(agent)) return { problem: `${from}: \`${agent}\` is listed more than once — list an agent once` }
    seen.add(agent)
  }
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
      previews,
      land,
      scheduled,
      rules: body.trim(),
    },
  }
}
