// The one place a board action turns into words for an agent.
//
// Every prompt lives here, so a run started in a terminal and the same run started from a
// button say exactly the same thing. Only the opening — how this agent is asked for the
// skill — follows the agent that runs; everything after it is the same for all of them.

import { locate } from '../cards'
import { channelLanguage } from '../channels'
import { draftFile, SOURCE } from '../content'
import { findGuide } from '../guide'
import { boardText, rel } from '../paths'
import { agentMemoryBlock, findSpecAgent, specHeading, specAgentInstructions, specAgentSelector } from '../agents'
import { boardCommand, boardCommandFor, commandNote } from './command'
import { activeDelivery } from './deliveries'
import { owesFocusedReview } from './review'
import { DELIVERY_FLOWS } from './flows'
import { languageNote } from './language'
import { skillCall } from './resolve'
import { runtimeFor } from './runtime'
import { ruleBlock } from './rules'
import { PROPOSE_DEFAULT, PROPOSE_MAX, type AgentAction, type AgentRequest, type Boldness } from './types'

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
  return DELIVERY_RESUME.replace('%s', deliveryId).replace('%c', `${boardCommandFor(cardId)} card implement ${cardId} --print`)
}

// The actions whose ask can be said again from the record alone. A resume drops what the
// user typed on purpose — it was already in the conversation being continued — so an action
// that is mostly those words (a revise's request, a reject's reason, a create's requirement,
// a plan's version) has nothing left to rebuild from, and is not restarted.
const RESTARTABLE: ReadonlySet<AgentAction> = new Set<AgentAction>([
  'implement',
  'run',
  'clarify',
  'resolve',
  'writing',
  'archive',
  'spec',
  'channel',
  'review',
  'conflict',
])

// What opens a restart. Everything the resume prompt leans on is gone, so the whole ask
// follows this line — the run does the task again rather than finishing a sentence.
const RESTART_LEAD = [
  `The session you were continuing is gone, and this one holds nothing of it.`,
  `Do the task below from the top, checking each step's precondition before you do it — work an earlier run already finished is done, so don't repeat it.`,
].join(' ')

/** What a run is told when the session it came back for turns out to be gone and a fresh
 *  one was opened in its place (#395). Unlike the resume prompt it stands on its own: it
 *  names the skill and the task, because nothing of the conversation survived.
 *
 *  A delivery's resume prompt already does — it names the delivery and prints the approved
 *  card — so the BUILD is restarted with that one as it is. Its review and its conflict run
 *  are different jobs on the same delivery, and that prompt would put either of them on the
 *  implement flow, so they are restarted by their own ask. Nothing comes back for a run whose
 *  ask can no longer be written down, and the client fails such a run rather than restarting
 *  it blind. */
export function restartPrompt(req: AgentRequest, deliveryId?: string): string | undefined {
  if (req.id === undefined) return undefined
  if (deliveryId && req.action === 'implement') return resumePrompt(deliveryId, req.id)
  if (!RESTARTABLE.has(req.action)) return undefined
  return [RESTART_LEAD, buildPrompt(req)].join('\n\n')
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
  // `docs/kanban` in these words is this board's real folder (#407) — the same swap the
  // flows get, so the ask and the flow it names never disagree about where the board is.
  return boardText([ask, languageNote(), roster(req)].filter(Boolean).join('\n\n'))
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

// The spec agents a pass may put on the card — the catalog, not a rule about any one of
// them. The passes that rewrite a plan are the ones that can tell what it still has no
// answer for, so they are the ones that pick; they just have to know which agents the board
// has. Naming any of them in a flow instead would go stale the moment one is switched off
// or a new one ships.
//
// A spec run is never given it (#403): the selector belongs to the session planning a card,
// and an agent handed the list of agents is an agent that can ask for itself.
//
// It goes after everything else because it is a block and the rest is prose.
const SELECTOR_FOR = new Set(['clarify', 'resolve', 'edit'])

// The two files a repurpose works between, as paths from the project root. Null when the
// card has gone — the command that starts the run has already refused that, so this is only
// the guard a restart needs.
function draftPaths(cardId: number | undefined, channel: string): { source: string; target: string } | null {
  const found = cardId === undefined ? null : locate(cardId)
  if (!found || found.kind !== 'file') return null
  return { source: rel(draftFile(found.target, SOURCE)), target: rel(draftFile(found.target, channel)) }
}

const roster = (req: AgentRequest): string =>
  SELECTOR_FOR.has(req.action) && req.id !== undefined ? specAgentSelector(req.id) : ''

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
    // One spec agent on one card (#187, #403). The whole run is assembled here and inlined:
    // the contract every spec run works to, the agent's own instructions, and the one
    // reference each of its settings picked. A pointer to a second command is a step an
    // agent skips, and a reference it had to go and find is one it could load the wrong
    // one of — the board resolves them, so the run has nothing to locate.
    //
    // Nothing here says what the card is about. The card is on the board and the agent is
    // told to read it — a summary pasted in would be the planning flow's reading of it,
    // which is the one thing this run exists to be free of.
    case 'spec': {
      const agent = findSpecAgent(req.specAgent ?? '')
      const heading = specHeading(req.specAgent ?? '')
      // The one read of what this agent is set to, taken as the run starts and frozen for
      // it: everything below is assembled from these values (#255).
      const own = agent ? specAgentInstructions(agent) : null
      if (own) notes.push(...own.notes)
      const contract = findGuide('spec-agent')?.text.trim()
      // What this agent remembers, when it declares a memory at all (#421) — the last block,
      // so the board's own words end before the agent's do.
      const memory = agent ? agentMemoryBlock(agent) : ''
      return [
        [
          `${kb}. You are the \`${req.specAgent}\` spec agent on task ${req.id} ${named}.`,
          `Read the card, answer only the part you own, and write it into that card's "${heading}" section with \`akb raw spec-write ${req.id} ${req.specAgent} --file <path>\`.`,
          memory
            ? `You keep a memory of this board, below. Follow it, and when this run taught you something lasting, curate it and write the whole file back by adding \`--memory <path>\` to that same call.`
            : '',
          `Change nothing else — not the rest of the card, not another card, not the code.`,
          req.notes ? `What the flow that asked for you wants looked at: ${req.notes}` : '',
          `Everything you need is in this message: the contract below, your instructions, and the references they selected. Do not go looking for more of them.`,
          `Don't ask me questions with human-in-the-loop — an open question on the card is how you defer to me.`,
        ]
          .filter(Boolean)
          .join(' '),
        contract ? `——— how a spec agent works ———\n\n${contract}` : '',
        agent && own ? `——— you, the \`${agent.name}\` agent ———\n\n${own.instructions}` : '',
        ...(own?.references ?? []).map((r) => `——— ${r.title} ———\n\n${r.text}`),
        memory ? `——— what you remember ———\n\n${memory}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    }
    // One channel's draft, repurposed from the topic's `source.md` (#409). The two paths
    // are named outright: `akb channel` has no `--print`, so this message is the whole of
    // what the run is handed, and a run left to work out its own filename is a run that
    // writes the draft somewhere nobody looks.
    //
    // Nothing here says what the piece argues. That is `source.md`, which the run reads —
    // a summary pasted in would be this file's reading of it, and the whole job is to carry
    // the piece across rather than to write it again.
    case 'channel': {
      const name = req.channel ?? ''
      const files = draftPaths(req.id, name)
      return [
        `${kb}. Repurpose task ${req.id} ${named} for ${name} following \`akb guide channel\`.`,
        files ? `Read ${files.source} and write ${files.target}, in ${channelLanguage(name)}.` : '',
        `One pass: shorten or expand the piece into that channel's shape and language, and stop.`,
        `Write that one file and nothing else — not the card, not \`source.md\`, and not another channel's draft.`,
        req.notes ? `Extra notes: ${req.notes}` : '',
        `Don't ask me questions with human-in-the-loop — the review is me editing the draft.`,
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
      // A rebase put the target's own changes beside work that already passed (#415). The
      // ask has to say so, or the run goes looking for approved requirements the flow
      // deliberately leaves out and judges the delivery a second time.
      if (owesFocusedReview(activeDelivery(req.id!))) {
        return [
          `${kb}. Task ${req.id} ${named} is landing, and its rebase put the target branch's own changes beside a delivery that already passed review.`,
          `\`${command} delivery review ${req.id} --print\` names the target delta and the paths both changed.`,
          `You did not build this. Do not read the run that wrote it.`,
          `Judge only how those changes interact, following \`akb guide review\` — not the delivery's own design, which stands. Fix plain mistakes and rerun the checks those paths affect. If a genuine user decision still blocks landing, append it to #${req.id} following \`akb guide update-questions\`; otherwise finish successfully and review passes.`,
          `Don't ask me questions with human-in-the-loop — the card's validated open question is how you defer to me.`,
        ].join(' ')
      }
      return [
        `${kb}. Review task ${req.id} ${named} — judge what the delivery in flight on it has built against the card as it was approved, following \`akb guide review\`.`,
        `\`${command} delivery review ${req.id} --print\` supplies the approved requirements, changed-file summary and small diff.`,
        `You did not build this. Do not read the run that wrote it.`,
        `Fix plain mistakes and rerun the affected checks. If a genuine user decision still blocks landing, append it to #${req.id} following \`akb guide update-questions\`; otherwise finish successfully and review passes.`,
        `Don't ask me questions with human-in-the-loop — the card's validated open question is how you defer to me.`,
      ].join(' ')
    // Resolving the conflict a landing's rebase stopped on (#304). It is new work, not a
    // correction: the two cards were both right on their own, and what to keep is a
    // judgment neither card wrote down. Nothing here names the files — they are in the
    // worktree and the flow prints them — and nothing here says to finish the rebase: the
    // board does that, so the run has one job and no rebase state to get wrong.
    case 'conflict':
      return [
        `${kb}. Task ${req.id} ${named} is landing, and its rebase onto the target branch stopped on a conflict.`,
        `\`${command} delivery conflict ${req.id} --print\` names the conflicted files, both cards and both diffs.`,
        `Resolve every conflicted file in the delivery's worktree so both cards' intent survives, \`git add\` each one, and stop there — the board finishes the rebase, then reviews your resolution before it lands.`,
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
