// The workflows a board runs, and the one place a card's own is read (#715).
//
// A board used to be ONE kind of work, and every card on it got that answer. A workflow
// moves the choice onto the card. One board plans a feature and a newsletter side by side,
// each through its own `plan → execute`, and the card says which.
//
// Two stages, always the same two. `plan` has hooks (stored as `helpers`) its lead calls in
// when their description applies; `execute` is its lead alone (#1507).
//
// `coding` ships with the command and cannot be renamed or deleted: it is what every board did
// before this file. A board adds its own, and every one of them — built-in included — keeps its
// assignments in `ui.config.json` under `workflows`. A built-in's unset stage falls back to
// the defaults below; a stage deliberately cleared does not.
//
// A built-in's LEADS are the command's and nobody else's (#774). Its name is a promise about
// who runs it — `Coding` led by some other planner is a workflow lying about itself — so a
// built-in stage takes hooks and nothing more. Somebody who wants other leads duplicates
// it and gets a workflow of their own, where all three are theirs to pick.
//
// The id is what a card carries and what a delivery freezes. It never changes: renaming a
// workflow rewrites its name and nothing else, so no card and no finished delivery is
// orphaned by it.

import fs from 'node:fs'
import path from 'node:path'

import { locate, locateArchived } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { die } from '../paths'
import type { Meta } from '../types'
import { AUTO_CADENCE, CADENCE_FORMS, formatStamp, isAuto, parseCadence, parseStamp } from '../cadence'
import { readConfigRaw, safeConfig, configBlock, writeConfig } from './settings'
import { specAgentCatalog, type RefusedAgent } from '../agents/catalog'
import { canonicalSpecAgent } from '../spec-agent-names'
import { agentRoster, type RosterEntry } from './roles'
import { copyAgent } from '../agents/roster'
import { proGate } from '../cloud/pro'
import { scheduledAuto, scheduledNext } from './scheduled'
import {
  refusal,
  WORKFLOW_STAGES,
  type FrozenWorkflow,
  type RunRefusal,
  type DeliveryStage,
  type WorkflowCandidate,
  type WorkflowHelper,
  type WorkflowScheduled,
  type WorkflowScheduledView,
  type WorkflowStage,
  type WorkflowStageView,
  type WorkflowView,
} from './types'

// The three stages, the shape of one assignment, and the shape a screen draws are all in
// ./types.ts — the one module the board UI keeps a copy of, so the pane names them without a
// second set of shapes drifting out of step.
export { WORKFLOW_STAGES }
export type { WorkflowCandidate, WorkflowHelper, WorkflowStage, WorkflowStageView, WorkflowView }

/** Who runs one stage of one workflow. Exactly one lead, and any number of hooks (`helpers`) the lead
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
  /** Whether its output is files rather than code (#715, #874) — the inverse of **Use a Git
   *  worktree**. Such a delivery works in the project with no branch, commits nothing, and
   *  ends on the files its card records. A copy of a workflow carries it; a board's own
   *  written before #874 carries nothing and reads as code. */
  needsArtifact: boolean
  /** The stage that hands over the finished work (#1057). `plan` means planning produces it
   *  and the user archives it: nothing is built, so the execute stage may stay empty. */
  delivers: DeliveryStage
  /** Whether only a Pro account may run it (#1038). A copy of one carries it; a copy made
   *  before #1038 carries nothing and stays free. */
  pro: boolean
  /** Whether an upgrade took a retired agent off this workflow and the user has not been
   *  told yet (#945). Cleared by `dismissRetiredAssignment`. */
  retiredAssignment: boolean
  stages: Record<WorkflowStage, WorkflowStageSetup>
  /** Its scheduled agents (#1401), as written down. Read through `scheduledMembers`. */
  scheduled: WorkflowScheduled[]
}

/** The workflow a card with no `workflow:` key runs on — every card written before this
 *  existed, and every one created without a choice. */
export const DEFAULT_WORKFLOW = 'coding'

/** What a workflow may be called on disk: the same shape an agent's name takes. */
const WORKFLOW_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/

const emptyStages = (): Record<WorkflowStage, WorkflowStageSetup> => ({
  plan: { lead: '', helpers: [], helpersChosen: false },
  execute: { lead: '', helpers: [], helpersChosen: false },
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
  /** What it is for, in English; screens translate it by id. */
  description: string
  needsArtifact?: boolean
  delivers?: DeliveryStage
  pro?: boolean
  stages: Record<WorkflowStage, { lead: string; helpers: BuiltinHelpers }>
  /** The scheduled agents it starts with, on, until the board changes them (#1401). */
  scheduled?: { agent: string; cadence?: string }[]
}

// `coding` is what every board did before workflows existed, written down. Its two planning
// helpers are the specialists the command ships — each joins only when its own applicability
// says so, which is why neither is required.
//
// `hyperframes-video` is one product video per card (#822, #1057), `slide-deck` one editable
// `.pptx` (#969, #1075), `carousel-post` one multi-page social post (#1117) and `blog-post` one
// article (#1126), each finished and checked during planning. Their leads are `lead` agents the command ships.
const BUILTINS: BuiltinWorkflow[] = [
  {
    id: 'coding',
    name: 'Coding',
    description: 'Plan and implement software changes.',
    stages: {
      plan: { lead: 'software-planner', helpers: 'every' },
      execute: { lead: 'builder', helpers: [] },
    },
    scheduled: [{ agent: 'qa-manager' }],
  },
  {
    id: 'hyperframes-video',
    name: 'Product video',
    description: 'Approve a script, get a finished product video, and archive it when you are happy.',
    needsArtifact: true,
    delivers: 'plan',
    pro: true,
    stages: {
      plan: { lead: 'scriptwriter', helpers: ['demo-rehearser', 'hyperframes-editor', 'cover-designer'] },
      execute: { lead: '', helpers: [] },
    },
  },
  {
    id: 'slide-deck',
    name: 'Slide deck',
    description: 'Approve the slides, get an editable PowerPoint deck, and archive it when you are happy.',
    needsArtifact: true,
    delivers: 'plan',
    pro: true,
    stages: {
      plan: { lead: 'deck-planner', helpers: [] },
      execute: { lead: '', helpers: [] },
    },
  },
  {
    id: 'carousel-post',
    name: 'Carousel post',
    description:
      'Approve the copy and page outline, get every page as an image with captions for each platform, and archive it when you are happy.',
    needsArtifact: true,
    delivers: 'plan',
    pro: true,
    stages: {
      plan: { lead: 'carousel-planner', helpers: [] },
      execute: { lead: '', helpers: [] },
    },
  },
  {
    id: 'blog-post',
    name: 'Blog post',
    description: 'Approve the outline, get the full article with its images and links, and archive it when you are happy.',
    needsArtifact: true,
    delivers: 'plan',
    pro: true,
    stages: {
      plan: { lead: 'blog-planner', helpers: ['blog-illustrator'] },
      execute: { lead: '', helpers: [] },
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


/** The ids the command ships. */
export const BUILTIN_WORKFLOW_IDS: string[] = BUILTINS.map((w) => w.id)

/** Whether a workflow is one of the command's own — what refuses a rename, a delete, and a
 *  change of lead. */
export const isBuiltinWorkflow = (id: string): boolean => BUILTIN_WORKFLOW_IDS.includes(id)

/** What a built-in is for. A board's own workflow has none. */
export const builtinDescription = (id: string): string | undefined => BUILTINS.find((w) => w.id === id)?.description

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
  off?: boolean
}

const workflowsBlock = (cfg: Record<string, unknown>): Record<string, unknown> => configBlock(cfg.workflows)

interface AddedRow {
  id: string
  name: string
  needsArtifact: boolean
  delivers: DeliveryStage
  pro: boolean
}

const addedRows = (cfg: Record<string, unknown>): AddedRow[] => {
  const raw = workflowsBlock(cfg).added
  if (!Array.isArray(raw)) return []
  const rows: AddedRow[] = []
  for (const entry of raw) {
    const row = configBlock(entry)
    const id = typeof row.id === 'string' ? row.id.trim() : ''
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (!id || !WORKFLOW_ID.test(id) || isBuiltinWorkflow(id)) continue
    if (rows.some((r) => r.id === id)) continue
    rows.push({
      id,
      name,
      needsArtifact: row.needsArtifact === true,
      delivers: row.delivers === 'plan' ? 'plan' : 'execute',
      pro: row.pro === true,
    })
  }
  return rows
}

const storedStages = (cfg: Record<string, unknown>, id: string): Record<string, unknown> =>
  configBlock(configBlock(workflowsBlock(cfg).stages)[id])

/** The workflows an upgrade took a retired agent off, still waiting to be told about (#945). */
const retiredRows = (cfg: Record<string, unknown>): string[] => {
  const raw = workflowsBlock(cfg).retired
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : []
}

// One stage as the config holds it. `lead` present and empty is a stage somebody cleared on
// purpose, so it is kept apart from a stage nobody has touched.
function readStage(raw: unknown): { lead?: string; helpers?: WorkflowHelper[] } {
  const box = configBlock(raw)
  const out: { lead?: string; helpers?: WorkflowHelper[] } = {}
  if (typeof box.lead === 'string') out.lead = canonicalSpecAgent(box.lead)
  if (Array.isArray(box.helpers)) {
    const helpers: WorkflowHelper[] = []
    for (const entry of box.helpers) {
      const row = configBlock(entry) as StoredHelper & Record<string, unknown>
      const agent = typeof row.agent === 'string' ? canonicalSpecAgent(row.agent) : ''
      if (!agent || helpers.some((h) => h.agent === agent)) continue
      helpers.push({ agent, extra: typeof row.extra === 'string' ? row.extra : '', ...(row.off === true ? { off: true } : {}) })
    }
    out.helpers = helpers
  }
  return out
}

// A workflow's scheduled agents (#1401) sit beside its stages, as `schedule.helpers`, so every
// pass over a saved agent's name reaches them too. Undefined when nothing is saved.
const SCHEDULE = 'schedule'

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

const scheduledRow = (h: WorkflowScheduled) => ({
  agent: h.agent,
  extra: h.extra,
  ...(h.off ? { off: true } : {}),
  ...(!isAuto(h.cadence) ? { cadence: h.cadence } : {}),
  ...(h.lastRun ? { lastRun: h.lastRun } : {}),
  ...(h.since ? { since: h.since } : {}),
})

function resolveOne(
  cfg: Record<string, unknown>,
  id: string,
  name: string,
  builtIn: boolean,
  needsArtifact = false,
  delivers: DeliveryStage = 'execute',
  pro = false,
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
      lead: base ? fallback.lead : (saved.lead ?? ''),
      helpers: saved.helpers !== undefined ? saved.helpers : fallback.helpers,
      helpersChosen: saved.helpers !== undefined,
    }
  }
  // Hooks after the build are gone (#1507): ones a board still has saved are ignored.
  stages.execute = { ...stages.execute, helpers: [], helpersChosen: false }
  return {
    id,
    name,
    builtIn,
    needsArtifact: base?.needsArtifact ?? needsArtifact,
    delivers: base ? (base.delivers ?? 'execute') : delivers,
    pro: base ? base.pro === true : pro,
    retiredAssignment: retiredRows(cfg).includes(id),
    stages,
    scheduled:
      readScheduled(storedStages(cfg, id)[SCHEDULE]) ??
      (base?.scheduled ?? []).map((one) => ({ agent: one.agent, extra: '', cadence: one.cadence ?? AUTO_CADENCE, lastRun: '' })),
  }
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
  const lead = base ? base.stages[stage].lead : (saved.lead ?? '')
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
  for (const agent of specAgentCatalog().agents) if (agent.stage && !agent.canLead) stageOf.set(agent.name, agent.stage)
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
            ...(isBuiltinWorkflow(id) ? {} : { lead: before.lead }),
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

// ---- renaming a saved agent (#858) -------------------------------------------
//
// A workflow saved under an agent's old name (`planner`) is rewritten to its current one, once.

const renamed = (name: unknown): boolean => typeof name === 'string' && canonicalSpecAgent(name) !== name.trim()

const savedOldName = (cfg: Record<string, unknown>): boolean =>
  Object.values(configBlock(workflowsBlock(cfg).stages)).some((flow) =>
    Object.values(configBlock(flow)).some((raw) => {
      const stage = configBlock(raw)
      return (
        renamed(stage.lead) ||
        (Array.isArray(stage.helpers) && stage.helpers.some((h) => renamed(configBlock(h).agent)))
      )
    }),
  )

function renameSavedAgents(cfg: Record<string, unknown>): boolean {
  if (!savedOldName(cfg)) return false
  const { ok } = writeConfig((raw) => {
    const block = configBlock(raw.workflows)
    const all = configBlock(block.stages)
    for (const [id, flow] of Object.entries(all)) {
      const mine = configBlock(flow)
      for (const [stage, value] of Object.entries(mine)) {
        const one = { ...configBlock(value) }
        if (typeof one.lead === 'string') one.lead = canonicalSpecAgent(one.lead)
        if (Array.isArray(one.helpers)) {
          // A stage that saved BOTH names keeps one assignment, the first written — the old
          // name's own extra requirements are not dropped onto the new one.
          const seen = new Set<string>()
          one.helpers = one.helpers.flatMap((h) => {
            const row = configBlock(h)
            if (typeof row.agent !== 'string') return [h]
            const agent = canonicalSpecAgent(row.agent)
            if (seen.has(agent)) return []
            seen.add(agent)
            return [{ ...row, agent }]
          })
        }
        mine[stage] = one
      }
      all[id] = mine
    }
    block.stages = all
    raw.workflows = block
  })
  return ok
}

// ---- dropping a retired agent's assignments (#945) --------------------------
//
// Agents the command no longer ships (`hyperframes-assets` and `video-reviewer` went into the
// video editor, #1057). A board that had assigned one keeps an assignment nothing answers to,
// so the agent comes off every saved stage, once, and each workflow it came off is marked —
// the Workflows pane says what happened there, and **Got it** takes the mark away. One pass:
// what it removes is what makes it run, so the line below is false from then on.

const RETIRED_AGENTS = new Set(['storyboard-designer', 'hyperframes-assets', 'video-reviewer'])

const retired = (agent: unknown): boolean => typeof agent === 'string' && RETIRED_AGENTS.has(canonicalSpecAgent(agent))

const assignsRetired = (cfg: Record<string, unknown>): boolean =>
  Object.values(configBlock(workflowsBlock(cfg).stages)).some((flow) =>
    Object.values(configBlock(flow)).some((raw) => {
      const helpers = configBlock(raw).helpers
      return Array.isArray(helpers) && helpers.some((h) => retired(configBlock(h).agent))
    }),
  )

/** Take every retired agent off the saved assignments, marking the workflows it came off.
 *  True when it wrote, which is once per board. */
function dropRetiredAgents(cfg: Record<string, unknown>): boolean {
  if (!assignsRetired(cfg)) return false
  const { ok } = writeConfig((raw) => {
    const block = configBlock(raw.workflows)
    const all = configBlock(block.stages)
    const marked = new Set(retiredRows(raw))
    for (const [id, flow] of Object.entries(all)) {
      const mine = configBlock(flow)
      for (const [stage, value] of Object.entries(mine)) {
        const one = { ...configBlock(value) }
        if (!Array.isArray(one.helpers)) continue
        const kept = one.helpers.filter((h) => !retired(configBlock(h).agent))
        if (kept.length === one.helpers.length) continue
        one.helpers = kept
        mine[stage] = one
        marked.add(id)
      }
      all[id] = mine
    }
    block.stages = all
    if (marked.size) block.retired = [...marked]
    raw.workflows = block
  })
  return ok
}

// ---- one workflow per agent (#1095) -------------------------------------------
//
// An agent belongs to the one workflow that lists it — as a helper, or as a lead that is not a
// role. Nothing is shared: a board that shared one gets, once, a copy for every workflow but
// the first to list it, and Coding's inherited plan helpers are written down so the copy
// changes nobody's team. `agentsOwned` marks that pass as done.

const OWNED = 'agentsOwned'

const toRow = (h: WorkflowHelper) => ({ agent: h.agent, extra: h.extra, ...(h.off ? { off: true } : {}) })

function splitSharedAgents(cfg: Record<string, unknown>): boolean {
  const block = workflowsBlock(cfg)
  if (block[OWNED] === true || !Object.keys(block).length) return false
  const catalog = specAgentCatalog().agents
  const specialist = new Set(catalog.map((a) => a.name))
  const stageOf = new Map<string, WorkflowStage>()
  for (const agent of catalog) if (agent.stage && !agent.canLead) stageOf.set(agent.name, agent.stage)
  const seen = new Set<string>()
  const taken = new Set<string>()
  const claim = (name: string): string => {
    if (!specialist.has(name) || !seen.has(name)) {
      seen.add(name)
      return name
    }
    const copy = copyAgent(name, taken)
    return copy.ok && copy.agent ? copy.agent : name
  }
  const written: Record<string, Record<string, unknown>> = {}
  for (const id of [...BUILTINS.map((w) => w.id), ...addedRows(cfg).map((r) => r.id)]) {
    for (const stage of WORKFLOW_STAGES) {
      const saved = readStage(storedStages(cfg, id)[stage]).helpers !== undefined
      const before = offeredBefore(cfg, id, stage, stageOf)
      const lead = before.lead ? claim(before.lead) : ''
      const helpers = before.helpers.map((h) => ({ ...h, agent: claim(h.agent) }))
      const moved = lead !== before.lead || helpers.some((h, i) => h.agent !== before.helpers[i]!.agent)
      if (!moved && (saved || BUILTINS.find((w) => w.id === id)?.stages[stage].helpers !== 'every')) continue
      written[id] = {
        ...written[id],
        [stage]: { ...(isBuiltinWorkflow(id) ? {} : { lead }), helpers: helpers.map(toRow) },
      }
    }
  }
  const { ok } = writeConfig((raw) => {
    const box = configBlock(raw.workflows)
    const stages = configBlock(box.stages)
    for (const [id, mine] of Object.entries(written)) stages[id] = { ...configBlock(stages[id]), ...mine }
    if (Object.keys(stages).length) box.stages = stages
    box[OWNED] = true
    raw.workflows = box
  })
  return ok
}

// ---- a newly shipped plan agent starts on (#1099) ------------------------------
//
// A board that wrote a workflow's plan helpers down would get a new built-in there disabled.
// The ones below join their workflow enabled instead, once: `shipped` records each, so
// removing one sticks.

const SHIPPED_ON: { agent: string; flow: string }[] = [
  { agent: 'prompt-writer', flow: DEFAULT_WORKFLOW },
  { agent: 'email-planner', flow: DEFAULT_WORKFLOW },
  { agent: 'user-docs', flow: DEFAULT_WORKFLOW },
  { agent: 'cover-designer', flow: 'hyperframes-video' },
  { agent: 'demo-rehearser', flow: 'hyperframes-video' },
]
const SHIPPED = 'shipped'

const shippedRows = (cfg: Record<string, unknown>): string[] => {
  const raw = workflowsBlock(cfg)[SHIPPED]
  return Array.isArray(raw) ? raw.filter((n): n is string => typeof n === 'string') : []
}

const listedAnywhere = (cfg: Record<string, unknown>, name: string): boolean =>
  Object.values(configBlock(workflowsBlock(cfg).stages)).some((flow) =>
    Object.values(configBlock(flow)).some((raw) => {
      const stage = readStage(raw)
      return stage.lead === name || !!stage.helpers?.some((h) => h.agent === name)
    }),
  )

function addShippedAgents(cfg: Record<string, unknown>): boolean {
  if (!Object.keys(workflowsBlock(cfg)).length) return false
  const done = shippedRows(cfg)
  const fresh = SHIPPED_ON.filter((s) => !done.includes(s.agent))
  if (!fresh.length) return false
  const { ok } = writeConfig((raw) => {
    const block = configBlock(raw.workflows)
    const all = configBlock(block.stages)
    const add = fresh.filter((s) => !listedAnywhere(raw, s.agent))
    for (const { agent, flow } of add) {
      const stages = configBlock(all[flow])
      const plan = { ...configBlock(stages.plan) }
      if (!Array.isArray(plan.helpers)) continue
      plan.helpers = [...plan.helpers, { agent, extra: '' }]
      all[flow] = { ...stages, plan }
      block.stages = all
    }
    block[SHIPPED] = [...done, ...fresh.map((s) => s.agent)]
    raw.workflows = block
  })
  return ok
}

// ---- the QA manager moves onto a schedule (#1402) -----------------------------
//
// `qa-manager` was Coding's hook after a build and is now its scheduled agent. A board that
// saved its execute hooks keeps its choice, once: the row moves with its switch and extra
// requirements, and hooks chosen without it leave it off. `qaScheduled` marks the pass done,
// and every write sets it, so a board that never saved any is not read as one that left it out.

const QA_MANAGER = 'qa-manager'
const QA_SCHEDULED = 'qaScheduled'

const isQaManager = (row: unknown): boolean => {
  const agent = configBlock(row).agent
  return typeof agent === 'string' && canonicalSpecAgent(agent) === QA_MANAGER
}

function scheduleQaManager(cfg: Record<string, unknown>): boolean {
  const block = workflowsBlock(cfg)
  if (block[QA_SCHEDULED] === true || !Object.keys(block).length) return false
  const { ok } = writeConfig((raw) => {
    const box = configBlock(raw.workflows)
    const all = configBlock(box.stages)
    const chosen = readStage(storedStages(raw, DEFAULT_WORKFLOW).execute).helpers
    const was = chosen?.find((h) => h.agent === QA_MANAGER)
    for (const [id, flow] of Object.entries(all)) {
      const mine = configBlock(flow)
      const execute = configBlock(mine.execute)
      if (!Array.isArray(execute.helpers)) continue
      mine.execute = { ...execute, helpers: execute.helpers.filter((h) => !isQaManager(h)) }
      all[id] = mine
    }
    // Nothing saved either way keeps the built-in's default: on, every day.
    const coding = configBlock(all[DEFAULT_WORKFLOW])
    const saved = configBlock(coding[SCHEDULE]).helpers
    const rows: unknown[] = Array.isArray(saved) ? saved : []
    if ((chosen || Array.isArray(saved)) && !rows.some(isQaManager)) {
      const row = was ? toRow(was) : { agent: QA_MANAGER, extra: '', ...(chosen ? { off: true } : {}) }
      all[DEFAULT_WORKFLOW] = { ...coding, [SCHEDULE]: { helpers: [...rows, row] } }
    }
    if (Object.keys(all).length) box.stages = all
    box[QA_SCHEDULED] = true
    raw.workflows = box
  })
  return ok
}

// The workflows as written down, every pass above done first.
function writtenWorkflows(): Workflow[] {
  let cfg = safeConfig()
  if (renameSavedAgents(cfg)) cfg = safeConfig()
  if (dropRetiredAgents(cfg)) cfg = safeConfig()
  if (dropBuiltinLeads(cfg)) cfg = safeConfig()
  if (foldAgentSwitches(cfg)) cfg = safeConfig()
  if (splitSharedAgents(cfg)) cfg = safeConfig()
  if (addShippedAgents(cfg)) cfg = safeConfig()
  if (scheduleQaManager(cfg)) cfg = safeConfig()
  return [
    ...BUILTINS.map((w) => resolveOne(cfg, w.id, w.name, true)),
    ...addedRows(cfg).map((row) => resolveOne(cfg, row.id, row.name, false, row.needsArtifact, row.delivers, row.pro)),
  ]
}

// The specialists one workflow lists. Roles are never anybody's.
const listedBy = (flow: Workflow, specialist: Set<string>): string[] =>
  [
    ...WORKFLOW_STAGES.flatMap((stage) => [flow.stages[stage].lead, ...flow.stages[stage].helpers.map((h) => h.agent)]),
    ...flow.scheduled.map((h) => h.agent),
  ].filter((name) => specialist.has(name))

// Every workflow, and which one each listed agent belongs to. A helper no workflow lists sits
// in Coding, disabled and nobody's — or enabled and Coding's, on a board whose Coding still
// offers every plan helper it has.
function resolved(): { flows: Workflow[]; owners: Map<string, string> } {
  const flows = writtenWorkflows()
  const catalog = specAgentCatalog().agents
  const specialist = new Set(catalog.map((a) => a.name))
  const owners = new Map<string, string>()
  for (const flow of flows) for (const name of listedBy(flow, specialist)) if (!owners.has(name)) owners.set(name, flow.id)
  const coding = flows.find((w) => w.id === DEFAULT_WORKFLOW)
  if (!coding) return { flows, owners }
  const base = BUILTINS.find((w) => w.id === DEFAULT_WORKFLOW)!
  for (const stage of WORKFLOW_STAGES) {
    const setup = coding.stages[stage]
    const every = !setup.helpersChosen && base.stages[stage].helpers === 'every'
    const free = catalog
      .filter((a) => a.stage === stage && !a.canLead && a.name !== setup.lead && !owners.has(a.name))
      .map((a) => a.name)
    if (every) for (const name of free) owners.set(name, coding.id)
    setup.helpers = [...setup.helpers, ...free.map((agent) => ({ agent, extra: '', ...(every ? {} : { off: true }) }))]
  }
  // And a scheduled agent no workflow lists (#1401): Coding's, off.
  const idle = catalog.filter((a) => a.schedule && !owners.has(a.name)).map((a) => a.name)
  coding.scheduled = [
    ...coding.scheduled,
    ...idle.map((agent) => ({ agent, extra: '', off: true, cadence: AUTO_CADENCE, lastRun: '' })),
  ]
  return { flows, owners }
}

/** The workflow an agent belongs to, or empty when none has it — a lead nobody picked, or a
 *  helper written by hand, which any workflow can take. */
export const agentWorkflow = (name: string): string => resolved().owners.get(name) ?? ''

/** Every workflow this board has, built-ins first and then its own in the order they were
 *  made. */
export const workflows = (): Workflow[] => resolved().flows

/** One workflow by id, or undefined when this board has no such workflow. */
export const workflowById = (id: string): Workflow | undefined => workflows().find((w) => w.id === id)

/** The workflow id a command line named, refused when this board has no such workflow: a card
 *  pointing at a workflow nobody has is a card whose stages nothing can resolve. */
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
  const catalog = specAgentCatalog().agents
  const own = new Set(catalog.filter((a) => !a.builtIn && a.dir).map((a) => a.name))
  return [...new Set(listedBy(flow, own))].filter((name) => owners.get(name) === id)
}

// ---- who may take a stage --------------------------------------------------

/** The agents that may lead or help one stage — every agent on the roster that declares this
 *  stage, in the roster's own order. What an assignment is checked against; only those with
 *  `canLead` are offered to lead. */
export const stageCandidates = (stage: WorkflowStage): RosterEntry[] =>
  agentRoster().filter((entry) => entry.stage === stage)

/** Every reason one workflow cannot start a card. Empty when the plan and execute stages
 *  have a lead this board answers to. A helper that no longer resolves is NOT a reason: it is dropped
 *  from the assignment instead, because a delivery that cannot start over an optional agent
 *  is a delivery held up by nothing. */
export function workflowProblems(id: string): string[] {
  return workflowIssues(id).map((issue) => issue.error)
}

/** The same, each with its kind. */
export function workflowIssues(id: string): RunRefusal[] {
  const flow = workflowById(id)
  if (!flow) return [refusal('workflowNotFound', `this board has no \`${id}\` workflow.`, { id })]
  const roster = agentRoster()
  const problems: RunRefusal[] = []
  for (const stage of WORKFLOW_STAGES) {
    const { lead } = flow.stages[stage]
    // Planning hands over the work, so nothing is built (#1057).
    if (stage === 'execute' && flow.delivers === 'plan' && !lead) continue
    const name = flow.name
    if (!lead) {
      problems.push(
        refusal('workflowNoLead', `\`${name}\` has no agent leading its ${stage} stage — assign one before it can run.`, {
          name,
          stage,
          workflow: flow.id,
        }),
      )
      continue
    }
    const found = roster.find((entry) => entry.name === lead)
    if (!found) {
      const refused = specAgentCatalog().refused
      const mine = refused.find((r) => r.folder === lead) ?? refused.find((r) => r.name === lead)
      if (mine) {
        problems.push(leadRefused(flow, stage, mine))
        continue
      }
      problems.push(
        refusal('workflowLeadMissing', `\`${name}\` has \`${lead}\` leading its ${stage} stage, and this board has no such agent.`, {
          name,
          agent: lead,
          stage,
          workflow: flow.id,
        }),
      )
      continue
    }
    if (found.stage !== stage) {
      problems.push(
        refusal('workflowLeadStage', `\`${name}\` has \`${lead}\` leading its ${stage} stage, and \`${lead}\` is a ${found.stage} agent.`, {
          name,
          agent: lead,
          stage,
          assigned: found.stage ?? 'board',
          workflow: flow.id,
        }),
      )
    }
  }
  return problems
}

// A lead whose file is there but refused (#1342): the one line that brings it back.
function leadRefused(flow: Workflow, stage: WorkflowStage, agent: RefusedAgent): RunRefusal {
  const lead = flow.stages[stage].lead
  const keys = agent.keys ?? []
  const line = agent.line ?? `lead: ${stage}`
  const declared = agent.name ?? ''
  const fix: Record<RefusedAgent['cause'], string> = {
    oldKeys: `in ${agent.file}, replace ${keys.map((key) => `\`${key}\``).join(', ')} with \`${line}\``,
    noFile: `${agent.file} is missing — add it`,
    nameTaken: `${agent.file} takes a name already in use — rename one of the two`,
    folderName: `its folder is \`${agent.folder}\` but ${agent.file} names it \`${declared}\` — make the two match`,
    file: `${agent.file} has an error — \`akb spec\` says which`,
  }
  const of = flow.name.endsWith('s') ? "'" : "'s"
  return refusal('workflowLeadRefused', `\`${lead}\`, the lead of \`${flow.name}\`${of} ${stage} stage, can't be used: ${fix[agent.cause]}.`, {
    name: flow.name,
    agent: lead,
    stage,
    workflow: flow.id,
    cause: agent.cause,
    file: agent.file,
    folder: agent.folder,
    declared,
    keys: keys.join(','),
    line,
  })
}

/** Every helper one stage has, disabled ones included, minus any agent this board no longer
 *  has. Never read from anything that BUILDS the roster: this asks the roster for itself. */
export function stageMembers(flow: Workflow, stage: WorkflowStage): WorkflowHelper[] {
  const setup = flow.stages[stage]
  const names = new Set(agentRoster().filter((entry) => entry.kind !== 'lead').map((entry) => entry.name))
  // Never the lead as well: a board that had assigned a built-in's lead elsewhere gets its
  // own agent back (#774), and it may be sitting in the helpers it was moved aside for.
  return setup.helpers.filter((h) => names.has(h.agent) && h.agent !== setup.lead)
}

/** The helpers one stage actually runs — its enabled ones. */
export const stageHelpers = (flow: Workflow, stage: WorkflowStage): WorkflowHelper[] =>
  stageMembers(flow, stage).filter((h) => !h.off)

/** One stage's setup as the board reads it: its lead exactly as assigned, and every helper it
 *  has. The lead is never filtered — a lead nobody answers to is an error somebody has to
 *  see, not a stage that quietly runs as somebody else. */
export const liveStage = (flow: Workflow, stage: WorkflowStage): WorkflowStageSetup => ({
  lead: flow.stages[stage].lead,
  helpers: stageMembers(flow, stage),
  helpersChosen: flow.stages[stage].helpersChosen,
})


// ---- writing ---------------------------------------------------------------

type Write = { ok: boolean } & Partial<RunRefusal>

// Every write also writes down whatever Coding still inherits, so an agent made from here on
// starts in no workflow rather than joining Coding by itself (#1095).
const save = (change: (block: Record<string, unknown>) => void): Write => {
  const coding = workflows().find((w) => w.id === DEFAULT_WORKFLOW)
  const base = BUILTINS.find((w) => w.id === DEFAULT_WORKFLOW)!
  const inherited = WORKFLOW_STAGES.filter(
    (stage) => coding && !coding.stages[stage].helpersChosen && base.stages[stage].helpers === 'every',
  ).map(
    (stage) => [stage, coding!.stages[stage].helpers.filter((h) => !h.off).map(toRow)] as const,
  )
  return writeConfig((cfg) => {
    const block = configBlock(cfg.workflows)
    const stages = configBlock(block.stages)
    const mine = configBlock(stages[DEFAULT_WORKFLOW])
    for (const [stage, helpers] of inherited) if (!mine[stage]) mine[stage] = { helpers }
    if (Object.keys(mine).length) block.stages = { ...stages, [DEFAULT_WORKFLOW]: mine }
    change(block)
    block[OWNED] = true
    block[QA_SCHEDULED] = true
    if (Object.keys(block).length === 0) delete cfg.workflows
    else cfg.workflows = block
  })
}

/** Write down what Coding still inherits — before an agent is made, so it starts in none. */
export const settleWorkflows = (): Write => save(() => {})

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

/** Add a workflow of this board's own, with all three stages empty and no worktree (#874).
 *  The name is the user's own words; an empty one is refused here rather than saved as a
 *  workflow with no name. */
export function createWorkflow(name: string): Write & { id?: string; name?: string } {
  const wanted = trimmedName(name)
  if (!wanted) return { ok: false, ...refusal('workflowUnnamed', 'a workflow needs a name') }
  if (nameTaken(wanted)) return { ok: false, ...refusal('workflowTaken', `this board already has a workflow called "${wanted}"`, { name: wanted }) }
  const id = freeId(workflows().map((w) => w.id))
  const res = save((block) => {
    const added = Array.isArray(block.added) ? [...block.added] : []
    added.push({ id, name: wanted, needsArtifact: true })
    block.added = added
  })
  return res.ok ? { ok: true, id, name: wanted } : res
}

/** Copy one workflow under a free name. Every agent in it but a role is copied too (#1095),
 *  enabled or not and with its extra requirements, so the two never share one. The copy is
 *  the board's own whatever it was copied from, so it can be renamed and deleted. */
export function duplicateWorkflow(id: string, called?: string): Write & { id?: string; name?: string } {
  const flow = workflowById(id)
  if (!flow) return { ok: false, ...refusal('workflowNotFound', `this board has no \`${id}\` workflow`, { id }) }
  // What it is CALLED where the copy was asked for: a built-in's name is the English the
  // command ships, and the screen draws it in the reader's own words. The copy takes those
  // words, and the name it was copied from counts as taken so the first copy is numbered.
  const base = trimmedName(called ?? '') || flow.name
  const name = freeName(base, [...workflows().map((w) => w.name), base])
  const copy = freeId(workflows().map((w) => w.id))
  // So Coding does not take the copies in as helpers it inherits.
  settleWorkflows()
  const specialist = new Set(specAgentCatalog().agents.map((a) => a.name))
  const taken = new Set<string>()
  const copied = new Map<string, string>()
  const own = (agent: string): string => {
    if (!agent || !specialist.has(agent)) return agent
    if (!copied.has(agent)) {
      const made = copyAgent(agent, taken)
      copied.set(agent, made.ok && made.agent ? made.agent : agent)
    }
    return copied.get(agent)!
  }
  const stages = Object.fromEntries(
    WORKFLOW_STAGES.map((stage) => {
      const setup = liveStage(flow, stage)
      const helpers = setup.helpers.map((h) => toRow({ ...h, agent: own(h.agent) }))
      return [stage, { lead: own(setup.lead), helpers }]
    }),
  )
  // Its scheduled agents come too (#1401), counting from the copy rather than the original's last pass.
  const scheduled = scheduledMembers(flow).map((h) =>
    scheduledRow({ ...h, agent: own(h.agent), lastRun: '', since: formatStamp(new Date()) }),
  )
  const res = save((block) => {
    const added = Array.isArray(block.added) ? [...block.added] : []
    added.push({
      id: copy,
      name,
      needsArtifact: flow.needsArtifact,
      ...(flow.delivers === 'plan' ? { delivers: 'plan' } : {}),
      ...(flow.pro ? { pro: true } : {}),
    })
    block.added = added
    // The stages as they RESOLVE, not as they are saved: one still inheriting its workflow's
    // default has nothing saved.
    block.stages = { ...configBlock(block.stages), [copy]: { ...stages, ...(scheduled.length ? { [SCHEDULE]: { helpers: scheduled } } : {}) } }
  })
  return res.ok ? { ok: true, id: copy, name } : res
}

/** `duplicateWorkflow`, refused for a Pro workflow this account cannot use (#1038). */
export async function duplicateWorkflowIfAllowed(id: string, called?: string): Promise<Write & { id?: string; name?: string }> {
  const flow = workflowById(id)
  const refused = flow ? await proGate(flow) : null
  return refused ? { ok: false, ...refused } : duplicateWorkflow(id, called)
}

/** Rename one of the board's own. The id does not move, so every card and every finished
 *  delivery pointing at it keeps pointing at it. */
export function renameWorkflow(id: string, name: string): Write {
  const flow = workflowById(id)
  if (!flow) return { ok: false, ...refusal('workflowNotFound', `this board has no \`${id}\` workflow`, { id }) }
  if (flow.builtIn) return { ok: false, ...refusal('workflowBuiltInRename', `\`${flow.name}\` is built in — duplicate it to make one you can rename`, { name: flow.name, workflow: flow.id }) }
  const wanted = trimmedName(name)
  if (!wanted) return { ok: false, ...refusal('workflowUnnamed', 'a workflow needs a name') }
  if (nameTaken(wanted, id)) return { ok: false, ...refusal('workflowTaken', `this board already has a workflow called "${wanted}"`, { name: wanted }) }
  return save((block) => {
    const added = Array.isArray(block.added) ? [...block.added] : []
    block.added = added.map((entry) => {
      const row = configBlock(entry)
      return row.id === id ? { ...row, name: wanted } : row
    })
  })
}

/** Turn **Use a Git worktree** on or off for one of the board's own (#874). Only deliveries
 *  started afterwards follow it. */
export function setWorkflowWorktree(id: string, on: boolean): Write {
  const flow = workflowById(id)
  if (!flow) return { ok: false, ...refusal('workflowNotFound', `this board has no \`${id}\` workflow`, { id }) }
  if (flow.builtIn) return { ok: false, ...refusal('workflowBuiltInChange', `\`${flow.name}\` is built in — duplicate it to make one you can change`, { name: flow.name, workflow: flow.id }) }
  return save((block) => {
    const added = Array.isArray(block.added) ? [...block.added] : []
    block.added = added.map((entry) => {
      const row = configBlock(entry)
      return row.id === id ? { ...row, needsArtifact: !on } : row
    })
  })
}

/** Take the "an assignment was removed" mark off one workflow (#945) — **Got it** in the
 *  Workflows pane. The assignment itself is already gone; this is only the telling. */
export function dismissRetiredAssignment(id: string): Write {
  if (!workflowById(id)) return { ok: false, ...refusal('workflowNotFound', `this board has no \`${id}\` workflow`, { id }) }
  return save((block) => {
    const kept = retiredRows({ workflows: block }).filter((one) => one !== id)
    if (kept.length) block.retired = kept
    else delete block.retired
  })
}

/** Drop one of the board's own, with the assignments it carried. Whoever calls this checks
 *  first that no open card still runs on it — the cards are the board's to walk, not this
 *  file's. */
export function deleteWorkflow(id: string): Write {
  const flow = workflowById(id)
  if (!flow) return { ok: false, ...refusal('workflowNotFound', `this board has no \`${id}\` workflow`, { id }) }
  if (flow.builtIn) return { ok: false, ...refusal('workflowBuiltInDelete', `\`${flow.name}\` is built in and cannot be deleted`, { name: flow.name, workflow: flow.id }) }
  return save((block) => {
    const added = Array.isArray(block.added) ? block.added : []
    const kept = added.filter((entry) => configBlock(entry).id !== id)
    if (kept.length) block.added = kept
    else delete block.added
    const stages = configBlock(block.stages)
    delete stages[id]
    if (Object.keys(stages).length) block.stages = stages
    else delete block.stages
    const marked = retiredRows({ workflows: block }).filter((one) => one !== id)
    if (marked.length) block.retired = marked
    else delete block.retired
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
  if (!flow) return { ok: false, ...refusal('workflowNotFound', `this board has no \`${id}\` workflow`, { id }) }
  const before = liveStage(flow, stage)
  const setup: WorkflowStageSetup = { ...before, helpers: before.helpers.map((h) => ({ ...h })) }
  change(setup)
  const movedHelpers =
    before.helpersChosen ||
    setup.helpers.length !== before.helpers.length ||
    setup.helpers.some(
      (h, i) => h.agent !== before.helpers[i]!.agent || h.extra !== before.helpers[i]!.extra || !h.off !== !before.helpers[i]!.off,
    )
  return save((block) => {
    const stages = configBlock(block.stages)
    const mine = configBlock(stages[id])
    const written = {
      ...(flow.builtIn ? {} : { lead: setup.lead }),
      ...(movedHelpers ? { helpers: setup.helpers.map(toRow) } : {}),
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
  if (!owner) return { ok: false, ...refusal('workflowNotFound', `this board has no \`${id}\` workflow`, { id }) }
  if (owner.builtIn) {
    return {
      ok: false,
      ...refusal(
        'workflowBuiltInLeads',
        `\`${owner.name}\` is built in — its lead agents are fixed. Duplicate it to make one you can reassign.`,
        { name: owner.name, workflow: owner.id },
      ),
    }
  }
  const wanted = agent.trim()
  if (wanted) {
    const found = agentRoster().find((entry) => entry.name === wanted)
    if (!found) return { ok: false, ...refusal('agentNotFound', `this board has no \`${wanted}\` agent`, { agent: wanted }) }
    if (found.stage !== stage) return { ok: false, ...refusal('agentCannotLead', `\`${wanted}\` is a ${found.stage ?? 'board'} agent and cannot lead ${stage}`, { agent: wanted, assigned: found.stage ?? 'board', stage }) }
    // A lead saved before #846 keeps running; only a new pick is held to the declaration.
    if (!found.canLead && owner.stages[stage].lead !== wanted) {
      return { ok: false, ...refusal('agentNotLead', `\`${wanted}\` declares \`akb.hook\`, not \`akb.lead\`, so it can only help`, { agent: wanted }) }
    }
    const refused = elsewhere(wanted, id)
    if (refused) return refused
  }
  if (owner.stages[stage].helpers.some((h) => h.agent === wanted)) {
    return { ok: false, ...refusal('agentHelps', `\`${wanted}\` is already a hook of this stage, so it cannot lead it`, { agent: wanted }) }
  }
  return setStage(id, stage, (setup) => {
    setup.lead = wanted
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

/** Enable or disable one helper of one stage (#1095). An agent no workflow lists is taken
 *  into this one; one another workflow lists is refused, and a lead is always on. */
export function switchWorkflowAgent(id: string, stage: WorkflowStage, agent: string, on: boolean): Write {
  const wanted = canonicalSpecAgent(agent.trim())
  const flow = workflowById(id)
  if (!flow) return { ok: false, ...refusal('workflowNotFound', `this board has no \`${id}\` workflow`, { id }) }
  if (flow.stages[stage].lead === wanted) {
    return { ok: false, ...refusal('agentLeads', `\`${wanted}\` leads this stage, so it is always on`, { agent: wanted }) }
  }
  // One already here only changes state; one taken in has to be able to help.
  if (!liveStage(flow, stage).helpers.some((h) => h.agent === wanted)) {
    const found = agentRoster().find((entry) => entry.name === wanted)
    if (!found) return { ok: false, ...refusal('agentNotFound', `this board has no \`${wanted}\` agent`, { agent: wanted }) }
    if (found.stage !== stage) return { ok: false, ...refusal('agentCannotHelp', `\`${wanted}\` is a ${found.stage ?? 'board'} agent and cannot help ${stage}`, { agent: wanted, assigned: found.stage ?? 'board', stage }) }
    if (found.canLead) {
      return { ok: false, ...refusal('agentLeadNotHelper', `\`${wanted}\` can lead a stage, so it is never a hook of one — it would run a second full ${stage}`, { agent: wanted, stage }) }
    }
    const refused = elsewhere(wanted, id)
    if (refused) return refused
  }
  return setStage(id, stage, (setup) => {
    const one = setup.helpers.find((h) => h.agent === wanted)
    if (!one) setup.helpers.push({ agent: wanted, extra: '', ...(on ? {} : { off: true }) })
    else if (on) delete one.off
    else one.off = true
  })
}

/** Enable one helper of one stage — what a new agent made in the pane gets. */
export const addWorkflowHelper = (id: string, stage: WorkflowStage, agent: string): Write =>
  switchWorkflowAgent(id, stage, agent, true)

/** Drop a deleted agent from every stage that saved it, so a later agent of the same name
 *  starts in no workflow. */
export function forgetWorkflowAgent(agent: string): Write {
  return save((block) => {
    const all = configBlock(block.stages)
    for (const [id, flow] of Object.entries(all)) {
      const mine = configBlock(flow)
      for (const [stage, value] of Object.entries(mine)) {
        const one = configBlock(value)
        if (Array.isArray(one.helpers)) one.helpers = one.helpers.filter((h) => configBlock(h).agent !== agent)
        mine[stage] = one
      }
      all[id] = mine
    }
    if (Object.keys(all).length) block.stages = all
  })
}

/** What this assignment asks of a helper on top of its own instructions. It belongs to the
 *  ASSIGNMENT, so an agent that does not help this stage is refused rather than written down
 *  as a requirement nothing would ever read. Empty clears it and leaves the agent's own
 *  instructions exactly as they were. */
export function setWorkflowHelperExtra(id: string, stage: WorkflowStage, agent: string, extra: string): Write {
  const wanted = agent.trim()
  const flow = workflowById(id)
  if (!flow) return { ok: false, ...refusal('workflowNotFound', `this board has no \`${id}\` workflow`, { id }) }
  if (!liveStage(flow, stage).helpers.some((h) => h.agent === wanted)) {
    return { ok: false, ...refusal('agentNotHelping', `\`${wanted}\` does not help the ${stage} stage of "${flow.name}"`, { agent: wanted, stage, name: flow.name, workflow: flow.id }) }
  }
  return setStage(id, stage, (setup) => {
    setup.helpers = setup.helpers.map((h) => (h.agent === wanted ? { ...h, extra } : h))
  })
}

// ---- scheduled agents (#1401) -------------------------------------------------
//
// A workflow's scheduled agents run by themselves on a cadence, on no card. Like a stage's
// hooks they are the workflow's own and are only switched; the cadence, the extra requirements
// and when each last passed are kept with the assignment.

const scheduleAgents = (): Set<string> => new Set(specAgentCatalog().agents.filter((a) => a.schedule).map((a) => a.name))

/** Every scheduled agent one workflow has, disabled ones included, minus any this board no
 *  longer has. */
export function scheduledMembers(flow: Workflow): WorkflowScheduled[] {
  const names = scheduleAgents()
  return flow.scheduled.filter((h) => names.has(h.agent))
}

/** One scheduled agent of one workflow, or undefined when it has no such agent. */
export const scheduledAgent = (id: string, agent: string): WorkflowScheduled | undefined => {
  const flow = workflowById(id)
  return flow ? scheduledMembers(flow).find((h) => h.agent === canonicalSpecAgent(agent.trim())) : undefined
}

/** The stamp one scheduled agent's cadence counts from: the later of its last pass and the
 *  moment it was first looked at or switched on. Empty when it has neither yet. */
export const scheduledClock = (one: WorkflowScheduled): string =>
  [one.lastRun, one.since ?? ''].filter((stamp) => parseStamp(stamp)).sort().pop() ?? ''

function setScheduled(id: string, change: (rows: WorkflowScheduled[]) => Write | void): Write {
  const flow = workflowById(id)
  if (!flow) return { ok: false, ...refusal('workflowNotFound', `this board has no \`${id}\` workflow`, { id }) }
  const rows = scheduledMembers(flow).map((h) => ({ ...h }))
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
    let one = rows.find((h) => h.agent === wanted)
    if (!one) {
      if (!scheduleAgents().has(wanted)) {
        const known = agentRoster().some((entry) => entry.name === wanted)
        return known
          ? { ok: false, ...refusal('agentNotSchedule', `\`${wanted}\` does not declare \`akb.hook: schedule\`, so it cannot run on a cadence`, { agent: wanted }) }
          : { ok: false, ...refusal('agentNotFound', `this board has no \`${wanted}\` agent`, { agent: wanted }) }
      }
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

/** Write where a scheduled agent that has never run counts from — the scheduler's first look.
 *  False when nothing was written. */
export function startScheduledClock(id: string, agent: string, now: Date = new Date()): boolean {
  return setScheduled(id, (rows) => {
    const one = rows.find((h) => h.agent === agent)
    if (!one || scheduledClock(one)) return { ok: false, error: '' }
    one.since = formatStamp(now)
  }).ok
}

/** Record a pass that PASSED, by when it began. A failed or stopped one records nothing, so
 *  the agent is tried again a cadence later. */
export function stampScheduledRun(id: string, agent: string, startedAt: Date): boolean {
  return setScheduled(id, (rows) => {
    const one = rows.find((h) => h.agent === agent)
    if (!one) return { ok: false, error: '' }
    one.lastRun = formatStamp(startedAt)
  }).ok
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
export const cardWorkflowId = (id: number): string => cardMeta(id)?.workflow ?? ''

/** A card's frontmatter, straight off its file, or null when it is not there. */
export function cardMeta(id: number): Meta | null {
  // Every step of this is best-effort. It is read on the way into a prompt, and a folder
  // that is not there — a half-made board, a card already archived away — means the card
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
      WORKFLOW_STAGES.map((stage) => [
        stage,
        { lead: flow.stages[stage].lead, helpers: stageHelpers(flow, stage).map((h) => ({ agent: h.agent, extra: h.extra })) },
      ]),
    ),
  }
}

// ---- what a screen draws ---------------------------------------------------

const candidateOf = (entry: RosterEntry): WorkflowCandidate => ({
  name: entry.name,
  title: entry.title,
  gloss: entry.gloss,
  builtIn: entry.builtIn,
  ...(entry.canLead ? { canLead: true } : {}),
})

/** Every workflow this board has, with each stage's lead, helpers and candidates. One read
 *  for the whole pane: the roster is walked once rather than once per stage per workflow. */
export function workflowViews(): WorkflowView[] {
  const roster = agentRoster()
  const { flows, owners } = resolved()
  const candidates = (stage: WorkflowStage, id: string): WorkflowCandidate[] =>
    roster.filter((e) => e.stage === stage && [id, ''].includes(owners.get(e.name) ?? '')).map(candidateOf)
  return flows.map((flow) => ({
    id: flow.id,
    name: flow.name,
    builtIn: flow.builtIn,
    ...(flow.builtIn ? { description: builtinDescription(flow.id) } : {}),
    isDefault: flow.id === DEFAULT_WORKFLOW,
    needsArtifact: flow.needsArtifact,
    delivers: flow.delivers,
    pro: flow.pro,
    retiredAssignment: flow.retiredAssignment,
    stages: WORKFLOW_STAGES.map((stage) => {
      const setup = liveStage(flow, stage)
      return { stage, lead: setup.lead, helpers: setup.helpers, candidates: candidates(stage, flow.id) }
    }),
    scheduled: scheduledMembers(flow).map((one): WorkflowScheduledView => {
      const entry = roster.find((e) => e.name === one.agent)
      const due = scheduledNext(flow.id, one)
      return {
        ...one,
        title: entry?.title ?? '',
        gloss: entry?.gloss ?? '',
        builtIn: entry?.builtIn ?? false,
        nextRun: due ? formatStamp(due.next) : '',
        ...(due?.reason ? { waiting: due.reason } : {}),
        auto: scheduledAuto(one.agent),
      }
    }),
    problems: workflowProblems(flow.id),
  }))
}
