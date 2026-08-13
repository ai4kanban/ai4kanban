// The one place a board action turns into words for an agent.
//
// Every prompt lives here, so a run started in a terminal and the same run started from a
// button say exactly the same thing. Only the opening — how this agent is asked for the
// skill — follows the agent that runs; everything after it is the same for all of them.

import { skillCall } from './resolve'
import { PROPOSE_DEFAULT, PROPOSE_MAX, type AgentRequest, type Boldness } from './types'

// What a resumed run says. The conversation is already there — the card, the work done,
// the error it died on — so this is the "continue" you would type in the terminal, not the
// whole action prompt again.
export const RESUME_PROMPT = [
  `Continue. The previous run ended before it finished the task.`,
  `Pick up where you left off and carry it through.`,
  `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
].join(' ')

// What each boldness level tells a propose run. The rule lives in the skill ("Boldness" in
// `references/propose.md`); these lines name the level and gloss it in one clause, so the
// agent doesn't have to guess what the user meant by the word. `normal` is the skill's
// default size, so it adds nothing.
const BOLDNESS_LINE: Record<Boldness, string> = {
  safe: `Boldness: **safe** (see "Boldness" in references/propose.md) — small moves that polish or fill gaps in what already works.`,
  normal: '',
  bold: `Boldness: **bold** (see "Boldness" in references/propose.md) — each task is a big leap: a capability the module doesn't have at all, still sized so one session finishes it.`,
}

// The count a propose run is asked for, made safe: a whole number between 1 and the cap,
// PROPOSE_DEFAULT when nothing (or nonsense) came in.
function clampCount(count: number | undefined): number {
  if (!Number.isFinite(count)) return PROPOSE_DEFAULT
  return Math.min(PROPOSE_MAX, Math.max(1, Math.round(count as number)))
}

// Nothing here asks a run to refine the card afterwards. A command does one job and stops;
// the refine that follows is a run of its own, started once this one has ended (see
// `follow.ts`), so it has its own log and can be stopped on its own.

// Every action that revises a card revises the CARD — the note says what the text should
// say, not "go build it". Without this line an agent reads a note like "make it handle
// empty input" as the work itself and writes code. The escape hatch is the note: one that
// asks for the change to be made outright still gets it. Not on create/propose (they carry
// their own "create only" line) and not on a resolve asked to carry on and implement.
const NO_IMPLEMENT = `(Unless the task note specifies, don't implement it.)`

export function buildPrompt(req: AgentRequest): string {
  // How this agent calls the skill — the only part of a prompt that follows the agent.
  const kb = skillCall()
  const tag = req.id ? `#${req.id}` : ''
  const named = req.title ? `${tag} ("${req.title}")` : tag
  switch (req.action) {
    case 'implement':
      return [
        `${kb}. Implement task ${req.id} ${named}.`,
        req.notes ? `Extra notes: ${req.notes}` : '',
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
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
    // protocol around it — questions, the resolve pass, never archiving — is the same for
    // every recurring card, so it belongs in the guide, not in a prompt rebuilt every run.
    case 'run':
      return [
        `${kb}. Run recurring task ${req.id} ${named} — one pass, following \`references/recurring-task.md\`.`,
        req.notes ? `Extra notes: ${req.notes}` : '',
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ]
        .filter(Boolean)
        .join(' ')
    case 'reject':
      return [
        `${kb}. Reject task ${req.id} ${named}. Reason: ${req.reason || '(none given)'}.`,
        `Follow the skill's reject flow.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ].join(' ')
    case 'archive':
      return [
        `${kb}. Archive task ${req.id} ${named}.`,
        `Follow the skill's archive flow.`,
        req.notes ? `Extra notes: ${req.notes}` : '',
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ]
        .filter(Boolean)
        .join(' ')
    case 'edit':
      return [
        `${kb}. Revise task ${req.id} ${named}: "${req.notes || ''}" ${NO_IMPLEMENT}`,
        `You can create new subtasks if it's a group task and the intent is to do so.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ].join(' ')
    case 'create':
      return [
        `${kb}. Add task(s) from this requirement: "${req.description || ''}".`,
        `Follow the skill's add-task flow. Create task only, don't implement it.`,
        // The board was showing one release when this was asked for, so the card ships in
        // it — otherwise it would land in no release, off the screen of the person who
        // just wrote it.
        req.release ? `Put the new card(s) in the "${req.release}" release: \`--release ${req.release}\`.` : '',
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ]
        .filter(Boolean)
        .join(' ')
    case 'propose': {
      // How many cards this run writes. The skill has its own default and cap ("How many"
      // in references/propose.md); this clamps whatever came in so a hand-made request
      // can't ask for fifty cards.
      const n = clampCount(req.count)
      return [
        `${kb}. Propose ${n} new task${n === 1 ? '' : 's'} following \`references/propose.md\`.`,
        req.module
          ? `Focus on the "${req.module}" module — read its memory set and write every one of them inside it.`
          : `Pick one focus module yourself (per references/propose.md) and write every one of them inside it.`,
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
        `${kb}. Plan the "${req.release || ''}" release following \`references/plan-release.md\`:`,
        `move in the open cards that ship its goal, and write the cards the goal needs that the board is missing.`,
        `Create the cards only, don't implement them.`,
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ].join(' ')
    case 'auto-refine':
      return [
        `${kb}. Auto-refine task ${req.id} ${named} following \`references/auto-refine.md\`.`,
        `Don't ask me questions with human-in-the-loop — the \`[user]\` tag is how you defer to me.`,
        NO_IMPLEMENT,
      ]
        .filter(Boolean)
        .join(' ')
    case 'resolve':
      return [
        `${kb}. Resolve the open questions on task ${req.id} ${named} following \`references/resolve.md\`.`,
        req.andImplement
          ? `Then, if resolving settles every question and nothing genuine is left for me to decide, go straight on to implementing the task — one continuous session. But if any real judgment call stays open, stop there and report it: don't implement on a guess.`
          : NO_IMPLEMENT,
        req.notes ? `Extra notes: ${req.notes}` : '',
        `Don't ask me questions with human-in-the-loop. Leave any questions as open questions.`,
      ]
        .filter(Boolean)
        .join(' ')
  }
}
