// The Discuss screen's own state (#427) — everything it draws that the chat rail doesn't.
//
// The conversation itself is `agent/chat.ts`: Discuss is `akb chat` on one discussion (#496),
// held in the same file, answered by the same agent. What is added here is the plan that
// discussion is writing and the run one of the handoff's answers handed it to — Start
// planning, which turns it into cards, or Build now, which writes one card from it and builds
// it (#481).

import path from 'node:path'
import fs from 'node:fs'

import { listRuns } from './sessions'
import { chatPlan, clearChatPlan, readChat, setChatArchived, setChatPlanRun } from './chat'
import { locate, locateArchived } from '../cards'
import { archivePlan, planPathInText, readPlan } from '../plans'
import { isDiscussion, type ChatTarget, type DiscussRead, type PlanAnswer } from './types'

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
    filePlanOfRun(target, run.createdCardIds)
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
 *  one, and says which of the two is working.
 *
 *  The discussion goes out of the rail with it (#551): the user has nothing left to do on a
 *  subject whose run is already underway. The plan file stays where it is — the run is
 *  reading it — and the archive is marked the board's own, so a run that ends having written
 *  no card can put the row back.
 */
export function startedPlanning(sessionId: string, answer: PlanAnswer = 'plan', target: ChatTarget = null): void {
  const handed = setChatPlanRun(target, sessionId, answer)
  if (handed && isDiscussion(target)) setChatArchived(target, true, 'board')
}

/** The run has written its cards, so the plan it was handed is finished: it is filed away
 *  under `plans/archive/`, every card that run wrote is repointed at where it went, and the
 *  discussion lets it go so the next idea starts a file of its own (#551). */
export function filePlanOfRun(target: ChatTarget, cardIds: number[]): void {
  const plan = chatPlan(readChat(target))
  const moved = plan && archivePlan(plan.path)
  if (plan && moved && moved !== plan.path) {
    for (const id of cardIds) repointSource(id, plan.path, moved)
  }
  clearChatPlan(target)
}

// Rewrite one card's `## Source` to name where the plan went. A card already rejected or
// otherwise gone is passed over — the plan still moves, and nothing here is worth failing
// the move for.
function repointSource(id: number, from: string, to: string): void {
  let file: string
  let text: string
  try {
    const found = locate(id) ?? locateArchived(id)
    if (!found) return
    file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return
  }
  const at = text.search(/^## Source\s*$/m)
  if (at < 0) return
  // `## Source` is the card's last section, so from the heading to the end is the whole of
  // it. Both spellings are replaced: the path from the project root, which is what a card
  // carries, and the board-relative one in case something wrote that instead.
  const head = text.slice(0, at)
  const source = text
    .slice(at)
    .replaceAll(planPathInText(from), planPathInText(to))
    .replaceAll(from, to)
  if (source === text.slice(at)) return
  try {
    fs.writeFileSync(file, head + source)
  } catch {
    // The card goes on naming a path that still reads — `readPlan` follows the plan by its
    // id into either folder.
  }
}
