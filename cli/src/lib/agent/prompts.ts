// The one place a board action turns into words for an agent.
//
// Every prompt lives here, so a run started in a terminal and the same run started from a
// button say exactly the same thing. Only the opening — how this agent is asked for the
// skill — follows the agent that runs; everything after it is the same for all of them.

import path from 'node:path'
import { locate, locateArchived } from '../cards'
import { PLANNER, planningMemoryFiles } from '../memory'
import { findGuide } from '../guide'
import { ARCHIVE, boardText, rel, GOAL, MEMORY, TRIAGE } from '../paths'
import {
  agentFilesBlock,
  agentMemoryBlock,
  findSpecAgent,
  specAgentInstructions,
  specAgentOutput,
  specAgentSelector,
  type SpecAgent,
} from '../agents'
import { boardCommand, boardCommandFor, commandNote } from './command'
import { activeDelivery, deliveryFor, findDelivery, withWorkflow } from './deliveries'
import { owesFocusedReview } from './review'
import { DELIVERY_FLOWS } from './flows'
import { languageNote } from './language'
import { agentImages, skillCall } from './resolve'
import { agentForRun, workflowForRun } from './runner'
import { DEFAULT_WORKFLOW, frozenReviewers, liveStage, workflowById, workflowFor } from './workflows'
import { stageOfAction } from './stage-end'
import type { Stage } from './stages'
import type { WorkflowStage } from './types'
import { migrateFlowRules, ruleBlock } from './rules'
import type { AgentAction, AgentRequest } from './types'
import { SPECIALIST_ACTIONS } from './types'

// What a resumed run says. The coding agent's own session is already there — the card, the
// work done, the error it died on — so this is the "continue" you would type in the
// terminal, not the whole action prompt again.
export const RESUME_PROMPT = [
  `Continue. The previous run ended before it finished the task.`,
  `Pick up where you left off and carry it through.`,
].join(' ')

// And what one resumed INSIDE a delivery says. A delivery is not picked up where the last
// run's sentence stopped — it is picked up by re-entering its flow and asking each step
// whether its precondition is already met, because a run that was cut off may well have
// finished the step it died in. Nothing here trusts the position the record kept: a stored
// position goes stale in exactly the crash it exists for.
const DELIVERY_RESUME = [
  `Continue delivery %s. The previous run ended before the delivery finished.`,
  `Re-enter the flow from the top and check each step's precondition before you do it — work that is already done is done, so do not repeat it.`,
].join(' ')

// And the last line, which says where the requirements are. A card file can have moved
// under the delivery, so the copy it is building from is what to read. A **Build now** that
// ended before it wrote its card (#470) has no file and no command that prints one, so the
// typed sentence is quoted here — this is the whole of what a restarted run would otherwise
// be left without.
const DELIVERY_RESUME_CARD = `Build the card as the delivery holds it, not as the file reads now: \`%c\` prints the approved copy.`

/** Resume the same action; only implementation receives build requirements. */
export function resumePrompt(deliveryId: string | undefined, cardId: number | null, action: AgentAction): string {
  if (!deliveryId) return RESUME_PROMPT
  if (action === 'review' || action === 'conflict') {
    return `${RESUME_PROMPT} Continue with \`${boardCommandFor(cardId ?? undefined)} delivery ${action} ${deliveryId} --print\`.`
  }
  if (action !== 'implement') return RESUME_PROMPT
  const lead = DELIVERY_RESUME.replace('%s', deliveryId)
  if (cardId !== null) {
    return `${lead} ${DELIVERY_RESUME_CARD.replace('%c', `${boardCommandFor(cardId)} card implement ${cardId} --print`)}`
  }
  const delivery = findDelivery(deliveryId)
  const approved = delivery?.approved.trim()
  if (!approved) return lead
  // Started from a plan (#481), the approved copy is a whole document — it cannot be quoted
  // as the sentence below is, and the file it came from may have been rewritten since, so
  // what the delivery froze is set out here in full.
  if (delivery?.plan) {
    return `${lead} No card was written yet: write it from the plan this delivery was approved to build, as \`akb guide implement\` says, then build exactly that and nothing more. It came from \`${delivery.plan}\`, and this is the copy to build:\n\n${approved}`
  }
  return `${lead} No card was written yet: write it from this sentence as \`akb guide implement\` says, then build exactly it and nothing more — "${approved}".`
}

/** A format repair continues the same run without repeating its task. */
export function contractRepairPrompt(req: AgentRequest, errors: string): string {
  const command = boardCommandFor(req.id)
  return boardText([
    'The task ended with invalid card formatting. Fix only the errors below in the listed files. Preserve planned behavior and completed work; do not repeat the task or request other agents.',
    errors,
    `Run \`${command} raw validate <id>\` for every affected card and fix every error before finishing.`,
    languageNote(),
    ruleBlock(req, frozenRules(req)),
  ].filter(Boolean).join('\n\n'))
}

// The actions whose ask can be said again from the record alone. A resume drops what the
// user typed on purpose — it was already in the conversation being continued — so an action
// that is mostly those words (a revise's request, a reject's reason, a create's requirement,
// a plan's version) has nothing left to rebuild from, and is not restarted. A `write` run is
// left out for the same reason: the note naming the files it was asked for is its whole job.
const RESTARTABLE: ReadonlySet<AgentAction> = new Set<AgentAction>([
  'implement',
  'run',
  'clarify',
  'resolve',
  'decide',
  'writing',
  'archive',
  'spec',
  'review',
  'conflict',
])

// What opens a restart. Everything the resume prompt leans on is gone, so the whole ask
// follows this line — the run does the task again rather than finishing a sentence.
const RESTART_LEAD = [
  `The session you were continuing is gone, and this one holds nothing of it.`,
  `Do the task below from the top, checking each step's precondition before you do it — work an earlier run already finished is done, so don't repeat it.`,
].join(' ')

/** Restart a lost conversation with its original action. Builds recover approved requirements;
 *  other restartable actions receive their own ask. */
export function restartPrompt(req: AgentRequest, deliveryId?: string): string | undefined {
  // A run that names neither a card nor a delivery has no ask to write down again.
  if (req.id === undefined && !req.deliveryId && !deliveryId) return undefined
  if (deliveryId && req.action === 'implement') return resumePrompt(deliveryId, req.id ?? null, req.action)
  if (!RESTARTABLE.has(req.action)) return undefined
  return [RESTART_LEAD, buildPrompt(req)].join('\n\n')
}

// Nothing here asks a run to refine the card afterwards. A command does one job and stops;
// the refinement sessions that follow are started once it ends (`refine.ts`), so each has
// its own log and can be stopped on its own.

// Every action that revises a card revises the CARD — the revision request says what the
// text should say, not "go build it". Without this line an agent reads a request like
// "make it handle empty input" as the work itself and writes code. A request that explicitly
// asks for implementation still gets it. Not on create (it carries its own "create only"
// line) and not on a resolve asked to carry on and implement.
const NO_IMPLEMENT = `(Unless the request explicitly asks for implementation, don't implement it.)`

/** The words one run is given, WITHOUT this board's own rule for the flow.
 *
 *  Every prompt ends with how the board's command is spelled on this machine, when it isn't
 *  `akb`. The skill's note carries the same rule, but a run is not owed a working note: it
 *  can be started from a button by someone who never installed one, and the first `akb` line
 *  it copies out of a flow is a poor place to find that out.
 *
 *  Split out from `buildPrompt` for the one caller that needs the ask alone: a printed flow
 *  puts the rule at the very end, after the flows themselves (`flow.ts`).
 *
 *  The language the board is read in rides here rather than in `buildPrompt` (#337): a
 *  printed flow is built from the ask alone, and `--print` is how the work is done in the
 *  user's own session. */
export function buildAsk(rawReq: AgentRequest, notes: string[] = []): string {
  const req = withWorkflow(rawReq)
  // A delivery's runs work in that delivery's own worktree, so their board commands
  // name the project's own copy outright (#303). Everything else runs in the project and
  // spells the command the ordinary way.
  const command = DELIVERY_FLOWS.has(req.action) ? boardCommandFor(req.id) : boardCommand()
  const ask = [actionPrompt(req, command, notes), pictureNote(req), commandNote(command)].filter(Boolean).join(' ')
  // `docs/kanban` in these words is this board's real folder (#407) — the same swap the
  // flows get, so the ask and the flow it names never disagree about where the board is.
  return boardText([ask, languageNote(), roster(req)].filter(Boolean).join('\n\n'))
}

// What one workflow asks of a helper it calls in, on top of the agent's own instructions
// (#715). Read off the delivery's frozen copy when the run is part of one, and off the board
// otherwise — the same rule a rule follows.
//
// It belongs to the ASSIGNMENT: the same agent helping two workflows carries a different one
// in each, and an agent no workflow calls in carries none.
function helperExtra(req: AgentRequest): string {
  const agent = req.specAgent ?? ''
  if (!agent) return ''
  const stage = stageOfAction(req.action)
  const which = stage ? WORKFLOW_OF_STAGE[stage] : undefined
  if (!which) return ''
  const frozen = deliveryFor(req)?.workflow
  const setup = frozen
    ? frozen.stages[which]
    : (() => {
        const flow = workflowFor(workflowForRun(req))
        return flow ? liveStage(flow, which) : undefined
      })()
  const extra = setup?.helpers.find((h) => h.agent === agent)?.extra?.trim()
  return extra ? `——— what this workflow asks of you here ———\n\n${extra}` : ''
}

// Which configurable stage a kernel stage is. `discuss` is none of them: a conversation
// belongs to the board rather than to any card's workflow.
const WORKFLOW_OF_STAGE: Partial<Record<Stage, WorkflowStage>> = {
  plan: 'plan',
  build: 'execute',
  review: 'review',
}

// The `--workflow` a create is told to pass. Nothing on the default: a card written without
// the key runs on the default anyway, and a flag that changes nothing is a flag to get wrong.
function createWorkflowNote(req: AgentRequest): string {
  const id = (req.workflow ?? '').trim()
  if (!id || id === DEFAULT_WORKFLOW) return ''
  const flow = workflowById(id)
  if (!flow) return ''
  return `Put the new card(s) on the "${flow.name}" workflow: \`--workflow ${flow.id}\`.`
}

/** The words one run is given, this board's own rule for the flow last (#306). It goes
 *  after everything else the board writes, so nothing of the board's follows the user's. */
export function buildPrompt(rawReq: AgentRequest, notes: string[] = []): string {
  const req = withWorkflow(rawReq)
  return [buildAsk(req, notes), leadBlock(req), ruleBlock(req, frozenRules(req))].filter(Boolean).join('\n\n')
}

/** A leading agent's own instructions, for a run it leads (#822, #846). Laid over the shared
 *  flow, never in place of it. */
export function leadBlock(req: AgentRequest): string {
  // Helping, it is handed its body by the spec flow instead.
  if (SPECIALIST_ACTIONS.has(req.action)) return ''
  const name = agentForRun(req)
  const agent = name ? findSpecAgent(name) : null
  if (!agent?.canLead) return ''
  const files = agentFilesBlock(agent)
  const human = specAgentOutput(agent) === 'human'
  return boardText(
    [
      `——— you, the \`${agent.name}\` agent — where this differs from the shared flow, follow this ———\n\n${agent.body}`,
      human
        ? `Your output is set to be reviewed by me: write it in \`\`## By \`${agent.name}\` agent\`\`, above \`<!-- agent -->\`, and leave it there. With nothing to show yet, write one line saying so.`
        : '',
      files ? `——— your own files ———\n\n${files}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  )
}

/** The pictures pasted into the create sheet (#517), as files to open — that is the only
 *  thing an agent can do with a path, and the words the user typed alongside them say what
 *  they are for.
 *
 *  Only for a connector that reads a path out of the words. One with a flag per file is
 *  handed them on its command line and told nothing here (agent/watch.ts), exactly as a
 *  conversation hands them over (agent/chat.ts).
 *
 *  The connector asked is the one THIS run spawns — its agent's, or the runtime it was
 *  started on instead (#518), which is what the spawn hands the files to. */
function pictureNote(req: AgentRequest): string {
  const files = req.pictures ?? []
  if (!files.length || agentImages(agentForRun(req), req.runtime)?.as !== 'message') return ''
  const one = files.length === 1
  return (
    `${one ? 'A picture came' : `${files.length} pictures came`} with this. ` +
    `Read ${one ? 'it' : 'them'} first: ${files.join(', ')}.`
  )
}

/** The rules the delivery in flight on this card froze when it started, or nothing when
 *  this run is not part of one. A delivery's runs work to the rules it started with, the
 *  way they build the card it started with. */
export function frozenRules(req: AgentRequest): Record<string, string> | undefined {
  if (req.action === 'spec' && req.id !== undefined && findSpecAgent(req.specAgent ?? '')?.stage === 'review') {
    return activeDelivery(req.id)?.rules
  }
  return deliveryFor(req)?.rules
}

// The specialists a pass may call in — the catalog, not a rule about any one of them.
// Naming any of them in a flow instead would go stale the moment one is switched off or a
// new one ships.
//
// The passes that rewrite a plan are the ones that can tell what it still has no answer for,
// so they are the ones that pick the `spec` agents.
//
// A specialist run is given neither (#403): a roster belongs to the run doing the job, and
// an agent handed the list of agents is an agent that can ask for itself.
//
// It goes after everything else because it is a block and the rest is prose.
const SPEC_SELECTOR_FOR = new Set<AgentAction>(['clarify', 'resolve', 'edit'])

// What the gater and the decider are given on top of the card (#493). Both stand in for the
// user rather than writing one card, so both read the whole board — the goal, and every
// module's decisions and rejections — and neither writes a line of it back.
const boardMemory = (): string => [rel(GOAL), ...planningMemoryFiles()].join(', ')

// Where a completed card is now (#534). Named outright rather than left to a search: the
// ordinary card read no longer finds it, so a run told only the folder would hunt through
// every card the board has ever finished. The folder is the fallback for the one case that
// cannot happen — a reflection whose card is not in the archive.
function archivedCardFile(id: number | undefined): string {
  const found = id === undefined ? null : locateArchived(id)
  if (!found) return `${rel(ARCHIVE)}/`
  return rel(found.kind === 'group' ? path.join(found.target, 'root.md') : found.target)
}

function roster(req: AgentRequest): string {
  if (req.id === undefined) return ''
  // The card's own workflow, not only the one the request carries (#749): the ask this block
  // invites is checked against the card's, and a list that offered a different team would be
  // a run told to ask for agents its card refuses.
  if (SPEC_SELECTOR_FOR.has(req.action)) return specAgentSelector(req.id, workflowForRun(req))
  return ''
}

/** The words one run is given, and anything the board owes that run's log before the agent
 *  says a word: a spec agent's setting whose saved value it no longer offers and has fallen
 *  back, and the one-time fold of a board's per-flow rules onto its agents (#420). */
export function buildRun(req: AgentRequest): { prompt: string; notes: string[] } {
  const notes: string[] = migrateFlowRules()
  return { prompt: buildPrompt(req, notes), notes }
}

// One reviewer, printed inside the review that picked it (#820): its instructions, and what
// the delivery's workflow asks of it on top.
function reviewerPrompt(req: AgentRequest, agent: SpecAgent, kb: string, named: string, notes: string[]): string {
  const own = specAgentInstructions(agent)
  notes.push(...own.notes)
  const memory = agentMemoryBlock(agent)
  const delivery = req.id === undefined ? undefined : activeDelivery(req.id)
  const extra = frozenReviewers(delivery?.workflow).find((h) => h.agent === agent.name)?.extra.trim()
  return [
    [
      `${kb}. You are the \`${agent.name}\` reviewer on the delivery in flight on task ${req.id} ${named}.`,
      `Review it by your instructions below, in the review run that picked you, and give your verdict before the next reviewer starts.`,
      `Keep your memory as **Memory** in \`akb guide spec-agent\` says.`,
      req.notes ? `What the review wants looked at: ${req.notes}` : '',
      `Don't ask me questions with human-in-the-loop — an open question on the card is how you defer to me.`,
    ]
      .filter(Boolean)
      .join(' '),
    `——— you, the \`${agent.name}\` agent ———\n\n${own.instructions}`,
    ...own.references.map((r) => `——— ${r.title} ———\n\n${r.text}`),
    own.files ? `——— your own files ———\n\n${own.files}` : '',
    memory ? `——— what you remember ———\n\n${memory}` : '',
    extra ? `——— what this workflow asks of you here ———\n\n${extra}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** What a review or a conflict run is aimed at, and what its flow is typed with: the card
 *  where there is one, the delivery itself where there is not (#428). */
function deliveryAim(
  req: AgentRequest,
  delivery: { deliveryId: string } | undefined,
): { subject: string; arg: string } {
  if (req.id !== undefined) {
    return { subject: `Task ${req.id}${req.title ? ` ("${req.title}")` : ''}`, arg: String(req.id) }
  }
  const id = req.deliveryId ?? delivery?.deliveryId ?? ''
  return { subject: `Delivery ${id} (a build with no card)`, arg: id }
}

/** What a pass applying answers is told when a delivery is already building the card (#637).
 *  It is the one thing that can tell a confirmation from a change; the board never compares
 *  the card's text, and reads silence as unchanged (#831). Empty when nothing is building the card. */
function answeredNote(cardId: number | undefined, command: string): string {
  const delivery = cardId === undefined ? undefined : activeDelivery(cardId)
  if (!delivery) return ''
  return (
    `Delivery ${delivery.deliveryId} is already building this card. Once your answers are on it, say what they did ` +
    `to what it was approved to build: \`${command} delivery answered ${delivery.deliveryId} ` +
    `--changed|--unchanged "<why>"\`, before you drop the questions. Judge the meaning, not the words — say ` +
    `nothing and the board carries the build on as unchanged.`
  )
}

function actionPrompt(req: AgentRequest, command: string, notes: string[]): string {
  // How this agent calls the skill — the only part of a prompt that follows the connector.
  // It is the connector THIS RUN spawns: the one its agent runs (#443), or the runtime the
  // run was started on instead (#518) — never the board's default. A `/kanban` sent to Codex
  // is plain chat text and the skill never loads.
  const kb = skillCall(agentForRun(req), req.runtime)
  const tag = req.id ? `#${req.id}` : ''
  const named = req.title ? `${tag} ("${req.title}")` : tag
  // Retired (#438): nothing starts a propose any more, so there is no ask left to write.
  if (req.action === 'propose') return ''
  switch (req.action) {
    // A build that writes its own card (#470): the typed sentence IS the requirement, so it
    // is quoted here rather than pointed at, and the run's first act is the card it holds.
    // Answered off the plan handoff it is a plan instead (#481), named the way a create off one
    // is: the words are in the file, and a copy pasted in here would go stale.
    // The release the board was showing comes with it, exactly as it does on a create.
    case 'implement':
      if (req.id === undefined) {
        return [
          req.plan
            ? `${kb}. Build the plan at \`${req.plan}\`. Read it first — it is the whole requirement.`
            : `${kb}. Build this: "${req.description?.trim() ?? ''}".`,
          req.plan
            ? `Follow \`akb guide implement\` — write its card first, from that plan, then build it.`
            : `Follow \`akb guide implement\` — write its card first, from that sentence, then build it.`,
          req.release ? `Put the new card in the "${req.release}" release: \`--release ${req.release}\`.` : '',
          createWorkflowNote(req),
          `Resolve routine choices yourself; record blockers needing user action on the card following \`akb guide update-questions\`.`,
        ]
          .filter(Boolean)
          .join(' ')
      }
      return [
        `${kb}. Implement task ${req.id} ${named} following \`akb guide implement\`.`,
        req.notes ? `Extra notes: ${req.notes}` : '',
      ]
        .filter(Boolean)
        .join(' ')
    // One pass of a recurring card. It is not an implement: the card is a job that repeats,
    // so the run does its `## Process` and leaves the card on the board.
    //
    // Nothing here about recording the run. That is the board's bookkeeping and the run
    // itself does it at the close (see the supervisor) — an agent asked to stamp its own
    // scheduling state is one crash away from freezing the card.
    //
    // And nothing here about how a run goes. The card's `## Process` is the job, and the
    // protocol around it — questions and never archiving — is the same for
    // every recurring card, so it belongs in the guide, not in a prompt rebuilt every run.
    case 'run':
      return [
        `${kb}. Run recurring task ${req.id} ${named} — one pass, following \`akb guide recurring-task\`.`,
        req.notes ? `Extra notes: ${req.notes}` : '',
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ]
        .filter(Boolean)
        .join(' ')
    case 'reject':
      return [
        req.discard === true
          ? `${kb}. Discard task ${req.id} ${named} — drop it and write no memory. Reason: ${req.reason || '(none given)'}.`
          : `${kb}. Reject task ${req.id} ${named}. Reason: ${req.reason || '(none given)'}.`,
        `Follow \`akb guide reject\`.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ].join(' ')
    case 'archive':
      return [
        `${kb}. Archive task ${req.id} ${named}.`,
        `Follow "Finish a task" in \`akb guide board\`.`,
        req.notes ? `Extra notes: ${req.notes}` : '',
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ]
        .filter(Boolean)
        .join(' ')
    case 'edit':
      return [
        `${kb}. Revise task ${req.id} ${named}: "${req.notes || ''}" ${NO_IMPLEMENT}`,
        `Apply the requested change following \`akb guide revise\`, then validate the updated plan following \`akb guide qa-lightweight\`.`,
        `You can create new subtasks if it's a group task and the intent is to do so.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ].join(' ')
    case 'create':
      return [
        // A create off a plan (#427) names the file rather than carrying its words: the
        // plan is a file the user can open, and a copy pasted in here would go stale. Several
        // plans from one discussion go as one request (#917).
        req.plans && req.plans.length > 1
          ? `${kb}. Add task(s) from these plans, written in one discussion: ${req.plans.map((p) => `\`${p}\``).join(', ')}. Read every one first and plan them as one request: merge overlapping requirements into one card, and record dependencies between cards. Write \`## Source\` on every card naming each plan it came from; a plan no new card names is handed back to the discussion as not planned.`
          : req.plan
          ? `${kb}. Add task(s) from the plan at \`${req.plan}\`. Read it first, and write \`## Source\` naming that path on every card you create.`
          : req.triage
            ? `${kb}. Add a task from the triage item at \`${req.triage.file}\`. Read it first, and write \`## Source\` naming its source id \`${req.triage.sourceId}\`. Then run \`${command} triage archive ${req.triage.sourceId} --card <id>\` with the new card, or with the open card that already owns this work instead of creating one.`
            : `${kb}. Add task(s) from this requirement: "${req.description || ''}".`,
        `Follow \`akb guide add-task\`. Create task only, don't implement it.`,
        "Cover what the requests asks for, DONT OVER DESIGN IT.",
        // The board was showing one release when this was asked for, so the card ships in
        // it — otherwise it would land in no release, off the screen of the person who
        // just wrote it.
        req.release ? `Put the new card(s) in the "${req.release}" release: \`--release ${req.release}\`.` : '',
        // The workflow the sheet was on when this was asked for (#715), when it is not the
        // board's default. A card written without it runs on the default, which is exactly
        // what every card written before workflows existed does.
        createWorkflowNote(req),
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ]
        .filter(Boolean)
        .join(' ')
    // Plan one release against its goal. The run reads the goal off the release's own line,
    // moves in the open cards that ship it, and writes the cards the goal needs that the
    // board hasn't got — deciding all of it on its own, and saying in its log what it
    // moved, what it wrote, and what it left.
    //
    // The release id is all this prompt carries: the goal is on the board, and a copy
    // pasted in here would go stale the moment the user changed it.
    case 'plan-release':
      return [
        `${kb}. Plan the "${req.release || ''}" release following \`akb guide plan-release\`:`,
        `move in the open cards that ship its goal, and write the cards the goal needs that the board is missing.`,
        `Create the cards only, don't implement them.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ].join(' ')
    // Write one closed version's changelog (#232). Like a plan run it carries only the
    // version id: the goal and the cards are in the file the close just wrote, and a copy
    // pasted in here would be a second reading of it.
    case 'changelog':
      return [
        `${kb}. Write the changelog for the "${req.release || ''}" release following \`akb guide changelog\`.`,
        `Change nothing but that version's summary file, and write it with \`akb raw release changelog\`.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ].join(' ')
    case 'clarify': {
      const qaGuide = req.refineEffort === 'lightweight' ? 'qa-lightweight' : 'qa-loop'
      return [
        `${kb}. Finish planning QA for task ${req.id} ${named} following \`akb guide ${qaGuide}\`.`,
        // A refine has no note box of its own, but one SCHEDULED on a blocked card
        // carries whatever was typed when it was scheduled — often the very reason the user
        // wanted it to wait — so it has to reach the run when it finally fires.
        req.notes ? `Extra notes: ${req.notes}` : '',
      ]
        .filter(Boolean)
        .join(' ')
    }
    // Finish setting the board up (#173) — the one run the board offers before it is a
    // board. It is the only prompt here that does NOT open with the skill call: a board
    // arrives without the skill, and this is the run a user who never opens a coding agent
    // presses, so a prompt leaning on the skill would be a prompt that only worked where
    // the user had already done the thing this run exists to spare them. It names the
    // command instead, and the flow comes back from the command.
    //
    // What it asks for is a place to start, not a list of steps: the checklist is the plan,
    // and the flow picks up at its first unticked box — which is also why a run started
    // again after a failure carries on rather than redoing what finished.
    case 'setup':
      return [
        `Finish setting up the AI4Kanban board in this repo — the one under \`docs/kanban/\`.`,
        `Read \`${command} guide setup\` and \`${command} guide board\` together in your first shell call, then follow setup from the first unticked box in \`docs/kanban/setup-checklist.md\`.`,
        `At the tasks step, read \`${command} guide add-task\` once. Do not call any other guide or help command during setup.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions, the way the setup flow says.`,
      ].join(' ')
    // Squeeze the memory back down to what helps planning (#514). It names nothing: the
    // memory set IS the whole job, so the run reads the folders off the board itself. It
    // raises nothing for a human either — a prune has no card to leave a question on, so
    // anything it cannot settle stays in the memory file it is rewriting.
    case 'prune-memory':
      return [
        `${kb}. Prune this board's memory following \`akb guide prune-memory\`.`,
        `Cover the board's own record at \`${rel(MEMORY)}/\` and every agent's memory at \`${rel(MEMORY)}/agents/<agent>/\`, the ${PLANNER}'s among them.`,
        `Change nothing but those files: no card, no \`verify:\` line, no question for anyone.`,
      ].join(' ')
    // Reading back over the conversations (#748). It names nothing either: which ones have
    // said something new is the flow's answer, and the flow prints them with the memory
    // folder each one's notes belong in. Like a prune it raises nothing for a human — there
    // is no card to leave a question on.
    case 'review-memory':
      return [
        `${kb}. Review what this board's conversations settled and write it into memory, following \`akb guide review-memory\`.`,
        `Read each conversation the flow lists right through, and hold to "What earns a note" in \`akb guide board\`.`,
        `Rewrite or delete a note an earlier review wrote that the conversation has since overturned, rather than adding a second one.`,
        `Change nothing but the memory files: no card, no \`verify:\` line, no question for anyone.`,
      ].join(' ')
    // The dismissal review (#929). The flow lists the dismissals and restored ids; the guide
    // holds every rule.
    case 'review-dismissals':
      return `${kb}. Learn the user's triage preferences from their dismissals, following \`akb guide review-dismissals\`.`
    // Reflecting on a card the board has just completed (#534). The card is off the board,
    // so the ask names the archive: nothing else can find it. What it may write is inbox
    // items and nothing else — a proposal is triaged like anything else that arrives there,
    // so the run never creates, edits or archives a card, and proposing nothing is the
    // result it reports as often as not.
    case 'reflect':
      return [
        `${kb}. Task ${req.id} ${named} has just been completed. Propose the work that should follow it, following \`akb guide reflect\`.`,
        `It has left the board — read it at \`${archivedCardFile(req.id)}\`, and take nothing else as input.`,
        `Judge what is worth proposing against ${boardMemory()}, and skip anything already on the board, already in the inbox, or turned down before.`,
        `Write each survivor with \`${command} triage add\`: that is the whole of what you may write — no card is created, edited or archived, and finding nothing worth proposing is a complete result.`,
        `Don't ask me questions with human-in-the-loop.`,
      ].join(' ')
    // Sorting what is waiting in triage (#561). It names nothing: the items in `triage/` are
    // the whole job, and the flow prints them. What it may write is a card per survivor and a
    // record per judgement — never an existing card, and never a build.
    case 'triage':
      return [
        `${kb}. Sort what is waiting in \`${rel(TRIAGE)}/\` following \`akb guide triage\`.`,
        `Judge each item on its own: skip what is already supported, already on a card, or turned down before, then ask whether it would improve the product.`,
        `A survivor becomes one card with a refine scheduled on it; everything else is ignored with a reason. Record every judgement through \`${command} triage archive\` or \`${command} triage dismiss\`.`,
        `Change nothing else — no existing card, no open question, no build.`,
        `Finish by reporting how many you judged, each new card by id and title, and how many you ignored with the reason for each.`,
        `Don't ask me questions with human-in-the-loop.`,
      ].join(' ')
    // Inject the shared contract, specialty instructions, and selected references.
    case 'spec': {
      const agent = findSpecAgent(req.specAgent ?? '')
      if (agent?.stage === 'review') return reviewerPrompt(req, agent, kb, named, notes)
      const found = req.id === undefined ? null : locate(req.id)
      const cardFile = found ? rel(found.kind === 'group' ? path.join(found.target, 'root.md') : found.target) : `task #${req.id}`
      // The one read of what this agent is set to, taken as the run starts and frozen for
      // it: everything below is assembled from these values (#255).
      const own = agent ? specAgentInstructions(agent) : null
      if (own) notes.push(...own.notes)
      const contract = findGuide('spec-agent')?.text.trim()
      // Who this agent's output is for (#445) — the setting decides, so the run is told the
      // half rather than judging it. The one exception is in the contract below: a section
      // an unanswered `[user]` question points at is lifted until that question is answered.
      const half = agent ? specAgentOutput(agent) : 'agent'
      // What this agent remembers (#421, #833) — after its instructions, so the board's own
      // words end before the agent's do.
      const memory = agent ? agentMemoryBlock(agent) : ''
      return [
        [
          `${kb}. You are the \`${req.specAgent}\` spec agent on task ${req.id} ${named}.`,
          `Card: \`${cardFile}\`. Section: \`\`## By \`${req.specAgent}\` agent\`\`.`,
          half === 'human'
            ? 'Your output is set to be reviewed by me: put your section above `<!-- agent -->`, and leave it there.'
            : 'Your output is set to be read by the agent that builds this: put your section below `<!-- agent -->`, before `## Decided by the agent`.',
          req.notes ? `What the flow that asked for you wants looked at: ${req.notes}` : '',
          `Don't ask me questions with human-in-the-loop — an open question on the card is how you defer to me.`,
        ]
          .filter(Boolean)
          .join(' '),
        contract ? `——— how a spec agent works ———\n\n${contract}` : '',
        agent && own ? `——— you, the \`${agent.name}\` agent ———\n\n${own.instructions}` : '',
        ...(own?.references ?? []).map((r) => `——— ${r.title} ———\n\n${r.text}`),
        own?.files ? `——— your own files ———\n\n${own.files}` : '',
        memory ? `——— what you remember ———\n\n${memory}` : '',
        // What THIS workflow asks of it here (#715) — the assignment's own words, after the
        // agent's instructions and its memory, because it is written on top of them and never
        // in place of them. A card whose workflow does not call this agent in has none.
        helperExtra(req),
      ]
        .filter(Boolean)
        .join('\n\n')
    }
    // Judging a delivery's work (#302). Nothing here says what the card wants or what the
    // diff holds: both are on the board, the flow prints them, and a copy pasted in here
    // would be this file's reading of them. What it DOES say is the one rule a fresh run
    // cannot work out for itself — you did not build this, so do not go looking for the
    // run that did.
    case 'review':
      // A rebase put the target's own changes beside work that already passed (#415). The
      // ask has to say so, or the run goes looking for approved requirements the flow
      // deliberately leaves out and judges the delivery a second time.
    {
      // What this review is aimed at. A build with no card is named by its delivery — the
      // only name it has — and has no card to append a question to (#428), so it says what
      // to do instead of naming one.
      const delivery = deliveryFor(req)
      const aim = deliveryAim(req, delivery)
      // A files delivery (#874) lands nothing: it is done once its recorded files pass.
      const files = delivery?.commitMode === 'files'
      const blocks = files ? 'blocks completion' : 'blocks landing'
      const defer = req.id === undefined
        ? `If a genuine user decision still ${blocks}, say so in your last message and stop; there is no card to write it on.`
        : `If a genuine user decision still ${blocks}, append it to #${req.id} following \`akb guide update-questions\`; otherwise finish successfully and review passes.`
      if (owesFocusedReview(delivery)) {
        return [
          `${kb}. ${aim.subject} is landing, and an agent resolved a conflict between it and the target branch — a composed result nothing has judged, on a delivery that already passed review.`,
          `\`${command} delivery review ${aim.arg} --print\` names the target delta and the paths both changed.`,
          `You did not build this. Do not read the run that wrote it.`,
          `Judge only how those changes interact, following \`akb guide review\` — not the delivery's own design, which stands. Pick the reviewers those paths need and review as each of them. ${defer}`,
          `Don't ask me questions with human-in-the-loop.`,
        ].join(' ')
      }
      return [
        `${kb}. Review ${aim.subject} — judge what the delivery in flight on it has built against what it was approved to build, following \`akb guide review\`.`,
        files
          ? `\`${command} delivery review ${aim.arg} --print\` supplies the approved requirements, the output files the card records and the reviewers.`
          : `\`${command} delivery review ${aim.arg} --print\` supplies the approved requirements, changed-file summary, small diff and the reviewers.`,
        `You did not build this. Do not read the run that wrote it.`,
        `Pick the reviewers ${files ? 'these files need' : 'this diff needs'} and review as each of them. ${defer}`,
        `Don't ask me questions with human-in-the-loop.`,
      ].join(' ')
    }
    // The flow supplies conflict facts; the guide owns the procedure.
    case 'conflict': {
      const aim = deliveryAim(req, deliveryFor(req))
      return [
        `${kb}. ${aim.subject} is landing, and its rebase onto the target branch stopped on a conflict.`,
        `\`${command} delivery conflict ${aim.arg} --print\` names the conflicted files, both sides' intent and both diffs.`,
        `Follow \`akb guide conflict\`.`,
      ].join(' ')
    }
    case 'resolve':
      return [
        `${kb}. Apply my answers to the open questions on task ${req.id} ${named} following \`akb guide resolve\`, then validate the updated plan following \`akb guide qa-lightweight\`.`,
        answeredNote(req.id, command),
        req.notes ? `Extra notes: ${req.notes}` : '',
        req.andImplement
          ? `Continue into implementation only if applying the answers leaves no open question.`
          : '',
      ]
        .filter(Boolean)
        .join(' ')
    // The decider answering for the user (#447). It is `resolve` with the choosing done
    // here, so the ask names the same job and adds the two rules that make it a decide: it
    // never hands the card back, and nothing it chooses becomes a lasting decision.
    case 'decide':
      return [
        `${kb}. Answer the open questions on task ${req.id} ${named} in my place, following \`akb guide decide\`.`,
        answeredNote(req.id, command),
        `You are standing in for me: leave no \`[user]\` question open, and do not hand the card back.`,
        `Choose from ${boardMemory()}, and from each question's own options and recommendation on the card.`,
        `Record every choice with \`${command} raw update-decided\`, and write no lasting decision anywhere.`,
        `Don't ask me questions with human-in-the-loop, and raise no new question.`,
      ]
        .filter(Boolean)
        .join(' ')
    // The gater's verdict (#440, #493). It is a verdict, not a pass over the card: the whole
    // of what it may write is one `[user]` question, and finishing with the card untouched IS
    // the other answer. Nothing here says what the card should say — that is `akb guide
    // writing`, which it is sent to read — and nothing here says to start the build: the
    // board does that, so a gate that judged well cannot also start the wrong thing.
    case 'gate':
      return [
        `${kb}. Judge task ${req.id} ${named} following \`akb guide gate\` — is it clear enough to build with nobody watching?`,
        `Judge it as I would: on top of the card, read ${boardMemory()}, and \`akb guide writing\` — the bar the card is held to.`,
        `Change nothing else: you are not refining this card, you write no memory, and a clean finish is how you say "build it".`,
        `Don't ask me questions with human-in-the-loop — the one question you append to the card is how you defer to me.`,
      ].join(' ')
    // Settling a card that sat too long (#118). It is a verdict on one card, so the ask says
    // the two ways to give one and the line that separates this from a refine: what it may
    // not do is research the card into a better plan or hand it on to anybody.
    case 'unstick':
      return [
        `${kb}. Task ${req.id} ${named} has sat untouched too long. Settle it now, following \`akb guide unstick\`.`,
        `Judge how much of it is already done and whether the rest is still worth the effort, then keep it — rewritten for the project as it stands today, under a dated ## By \`sweeper\` agent note — or discard it with \`${command} raw reject ${req.id} --discard\`.`,
        `Change only what you can show is out of date: this is not a refine, so run no planning QA, touch no \`- [x]\` todo, and set no status by hand.`,
        `Don't ask me questions with human-in-the-loop, and raise no new question — the verdict is the whole of what you leave behind.`,
      ].join(' ')
    case 'writing':
      return [
        `${kb}. Improve the writing of task ${req.id} ${named} following \`akb guide writing\`.`,
        `This is already the writing session: do not start \`revise\` or \`refine\`, and do not change the card's status. The board marks it ready when this session succeeds.`,
        `Preserve the settled plan exactly. Do not research, replan, or raise questions.`,
        NO_IMPLEMENT,
        `Don't ask me questions with human-in-the-loop.`,
      ].join(' ')
  }
}

export function discardedCardsPrompt(cards: { id: number; path: string }[] = []): string {
  if (!cards.length) return ''
  return 'The user discarded the cards listed below. Their absence is intentional. Do not restore or recreate them, including under new IDs or filenames. Continue the remaining work from the current board, preserving the other cards.\n\n' + cards.map((c) => `- #${c.id}: ${c.path}`).join('\n')
}
