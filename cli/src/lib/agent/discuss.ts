// The Discuss screen's own state (#427) — everything it draws that the chat rail doesn't.
//
// The conversation itself is `agent/chat.ts`: Discuss is `akb chat` on the board's own
// conversation, held in the same file, answered by the same agent. What is added here is
// the plan that conversation is writing and the run that turns it into cards.

import { listRuns } from './sessions'
import { clearChatPlan, readChat, setChatPlanRun } from './chat'
import { planPathInText, readPlan } from '../plans'
import type { DiscussRead } from './types'

const NOTHING: DiscussRead = { plan: null, ask: false, run: null }

/**
 * What Discuss shows beside the transcript: the plan, the ask, and the planning run.
 *
 * It is also where a finished plan is let go. A run that wrote its cards can end while the
 * screen is shut, so nothing is watching to clear it then — the next read is, and by the
 * time anyone opens Discuss again the panel is gone and the next idea starts a file of its
 * own. A run that failed is kept, so the screen can offer it again.
 */
export async function readDiscuss(): Promise<DiscussRead> {
  const plan = readChat(null)?.plan
  if (!plan) return NOTHING
  const run = plan.run ? (await listRuns()).find((r) => r.sessionId === plan.run) : undefined
  // The cards themselves, not the exit code: a run can end cleanly having written none, and
  // that is a plan still waiting for its cards rather than one to let go of.
  if (plan.run && run?.ok && run.createdCardIds?.length) {
    clearChatPlan(null)
    return NOTHING
  }
  // Still working, or over without writing its cards — it failed, was stopped, was cut off,
  // or the record has been trimmed away under it. Either way the plan is held: the screen
  // says the run is going, or offers it again.
  const running = run?.status === 'running'
  const file = readPlan(plan.path)
  return {
    // Spelled from the project root, the way a card's `## Source` carries it — the panel
    // shows the path to copy, and the board never opens a plan itself.
    plan: file && { ...file, path: planPathInText(file.path) },
    ask: plan.ask === true,
    run: plan.run ? { sessionId: plan.run, running } : null,
  }
}

/** The run writing this plan's cards has started. Held on the conversation so reopening
 *  Discuss says it is still working rather than offering a second one. */
export function startedPlanning(sessionId: string): void {
  setChatPlanRun(null, sessionId)
}
