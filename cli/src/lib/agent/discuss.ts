// The Discuss screen's own state (#427) — everything it draws that the chat rail doesn't.
//
// The conversation itself is `agent/chat.ts`: Discuss is `akb chat` on one discussion (#496),
// held in the same file, answered by the same agent. What is added here is the plan that
// discussion is writing and the run one of the handoff's answers handed it to — Start
// planning, which turns it into cards, or Build now, which writes one card from it and builds
// it (#481).

import { listRuns } from './sessions'
import { chatPlan, clearChatPlan, readChat, setChatPlanRun } from './chat'
import { planPathInText, readPlan } from '../plans'
import type { ChatTarget, DiscussRead, PlanAnswer } from './types'

const NOTHING: DiscussRead = { plan: null, run: null }

/**
 * What Discuss shows beside the transcript: the plan, and the run it was handed to.
 *
 * It is also where a finished plan is let go. A run that wrote its card can end while the
 * screen is shut, so nothing is watching to clear it then — the next read is, and by the
 * time anyone opens Discuss again the panel is gone and the next idea starts a file of its
 * own. A run that wrote none is kept, so the screen can offer it again.
 */
export async function readDiscuss(target: ChatTarget = null): Promise<DiscussRead> {
  const plan = chatPlan(readChat(target))
  if (!plan) return NOTHING
  const run = plan.run ? (await listRuns()).find((r) => r.sessionId === plan.run) : undefined
  // Still working, or over without writing a card — it failed, was stopped, was cut off, or
  // the record has been trimmed away under it. Either way the plan is held: the screen says
  // the run is going, or offers it again.
  const running = run?.status === 'running'
  // The card, not the exit code (#481): a Build now writes its card first and can fail
  // building it, and that plan is finished all the same — a second answer off it would write
  // the card twice. A run that ended having written none leaves the plan to be answered
  // again.
  if (plan.run && !running && run?.createdCardIds?.length) {
    clearChatPlan(target)
    return NOTHING
  }
  const file = readPlan(plan.path)
  return {
    // Spelled from the project root, the way a card's `## Source` carries it — the panel
    // shows the path to copy, and the board never opens a plan itself.
    plan: file && { ...file, path: planPathInText(file.path) },
    run: plan.run ? { sessionId: plan.run, running, answer: plan.answer ?? 'plan' } : null,
  }
}

/** The run this plan was handed to has started, and which answer handed it over. Held on the
 *  discussion so reopening it says the run is still working rather than offering a second
 *  one, and says which of the two is working. */
export function startedPlanning(sessionId: string, answer: PlanAnswer = 'plan', target: ChatTarget = null): void {
  setChatPlanRun(target, sessionId, answer)
}
