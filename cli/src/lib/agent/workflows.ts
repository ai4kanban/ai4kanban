// The workflows a board runs, and the one place a card's own is read (#715).
//
// A workflow lists its agents in three groups (#2152): `previews`, whose work a person approves,
// each waiting on the approvals its `after` names (#2154); `land`, run in order once the last
// approval is in; and `scheduled`. Cards
// are written by the board's own planning, to the workflow's rules (its file's body and the
// user's rule for it); no agent leads a workflow.
//
// Every workflow is a `WORKFLOW.md` (./workflow-file.ts, #1890) kept in Cloud (#409): the
// official ones, read-only, and the workspace's own, edited on the web. The run state of each
// scheduled agent stays in `ui.config.json` under `workflows`.
//
// The id is what a card carries and what a delivery freezes. It never changes: renaming a
// workflow rewrites its name and nothing else, so no card and no finished delivery is
// orphaned by it.

import fs from 'node:fs'
import path from 'node:path'

import { locate, locateArchived } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { AGENTS, die, LEGACY_AGENTS, LEGACY_UI_CONFIG, RULES, UI_CONFIG, WORKFLOWS } from '../paths'
import { memoByFiles } from '../file-memo'
import type { Meta } from '../types'
import { AUTO_CADENCE, formatStamp, isAuto, parseCadence } from '../cadence'
import { safeConfig, configBlock, writeConfig } from './settings'
import { checkAgentKeys, specAgentCatalog, type AgentPlaces, type RefusedAgent } from '../agents/catalog'
import { canonicalSpecAgent } from '../spec-agent-names'
import { cloudWorkflowSources, heldWorkflowName } from './cloud-workflows'
import { translating } from './language'
import { boardWorkflowDefs, builtinDefs, draftId, stagesOf, writeWorkflowDef, type WorkflowDef } from './workflow-file'
import { refusal, type FrozenWorkflow, type RunRefusal, type WorkflowHelper, type WorkflowScheduled } from './types'

export type { WorkflowHelper }

/** One workflow, resolved: the board's own changes over its file. */
export interface Workflow {
  /** What a card carries and a delivery freezes. Never changes. */
  id: string
  /** What it is called. A built-in's is its English name, which the screen drawing it
   *  translates; a board's own is the user's own words and is drawn as written. */
  name: string
  /** Whether it is an official one, read-only. */
  builtIn: boolean
  /** Whether completion requires recorded output files. */
  needsArtifact: boolean
  /** Its preview agents, in order, disabled ones included. Read through `previewMembers`. */
  previews: WorkflowHelper[]
  /** What runs, in order, after the last approval. Read through `landAgents`. */
  land: WorkflowHelper[]
  /** Its scheduled agents (#1401), as written down. Read through `scheduledMembers`. */
  scheduled: WorkflowScheduled[]
  /** Its file's body: how a card on it is written. The user's own rule is `userWorkflowRules`. */
  rules: string
}

// ---- the official ones --------------------------------------------------------

/** Whether a workflow is an official one. */
export const isBuiltinWorkflow = (id: string): boolean => builtinDefs().some((w) => w.id === id)

/** What an official one is for. */
export const builtinDescription = (id: string): string | undefined => builtinDefs().find((w) => w.id === id)?.description

/** What a workflow is for: its own line, else its name. */
export function workflowPurpose(flow: Workflow): string {
  if (flow.builtIn) return builtinDescription(flow.id) || flow.name
  return boardWorkflowDefs().defs.find((d) => d.id === flow.id)?.description || flow.name
}

/** Which requests a workflow is for; empty when its file has none. */
export function workflowWhen(flow: Workflow): string {
  const defs = flow.builtIn ? builtinDefs() : boardWorkflowDefs().defs
  return defs.find((d) => d.id === flow.id)?.when ?? ''
}

// ---- reading ---------------------------------------------------------------

// `ui.config.json`:
//
//   "workflows": { "stages": { "coding": { "schedule": { "helpers": [...] } } } }
//
// Every workflow's scheduled agents with their run state.

const workflowsBlock = (cfg: Record<string, unknown>): Record<string, unknown> => configBlock(cfg.workflows)

const storedStages = (cfg: Record<string, unknown>, id: string): Record<string, unknown> =>
  configBlock(configBlock(workflowsBlock(cfg).stages)[id])

const SCHEDULE = 'schedule'

function readRows(raw: unknown): WorkflowHelper[] | undefined {
  const rows = configBlock(raw).helpers
  if (!Array.isArray(rows)) return undefined
  const out: WorkflowHelper[] = []
  for (const entry of rows) {
    const row = configBlock(entry)
    const agent = typeof row.agent === 'string' ? canonicalSpecAgent(row.agent) : ''
    if (!agent || out.some((h) => h.agent === agent)) continue
    out.push({ agent, extra: typeof row.extra === 'string' ? row.extra : '', ...(row.off === true ? { off: true } : {}) })
  }
  return out
}

function readScheduled(raw: unknown): WorkflowScheduled[] | undefined {
  const rows = configBlock(raw).helpers
  if (!Array.isArray(rows)) return undefined
  const out: WorkflowScheduled[] = []
  for (const entry of rows) {
    const row = configBlock(entry)
    const agent = typeof row.agent === 'string' ? canonicalSpecAgent(row.agent) : ''
    if (!agent || out.some((h) => h.agent === agent)) continue
    const text = (key: string): string => (typeof row[key] === 'string' ? (row[key] as string).trim() : '')
    out.push({
      agent,
      extra: typeof row.extra === 'string' ? row.extra : '',
      ...(row.off === true ? { off: true } : {}),
      cadence: parseCadence(text('cadence')) ? text('cadence') : AUTO_CADENCE,
      lastRun: text('lastRun'),
      ...(text('since') ? { since: text('since') } : {}),
    })
  }
  return out
}

const toRow = (h: WorkflowHelper) => ({ agent: h.agent, extra: h.extra, ...(h.off ? { off: true } : {}) })

const scheduledRow = (h: WorkflowScheduled) => ({
  ...toRow(h),
  ...(!isAuto(h.cadence) ? { cadence: h.cadence } : {}),
  ...(h.lastRun ? { lastRun: h.lastRun } : {}),
  ...(h.since ? { since: h.since } : {}),
})

// A workflow is its file, with the run state of its scheduled agents.
function resolveOne(cfg: Record<string, unknown>, def: WorkflowDef, builtIn: boolean): Workflow {
  const stored = storedStages(cfg, def.id)
  return {
    id: def.id,
    name: def.name,
    builtIn,
    needsArtifact: def.needsArtifact,
    previews: def.previews.map((h) => ({ ...h })),
    land: def.land.map((h) => ({ ...h })),
    scheduled:
      readScheduled(stored[SCHEDULE]) ??
      def.scheduled.map((one) => ({ agent: one.agent, extra: '', cadence: one.cadence ?? AUTO_CADENCE, lastRun: '' })),
    rules: def.rules,
  }
}

// The workflows as written down, with the file each came from.
function writtenWorkflows(): Workflow[] {
  const cfg = safeConfig()
  return [...builtinDefs().map((def) => resolveOne(cfg, def, true)), ...boardWorkflowDefs().defs.map((def) => resolveOne(cfg, def, false))]
}

/** Why a board's own workflow file is not used, one line each. */
export const workflowFileProblems = (): string[] => boardWorkflowDefs().problems

const allListed = (flow: Workflow): WorkflowHelper[] => [...flow.previews, ...flow.land, ...flow.scheduled]

interface Resolved {
  flows: Workflow[]
  owners: Map<string, string>
  /** Each preview's `after`, as it is used, and the lines saying what was ignored. */
  keys: { problems: string[]; after: Map<string, string[]> }
}

// Every workflow, and which one each listed agent belongs to. An agent no workflow lists sits
// in the first workflow, off and nobody's, both among its previews and its scheduled agents:
// switching it on as a preview makes it that workflow's.
const resolved = memoByFiles(
  () => [UI_CONFIG, LEGACY_UI_CONFIG, WORKFLOWS, AGENTS, LEGACY_AGENTS, ...cloudWorkflowSources()],
  (): Resolved => {
    const flows = writtenWorkflows()
    const catalog = specAgentCatalog().agents
    const known = new Set(catalog.map((a) => a.name))
    const owners = new Map<string, string>()
    for (const flow of flows) {
      for (const { agent } of allListed(flow)) if (known.has(agent) && !owners.has(agent)) owners.set(agent, flow.id)
    }
    const first = flows[0]
    if (first) {
      const idle = catalog.filter((a) => !owners.has(a.name))
      if (idle.length) {
        const previews = idle.map((a) => ({ agent: a.name, extra: '', off: true }))
        first.previews = [...first.previews, ...previews]
        first.scheduled = [...first.scheduled, ...idle.map((a) => ({ agent: a.name, extra: '', off: true, cadence: AUTO_CADENCE, lastRun: '' }))]
      }
    }
    const places: AgentPlaces = new Map()
    for (const flow of flows) {
      const mark = (agent: string, where: string) => {
        if (!places.has(agent) && owners.get(agent) === flow.id) places.set(agent, where)
      }
      flow.previews.forEach((h) => mark(h.agent, `${flow.id}#preview`))
      flow.land.forEach((h) => mark(h.agent, 'land'))
      flow.scheduled.forEach((h) => mark(h.agent, 'scheduled'))
    }
    return { flows, owners, keys: checkAgentKeys(catalog, places) }
  },
)

/** The previews whose approval one agent waits on (#2151, #2154), with every name its workflow
 *  cannot use dropped. */
export const agentAfter = (name: string): string[] => resolved().keys.after.get(name) ?? []

/** One line for each `akb.*` key an agent declares and its place in a workflow does not read. */
export const agentKeyProblems = (): string[] => resolved().keys.problems

/** The workflow an agent belongs to, or empty when none lists it. */
export const agentWorkflow = (name: string): string => resolved().owners.get(name) ?? ''

/** Every workflow this board has, built-ins first and then its own in the order they were
 *  made. */
export const workflows = (): Workflow[] => resolved().flows

/** One workflow by id, or undefined when this board has no such workflow. */
export const workflowById = (id: string): Workflow | undefined => workflows().find((w) => w.id === id)

/** The workflow id a command line named, refused when this board has no such workflow. */
export function knownWorkflow(asked: string): string {
  const flow = workflowById(asked.trim())
  if (!flow) {
    die(`no workflow called "${asked.trim()}" on this board. It has: ${workflows().map((w) => w.id).join(', ')}.`, {
      kind: 'no-such-workflow',
      workflow: asked.trim(),
    })
  }
  return flow!.id
}

/** The workflow a card runs on, from the id it carries; undefined when it carries none or this
 *  board has no such workflow. */
export function workflowFor(id: string | undefined): Workflow | undefined {
  const wanted = (id ?? '').trim()
  return wanted ? workflowById(wanted) : undefined
}

/** Why a card has no workflow to run on. */
export function noWorkflowMessage(id: string | undefined): string {
  const wanted = (id ?? '').trim()
  const zh = translating()
  if (!wanted || !workflows().length) return zh ? '先安装一个工作流' : 'Install a workflow first.'
  const name = heldWorkflowName(wanted) || wanted
  return zh ? `此任务的工作流「${name}」未安装` : `This task's workflow "${name}" is not installed.`
}

/** `workflowFor`, refused with `noWorkflowMessage` when there is none. */
export function requireWorkflow(id: string | undefined): Workflow {
  const flow = workflowFor(id)
  if (!flow) die(noWorkflowMessage(id), { kind: 'no-workflow', workflow: (id ?? '').trim() })
  return flow!
}

// ---- the groups, as the board runs them -------------------------------------

const onBoard = (): Set<string> => new Set(specAgentCatalog().agents.map((a) => a.name))

/** Its preview agents, disabled ones included, minus any this board no longer has. */
export const previewMembers = (flow: Workflow): WorkflowHelper[] => {
  const known = onBoard()
  return flow.previews.filter((h) => known.has(h.agent))
}

/** Every preview agent this workflow runs. */
export const previewAgents = (flow: Workflow): WorkflowHelper[] => previewMembers(flow).filter((h) => !h.off)

/** The approvals a card goes through (#2154), each the previews made for it: an agent is one
 *  past the latest of those its `after` names that the card also chose, or first when none.
 *  `chosen` are the card's previews; one its workflow does not run is dropped. Never empty. */
export function previewStages(flow: Workflow | undefined, chosen: readonly string[]): string[][] {
  const names = flow ? previewAgents(flow).map((h) => h.agent).filter((name) => chosen.includes(name)) : []
  const stages = stagesOf(names, agentAfter)
  return stages.length ? stages : [[]]
}

/** What lands the work, in order — its enabled agents. Roles stay; a missing agent is a
 *  problem `workflowIssues` reports, never one dropped in silence. */
export const landAgents = (flow: Workflow): WorkflowHelper[] => flow.land.filter((h) => !h.off)

/** Whether the last approval archives the card: nothing lands it (#2152). */
export const archivesOnApproval = (flow: Workflow | undefined): boolean => !!flow && !landAgents(flow).length

/** The rules a card on this workflow is written by: its file's body, then the user's own. */
export function userWorkflowRules(flow: Workflow): string {
  try {
    return fs.readFileSync(workflowRuleFile(flow.id), 'utf8').trim()
  } catch {
    return ''
  }
}

/** Where the user's own rule for one workflow's cards lives. */
export const workflowRuleFile = (id: string): string => path.join(RULES, 'workflows', `${id}.md`)

/** Every reason one workflow cannot start a card: a land agent this board cannot run. A
 *  preview that no longer resolves is NOT a reason: it is dropped instead. */
export function workflowProblems(id: string): string[] {
  return workflowIssues(id).map((issue) => issue.error)
}

/** The same, each with its kind. */
export function workflowIssues(id: string): RunRefusal[] {
  const flow = workflowById(id)
  if (!flow) return [refusal('workflowNotFound', `this board has no \`${id}\` workflow.`, { id })]
  const known = onBoard()
  const problems: RunRefusal[] = []
  for (const { agent } of landAgents(flow)) {
    if (known.has(agent)) continue
    const refused = specAgentCatalog().refused
    const mine = refused.find((r) => r.folder === agent) ?? refused.find((r) => r.name === agent)
    if (mine) {
      problems.push(landRefused(flow, agent, mine))
      continue
    }
    problems.push(
      refusal('workflowLandMissing', `\`${flow.name}\` lands with \`${agent}\`, and this board has no such agent.`, {
        name: flow.name,
        agent,
        workflow: flow.id,
      }),
    )
  }
  return problems
}

// A land agent whose file is there but refused (#1342): the one line that brings it back.
function landRefused(flow: Workflow, agent: string, found: RefusedAgent): RunRefusal {
  const keys = found.keys ?? []
  const declared = found.name ?? ''
  const fix: Record<RefusedAgent['cause'], string> = {
    oldKeys: `in ${found.file}, remove ${keys.map((key) => `\`${key}\``).join(', ')}`,
    noFile: `${found.file} is missing — add it`,
    nameTaken: `${found.file} takes a name already in use — rename one of the two`,
    folderName: `its folder is \`${found.folder}\` but ${found.file} names it \`${declared}\` — make the two match`,
    file: `${found.file} has an error — \`akb previews\` says which`,
  }
  return refusal('workflowLandRefused', `\`${agent}\`, which lands \`${flow.name}\`, can't be used: ${fix[found.cause]}.`, {
    name: flow.name,
    agent,
    workflow: flow.id,
    cause: found.cause,
    file: found.file,
    folder: found.folder,
    declared,
    keys: keys.join(','),
  })
}

// ---- writing: a Workflow builder draft ----------------------------------------
//
// Workflows are edited on the web (#409). Inside a Workflow builder task's run, the draft it
// writes on the board takes a name, a copy of another workflow, or a new name; approving the
// task saves it.

type Write = { ok: boolean } & Partial<RunRefusal>

const save = (change: (block: Record<string, unknown>) => void): Write =>
  writeConfig((cfg) => {
    const block = configBlock(cfg.workflows)
    change(block)
    if (Object.keys(block).length === 0) delete cfg.workflows
    else cfg.workflows = block
  })

function writeDraft(def: WorkflowDef, settings?: (block: Record<string, unknown>) => void): Write {
  try {
    writeWorkflowDef(def)
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    return { ok: false, ...refusal('fileWrite', `couldn't write the "${def.name}" workflow: ${why}`, { path: def.id, details: why }) }
  }
  return settings ? save(settings) : { ok: true }
}

const draftDef = (id: string): WorkflowDef | undefined => boardWorkflowDefs().defs.find((d) => d.id === id)

const notFound = (id: string): Write => ({ ok: false, ...refusal('workflowNotFound', `this board has no \`${id}\` workflow`, { id }) })

const readOnly = (): Write => ({ ok: false, ...refusal('workflowReadOnly', 'Workflows are edited on the web.') })

const trimmedName = (name: string): string => name.replace(/\s+/g, ' ').trim()

// A number written onto the end of a name. No space after a Han, Kana or Hangul character:
// "软件开发2" is how that name is written and "Coding 2" is how this one is.
const nameTaken = (name: string, except = ''): boolean =>
  workflows().some((w) => w.id !== except && trimmedName(w.name).toLowerCase() === trimmedName(name).toLowerCase())

/** Rename the draft. */
export function renameWorkflow(id: string, name: string): Write {
  const draft = draftId()
  if (!draft) return readOnly()
  if (id !== draft) return { ok: false, ...refusal('workflowReadOnly', `only the draft, \`${draft}\`, is edited here; workflows are edited on the web`, { id }) }
  const wanted = trimmedName(name)
  if (!wanted) return { ok: false, ...refusal('workflowUnnamed', 'a workflow needs a name') }
  if (nameTaken(wanted, id)) return { ok: false, ...refusal('workflowTaken', `this workspace already has a workflow called "${wanted}"`, { name: wanted }) }
  const def = draftDef(id)
  return def ? writeDraft({ ...def, name: wanted }) : notFound(id)
}

// Refused when the agent belongs to another workflow (#1095).
function elsewhere(agent: string, id: string): Write | null {
  const owner = agentWorkflow(agent)
  if (!owner || owner === id) return null
  const name = workflowById(owner)?.name ?? owner
  return {
    ok: false,
    ...refusal('agentOtherWorkflow', `\`${agent}\` belongs to the "${name}" workflow — create a new agent here instead`, {
      agent,
      name,
      workflow: owner,
    }),
  }
}

/** Drop a deleted agent from the draft and the saved run state, so a later agent of the same
 *  name starts in no workflow. */
export function forgetWorkflowAgent(agent: string): Write {
  const id = draftId()
  const def = id ? draftDef(id) : undefined
  if (def) {
    const keep = (rows: WorkflowHelper[]) => rows.filter((h) => h.agent !== agent)
    try {
      writeWorkflowDef({ ...def, previews: keep(def.previews), land: keep(def.land), scheduled: def.scheduled.filter((s) => s.agent !== agent) })
    } catch {
      // Left listing it: an agent no board has drops out of every workflow it is read into.
    }
  }
  return save((block) => {
    const all = configBlock(block.stages)
    for (const [id, flow] of Object.entries(all)) {
      const mine = configBlock(flow)
      for (const [key, value] of Object.entries(mine)) {
        const one = configBlock(value)
        if (Array.isArray(one.helpers)) one.helpers = one.helpers.filter((h) => configBlock(h).agent !== agent)
        mine[key] = one
      }
      all[id] = mine
    }
    if (Object.keys(all).length) block.stages = all
  })
}

// ---- scheduled agents (#1401) -------------------------------------------------
//
// A workflow's scheduled agents run by themselves on a cadence, on no card. A Runner judges
// them by what Cloud keeps; the project's Agents page is where they are switched and timed.
// The rows here hold each one's extra requirements and when it last passed.

/** Every scheduled agent one workflow has, disabled ones included, minus any this board no
 *  longer has. */
export function scheduledMembers(flow: Workflow): WorkflowScheduled[] {
  const known = onBoard()
  return flow.scheduled.filter((h) => known.has(h.agent))
}

/** The agents a workflow's `WORKFLOW.md` lists as scheduled, minus any this board no longer
 *  has. What the board saved about them plays no part. */
export function listedScheduled(flow: Workflow): string[] {
  const def = (flow.builtIn ? builtinDefs() : boardWorkflowDefs().defs).find((d) => d.id === flow.id)
  const known = onBoard()
  return (def?.scheduled ?? []).map((s) => s.agent).filter((agent) => known.has(agent))
}

/** One scheduled agent of one workflow, or undefined when it has no such agent. */
export const scheduledAgent = (id: string, agent: string): WorkflowScheduled | undefined => {
  const flow = workflowById(id)
  return flow ? scheduledMembers(flow).find((h) => h.agent === canonicalSpecAgent(agent.trim())) : undefined
}

// The rows written are the ones this workflow owns, and `claim`, an agent only sitting here.
function setScheduled(id: string, change: (rows: WorkflowScheduled[]) => Write | void, claim = ''): Write {
  const flow = workflowById(id)
  if (!flow) return notFound(id)
  const rows = scheduledMembers(flow)
    .filter((h) => agentWorkflow(h.agent) === id || h.agent === claim)
    .map((h) => ({ ...h }))
  const refused = change(rows)
  if (refused) return refused
  return save((block) => {
    const stages = configBlock(block.stages)
    stages[id] = { ...configBlock(stages[id]), [SCHEDULE]: { helpers: rows.map(scheduledRow) } }
    block.stages = stages
  })
}

/** Record a pass that PASSED, by when it began. A failed or stopped one records nothing, so
 *  the agent is tried again a cadence later. */
export function stampScheduledRun(id: string, agent: string, startedAt: Date): boolean {
  return setScheduled(
    id,
    (rows) => {
      const one = rows.find((h) => h.agent === agent)
      if (!one) return { ok: false, error: '' }
      one.lastRun = formatStamp(startedAt)
    },
    agentWorkflow(agent) ? '' : agent,
  ).ok
}

/** Take in the agent a retired recurring card became (#1414), with the cadence and last pass
 *  the card carried. On only with a cadence; no `since`, so the cadence counts from that pass. */
export function adoptWorkflowScheduled(id: string, agent: string, from: { cadence: string; lastRun: string }): Write {
  const refused = elsewhere(agent, id)
  if (refused) return refused
  return setScheduled(id, (rows) => {
    const at = rows.findIndex((h) => h.agent === agent)
    if (at >= 0) rows.splice(at, 1)
    rows.push({
      agent,
      extra: '',
      ...(from.cadence ? {} : { off: true }),
      cadence: from.cadence || AUTO_CADENCE,
      lastRun: from.lastRun,
    })
  })
}

// ---- the workflow one card runs on -----------------------------------------

/** The id a card carries, straight off its file. Empty when the card is not there or carries
 *  no `workflow:` key. */
export const cardWorkflowId = (id: number): string => cardMeta(id)?.workflow ?? ''

/** A card's frontmatter, straight off its file, or null when it is not there. */
export function cardMeta(id: number): Meta | null {
  // Best-effort: read on the way into a prompt, and a folder that is not there means the card
  // names no workflow, never a run that cannot start.
  try {
    const found = locate(id) ?? locateArchived(id)
    if (!found) return null
    const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
    return parseFrontmatter(fs.readFileSync(file, 'utf8')).meta
  } catch {
    return null
  }
}

/** The workflow a card runs on, resolved; undefined when it has none this board knows. */
export const cardWorkflow = (id: number | null | undefined): Workflow | undefined =>
  workflowFor(typeof id === 'number' ? cardWorkflowId(id) : '')

/** A card's approvals (#2154): the previews it chose, staged by their `after`. */
export const cardStages = (meta: Pick<Meta, 'previews'> | null | undefined, flow: Workflow | undefined): string[][] =>
  previewStages(flow, meta?.previews ?? [])

/** The approval a card is on, 1-based: its `phase`, kept inside its stages. */
export const cardStage = (meta: Pick<Meta, 'phase' | 'previews'> | null | undefined, flow: Workflow | undefined): number =>
  Math.min(Math.max(meta?.phase || 1, 1), cardStages(meta, flow).length)

// ---- what a delivery freezes -----------------------------------------------

/** One workflow as a delivery keeps it: its id, its name right now, and its enabled previews
 *  and land agents with the extra requirements their assignments carry. Read once, when the
 *  delivery opens, so every run in it works to the same answer however the board's settings
 *  move underneath. Undefined for an id this board has no workflow for. */
export function frozenWorkflow(id: string): FrozenWorkflow | undefined {
  const flow = workflowFor(id)
  if (!flow) return undefined
  const row = (h: WorkflowHelper) => ({ agent: h.agent, extra: h.extra })
  return {
    id: flow.id,
    name: flow.name,
    needsArtifact: flow.needsArtifact,
    previews: previewAgents(flow).map(row),
    land: landAgents(flow).map(row),
  }
}
