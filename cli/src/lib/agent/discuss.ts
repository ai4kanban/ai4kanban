// The Discuss screen's own state (#427) — everything it draws that the chat rail doesn't.
//
// The conversation itself is `agent/chat.ts`: Discuss is `akb chat` on one discussion (#496),
// held in the same file, answered by the same agent. What is added here is the plan that
// discussion is writing and the run one of the handoff's answers handed it to — Start
// planning, which turns it into cards, or Build now, which writes one card from it and builds
// it (#481).

import path from 'node:path'
import fs from 'node:fs'

import { listRuns, peekRun } from './sessions'
import { openPlans, readChat, returnChatPlan, clearChatPlan, setChatArchived, setChatPlanRun } from './chat'
import { locate, locateArchived } from '../cards'
import { archivePlan, planFromText, planHeading, planPathInText, readPlan } from '../plans'
import { endBlocked, END_BLOCK_SAID, shareOnEnd, type EndBlock } from './share'
import { isDiscussion, type ChatPlan, type ChatTarget, type DiscussPlan, type DiscussRead, type PlanAnswer } from './types'

const NOTHING: DiscussRead = { plan: null, plans: [], run: null }

/** A run as settling reads it: still going, and the cards it wrote. */
export type RunLook = (sessionId: string) => { live: boolean; cards: number[] } | undefined

/**
 * What Discuss shows beside the transcript: the open plans, and the run they were handed to.
 *
 * It is also where a finished handoff is settled. A run can end while the screen is shut, so
 * nothing is watching then — the next read is. A run that wrote none keeps its plans, so the
 * screen can offer them again.
 */
export async function readDiscuss(target: ChatTarget = null): Promise<DiscussRead> {
  if (!openPlans(readChat(target)).length) return NOTHING
  const runs = await listRuns()
  settlePlans(target, (id) => {
    const run = runs.find((r) => r.sessionId === id)
    return run && { live: run.status === 'running', cards: run.createdCardIds ?? [] }
  })
  const open = openPlans(readChat(target))
  const plans = open.map(shown).filter((p): p is DiscussPlan => p !== null)
  if (!plans.length) return NOTHING
  const running = (p: ChatPlan) => runs.find((r) => r.sessionId === p.run)?.status === 'running'
  const handed = open.find(running) ?? open.find((p) => p.run)
  return {
    plan: plans.at(-1)!,
    plans,
    run: handed?.run ? { sessionId: handed.run, running: running(handed), answer: handed.answer ?? 'plan' } : null,
  }
}

// One plan as the screen draws it — spelled from the project root, the way a card's
// `## Source` carries it: the panel shows the path to copy, and the board never opens a plan
// itself.
function shown(plan: ChatPlan): DiscussPlan | null {
  const file = readPlan(plan.path)
  return file && { ...file, path: planPathInText(file.path), title: planHeading(file.text), workflow: plan.workflow }
}

/** The run this plan was handed to has started, and which answer handed it over. Held on the
 *  discussion so reopening it says the run is still working rather than offering a second
 *  one, and says which of the two is working.
 *
 *  The discussion goes out of the rail with it (#551): the user has nothing left to do on a
 *  subject whose run is already underway. The plan file stays where it is — the run is
 *  reading it — and the archive is marked the board's own, so a run that ends having written
 *  no card can put the row back.
 *
 *  That archive is an end, so it submits (#659) — the same one turn the rail's End discussion
 *  makes, started here and never waited on. Start planning and Build now are ends too, and a
 *  discussion whose end is refused is not handed over at all: the screen holds these two
 *  before the run ever starts, and this is the answer behind it.
 */
export function startedPlanning(
  sessionId: string,
  answer: PlanAnswer = 'plan',
  target: ChatTarget = null,
  paths?: string[],
): { ok: true } | { error: string; reason: EndBlock } {
  const held = endBlocked(target)
  if (held) return { error: END_BLOCK_SAID[held], reason: held }
  // The plans the run was pointed at, spelled the way the read gave them; none named is every
  // open one, which is what a screen older than #917 hands over.
  const rels = paths?.map(planFromText).filter((p): p is string => p !== null)
  const handed = setChatPlanRun(target, sessionId, answer, rels ?? openPlans(readChat(target)).map((p) => p.path))
  if (handed && isDiscussion(target)) {
    setChatArchived(target, true, 'board')
    // Started, never waited on, and never able to take the handoff down with it: the screen
    // has already moved on to the run, and this turn is the board's own. A run said into this
    // discussion's session submits once it ends instead (#1026).
    if (!peekRun(sessionId)?.chat) void shareOnEnd(target).catch(() => {})
  }
  return { ok: true }
}

/** Settle every open plan whose run has ended having written cards (#917). A plan some new
 *  card names in `## Source` is finished: it is filed under `plans/archive/`, those cards are
 *  repointed at where it went, and the discussion lets it go. One no card names goes back to
 *  the discussion to be handed off again. A run handed a single plan wrote its cards from it
 *  whatever they name, as it always has. */
export function settlePlans(target: ChatTarget, look: RunLook): void {
  const byRun = new Map<string, ChatPlan[]>()
  for (const p of openPlans(readChat(target))) if (p.run) byRun.set(p.run, [...(byRun.get(p.run) ?? []), p])
  for (const [sessionId, plans] of byRun) {
    const run = look(sessionId)
    // The card, not the exit code (#481): a Build now writes its card first and can fail
    // building it, and that plan is finished all the same.
    if (!run || run.live || !run.cards.length) continue
    for (const plan of plans) {
      const naming = plans.length === 1 ? run.cards : run.cards.filter((id) => sourceNames(id, plan.path))
      if (!naming.length) {
        returnChatPlan(target, plan.path)
        continue
      }
      const moved = archivePlan(plan.path)
      if (moved && moved !== plan.path) for (const id of naming) repointSource(id, plan.path, moved)
      clearChatPlan(target, plan.path)
    }
  }
}

// One card's file, whatever became of the card; null when it is gone.
function cardFile(id: number): string | null {
  const found = locate(id) ?? locateArchived(id)
  if (!found) return null
  return found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
}

// A card's `## Source` section — the card's last, so from the heading to the end.
function sourceOf(text: string): string {
  const at = text.search(/^## Source\s*$/m)
  return at < 0 ? '' : text.slice(at)
}

// Whether a card's `## Source` names this plan, however it was spelled — by its id, the one
// part of the name that survives a rename and the move into `archive/`.
function sourceNames(id: number, plan: string): boolean {
  const planId = /(\d+)-[^/]*\.md$/.exec(plan)?.[1]
  if (!planId) return false
  try {
    const file = cardFile(id)
    return !!file && new RegExp(`plans/(archive/)?${planId}-`).test(sourceOf(fs.readFileSync(file, 'utf8')))
  } catch {
    return false
  }
}

// Rewrite one card's `## Source` to name where the plan went. A card already rejected or
// otherwise gone is passed over — the plan still moves, and nothing here is worth failing
// the move for.
function repointSource(id: number, from: string, to: string): void {
  let file: string | null
  let text: string
  try {
    file = cardFile(id)
    if (!file) return
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return
  }
  const was = sourceOf(text)
  if (!was) return
  // Both spellings are replaced: the path from the project root, which is what a card
  // carries, and the board-relative one in case something wrote that instead.
  const head = text.slice(0, text.length - was.length)
  const source = was.replaceAll(planPathInText(from), planPathInText(to)).replaceAll(from, to)
  if (source === was) return
  try {
    fs.writeFileSync(file, head + source)
  } catch {
    // The card goes on naming a path that still reads — `readPlan` follows the plan by its
    // id into either folder.
  }
}
