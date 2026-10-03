// The Discuss screen's own state (#427) — everything it draws that the chat rail doesn't.
//
// The conversation itself is `agent/chat.ts`: Discuss is `akb chat` on one discussion (#496),
// held in the same file, answered by the same agent. What is added here is the plan that
// discussion is writing and the run one of the handoff's answers handed it to — Plan tasks,
// which turns it into cards, or Start now, which writes one card from it and builds it
// (#481).

import path from 'node:path'
import fs from 'node:fs'

import { listRuns, peekRun, titleOf } from './sessions'
import { runIsLive } from './store'
import {
  becameCards,
  clearChatPlan,
  clearChatTriage,
  openPlans,
  readChat,
  returnChatPlan,
  setChatArchived,
  setChatPlanRun,
} from './chat'
import { locate, locateArchived } from '../cards'
import { plansNamed } from '../card-sources'
import { parseFrontmatter } from '../frontmatter'
import { archivePlan, planFromText, planHeading, planPathInText, readPlan } from '../plans'
import { archiveInboxItem } from '../signals/inbox'
import { endBlocked, END_BLOCK_SAID, shareOnEnd, type EndBlock } from './share'
import {
  isDiscussion,
  type ChatPlan,
  type ChatTarget,
  type DiscussPlan,
  type DiscussRead,
  type HandoffRow,
  type PlanAnswer,
} from './types'

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
  if (!openPlans(readChat(target)).length) return became(target)
  const runs = await listRuns()
  settlePlans(target, (id) => {
    const run = runs.find((r) => r.sessionId === id)
    return run && { live: run.status === 'running', cards: run.createdCardIds ?? [] }
  })
  const chat = readChat(target)
  const open = openPlans(chat)
  const plans = open.map(shown).filter((p): p is DiscussPlan => p !== null)
  if (!plans.length) return became(target)
  const running = (p: ChatPlan) => runs.find((r) => r.sessionId === p.run)?.status === 'running'
  const runOf = (p: ChatPlan) => p.run && { sessionId: p.run, running: running(p), answer: p.answer ?? 'plan' }
  const handed = open.find(running) ?? open.find((p) => p.run)
  // A withdrawn plan is done with no cards, and has no row.
  const rows = (chat?.plans ?? []).flatMap((p): HandoffRow[] => {
    if (p.done) {
      if (!p.cards?.length) return []
      const cards = p.cards.map((id) => ({ id, title: titleOf(id) ?? '' }))
      return [{ path: planPathInText(p.path), title: p.title || cards[0]!.title, workflow: p.workflow, cards }]
    }
    const plan = plans.find((s) => s.path === planPathInText(p.path))
    if (!plan) return []
    const run = runOf(p)
    return [{ path: plan.path, title: plan.title || p.title || '', workflow: p.workflow, ...(run ? { run } : {}) }]
  })
  return { plan: plans.at(-1)!, plans, run: (handed && runOf(handed)) || null, rows }
}

// A discussion with no plan left open: the cards it became, if it became any (#1213).
function became(target: ChatTarget): DiscussRead {
  const cards = becameCards(readChat(target))
  return cards.length ? { ...NOTHING, became: cards.map((id) => ({ id, title: titleOf(id) ?? '' })) } : NOTHING
}

// One plan as the screen draws it — spelled from the project root: the panel shows the path
// to copy.
function shown(plan: ChatPlan): DiscussPlan | null {
  const file = readPlan(plan.path)
  return file && { ...file, path: planPathInText(file.path), title: planHeading(file.text), workflow: plan.workflow }
}

/** The run these plans were handed to has started, and which answer handed it over (#481).
 *  Held on the discussion so reopening it says the run is still working.
 *
 *  Handing over the last plan still waiting ends the discussion (#551, #1442): it goes out of
 *  the rail, marked the board's own so a run that writes no card can put it back, and it
 *  submits (#659). A plan whose run ended with no card is waiting again. An end can be
 *  refused, and then nothing is handed over.
 */
export function startedPlanning(
  sessionId: string,
  answer: PlanAnswer = 'plan',
  target: ChatTarget = null,
  paths?: string[],
): { ok: true } | { error: string; reason: EndBlock } {
  const held = endBlocked(target)
  if (held) return { error: END_BLOCK_SAID[held], reason: held }
  // None named is every open one, which is what a screen older than #917 hands over.
  const rels = paths?.map(planFromText).filter((p): p is string => p !== null)
  const handed = setChatPlanRun(target, sessionId, answer, rels ?? openPlans(readChat(target)).map((p) => p.path))
  // A run with no record may be continued under another id (#970), so it counts as live.
  const live = (id: string) => {
    const run = peekRun(id)
    return id === sessionId || !run || runIsLive(run)
  }
  const waiting = openPlans(readChat(target)).some((p) => !p.run || !live(p.run))
  if (handed && !waiting && isDiscussion(target)) {
    setChatArchived(target, true, 'board')
    // Never waited on. A run said into this discussion's session submits once it ends instead
    // (#1026).
    if (!peekRun(sessionId)?.chat) void shareOnEnd(target).catch(() => {})
  }
  return { ok: true }
}

/** Settle every open plan whose run has ended having written cards (#917). A plan some new
 *  card names as a source is finished: it is filed under `plans/archive/` and the discussion
 *  lets it go. One no card names goes back to
 *  the discussion to be handed off again. A run handed a single plan wrote its cards from it
 *  whatever they name, as it always has. */
export function settlePlans(target: ChatTarget, look: RunLook): void {
  const byRun = new Map<string, ChatPlan[]>()
  for (const p of openPlans(readChat(target))) if (p.run) byRun.set(p.run, [...(byRun.get(p.run) ?? []), p])
  for (const [sessionId, plans] of byRun) {
    const run = look(sessionId)
    // The card, not the exit code (#481): a Start now writes its card first and can fail
    // building it, and that plan is finished all the same.
    if (!run || run.live || !run.cards.length) continue
    for (const plan of plans) {
      const naming = plans.length === 1 ? run.cards : run.cards.filter((id) => sourceNames(id, plan.path))
      if (!naming.length) {
        returnChatPlan(target, plan.path)
        continue
      }
      archivePlan(plan.path)
      clearChatPlan(target, plan.path, naming)
      archiveDiscussionTriage(target, naming[0]!)
    }
  }
}

/** File the triage item a discussion was started from under the first card it wrote
 *  (#1252). Once only, and never in the way of the card. */
export function archiveDiscussionTriage(target: ChatTarget, cardId: number): void {
  const sourceId = readChat(target)?.triage
  if (!sourceId) return
  try {
    archiveInboxItem(sourceId, cardId)
    clearChatTriage(target)
  } catch {
    // left for the next card
  }
}

// Whether a card names this plan as a source, by the plan's id — the one part of its name
// that survives a rename and the move into `archive/`.
function sourceNames(id: number, plan: string): boolean {
  const planId = /(\d+)-[^/]*\.md$/.exec(plan)?.[1]
  const found = locate(id) ?? locateArchived(id)
  if (!planId || !found) return false
  try {
    const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
    const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
    return plansNamed(meta ?? { source: [] }, body).includes(Number(planId))
  } catch {
    return false
  }
}
