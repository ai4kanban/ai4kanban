// The workflows a board runs, and the one place a card's own is read (#715).
//
// A board used to be ONE kind of work, and every card on it got that answer. A workflow
// moves the choice onto the card. One board plans a feature and a newsletter side by side,
// each through its own `plan → execute → review`, and the card says which.
//
// Three stages, always the same three. This is not a flow editor: a workflow says WHO runs
// each of the three and who they may call in, and nothing about the order — a review that
// fails goes back to execute, the way it always has.
//
// `coding` ships with the command and cannot be renamed or deleted: it is what every board did
// before this file. A board adds its own, and every one of them — built-in included — keeps its
// assignments in `ui.config.json` under `workflows`. A built-in's unset stage falls back to
// the defaults below; a stage deliberately cleared does not.
//
// A built-in's LEADS are the command's and nobody else's (#774). Its name is a promise about
// who runs it — `Coding` led by some other planner is a workflow lying about itself — so a
// built-in stage takes helpers and nothing more. Somebody who wants other leads duplicates
// it and gets a workflow of their own, where all three are theirs to pick.
//
// The id is what a card carries and what a delivery freezes. It never changes: renaming a
// workflow rewrites its name and nothing else, so no card and no finished delivery is
// orphaned by it.

import fs from 'node:fs'
import path from 'node:path'

import { locate, locateArchived } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { readConfigRaw, safeConfig, configBlock, writeConfig } from './settings'
import { specAgentCatalog } from '../agents/catalog'
import { canonicalSpecAgent } from '../spec-agent-names'
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

// The three stages, the shape of one assignment, and the shape a screen draws are all in
// ./types.ts — the one module the board UI keeps a copy of, so the pane names them without a
// second set of shapes drifting out of step.
export { WORKFLOW_STAGES }
export type { WorkflowCandidate, WorkflowHelper, WorkflowStage, WorkflowStageView, WorkflowView }

/** Who runs one stage of one workflow. Exactly one lead, and any number of helpers the lead
 *  may call in when its own instructions say to. An empty `lead` is a stage nobody runs, and
 *  a delivery refuses to start on one.
 *
 *  The review stage has no lead (#820): its helpers are the reviewers, and an empty list means
 *  a finished build is delivered unreviewed. */
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
   *  there. On one whose output is a file, a delivery that wrote nothing has produced nothing,
   *  and it stops unfinished saying so. A copy of a workflow carries it. */
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
// `hyperframes-video` is one demo video per card (#822): its leads are `lead` agents the
// command ships, and nothing reviews the render.
const BUILTINS: BuiltinWorkflow[] = [
  {
    id: 'coding',
    name: 'Coding',
    stages: {
      plan: { lead: 'planner', helpers: 'every' },
      execute: { lead: 'builder', helpers: [] },
      review: { lead: '', helpers: ['code-reviewer'] },
    },
  },
  {
    id: 'hyperframes-video',
    name: 'Demo video',
    needsArtifact: true,
    stages: {
      plan: { lead: 'scriptwriter', helpers: ['video-assets'] },
      execute: { lead: 'hyperframes-editor', helpers: [] },
      review: { lead: '', helpers: [] },
    },
  },
]

// A helper another built-in names is that workflow's, so `every` leaves it out.
const namedByBuiltins = (except: string): Set<string> =>
  new Set(
    BUILTINS.filter((w) => w.id !== except).flatMap((w) =>
      WORKFLOW_STAGES.flatMap((stage) => {
        const helpers = w.stages[stage].helpers
        return Array.isArray(helpers) ? helpers : []
      }),
    ),
  )

/** The stage that has reviewers instead of a lead (#820). */
const REVIEW: WorkflowStage = 'review'

/** The ids the command ships. */
export const BUILTIN_WORKFLOW_IDS: string[] = BUILTINS.map((w) => w.id)

/** Whether a workflow is one of the command's own — what refuses a rename, a delete, and a
 *  change of lead. */
export const isBuiltinWorkflow = (id: string): boolean => BUILTIN_WORKFLOW_IDS.includes(id)

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
      const agent = typeof row.agent === 'string' ? canonicalSpecAgent(row.agent) : ''
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
      // A built-in's lead is read off the command, never off the file: a board that changed
      // one before it was fixed runs the built-in's own agent again, and `dropBuiltinLeads`
      // takes the key away.
      lead: stage === REVIEW ? '' : base ? fallback.lead : (saved.lead ?? ''),
      helpers: saved.helpers !== undefined ? saved.helpers : fallback.helpers,
      helpersChosen: saved.helpers !== undefined,
    }
  }
  return { id, name, builtIn, needsArtifact: base?.needsArtifact ?? needsArtifact, stages }
}

// ---- folding an older board's switches (#749) -------------------------------
//
// A workflow agent used to carry a switch of its own beside its stage assignment, and the
// two could disagree: a stage offered an agent the switch then refused. The assignment is
// the only answer now, so a board that switched one off has that meant once and written
// down — the agent comes off every stage that was offering it, and the key goes. Reading
// the key again afterwards would quietly put the agent back, which is the one outcome an
// upgrade must not have.
//
// Only where the board has workflows at all, and only from `workflows()`, which every read
// of an assignment goes through. One pass: the keys it folds are the keys it deletes, so the
// line below is false from then on.

const switchedOff = (cfg: Record<string, unknown>): string[] =>
  Object.entries(configBlock(cfg.specAgents))
    .filter(([, value]) => value === false || configBlock(value).enabled === false)
    .map(([name]) => name)

// What one stage was offering before the fold, worked out from the config alone. It is the
// same answer `stageHelpers` gives, computed here without the roster: this runs inside
// `workflows()`, and the roster is built from it.
function offeredBefore(
  cfg: Record<string, unknown>,
  id: string,
  stage: WorkflowStage,
  stageOf: Map<string, WorkflowStage>,
): { lead: string; helpers: WorkflowHelper[] } {
  const base = BUILTINS.find((w) => w.id === id)
  const saved = readStage(storedStages(cfg, id)[stage])
  const lead = stage === REVIEW ? '' : base ? base.stages[stage].lead : (saved.lead ?? '')
  if (saved.helpers !== undefined) return { lead, helpers: saved.helpers }
  const declared = base?.stages[stage].helpers
  if (declared === 'every') {
    const others = namedByBuiltins(id)
    return {
      lead,
      helpers: [...stageOf]
        .filter(([name, where]) => where === stage && name !== lead && !others.has(name))
        .map(([name]) => ({ agent: name, extra: '' })),
    }
  }
  return { lead, helpers: (declared ?? []).map((agent) => ({ agent, extra: '' })) }
}

/** Fold every switched-off workflow agent into the stages that were offering it, and drop
 *  the keys. True when it wrote, which is once per board. */
function foldAgentSwitches(cfg: Record<string, unknown>): boolean {
  if (!switchedOff(cfg).length) return false
  // The catalog rather than the roster: the roster is built from the workflows this is
  // inside of. Only a specialist can carry one of these keys on a board with workflows —
  // `kind: write` does not parse here (../agents/parse.ts).
  const stageOf = new Map<string, WorkflowStage>()
  for (const agent of specAgentCatalog().agents) if (agent.stage && agent.kind !== 'lead') stageOf.set(agent.name, agent.stage)
  const { ok } = writeConfig((raw) => {
    const off = new Set(switchedOff(raw).map(canonicalSpecAgent))
    const block = configBlock(raw.workflows)
    const stages = configBlock(block.stages)
    const ids = [...BUILTINS.map((w) => w.id), ...addedRows(raw).map((r) => r.id)]
    for (const id of ids) {
      for (const stage of WORKFLOW_STAGES) {
        const before = offeredBefore(raw, id, stage, stageOf)
        const kept = before.helpers.filter((h) => !off.has(canonicalSpecAgent(h.agent)))
        if (kept.length === before.helpers.length) continue
        stages[id] = {
          ...configBlock(stages[id]),
          [stage]: {
            ...(isBuiltinWorkflow(id) || stage === REVIEW ? {} : { lead: before.lead }),
            helpers: kept.map((h) => ({ agent: h.agent, extra: h.extra })),
          },
        }
      }
    }
    if (Object.keys(stages).length) block.stages = stages
    if (Object.keys(block).length) raw.workflows = block

    // The key itself. An entry left holding nothing goes with it, so the file reads exactly
    // as a board that never had the switch.
    const spec = { ...configBlock(raw.specAgents) }
    for (const name of switchedOff(raw)) {
      const rest = { ...configBlock(spec[name]) }
      delete rest.enabled
      if (Object.keys(rest).length) spec[name] = rest
      else delete spec[name]
    }
    if (Object.keys(spec).length) raw.specAgents = spec
    else delete raw.specAgents
  })
  return ok
}

// ---- dropping a built-in's saved lead (#774) --------------------------------
//
// The leads of a built-in belong to the command now. A board that changed one while it was
// still a picker has a key nothing reads, so the key goes: left there it would come back the
// moment the rule ever loosened, and a settings file that holds an answer nobody honours is
// a file the next reader has to be told to ignore. One pass — what it drops is what makes it
// run, so the line below is false from then on.

const savedBuiltinLead = (cfg: Record<string, unknown>): boolean =>
  BUILTINS.some((w) =>
    WORKFLOW_STAGES.some((stage) => typeof configBlock(storedStages(cfg, w.id)[stage]).lead === 'string'),
  )

/** Take every saved lead off the built-ins. True when it wrote, which is once per board. */
function dropBuiltinLeads(cfg: Record<string, unknown>): boolean {
  if (!savedBuiltinLead(cfg)) return false
  const { ok } = writeConfig((raw) => {
    const block = configBlock(raw.workflows)
    const all = configBlock(block.stages)
    for (const w of BUILTINS) {
      const mine = configBlock(all[w.id])
      for (const stage of WORKFLOW_STAGES) {
        const one = { ...configBlock(mine[stage]) }
        if (!('lead' in one)) continue
        delete one.lead
        // A stage that held nothing but the lead goes with it, so the file reads exactly as
        // a board that never touched the built-in.
        if (Object.keys(one).length) mine[stage] = one
        else delete mine[stage]
      }
      if (Object.keys(mine).length) all[w.id] = mine
      else delete all[w.id]
    }
    if (Object.keys(all).length) block.stages = all
    else delete block.stages
    if (Object.keys(block).length) raw.workflows = block
    else delete raw.workflows
  })
  return ok
}

// ---- folding a saved review lead into the reviewers (#820) ------------------
//
// The review stage has no lead now. A board's own workflow that saved one gets it back as its
// first reviewer, once; the key goes. Built-ins are `dropBuiltinLeads`' job.

const savedReviewLead = (cfg: Record<string, unknown>): boolean =>
  addedRows(cfg).some((row) => 'lead' in configBlock(storedStages(cfg, row.id)[REVIEW]))

function foldReviewLeads(cfg: Record<string, unknown>): boolean {
  if (!savedReviewLead(cfg)) return false
  const { ok } = writeConfig((raw) => {
    const block = configBlock(raw.workflows)
    const all = configBlock(block.stages)
    for (const row of addedRows(raw)) {
      const mine = configBlock(all[row.id])
      const one = { ...configBlock(mine[REVIEW]) }
      if (!('lead' in one)) continue
      const saved = readStage(one)
      const helpers = saved.helpers ?? []
      const lead = canonicalSpecAgent(saved.lead ?? '')
      delete one.lead
      if (lead && !helpers.some((h) => canonicalSpecAgent(h.agent) === lead)) {
        one.helpers = [{ agent: lead, extra: '' }, ...helpers.map((h) => ({ agent: h.agent, extra: h.extra }))]
      }
      if (Object.keys(one).length) mine[REVIEW] = one
      else delete mine[REVIEW]
      all[row.id] = mine
    }
    block.stages = all
    raw.workflows = block
  })
  return ok
}

/** Every workflow this board has, built-ins first and then its own in the order they were
 *  made. */
export function workflows(): Workflow[] {
  let cfg = safeConfig()
  if (dropBuiltinLeads(cfg)) cfg = safeConfig()
  if (foldReviewLeads(cfg)) cfg = safeConfig()
  if (foldAgentSwitches(cfg)) cfg = safeConfig()
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
 *  stage, in the roster's own order. What an assignment is checked against; only those with
 *  `canLead` are offered to lead. */
export const stageCandidates = (stage: WorkflowStage): RosterEntry[] =>
  agentRoster().filter((entry) => entry.stage === stage)

/** Every reason one workflow cannot start a card. Empty when the plan and execute stages
 *  have a lead this board answers to — review has none (#820). A helper that no longer resolves is NOT a reason: it is dropped
 *  from the assignment instead, because a delivery that cannot start over an optional agent
 *  is a delivery held up by nothing. */
export function workflowProblems(id: string): string[] {
  const flow = workflowById(id)
  if (!flow) return [`this board has no \`${id}\` workflow.`]
  const roster = agentRoster()
  const problems: string[] = []
  for (const stage of WORKFLOW_STAGES) {
    if (stage === REVIEW) continue
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
    const others = namedByBuiltins(flow.id)
    return roster
      .filter(
        (entry) =>
          entry.stage === stage &&
          entry.kind !== 'role' &&
          entry.kind !== 'lead' &&
          entry.name !== setup.lead &&
          !others.has(entry.name),
      )
      .map((entry) => ({ agent: entry.name, extra: '' }))
  }
  const names = new Set(roster.filter((entry) => entry.kind !== 'lead').map((entry) => entry.name))
  // Never the lead as well: a board that had assigned a built-in's lead elsewhere gets its
  // own agent back (#774), and it may be sitting in the helpers it was moved aside for.
  return setup.helpers.filter((h) => names.has(h.agent) && h.agent !== setup.lead)
}

/** One stage's setup as a run and a freeze read it: its lead exactly as assigned, and the
 *  helpers it actually offers. The lead is never filtered — a lead nobody answers to is an
 *  error somebody has to see, not a stage that quietly runs as somebody else. */
export const liveStage = (flow: Workflow, stage: WorkflowStage): WorkflowStageSetup => ({
  lead: flow.stages[stage].lead,
  helpers: stageHelpers(flow, stage),
  helpersChosen: flow.stages[stage].helpersChosen,
})

/** The reviewers one workflow offers, in order (#820). Empty means no review. */
export const workflowReviewers = (flow: Workflow): WorkflowHelper[] => stageHelpers(flow, REVIEW)

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
        const helpers = setup.helpers.map((h) => ({ agent: h.agent, extra: h.extra }))
        return [stage, stage === REVIEW ? { helpers } : { lead: setup.lead, helpers }]
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
//
// A built-in writes no `lead` at all: its leads are the command's, and a key here would be
// an answer no read ever consults (#774).
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
    const written = {
      ...(flow.builtIn || stage === REVIEW ? {} : { lead: setup.lead }),
      ...(movedHelpers ? { helpers: setup.helpers.map((h) => ({ agent: h.agent, extra: h.extra })) } : {}),
    }
    if (Object.keys(written).length) mine[stage] = written
    else delete mine[stage]
    if (Object.keys(mine).length) stages[id] = mine
    else delete stages[id]
    if (Object.keys(stages).length) block.stages = stages
    else delete block.stages
  })
}

/** Give one stage its lead, or clear it with an empty name. One lead per stage: picking
 *  another replaces the one there rather than joining it.
 *
 *  A built-in's is refused: what leads `Coding` is what the name says it is, and whoever
 *  wants another one duplicates it (#774). */
export function setWorkflowLead(id: string, stage: WorkflowStage, agent: string): Write {
  const owner = workflowById(id)
  if (!owner) return { ok: false, error: `this board has no \`${id}\` workflow` }
  if (stage === REVIEW) return { ok: false, error: 'the review stage has no lead, only reviewers' }
  if (owner.builtIn) {
    return {
      ok: false,
      error: `\`${owner.name}\` is built in — its lead agents are fixed. Duplicate it to make one you can reassign.`,
    }
  }
  const wanted = agent.trim()
  if (wanted) {
    const found = agentRoster().find((entry) => entry.name === wanted)
    if (!found) return { ok: false, error: `this board has no \`${wanted}\` agent` }
    if (found.stage !== stage) return { ok: false, error: `\`${wanted}\` is a ${found.stage ?? 'board'} agent and cannot lead ${stage}` }
    // A lead saved before #846 keeps running; only a new pick is held to the declaration.
    if (!found.canLead && owner.stages[stage].lead !== wanted) {
      return { ok: false, error: `\`${wanted}\` does not declare \`akb.lead: true\`, so it can only help` }
    }
  }
  if (owner.stages[stage].helpers.some((h) => h.agent === wanted)) {
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
  if (found.kind === 'lead') return { ok: false, error: `\`${wanted}\` only leads a stage and cannot help one` }
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
 *  Undefined for an id this board has no workflow for; a record with nothing frozen reads as
 *  "the board's own", which is what it always was. */
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

/** Why a delivery with no reviewers is never reviewed, said the same way everywhere. */
export const NO_REVIEWERS = "this delivery's workflow has no reviewers, so it is delivered as built and there is nothing to review"

/** The reviewers a delivery froze, in order (#820). A record frozen before then named a
 *  review lead instead, which reads as its first reviewer; one with nothing frozen reads the
 *  board's default workflow. */
export function frozenReviewers(frozen: FrozenWorkflow | undefined): WorkflowHelper[] {
  if (!frozen) {
    const flow = workflowFor('')
    return flow ? workflowReviewers(flow) : []
  }
  const stage = frozen.stages[REVIEW]
  const helpers = (stage?.helpers ?? []).map((h) => ({ agent: canonicalSpecAgent(h.agent), extra: h.extra }))
  const lead = canonicalSpecAgent(stage?.lead ?? '')
  return lead && !helpers.some((h) => h.agent === lead) ? [{ agent: lead, extra: '' }, ...helpers] : helpers
}

// ---- what a screen draws ---------------------------------------------------

const candidateOf = (entry: RosterEntry): WorkflowCandidate => ({
  name: entry.name,
  title: entry.title,
  gloss: entry.gloss,
  builtIn: entry.builtIn,
  ...(entry.canLead ? { canLead: true } : {}),
  ...(entry.kind === 'lead' ? { leadOnly: true } : {}),
})

/** Every workflow this board has, with each stage's lead, helpers and candidates. One read
 *  for the whole pane: the roster is walked once rather than once per stage per workflow. */
export function workflowViews(): WorkflowView[] {
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
