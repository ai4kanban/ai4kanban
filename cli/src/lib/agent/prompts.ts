// The one place a board action turns into words for an agent.
//
// Every prompt lives here, so a run started in a terminal and the same run started from a
// button say exactly the same thing. Only the opening — how this agent is asked for the
// skill — follows the agent that runs; everything after it is the same for all of them.

import { findSpecAgent, specAgentPrompt, specAgentRoster, specHeading } from '../spec-agents'
import { boardCommand, boardCommandFor, commandNote } from './command'
import { activeDelivery } from './deliveries'
import { DELIVERY_FLOWS } from './flows'
import { languageNote } from './language'
import { skillCall } from './resolve'
import { runtimeFor } from './runtime'
import { ruleBlock } from './rules'
import { PROPOSE_DEFAULT, PROPOSE_MAX, type AgentRequest, type Boldness } from './types'

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
  `Build the card as the delivery holds it, not as the file reads now: \`%c\` prints the approved copy.`,
].join(' ')

/** What a resumed run is told: the plain "carry on", or — inside a delivery — the one that
 *  re-enters the delivery's flow. */
export function resumePrompt(deliveryId: string | undefined, cardId: number | null): string {
  if (!deliveryId || cardId === null) return RESUME_PROMPT
  return DELIVERY_RESUME.replace('%s', deliveryId).replace('%c', `${boardCommandFor(cardId)} implement ${cardId} --print`)
}

// What each boldness level tells a propose run. The rule lives in the flow ("Boldness" in
// `akb guide propose`); these lines name the level and gloss it in one clause, so the
// agent doesn't have to guess what the user meant by the word. `normal` is the flow's
// default size, so it adds nothing.
const BOLDNESS_LINE: Record<Boldness, string> = {
  safe: `Boldness: **safe** (see "Boldness" in \`akb guide propose\`) — small moves that polish or fill gaps in what already works.`,
  normal: '',
  bold: `Boldness: **bold** (see "Boldness" in \`akb guide propose\`) — each task is a big leap: a capability the module doesn't have at all, still sized so one run finishes it.`,
}

// The count a propose run is asked for, made safe: a whole number between 1 and the cap,
// PROPOSE_DEFAULT when nothing (or nonsense) came in.
function clampCount(count: number | undefined): number {
  if (!Number.isFinite(count)) return PROPOSE_DEFAULT
  return Math.min(PROPOSE_MAX, Math.max(1, Math.round(count as number)))
}

// Nothing here asks a run to refine the card afterwards. A command does one job and stops;
// the refinement sessions that follow are started once it ends (`refine.ts`), so each has
// its own log and can be stopped on its own.

// Every action that revises a card revises the CARD — the revision request says what the
// text should say, not "go build it". Without this line an agent reads a request like
// "make it handle empty input" as the work itself and writes code. A request that explicitly
// asks for implementation still gets it. Not on create/propose (they carry their own
// "create only" line) and not on a resolve asked to carry on and implement.
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
export function buildAsk(req: AgentRequest, notes: string[] = []): string {
  // A delivery's runs work in that delivery's own worktree, so their board commands
  // name the project's own copy outright (#303). Everything else runs in the project and
  // spells the command the ordinary way.
  const command = DELIVERY_FLOWS.has(req.action) ? boardCommandFor(req.id) : boardCommand()
  const ask = [actionPrompt(req, command, notes), commandNote(command)].filter(Boolean).join(' ')
  return [ask, languageNote(), roster(req)].filter(Boolean).join('\n\n')
}

/** The words one run is given, this board's own rule for the flow last (#306). It goes
 *  after everything else the board writes, so nothing of the board's follows the user's. */
export function buildPrompt(req: AgentRequest, notes: string[] = []): string {
  return [buildAsk(req, notes), ruleBlock(req, frozenRules(req))].filter(Boolean).join('\n\n')
}

/** The rules the delivery in flight on this card froze when it started, or nothing when
 *  this run is not part of one. A delivery's runs work to the rules it started with, the
 *  way they build the card it started with. */
export function frozenRules(req: AgentRequest): Record<string, string> | undefined {
  if (!DELIVERY_FLOWS.has(req.action) || req.id === undefined) return undefined
  return activeDelivery(req.id)?.rules
}

// The spec agents a pass may put on the card — the roster, not a rule about any one of
// them. The passes that rewrite a plan are the ones that can tell what it still has no
// answer for, so they are the ones that pick; they just have to know which agents the board
// has. Naming any of them in a flow instead would go stale the moment one is switched off
// or a new one ships.
//
// It goes after everything else because it is a block and the rest is prose.
const ROSTER_FOR = new Set(['clarify', 'resolve', 'edit'])

const roster = (req: AgentRequest): string =>
  ROSTER_FOR.has(req.action) && req.id !== undefined ? specAgentRoster(req.id) : ''

/** The words one run is given, and anything the board owes that run's log before the agent
 *  says a word. Only a spec agent has notes today: a setting whose saved value it no longer
 *  offers falls back, and the log is where that is said. */
export function buildRun(req: AgentRequest): { prompt: string; notes: string[] } {
  const notes: string[] = []
  return { prompt: buildPrompt(req, notes), notes }
}

function actionPrompt(req: AgentRequest, command: string, notes: string[]): string {
  // How this agent calls the skill — the only part of a prompt that follows the agent. It
  // is the agent THIS run's runtime resolves to here (#343), not the board's global one: a
  // `/kanban` sent to Codex is plain chat text and the skill never loads.
  const kb = skillCall(runtimeFor(req))
  const tag = req.id ? `#${req.id}` : ''
  const named = req.title ? `${tag} ("${req.title}")` : tag
  switch (req.action) {
    case 'implement':
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
        `${kb}. Reject task ${req.id} ${named}. Reason: ${req.reason || '(none given)'}.`,
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
        `Apply the requested change following \`akb guide revise\`, then validate the updated plan following \`akb guide qa-loop\`.`,
        `You can create new subtasks if it's a group task and the intent is to do so.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ].join(' ')
    case 'create':
      return [
        `${kb}. Add task(s) from this requirement: "${req.description || ''}".`,
        `Follow \`akb guide add-task\`. Create task only, don't implement it.`,
        "Cover what the requests asks for, DONT OVER DESIGN IT.",
        // The board was showing one release when this was asked for, so the card ships in
        // it — otherwise it would land in no release, off the screen of the person who
        // just wrote it.
        req.release ? `Put the new card(s) in the "${req.release}" release: \`--release ${req.release}\`.` : '',
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ]
        .filter(Boolean)
        .join(' ')
    case 'propose': {
      // How many cards this run writes. The flow has its own default and cap ("How many"
      // in `akb guide propose`); this clamps whatever came in so a hand-made request
      // can't ask for fifty cards.
      const n = clampCount(req.count)
      return [
        `${kb}. Propose ${n} new task${n === 1 ? '' : 's'} following \`akb guide propose\`.`,
        req.module
          ? `Focus on the "${req.module}" module — read its memory set and write every one of them inside it.`
          : `Pick one focus module yourself (per \`akb guide propose\`) and write every one of them inside it.`,
        BOLDNESS_LINE[req.boldness ?? 'normal'],
        `Create the cards only, don't implement them.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ]
        .filter(Boolean)
        .join(' ')
    }
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
        `Change nothing but that version's summary file, and write it with \`akb board release changelog\`.`,
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
    // One spec agent on one card (#187). Its own prompt is inlined rather than named: a
    // pointer to a second command is a step an agent skips, and the whole of what this run
    // is comes from that text.
    //
    // Nothing here says what the card is about. The card is on the board and the agent is
    // told to read it — a summary pasted in would be the planning flow's reading of it,
    // which is the one thing this run exists to be free of.
    case 'spec': {
      const agent = findSpecAgent(req.specAgent ?? '')
      const heading = specHeading(req.specAgent ?? '')
      // The one read of what this agent is set to, taken as the run starts. Its prompt is
      // its own text plus the block each picked choice carries (#255).
      const own = agent ? specAgentPrompt(agent) : null
      if (own) notes.push(...own.notes)
      return [
        `${kb}. You are the \`${req.specAgent}\` spec agent on task ${req.id} ${named}.`,
        `Follow \`akb guide spec-agent\`: read the card, answer only the part you own, and write it into that card's "${heading}" section with \`akb board spec-write ${req.id} ${req.specAgent} --file <path>\`.`,
        `Change nothing else — not the rest of the card, not another card, not the code.`,
        req.notes ? `What the flow that asked for you wants looked at: ${req.notes}` : '',
        `Don't ask me questions with human-in-the-loop — an open question on the card is how you defer to me.`,
        agent && own ? `\n\n——— your prompt: the \`${agent.name}\` spec agent ———\n\n${own.prompt}` : '',
      ]
        .filter(Boolean)
        .join(' ')
    }
    // Judging a delivery's work (#302). Nothing here says what the card wants or what the
    // diff holds: both are on the board, the flow prints them, and a copy pasted in here
    // would be this file's reading of them. What it DOES say is the one rule a fresh run
    // cannot work out for itself — you did not build this, so do not go looking for the
    // run that did.
    case 'review':
      return [
        `${kb}. Review task ${req.id} ${named} — judge what the delivery in flight on it has built against the card as it was approved, following \`akb guide review\`.`,
        `\`${command} review ${req.id} --print\` supplies the approved requirements, changed-file summary and small diff.`,
        `You did not build this. Do not read the run that wrote it.`,
        `Fix plain mistakes and rerun the affected checks. If a genuine user decision still blocks landing, append it to #${req.id} following \`akb guide update-questions\`; otherwise finish successfully and review passes.`,
        `Don't ask me questions with human-in-the-loop — the card's validated open question is how you defer to me.`,
      ].join(' ')
    // Kept only so a correction run already in flight during an upgrade can finish.
    case 'correct':
      return [
        `${kb}. Finish the legacy correction run for task ${req.id} ${named}.`,
        `Fix the recorded findings; a combined review follows.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ].join(' ')
    // Resolving the conflict a landing's rebase stopped on (#304). It is new work, not a
    // correction: the two cards were both right on their own, and what to keep is a
    // judgment neither card wrote down. Nothing here names the files — they are in the
    // worktree and the flow prints them — and nothing here says to finish the rebase: the
    // board does that, so the run has one job and no rebase state to get wrong.
    case 'conflict':
      return [
        `${kb}. Task ${req.id} ${named} is landing, and its rebase onto the target branch stopped on a conflict.`,
        `\`${command} conflict ${req.id} --print\` names the conflicted files, both cards and both diffs.`,
        `Resolve every conflicted file in the delivery's worktree so both cards' intent survives, \`git add\` each one, and stop there — the board finishes the rebase and lands it, with no review after this run.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ].join(' ')
    case 'resolve':
      return [
        `${kb}. Apply my answers to the open questions on task ${req.id} ${named} following \`akb guide resolve\`, then validate the updated plan following \`akb guide qa-loop\`.`,
        req.notes ? `Extra notes: ${req.notes}` : '',
        req.andImplement
          ? `Continue into implementation only if applying the answers leaves no open question.`
          : '',
      ]
        .filter(Boolean)
        .join(' ')
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
