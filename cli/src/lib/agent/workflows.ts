// The workflows a board runs, and the one place a card's own is read (#715).
//
// A workflow lists its agents in three groups (#2152): `previews`, whose work a person approves,
// each waiting on the approvals its `after` names (#2154); `land`, run in order once the last
// approval is in; and `scheduled`. Cards
// are written by the board's own planning, to the workflow's rules (its file's body and the
// user's rule for it); no agent leads a workflow.
//
// Every workflow is a `WORKFLOW.md` (./workflow-file.ts, #1890): the built-ins ship with the
// command and cannot be renamed or deleted, a board's own sit in `docs/kanban/workflows/`.
// What a board changes on a built-in — an agent switched off, what it is asked for here, an
// agent of its own added to its previews, a land a built-in ships empty (#1814) — stays in
// `ui.config.json` under `workflows`, over the file.
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
import { AUTO_CADENCE, CADENCE_FORMS, formatStamp, isAuto, parseCadence, parseStamp } from '../cadence'
import { safeConfig, configBlock, writeConfig } from './settings'
import { checkAgentKeys, specAgentCatalog, type AgentPlaces, type RefusedAgent } from '../agents/catalog'
import { canonicalSpecAgent } from '../spec-agent-names'
import { copyAgent, renameCopiedAfter } from '../agents/roster'
import {
  BUILTIN_DEFS,
  WORKFLOW_ID,
  boardWorkflowDefs,
  removeWorkflowDef,
  stagesOf,
  writeWorkflowDef,
  type WorkflowDef,
} from './workflow-file'
import { refusal, type FrozenWorkflow, type RunRefusal, type WorkflowHelper, type WorkflowScheduled } from './types'

export type { WorkflowHelper }

/** The roles a workflow may list under `land`: they run the build with no `AGENT.md`. */
export const LAND_ROLES = ['builder']

/** One workflow, resolved: the board's own changes over its file. */
export interface Workflow {
  /** What a card carries and a delivery freezes. Never changes. */
  id: string
  /** What it is called. A built-in's is its English name, which the screen drawing it
   *  translates; a board's own is the user's own words and is drawn as written. */
  name: string
  /** Whether the command ships it. A built-in cannot be renamed or deleted. */
  builtIn: boolean
  /** Whether its output is files rather than code (#715, #874) — the inverse of **Use a Git
   *  worktree**. Such a delivery works in the project with no branch and commits nothing. */
  needsArtifact: boolean
  /** Its preview agents, in order, disabled ones included. Read through `previewMembers`. */
  previews: WorkflowHelper[]
  /** What runs, in order, after the last approval. Read through `landAgents`. */
  land: WorkflowHelper[]
  /** Its scheduled agents (#1401), as written down. Read through `scheduledMembers`. */
  scheduled: WorkflowScheduled[]
  /** Its file's body: how a card on it is written. The user's own rule is `workflowRules`. */
  rules: string
}

/** The workflow a card with no `workflow:` key runs on — every card written before this
 *  existed, and every one created without a choice. */
export const DEFAULT_WORKFLOW = 'coding'

// ---- what the command ships ------------------------------------------------

const BUILTINS: WorkflowDef[] = BUILTIN_DEFS

/** The ids the command ships. */
export const BUILTIN_WORKFLOW_IDS: string[] = BUILTINS.map((w) => w.id)

/** Whether a workflow is one of the command's own — what refuses a rename and a delete. */
export const isBuiltinWorkflow = (id: string): boolean => BUILTIN_WORKFLOW_IDS.includes(id)

/** What a built-in is for. A board's own workflow has none. */
export const builtinDescription = (id: string): string | undefined => BUILTINS.find((w) => w.id === id)?.description

/** What a workflow is for: its own line, else its name. */
export function workflowPurpose(flow: Workflow): string {
  if (flow.builtIn) return builtinDescription(flow.id) || flow.name
  return boardWorkflowDefs().defs.find((d) => d.id === flow.id)?.description || flow.name
}

// ---- reading ---------------------------------------------------------------

// `ui.config.json`:
//
//   "workflows": {
//     "stages": {
//       "coding": { "previews": { "helpers": [...] }, "schedule": { "helpers": [...] } },
//       "video-clone": { "land": { "helpers": [...] } }
//     }
//   }
//
// `previews` and `land` are what the board changed on a built-in; `schedule` is every
// workflow's scheduled agents with their run state.

const workflowsBlock = (cfg: Record<string, unknown>): Record<string, unknown> => configBlock(cfg.workflows)

const storedStages = (cfg: Record<string, unknown>, id: string): Record<string, unknown> =>
  configBlock(configBlock(workflowsBlock(cfg).stages)[id])

const PREVIEWS = 'previews'
const LAND = 'land'
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

// A built-in is its file under what the board saved: a saved row changes that agent where the
// file has it, and an agent the file does not list joins its previews. A board's own is its
// file alone.
function resolveOne(cfg: Record<string, unknown>, def: WorkflowDef, builtIn: boolean): Workflow {
  const stored = storedStages(cfg, def.id)
  let previews = def.previews.map((h) => ({ ...h }))
  let land = def.land.map((h) => ({ ...h }))
  if (builtIn) {
    const saved = readRows(stored[PREVIEWS]) ?? []
    const listed = new Set(previews.map((h) => h.agent))
    previews = previews.map((h) => saved.find((s) => s.agent === h.agent) ?? h)
    previews.push(...saved.filter((s) => !listed.has(s.agent) && !land.some((h) => h.agent === s.agent)))
    if (!land.length) land = readRows(stored[LAND]) ?? []
  }
  return {
    id: def.id,
    name: def.name,
    builtIn,
    needsArtifact: def.needsArtifact,
    previews,
    land,
    scheduled:
      readScheduled(stored[SCHEDULE]) ??
      def.scheduled.map((one) => ({ agent: one.agent, extra: '', cadence: one.cadence ?? AUTO_CADENCE, lastRun: '' })),
    rules: def.rules,
  }
}

// ---- a board saved before rounds (#2152) -------------------------------------
//
// A built-in's saved plan hooks become its preview settings, and the lead a board gave a
// built-in's empty execute stage becomes its land. Everything else the stages held is
// dropped. One pass: the keys it moves are the keys it deletes.

const OLD_STAGE_KEYS = ['plan', 'execute']

const savedOldStages = (cfg: Record<string, unknown>): boolean =>
  Object.values(configBlock(workflowsBlock(cfg).stages)).some((flow) => OLD_STAGE_KEYS.some((key) => key in configBlock(flow)))

function foldOldStages(cfg: Record<string, unknown>): boolean {
  if (!savedOldStages(cfg)) return false
  const { ok } = writeConfig((raw) => {
    const block = configBlock(raw.workflows)
    const all = configBlock(block.stages)
    for (const [id, flow] of Object.entries(all)) {
      const mine = { ...configBlock(flow) }
      const plan = readRows(mine.plan)
      const lead = configBlock(mine.execute).lead
      delete mine.plan
      delete mine.execute
      if (plan && isBuiltinWorkflow(id)) mine[PREVIEWS] = { helpers: plan.map(toRow) }
      if (typeof lead === 'string' && lead.trim() && isBuiltinWorkflow(id) && !BUILTINS.find((w) => w.id === id)!.land.length) {
        mine[LAND] = { helpers: [{ agent: canonicalSpecAgent(lead), extra: '' }] }
      }
      if (Object.keys(mine).length) all[id] = mine
      else delete all[id]
    }
    if (Object.keys(all).length) block.stages = all
    else delete block.stages
    for (const key of ['added', 'agentsOwned', 'shipped', 'qaScheduled']) delete block[key]
    if (Object.keys(block).length) raw.workflows = block
    else delete raw.workflows
  })
  return ok
}

// The workflows as written down, with the file each came from.
function writtenWorkflows(): Workflow[] {
  let cfg = safeConfig()
  if (foldOldStages(cfg)) cfg = safeConfig()
  return [...BUILTINS.map((def) => resolveOne(cfg, def, true)), ...boardWorkflowDefs().defs.map((def) => resolveOne(cfg, def, false))]
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
// in Coding, off and nobody's, both among its previews and its scheduled agents: switching
// it on either way makes it Coding's.
const resolved = memoByFiles(
  () => [UI_CONFIG, LEGACY_UI_CONFIG, WORKFLOWS, AGENTS, LEGACY_AGENTS],
  (): Resolved => {
    const flows = writtenWorkflows()
    const catalog = specAgentCatalog().agents
    const known = new Set(catalog.map((a) => a.name))
    const owners = new Map<string, string>()
    for (const flow of flows) {
      for (const { agent } of allListed(flow)) if (known.has(agent) && !owners.has(agent)) owners.set(agent, flow.id)
    }
    const coding = flows.find((w) => w.id === DEFAULT_WORKFLOW)
    if (coding) {
      const idle = catalog.filter((a) => !owners.has(a.name))
      if (idle.length) {
        const previews = idle.map((a) => ({ agent: a.name, extra: '', off: true }))
        coding.previews = [...coding.previews, ...previews]
        coding.scheduled = [...coding.scheduled, ...idle.map((a) => ({ agent: a.name, extra: '', off: true, cadence: AUTO_CADENCE, lastRun: '' }))]
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

/** The workflow a card runs on, from the id it carries. A card with no id, and one naming a
 *  workflow this board no longer has, both run on the default — a card is never left without
 *  a workflow, and `workflowDeleted` is what a caller asks when the difference matters. */
export function workflowFor(id: string | undefined): Workflow | undefined {
  const wanted = (id ?? '').trim()
  return (wanted ? workflowById(wanted) : undefined) ?? workflowById(DEFAULT_WORKFLOW)
}

/** The project agents one of the board's own workflows owns — what deleting it deletes
 *  (#1248). Never a role, a bundled agent, or one another workflow owns. */
export function workflowOwnAgents(id: string): string[] {
  const { flows, owners } = resolved()
  const flow = flows.find((w) => w.id === id)
  if (!flow || flow.builtIn) return []
  const own = new Set(specAgentCatalog().agents.filter((a) => !a.builtIn && a.dir).map((a) => a.name))
  return [...new Set(allListed(flow).map((h) => h.agent))].filter((name) => own.has(name) && owners.get(name) === id)
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
export function workflowRules(flow: Workflow): string {
  let own = ''
  try {
    own = fs.readFileSync(workflowRuleFile(flow.id), 'utf8').trim()
  } catch {
    // None written.
  }
  return [flow.rules.trim(), own].filter(Boolean).join('\n\n')
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
    if (LAND_ROLES.includes(agent) || known.has(agent)) continue
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
    file: `${found.file} has an error — \`akb spec\` says which`,
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

// ---- writing ---------------------------------------------------------------

type Write = { ok: boolean } & Partial<RunRefusal>

const save = (change: (block: Record<string, unknown>) => void): Write =>
  writeConfig((cfg) => {
    const block = configBlock(cfg.workflows)
    change(block)
    if (Object.keys(block).length === 0) delete cfg.workflows
    else cfg.workflows = block
  })

// Write one of the board's own to its file, then the settings when there is more to save.
function writeOwn(def: WorkflowDef, settings?: (block: Record<string, unknown>) => void): Write {
  try {
    writeWorkflowDef(def)
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    return { ok: false, ...refusal('fileWrite', `couldn't write the "${def.name}" workflow: ${why}`, { path: def.id, details: why }) }
  }
  return settings ? save(settings) : { ok: true }
}

const ownDef = (id: string): WorkflowDef | undefined => boardWorkflowDefs().defs.find((d) => d.id === id)

const notFound = (id: string): Write => ({ ok: false, ...refusal('workflowNotFound', `this board has no \`${id}\` workflow`, { id }) })

const trimmedName = (name: string): string => name.replace(/\s+/g, ' ').trim()

// A number written onto the end of a name. No space after a Han, Kana or Hangul character:
// "软件开发2" is how that name is written and "Coding 2" is how this one is.
const numbered = (base: string, n: number): string =>
  /[぀-ヿ㐀-䶿一-鿿가-힯豈-﫿]$/.test(base) ? `${base}${n}` : `${base} ${n}`

/** The name a duplicate gets: the original with the next free number after it, so a second
 *  copy of `Coding` is `Coding 2` and a third is `Coding 3`. */
export function freeName(wanted: string, taken: string[]): string {
  const base = trimmedName(wanted).replace(/\s*\d+$/, '') || wanted
  const used = new Set(taken.map((n) => trimmedName(n)))
  if (!used.has(trimmedName(wanted))) return trimmedName(wanted)
  for (let n = 2; ; n++) {
    const tried = numbered(base, n)
    if (!used.has(tried)) return tried
  }
}

const freeId = (taken: string[]): string => {
  for (let n = 2; ; n++) {
    const id = `wf-${n}`
    if (!taken.includes(id)) return id
  }
}

const nameTaken = (name: string, except = ''): boolean =>
  workflows().some((w) => w.id !== except && trimmedName(w.name).toLowerCase() === trimmedName(name).toLowerCase())

/** Add a workflow of this board's own, with no agents and no worktree (#874). */
export function createWorkflow(name: string): Write & { id?: string; name?: string } {
  const wanted = trimmedName(name)
  if (!wanted) return { ok: false, ...refusal('workflowUnnamed', 'a workflow needs a name') }
  if (nameTaken(wanted)) return { ok: false, ...refusal('workflowTaken', `this board already has a workflow called "${wanted}"`, { name: wanted }) }
  const id = freeId(workflows().map((w) => w.id))
  const res = writeOwn({ id, name: wanted, description: '', needsArtifact: true, previews: [], land: [], scheduled: [], rules: '' })
  return res.ok ? { ok: true, id, name: wanted } : res
}

/** Copy one workflow under a free name. Every agent in it but a role is copied too (#1095),
 *  enabled or not and with its extra requirements, so the two never share one. The copy is
 *  the board's own whatever it was copied from, so it can be renamed and deleted. */
export function duplicateWorkflow(id: string, called?: string): Write & { id?: string; name?: string } {
  const flow = workflowById(id)
  if (!flow) return notFound(id)
  // A built-in's name is the English the command ships, drawn in the reader's own words; the
  // copy takes those words, and the name it was copied from counts as taken.
  const base = trimmedName(called ?? '') || flow.name
  const name = freeName(base, [...workflows().map((w) => w.name), base])
  const copy = freeId(workflows().map((w) => w.id))
  const known = onBoard()
  const taken = new Set<string>()
  const copied = new Map<string, string>()
  const own = (agent: string): string => {
    if (!known.has(agent)) return agent
    if (!copied.has(agent)) {
      const made = copyAgent(agent, taken)
      copied.set(agent, made.ok && made.agent ? made.agent : agent)
    }
    return copied.get(agent)!
  }
  const each = (rows: WorkflowHelper[]) => rows.map((h) => ({ ...h, agent: own(h.agent) }))
  const previews = each(previewMembers(flow))
  const land = each(flow.land)
  // Its scheduled agents come too (#1401), counting from the copy rather than the original's last pass.
  const scheduled = scheduledMembers(flow).map((h) => scheduledRow({ ...h, agent: own(h.agent), lastRun: '', since: formatStamp(new Date()) }))
  const res = writeOwn(
    {
      id: copy,
      name,
      description: flow.builtIn ? '' : (ownDef(flow.id)?.description ?? ''),
      needsArtifact: flow.needsArtifact,
      previews,
      land,
      scheduled: scheduled.map((h) => ({ agent: h.agent, ...(h.cadence ? { cadence: h.cadence } : {}) })),
      rules: flow.rules,
    },
    scheduled.length
      ? (block) => {
          block.stages = { ...configBlock(block.stages), [copy]: { [SCHEDULE]: { helpers: scheduled } } }
        }
      : undefined,
  )
  if (res.ok) renameCopiedAfter(copied)
  return res.ok ? { ok: true, id: copy, name } : res
}

/** Rename one of the board's own. The id does not move, so every card and every finished
 *  delivery pointing at it keeps pointing at it. */
export function renameWorkflow(id: string, name: string): Write {
  const flow = workflowById(id)
  if (!flow) return notFound(id)
  if (flow.builtIn) return { ok: false, ...refusal('workflowBuiltInRename', `\`${flow.name}\` is built in — duplicate it to make one you can rename`, { name: flow.name, workflow: flow.id }) }
  const wanted = trimmedName(name)
  if (!wanted) return { ok: false, ...refusal('workflowUnnamed', 'a workflow needs a name') }
  if (nameTaken(wanted, id)) return { ok: false, ...refusal('workflowTaken', `this board already has a workflow called "${wanted}"`, { name: wanted }) }
  const def = ownDef(id)
  return def ? writeOwn({ ...def, name: wanted }) : notFound(id)
}

/** Turn **Use a Git worktree** on or off for one of the board's own (#874). Only deliveries
 *  started afterwards follow it. */
export function setWorkflowWorktree(id: string, on: boolean): Write {
  const flow = workflowById(id)
  if (!flow) return notFound(id)
  if (flow.builtIn) return { ok: false, ...refusal('workflowBuiltInChange', `\`${flow.name}\` is built in — duplicate it to make one you can change`, { name: flow.name, workflow: flow.id }) }
  const def = ownDef(id)
  return def ? writeOwn({ ...def, needsArtifact: !on }) : notFound(id)
}

/** Drop one of the board's own, with what the settings kept for it. Whoever calls this checks
 *  first that no open card still runs on it. */
export function deleteWorkflow(id: string): Write {
  const flow = workflowById(id)
  if (!flow) return notFound(id)
  if (flow.builtIn) return { ok: false, ...refusal('workflowBuiltInDelete', `\`${flow.name}\` is built in and cannot be deleted`, { name: flow.name, workflow: flow.id }) }
  try {
    removeWorkflowDef(id)
    fs.rmSync(workflowRuleFile(id), { force: true })
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    return { ok: false, ...refusal('fileWrite', `couldn't delete the "${flow.name}" workflow: ${why}`, { path: id, details: why }) }
  }
  return save((block) => {
    const stages = configBlock(block.stages)
    delete stages[id]
    if (Object.keys(stages).length) block.stages = stages
    else delete block.stages
  })
}

// Write one workflow's previews and land: a board's own to its file, a built-in's rows to the
// settings — every row, so an agent the board added keeps its place.
function setAgents(id: string, change: (previews: WorkflowHelper[], land: WorkflowHelper[]) => void): Write {
  const flow = workflowById(id)
  if (!flow) return notFound(id)
  const mine = (h: WorkflowHelper) => agentWorkflow(h.agent) === id || !onBoard().has(h.agent)
  const previews = previewMembers(flow).filter(mine).map((h) => ({ ...h }))
  const land = flow.land.map((h) => ({ ...h }))
  change(previews, land)
  if (!flow.builtIn) {
    const def = ownDef(id)
    return def ? writeOwn({ ...def, previews, land }) : notFound(id)
  }
  const fileLand = BUILTINS.find((w) => w.id === id)!.land.length > 0
  return save((block) => {
    const stages = configBlock(block.stages)
    const mine: Record<string, unknown> = { ...configBlock(stages[id]), [PREVIEWS]: { helpers: previews.map(toRow) } }
    if (!fileLand && land.length) mine[LAND] = { helpers: land.map(toRow) }
    stages[id] = mine
    block.stages = stages
  })
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

// An agent no workflow lists only SITS in Coding (`resolved`), so it is listed nowhere.
const listedHere = (flow: Workflow, agent: string): boolean =>
  agentWorkflow(agent) === flow.id &&
  [...previewMembers(flow), ...flow.land].some((h) => h.agent === agent)

/** Enable or disable one of a workflow's previews or land agents (#1095). An agent no workflow
 *  lists joins the end of this one's previews; one another workflow lists is refused. */
export function switchWorkflowAgent(id: string, agent: string, on: boolean): Write {
  const wanted = canonicalSpecAgent(agent.trim())
  const flow = workflowById(id)
  if (!flow) return notFound(id)
  if (!listedHere(flow, wanted)) {
    if (!onBoard().has(wanted)) return { ok: false, ...refusal('agentNotFound', `this board has no \`${wanted}\` agent`, { agent: wanted }) }
    if (agentWorkflow(wanted) === id && flow.scheduled.some((h) => h.agent === wanted)) {
      return { ok: false, ...refusal('agentNotListed', `\`${wanted}\` is a scheduled agent of "${flow.name}" — switch it with \`akb workflow schedule\``, { agent: wanted, name: flow.name, workflow: flow.id }) }
    }
    const refused = elsewhere(wanted, id)
    if (refused) return refused
  }
  return setAgents(id, (previews, land) => {
    const one = listedHere(flow, wanted) ? [...previews, ...land].find((h) => h.agent === wanted) : undefined
    if (one) {
      if (on) delete one.off
      else one.off = true
      return
    }
    previews.push({ agent: wanted, extra: '', ...(on ? {} : { off: true }) })
  })
}

/** What this workflow asks of one of its previews or land agents on top of its own
 *  instructions. Empty clears it. */
export function setWorkflowAgentExtra(id: string, agent: string, extra: string): Write {
  const wanted = canonicalSpecAgent(agent.trim())
  const flow = workflowById(id)
  if (!flow) return notFound(id)
  if (!listedHere(flow, wanted)) {
    return { ok: false, ...refusal('agentNotListed', `\`${wanted}\` is not one of the "${flow.name}" workflow's agents`, { agent: wanted, name: flow.name, workflow: flow.id }) }
  }
  return setAgents(id, (previews, land) => {
    const one = [...previews, ...land].find((h) => h.agent === wanted)!
    one.extra = extra
  })
}

/** Drop a deleted agent from every workflow that lists it, so a later agent of the same name
 *  starts in no workflow. */
export function forgetWorkflowAgent(agent: string): Write {
  for (const def of boardWorkflowDefs().defs) {
    const keep = (rows: WorkflowHelper[]) => rows.filter((h) => h.agent !== agent)
    const previews = keep(def.previews)
    const land = keep(def.land)
    const scheduled = def.scheduled.filter((s) => s.agent !== agent)
    if (previews.length === def.previews.length && land.length === def.land.length && scheduled.length === def.scheduled.length) continue
    try {
      writeWorkflowDef({ ...def, previews, land, scheduled })
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
// A workflow's scheduled agents run by themselves on a cadence, on no card. They are only
// switched; the cadence, the extra requirements and when each last passed are kept with the
// assignment.

/** Every scheduled agent one workflow has, disabled ones included, minus any this board no
 *  longer has. */
export function scheduledMembers(flow: Workflow): WorkflowScheduled[] {
  const known = onBoard()
  return flow.scheduled.filter((h) => known.has(h.agent))
}

/** One scheduled agent of one workflow, or undefined when it has no such agent. */
export const scheduledAgent = (id: string, agent: string): WorkflowScheduled | undefined => {
  const flow = workflowById(id)
  return flow ? scheduledMembers(flow).find((h) => h.agent === canonicalSpecAgent(agent.trim())) : undefined
}

/** The workflow listing this agent among its scheduled agents, or undefined when none does. */
export const scheduledWorkflow = (agent: string): Workflow | undefined => {
  const name = canonicalSpecAgent(agent.trim())
  return workflows().find((flow) => scheduledMembers(flow).some((h) => h.agent === name))
}

/** The stamp one scheduled agent's cadence counts from: the later of its last pass and the
 *  moment it was first looked at or switched on. Empty when it has neither yet. */
export const scheduledClock = (one: WorkflowScheduled): string =>
  [one.lastRun, one.since ?? ''].filter((stamp) => parseStamp(stamp)).sort().pop() ?? ''

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

const notScheduled = (agent: string, flow: Workflow): Write => ({
  ok: false,
  ...refusal('agentNotScheduled', `\`${agent}\` is not a scheduled agent of "${flow.name}"`, { agent, name: flow.name, workflow: flow.id }),
})

/** Switch one scheduled agent on or off. One no workflow lists is taken into this one; one
 *  another workflow lists is refused. Switching it on counts its cadence from now, so it
 *  never runs in the moment it was enabled. */
export function switchWorkflowScheduled(id: string, agent: string, on: boolean, now: Date = new Date()): Write {
  const wanted = canonicalSpecAgent(agent.trim())
  return setScheduled(id, (rows) => {
    let one = agentWorkflow(wanted) === id ? rows.find((h) => h.agent === wanted) : undefined
    if (!one) {
      if (!onBoard().has(wanted)) return { ok: false, ...refusal('agentNotFound', `this board has no \`${wanted}\` agent`, { agent: wanted }) }
      const flow = workflowById(id)!
      if (listedHere(flow, wanted)) return notScheduled(wanted, flow)
      const refused = elsewhere(wanted, id)
      if (refused) return refused
      one = { agent: wanted, extra: '', off: true, cadence: AUTO_CADENCE, lastRun: '' }
      rows.push(one)
    }
    if (!on) one.off = true
    else if (one.off) {
      delete one.off
      one.since = formatStamp(now)
    }
  })
}

/** Set how often one scheduled agent runs, or `auto` to leave it to the board (#1475). */
export function setWorkflowScheduledCadence(id: string, agent: string, cadence: string): Write {
  const wanted = canonicalSpecAgent(agent.trim())
  const said = cadence.trim()
  const next = !said || isAuto(said) ? AUTO_CADENCE : said
  if (!isAuto(next) && !parseCadence(next)) {
    const formats = `${AUTO_CADENCE}, or ${CADENCE_FORMS}`
    return { ok: false, ...refusal('cadence', `"${next}" isn't a cadence — use ${formats}`, { cadence: next, formats }) }
  }
  return setScheduled(id, (rows) => {
    const one = rows.find((h) => h.agent === wanted)
    if (!one) return notScheduled(wanted, workflowById(id)!)
    one.cadence = next
  })
}

/** What this workflow asks of one scheduled agent on top of its own instructions. */
export function setWorkflowScheduledExtra(id: string, agent: string, extra: string): Write {
  const wanted = canonicalSpecAgent(agent.trim())
  return setScheduled(id, (rows) => {
    const one = rows.find((h) => h.agent === wanted)
    if (!one) return notScheduled(wanted, workflowById(id)!)
    one.extra = extra
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

/** The id a card carries, straight off its file. Empty when the card is not there, carries
 *  no `workflow:` key, or is archived — the caller resolves that to the default. */
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

/** The workflow a card runs on, resolved. A card naming a workflow this board no longer has
 *  runs on the default rather than on nothing. */
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
