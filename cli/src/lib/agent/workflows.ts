// The workflows a board runs, and the one place a card's own is read (#715).
//
// A board used to be ONE kind of work: `solution` in its `config.md` said whether its cards
// were code or content, and every card on it got that answer. A workflow moves the choice
// onto the card. One board plans a feature and a newsletter side by side, each through its
// own `plan → execute → review`, and the card says which.
//
// Three stages, always the same three. This is not a flow editor: a workflow says WHO runs
// each of the three and who they may call in, and nothing about the order — a review that
// fails goes back to execute, the way it always has.
//
// Two workflows ship with the command and neither can be renamed or deleted: `coding`, what
// every board did before this file, and `content`, the same three stages led by the content
// agents. A board adds its own, and every one of them — built-in included — keeps its
// assignments in `ui.config.json` under `workflows`. A built-in's unset stage falls back to
// the defaults below; a stage deliberately cleared does not.
//
// The id is what a card carries and what a delivery freezes. It never changes: renaming a
// workflow rewrites its name and nothing else, so no card and no finished delivery is
// orphaned by it.

import fs from 'node:fs'
import path from 'node:path'

import { locate, locateArchived } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { readConfigRaw, safeConfig, configBlock, writeConfig } from './settings'
import { agentRoster, type RosterEntry } from './roles'
import {
  WORKFLOW_STAGES,
  type FrozenWorkflow,
  type WorkflowCandidate,
  type WorkflowHelper,
  type WorkflowStage,
  type WorkflowStageView,
  type WorkflowView,
} from './types'
import { solution } from '../solution'

// The three stages, the shape of one assignment, and the shape a screen draws are all in
// ./types.ts — the one module the board UI keeps a copy of, so the pane names them without a
// second set of shapes drifting out of step.
export { WORKFLOW_STAGES }
export type { WorkflowCandidate, WorkflowHelper, WorkflowStage, WorkflowStageView, WorkflowView }

/** Who runs one stage of one workflow. Exactly one lead, and any number of helpers the lead
 *  may call in when its own instructions say to. An empty `lead` is a stage nobody runs, and
 *  a delivery refuses to start on one. */
export interface WorkflowStageSetup {
  lead: string
  helpers: WorkflowHelper[]
  /** Whether the board has chosen these helpers, as opposed to inheriting the workflow's
   *  own default. It is the difference between a stage nobody has touched and one somebody
   *  deliberately emptied — and, on the coding plan stage, between "every specialist this
   *  board has" and "these ones". Read through `stageHelpers`, never straight. */
  helpersChosen: boolean
}

/** One workflow, resolved: the board's own assignments over its defaults. */
export interface Workflow {
  /** What a card carries and a delivery freezes. Never changes. */
  id: string
  /** What it is called. A built-in's is its English name, which the screen drawing it
   *  translates; a board's own is the user's own words and is drawn as written. */
  name: string
  /** Whether the command ships it. A built-in cannot be renamed or deleted. */
  builtIn: boolean
  /** Whether the execute stage has to leave a FILE behind (#715). On a coding workflow a
   *  delivery whose tree ends identical to its base is finished — the change was already
   *  there. On a content one it is not: the piece IS the deliverable, so a delivery that
   *  wrote nothing has produced nothing, and it stops unfinished saying so.
   *
   *  A copy of a workflow carries it, because a copy of the content workflow is still a
   *  workflow whose stages produce writing. */
  needsArtifact: boolean
  stages: Record<WorkflowStage, WorkflowStageSetup>
}

/** The workflow a card with no `workflow:` key runs on — every card written before this
 *  existed, and every one created without a choice. */
export const DEFAULT_WORKFLOW = 'coding'

/** What a workflow may be called on disk: the same shape an agent's name takes. */
const WORKFLOW_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/

const emptyStages = (): Record<WorkflowStage, WorkflowStageSetup> => ({
  plan: { lead: '', helpers: [], helpersChosen: false },
  execute: { lead: '', helpers: [], helpersChosen: false },
  review: { lead: '', helpers: [], helpersChosen: false },
})

// ---- what the command ships ------------------------------------------------

/** What a built-in stage offers as helpers until the board chooses. `every` means every
 *  agent on the board that declares this stage — the two specialists the command ships, and
 *  every one a project adds afterwards. It is what a card's planning always offered, so a
 *  board upgrading into workflows keeps every specialist it had. */
type BuiltinHelpers = 'every' | string[]

interface BuiltinWorkflow {
  id: string
  name: string
  needsArtifact?: boolean
  stages: Record<WorkflowStage, { lead: string; helpers: BuiltinHelpers }>
}

// `coding` is what every board did before workflows existed, written down. Its two planning
// helpers are the specialists the command ships — each joins only when its own applicability
// says so, which is why neither is required.
//
// `content` is the same three stages led by the content agents (./roles.ts). It shares the
// board's planning and building memory rather than starting a second set: a board that
// remembers its decisions in two places is a board whose pruner can only read half of them.
const BUILTINS: BuiltinWorkflow[] = [
  {
    id: 'coding',
    name: 'Coding',
    stages: {
      plan: { lead: 'planner', helpers: 'every' },
      execute: { lead: 'builder', helpers: [] },
      review: { lead: 'reviewer', helpers: [] },
    },
  },
  {
    id: 'content',
    name: 'Content creation',
    needsArtifact: true,
    stages: {
      plan: { lead: 'content-planner', helpers: [] },
      execute: { lead: 'content-writer', helpers: [] },
      review: { lead: 'content-reviewer', helpers: [] },
    },
  },
]

/** The ids the command ships. */
export const BUILTIN_WORKFLOW_IDS: string[] = BUILTINS.map((w) => w.id)

/** Whether a workflow is one of the command's own — what refuses a rename and a delete. */
export const isBuiltinWorkflow = (id: string): boolean => BUILTIN_WORKFLOW_IDS.includes(id)

/** Whether this board picks workflows at all. A marketing board keeps the path it has until
 *  its own card retires it (#718): its cards are topics, its flows are the writer's, and a
 *  workflow list there would offer work it cannot do. */
export const workflowsHere = (): boolean => solution() !== 'marketing'

// ---- reading ---------------------------------------------------------------

// `ui.config.json`:
//
//   "workflows": {
//     "added": [ { "id": "wf-2", "name": "Weekly newsletter" } ],
//     "stages": {
//       "coding": { "plan": { "lead": "product-planner", "helpers": [...] } }
//     }
//   }
//
// `added` is the board's own workflows, in the order they were made. `stages` is every
// assignment the board has changed, built-in and added alike — a key that isn't there means
// "whatever the built-in says", and on an added workflow there is nothing to fall back to.

interface StoredHelper {
  agent: string
  extra?: string
}

const workflowsBlock = (cfg: Record<string, unknown>): Record<string, unknown> => configBlock(cfg.workflows)

const addedRows = (cfg: Record<string, unknown>): { id: string; name: string; needsArtifact: boolean }[] => {
  const raw = workflowsBlock(cfg).added
  if (!Array.isArray(raw)) return []
  const rows: { id: string; name: string; needsArtifact: boolean }[] = []
  for (const entry of raw) {
    const row = configBlock(entry)
    const id = typeof row.id === 'string' ? row.id.trim() : ''
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (!id || !WORKFLOW_ID.test(id) || isBuiltinWorkflow(id)) continue
    if (rows.some((r) => r.id === id)) continue
    rows.push({ id, name, needsArtifact: row.needsArtifact === true })
  }
  return rows
}

const storedStages = (cfg: Record<string, unknown>, id: string): Record<string, unknown> =>
  configBlock(configBlock(workflowsBlock(cfg).stages)[id])

// One stage as the config holds it. `lead` present and empty is a stage somebody cleared on
// purpose, so it is kept apart from a stage nobody has touched.
function readStage(raw: unknown): { lead?: string; helpers?: WorkflowHelper[] } {
  const box = configBlock(raw)
  const out: { lead?: string; helpers?: WorkflowHelper[] } = {}
  if (typeof box.lead === 'string') out.lead = box.lead.trim()
  if (Array.isArray(box.helpers)) {
    const helpers: WorkflowHelper[] = []
    for (const entry of box.helpers) {
      const row = configBlock(entry) as StoredHelper & Record<string, unknown>
      const agent = typeof row.agent === 'string' ? row.agent.trim() : ''
      if (!agent || helpers.some((h) => h.agent === agent)) continue
      helpers.push({ agent, extra: typeof row.extra === 'string' ? row.extra : '' })
    }
    out.helpers = helpers
  }
  return out
}

function resolveOne(
  cfg: Record<string, unknown>,
  id: string,
  name: string,
  builtIn: boolean,
  needsArtifact = false,
): Workflow {
  const base = BUILTINS.find((w) => w.id === id)
  const stages = emptyStages()
  for (const stage of WORKFLOW_STAGES) {
    const declared = base?.stages[stage].helpers
    const fallback = {
      lead: base ? base.stages[stage].lead : '',
      helpers: Array.isArray(declared) ? declared.map((agent) => ({ agent, extra: '' })) : ([] as WorkflowHelper[]),
    }
    const saved = readStage(storedStages(cfg, id)[stage])
    stages[stage] = {
      lead: saved.lead !== undefined ? saved.lead : fallback.lead,
      helpers: saved.helpers !== undefined ? saved.helpers : fallback.helpers,
      helpersChosen: saved.helpers !== undefined,
    }
  }
  return { id, name, builtIn, needsArtifact: base?.needsArtifact ?? needsArtifact, stages }
}

/** Every workflow this board has, built-ins first and then its own in the order they were
 *  made. Empty where a board picks no workflows at all. */
export function workflows(): Workflow[] {
  if (!workflowsHere()) return []
  const cfg = safeConfig()
  return [
    ...BUILTINS.map((w) => resolveOne(cfg, w.id, w.name, true)),
    ...addedRows(cfg).map((row) => resolveOne(cfg, row.id, row.name, false, row.needsArtifact)),
  ]
}

/** One workflow by id, or undefined when this board has no such workflow. */
export const workflowById = (id: string): Workflow | undefined => workflows().find((w) => w.id === id)

/** The workflow a card runs on, from the id it carries. A card with no id, and one naming a
 *  workflow this board no longer has, both run on the default — a card is never left without
 *  a workflow, and `workflowKnown` is what a caller asks when the difference matters. */
export function workflowFor(id: string | undefined): Workflow | undefined {
  const wanted = (id ?? '').trim()
  return (wanted ? workflowById(wanted) : undefined) ?? workflowById(DEFAULT_WORKFLOW)
}

/** Whether this board has the workflow a card names. False on a card pointing at one that
 *  was deleted — the card still builds, on the default, and whoever asked is told. */
export const workflowKnown = (id: string): boolean => !id || workflows().some((w) => w.id === id)

// ---- who may take a stage --------------------------------------------------

/** The agents that may lead or help one stage — every agent on the roster that declares this
 *  stage, in the roster's own order. What the pickers offer, and what an assignment is
 *  checked against. */
export const stageCandidates = (stage: WorkflowStage): RosterEntry[] =>
  agentRoster().filter((entry) => entry.stage === stage)

/** Every reason one workflow cannot start a card. Empty when all three stages have a lead
 *  this board answers to. A helper that no longer resolves is NOT a reason: it is dropped
 *  from the assignment instead, because a delivery that cannot start over an optional agent
 *  is a delivery held up by nothing. */
export function workflowProblems(id: string): string[] {
  const flow = workflowById(id)
  if (!flow) return [`this board has no \`${id}\` workflow.`]
  const roster = agentRoster()
  const problems: string[] = []
  for (const stage of WORKFLOW_STAGES) {
    const { lead } = flow.stages[stage]
    if (!lead) {
      problems.push(`\`${flow.name}\` has no agent leading its ${stage} stage — assign one before it can run.`)
      continue
    }
    const found = roster.find((entry) => entry.name === lead)
    if (!found) {
      problems.push(`\`${flow.name}\` has \`${lead}\` leading its ${stage} stage, and this board has no such agent.`)
      continue
    }
    if (found.stage !== stage) {
      problems.push(`\`${flow.name}\` has \`${lead}\` leading its ${stage} stage, and \`${lead}\` is a ${found.stage} agent.`)
    }
  }
  return problems
}

/** The helpers one stage of one workflow actually offers.
 *
 *  A stage the board has chosen for offers exactly what it was given, minus anything this
 *  board no longer has. One it has NOT chosen for offers the workflow's own default, which
 *  on the coding plan stage is every agent on the board that declares the plan stage — so a
 *  specialist a project adds is offered without anyone having to assign it, exactly as it was
 *  before workflows existed.
 *
 *  Never read from anything that BUILDS the roster: this asks the roster for itself. */
export function stageHelpers(flow: Workflow, stage: WorkflowStage): WorkflowHelper[] {
  const roster = agentRoster()
  const setup = flow.stages[stage]
  const inherits = !setup.helpersChosen && BUILTINS.find((w) => w.id === flow.id)?.stages[stage].helpers === 'every'
  if (inherits) {
    return roster
      .filter((entry) => entry.stage === stage && entry.kind !== 'role' && entry.name !== setup.lead)
      .map((entry) => ({ agent: entry.name, extra: '' }))
  }
  const names = new Set(roster.map((entry) => entry.name))
  return setup.helpers.filter((h) => names.has(h.agent))
}

/** One stage's setup as a run and a freeze read it: its lead exactly as assigned, and the
 *  helpers it actually offers. The lead is never filtered — a lead nobody answers to is an
 *  error somebody has to see, not a stage that quietly runs as somebody else. */
export const liveStage = (flow: Workflow, stage: WorkflowStage): WorkflowStageSetup => ({
  lead: flow.stages[stage].lead,
  helpers: stageHelpers(flow, stage),
  helpersChosen: flow.stages[stage].helpersChosen,
})

// ---- writing ---------------------------------------------------------------

type Write = { ok: boolean; error?: string }

const save = (change: (block: Record<string, unknown>) => void): Write =>
  writeConfig((cfg) => {
    const block = configBlock(cfg.workflows)
    change(block)
    if (Object.keys(block).length === 0) delete cfg.workflows
    else cfg.workflows = block
  })

const trimmedName = (name: string): string => name.replace(/\s+/g, ' ').trim()

// A number written onto the end of a name. No space after a Han, Kana or Hangul character:
// "软件开发2" is how that name is written and "Coding 2" is how this one is, and a name a
// duplicate gets is read before it is anything else.
const numbered = (base: string, n: number): string =>
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff]$/.test(base) ? `${base}${n}` : `${base} ${n}`

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

/** Add a workflow of this board's own, with all three stages empty. The name is the user's
 *  own words; an empty one is refused here rather than saved as a workflow with no name. */
export function createWorkflow(name: string): Write & { id?: string; name?: string } {
  if (!workflowsHere()) return { ok: false, error: 'this board does not pick workflows' }
  const wanted = trimmedName(name)
  if (!wanted) return { ok: false, error: 'a workflow needs a name' }
  if (nameTaken(wanted)) return { ok: false, error: `this board already has a workflow called "${wanted}"` }
  const id = freeId(workflows().map((w) => w.id))
  const res = save((block) => {
    const added = Array.isArray(block.added) ? [...block.added] : []
    added.push({ id, name: wanted })
    block.added = added
  })
  return res.ok ? { ok: true, id, name: wanted } : res
}

/** Copy one workflow, assignments and extra requirements and all, under a free name. The
 *  copy is the board's own whatever it was copied from, so it can be renamed and deleted. */
export function duplicateWorkflow(id: string, called?: string): Write & { id?: string; name?: string } {
  const flow = workflowById(id)
  if (!flow) return { ok: false, error: `this board has no \`${id}\` workflow` }
  // What it is CALLED where the copy was asked for: a built-in's name is the English the
  // command ships, and the screen draws it in the reader's own words. The copy takes those
  // words, and the name it was copied from counts as taken so the first copy is numbered.
  const base = trimmedName(called ?? '') || flow.name
  const name = freeName(base, [...workflows().map((w) => w.name), base])
  const copy = freeId(workflows().map((w) => w.id))
  const res = save((block) => {
    const added = Array.isArray(block.added) ? [...block.added] : []
    added.push({ id: copy, name, ...(flow.needsArtifact ? { needsArtifact: true } : {}) })
    block.added = added
    const stages = configBlock(block.stages)
    // The assignments as they RESOLVE, not as they are saved: a stage still inheriting its
    // workflow's default has nothing saved, and a copy that took the saved nothing would open
    // with the helpers its original was offering silently gone.
    stages[copy] = Object.fromEntries(
      WORKFLOW_STAGES.map((stage) => {
        const setup = liveStage(flow, stage)
        return [stage, { lead: setup.lead, helpers: setup.helpers.map((h) => ({ agent: h.agent, extra: h.extra })) }]
      }),
    )
    block.stages = stages
  })
  return res.ok ? { ok: true, id: copy, name } : res
}

/** Rename one of the board's own. The id does not move, so every card and every finished
 *  delivery pointing at it keeps pointing at it. */
export function renameWorkflow(id: string, name: string): Write {
  const flow = workflowById(id)
  if (!flow) return { ok: false, error: `this board has no \`${id}\` workflow` }
  if (flow.builtIn) return { ok: false, error: `\`${flow.name}\` is built in — duplicate it to make one you can rename` }
  const wanted = trimmedName(name)
  if (!wanted) return { ok: false, error: 'a workflow needs a name' }
  if (nameTaken(wanted, id)) return { ok: false, error: `this board already has a workflow called "${wanted}"` }
  return save((block) => {
    const added = Array.isArray(block.added) ? [...block.added] : []
    block.added = added.map((entry) => {
      const row = configBlock(entry)
      return row.id === id ? { ...row, name: wanted } : row
    })
  })
}

/** Drop one of the board's own, with the assignments it carried. Whoever calls this checks
 *  first that no open card still runs on it — the cards are the board's to walk, not this
 *  file's. */
export function deleteWorkflow(id: string): Write {
  const flow = workflowById(id)
  if (!flow) return { ok: false, error: `this board has no \`${id}\` workflow` }
  if (flow.builtIn) return { ok: false, error: `\`${flow.name}\` is built in and cannot be deleted` }
  return save((block) => {
    const added = Array.isArray(block.added) ? block.added : []
    const kept = added.filter((entry) => configBlock(entry).id !== id)
    if (kept.length) block.added = kept
    else delete block.added
    const stages = configBlock(block.stages)
    delete stages[id]
    if (Object.keys(stages).length) block.stages = stages
    else delete block.stages
  })
}

// Write one stage of one workflow, starting from what it OFFERS rather than from what is
// saved: the first helper added to an inherited stage has to keep the ones already there,
// and an inherited stage has nothing saved to keep them in.
//
// `lead` is written always, so an empty one reads as "cleared" rather than as "untouched" —
// a key present and empty is a choice, a missing key is not. `helpers` is written only once
// the change actually moves them, so assigning a lead does not quietly freeze a plan stage
// that was still offering every specialist the board has.
function setStage(id: string, stage: WorkflowStage, change: (setup: WorkflowStageSetup) => void): Write {
  const flow = workflowById(id)
  if (!flow) return { ok: false, error: `this board has no \`${id}\` workflow` }
  const before = liveStage(flow, stage)
  const setup: WorkflowStageSetup = { ...before, helpers: before.helpers.map((h) => ({ ...h })) }
  change(setup)
  const movedHelpers =
    before.helpersChosen ||
    setup.helpers.length !== before.helpers.length ||
    setup.helpers.some((h, i) => h.agent !== before.helpers[i]!.agent || h.extra !== before.helpers[i]!.extra)
  return save((block) => {
    const stages = configBlock(block.stages)
    const mine = configBlock(stages[id])
    mine[stage] = {
      lead: setup.lead,
      ...(movedHelpers ? { helpers: setup.helpers.map((h) => ({ agent: h.agent, extra: h.extra })) } : {}),
    }
    stages[id] = mine
    block.stages = stages
  })
}

/** Give one stage its lead, or clear it with an empty name. One lead per stage: picking
 *  another replaces the one there rather than joining it. */
export function setWorkflowLead(id: string, stage: WorkflowStage, agent: string): Write {
  const wanted = agent.trim()
  if (wanted) {
    const found = agentRoster().find((entry) => entry.name === wanted)
    if (!found) return { ok: false, error: `this board has no \`${wanted}\` agent` }
    if (found.stage !== stage) return { ok: false, error: `\`${wanted}\` is a ${found.stage ?? 'board'} agent and cannot lead ${stage}` }
  }
  const flow = workflowById(id)
  if (flow?.stages[stage].helpers.some((h) => h.agent === wanted)) {
    return { ok: false, error: `\`${wanted}\` already helps this stage — remove it from the helpers first` }
  }
  return setStage(id, stage, (setup) => {
    setup.lead = wanted
  })
}

/** Add a helper to one stage. The same agent never leads and helps the same stage. */
export function addWorkflowHelper(id: string, stage: WorkflowStage, agent: string): Write {
  const wanted = agent.trim()
  const found = agentRoster().find((entry) => entry.name === wanted)
  if (!found) return { ok: false, error: `this board has no \`${wanted}\` agent` }
  if (found.stage !== stage) return { ok: false, error: `\`${wanted}\` is a ${found.stage ?? 'board'} agent and cannot help ${stage}` }
  const flow = workflowById(id)
  if (flow?.stages[stage].lead === wanted) {
    return { ok: false, error: `\`${wanted}\` already leads this stage` }
  }
  return setStage(id, stage, (setup) => {
    if (!setup.helpers.some((h) => h.agent === wanted)) setup.helpers.push({ agent: wanted, extra: '' })
  })
}

/** Take a helper off one stage. The agent itself is untouched — this ends an assignment. */
export const removeWorkflowHelper = (id: string, stage: WorkflowStage, agent: string): Write =>
  setStage(id, stage, (setup) => {
    setup.helpers = setup.helpers.filter((h) => h.agent !== agent.trim())
  })

/** What this assignment asks of a helper on top of its own instructions. It belongs to the
 *  ASSIGNMENT, so an agent that does not help this stage is refused rather than written down
 *  as a requirement nothing would ever read. Empty clears it and leaves the agent's own
 *  instructions exactly as they were. */
export function setWorkflowHelperExtra(id: string, stage: WorkflowStage, agent: string, extra: string): Write {
  const wanted = agent.trim()
  const flow = workflowById(id)
  if (!flow) return { ok: false, error: `this board has no \`${id}\` workflow` }
  if (!liveStage(flow, stage).helpers.some((h) => h.agent === wanted)) {
    return { ok: false, error: `\`${wanted}\` does not help the ${stage} stage of "${flow.name}"` }
  }
  return setStage(id, stage, (setup) => {
    setup.helpers = setup.helpers.map((h) => (h.agent === wanted ? { ...h, extra } : h))
  })
}

/** Whether the config names a workflow at all — what says a board has been through this
 *  screen. Read straight, so an unreadable file is not mistaken for an untouched one. */
export function workflowsConfigured(): boolean {
  try {
    return Object.keys(workflowsBlock(readConfigRaw())).length > 0
  } catch {
    return false
  }
}

// ---- the workflow one card runs on -----------------------------------------

/** The id a card carries, straight off its file. Empty when the card is not there, carries
 *  no `workflow:` key, or is archived — the caller resolves that to the default. */
export function cardWorkflowId(id: number): string {
  // Every step of this is best-effort. It is read on the way into a prompt, and a folder
  // that is not there — a half-made board, a card already archived away — means the card
  // names no workflow, never a run that cannot start.
  try {
    const found = locate(id) ?? locateArchived(id)
    if (!found) return ''
    const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
    return parseFrontmatter(fs.readFileSync(file, 'utf8')).meta?.workflow ?? ''
  } catch {
    return ''
  }
}

/** The workflow a card runs on, resolved. A card naming a workflow this board no longer has
 *  runs on the default rather than on nothing. */
export const cardWorkflow = (id: number | null | undefined): Workflow | undefined =>
  workflowFor(typeof id === 'number' ? cardWorkflowId(id) : '')

// ---- what a delivery freezes -----------------------------------------------

/** One workflow as a delivery keeps it: its id, its name right now, and who leads and helps
 *  each of its three stages with the extra requirements their assignments carry. Read once,
 *  when the delivery opens, so every run in it works to the same answer however the board's
 *  settings move underneath.
 *
 *  Undefined where this board picks no workflows — a marketing board freezes nothing, and a
 *  record with nothing frozen reads as "the board's own", which is what it always was. */
export function frozenWorkflow(id: string): FrozenWorkflow | undefined {
  const flow = workflowFor(id)
  if (!flow) return undefined
  return {
    id: flow.id,
    name: flow.name,
    needsArtifact: flow.needsArtifact,
    stages: Object.fromEntries(
      WORKFLOW_STAGES.map((stage) => {
        const setup = liveStage(flow, stage)
        return [stage, { lead: setup.lead, helpers: setup.helpers.map((h) => ({ agent: h.agent, extra: h.extra })) }]
      }),
    ),
  }
}

// ---- what a screen draws ---------------------------------------------------

const candidateOf = (entry: RosterEntry): WorkflowCandidate => ({
  name: entry.name,
  title: entry.title,
  gloss: entry.gloss,
  builtIn: entry.builtIn,
})

/** Every workflow this board has, with each stage's lead, helpers and candidates. One read
 *  for the whole pane: the roster is walked once rather than once per stage per workflow. */
export function workflowViews(): WorkflowView[] {
  if (!workflowsHere()) return []
  const roster = agentRoster()
  const byStage = new Map<WorkflowStage, WorkflowCandidate[]>(
    WORKFLOW_STAGES.map((stage) => [stage, roster.filter((e) => e.stage === stage).map(candidateOf)]),
  )
  return workflows().map((flow) => ({
    id: flow.id,
    name: flow.name,
    builtIn: flow.builtIn,
    isDefault: flow.id === DEFAULT_WORKFLOW,
    needsArtifact: flow.needsArtifact,
    stages: WORKFLOW_STAGES.map((stage) => {
      const setup = liveStage(flow, stage)
      return { stage, lead: setup.lead, helpers: setup.helpers, candidates: byStage.get(stage) ?? [] }
    }),
    problems: workflowProblems(flow.id),
  }))
}
