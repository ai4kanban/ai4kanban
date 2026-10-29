/**
 * Sorting triage in Cloud (#2124): each new item is judged once, for the workspace owner's Pro,
 * and ends as a task, a dismissal with its reason, or open for the user. The questions, the
 * lines and the trimming came from the CLI's retired local sort (#2115), less what a Cloud task
 * has no field for.
 */

import { readBilling } from './billing.ts'
import { boardFor, boardOf, projectRoot, workspaceOfProject } from './board.ts'
import { cardFront } from './board-files.ts'
import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import { askJev } from './judge.ts'
import type { Answer } from './judge.ts'
import { cardItem, heldIn, heldOf, itemsJson, openItem, rewriteItem } from './triage.ts'
import { cloudWorkflowOf, itemPath, ofTriageId, stampItem, stampOf, triageId } from './triage-files.ts'
import { placeWorkflow } from './v1/board.ts'
import { poke } from './v1/stream.ts'
import { BUILTIN_WORKFLOWS, workflowFor } from './v1/workflows.ts'

/** Below this confidence a workflow pick is left to the user. */
export const CONFIDENT = 0.6
export const IGNORE_LINE = 0.9
export const NEEDS_USER_LINE = 0.5
export const DROP_LINE = 0.8
export const DO_LINE = 0.8
export const MAX_TOKENS = 30_000
/** Items the hourly run judges at most. */
export const HOURLY = 50
/** Jev takes at most 500 options a question; the newest cards are offered. */
const MAX_CARDS = 499

const encoder = new TextEncoder()
export const tokensOf = (value: unknown): number => Math.ceil(encoder.encode(JSON.stringify(value)).length / 3)

const yesNo = (instructions: string, yes: string, no: string) => ({ type: 'choice', instructions, criteria: { yes, no } }) as const

const WORTH = yesNo(
  "Is the work this `item` asks for worth doing for the product, as its description and the planner's `decisions` say?",
  'it fixes something users meet, or moves the product the way its description and the decisions point.',
  'it is worth too little: cosmetic or speculative, outside what the product is for, or about something the product no longer has.',
)

const REJECTED = yesNo(
  'Was the idea this `item` asks for turned down before, as the `rejected.md` notes record?',
  'a note records the same idea, or the kind of item it is, as turned down.',
  'no note turns down this idea.',
)

const NEEDS_USER = yesNo(
  'Does whether to do what this `item` asks hinge on a direction or trade-off only the user can settle?',
  'doing it means choosing a product direction, a price, a promise to users, or between options the item itself leaves open.',
  'the item says what to do, and doing it follows the product as described.',
)

const DUPLICATE_ASKS = 'Which open card already owns the work this item asks for? Pick none when no card does.'

const WORKFLOW_ASKS =
  'Which workflow does the work this item asks for? Choose by the work, not the topic: changing code, agent instructions or skill files is `coding` work, even when they are about UI or video. Pick none when no workflow here can.'

export interface OpenCard {
  id: number
  title: string
}

/** What Jev is asked. A question left with fewer than two options is left out. */
export function questionsFor(cards: OpenCard[], workflows: Record<string, string>, proposer: boolean): Record<string, unknown> {
  return {
    ...(proposer
      ? { needsUser: NEEDS_USER }
      : {
          worth: WORTH,
          rejected: REJECTED,
          ...(cards.length
            ? {
                duplicate: {
                  type: 'choice',
                  instructions: DUPLICATE_ASKS,
                  criteria: { ...Object.fromEntries(cards.map((c) => [`#${c.id}`, c.title])), none: 'no open card owns this work.' },
                },
              }
            : {}),
          needsUser: NEEDS_USER,
        }),
    ...(Object.keys(workflows).length
      ? { workflow: { type: 'choice', instructions: WORKFLOW_ASKS, criteria: { ...workflows, none: 'no workflow here can do this work.' } } }
      : {}),
  }
}

/** A memory file as lines, so its oldest entries can be dropped one at a time. */
interface Kept {
  key: string
  lines: string[]
}

/** The item and the board's memory, cut to fit: the oldest entry of each file in turn. */
export function stateFor(item: string, product: string, memory: { key: string; text: string }[], questions: Record<string, unknown>) {
  const kept: Kept[] = memory.filter((m) => m.text.trim()).map((m) => ({ key: m.key, lines: m.text.split('\n') }))
  const build = (): Record<string, unknown> => {
    const state: Record<string, unknown> = { item }
    if (product.trim()) state.product = product
    for (const k of kept) state[k.key] = k.lines.join('\n')
    return state
  }
  const fits = () => tokensOf({ state: build(), questions }) <= MAX_TOKENS
  let dropped = true
  while (!fits() && dropped) {
    dropped = false
    for (const k of kept) {
      if (fits()) break
      const at = k.lines.findIndex((line) => /^\s*[-*] /.test(line))
      if (at < 0) continue
      k.lines.splice(at, 1)
      dropped = true
    }
  }
  return build()
}

export type Reason = 'rejected' | 'duplicate' | 'low-value' | 'needs-user' | 'unsure' | 'plan'

export interface Verdict {
  verdict: 'skip' | 'human-review' | 'plan'
  reason: Reason
  card: number | null
  confidence: number
}

const hundredths = (n: number): number => Math.round(n * 100) / 100

const yes = (answer?: Answer): number => {
  if (!answer) return 0
  const given = answer.probabilities?.yes
  if (Number.isFinite(given)) return hundredths(given!)
  return hundredths(answer.choice === 'yes' ? answer.confidence : 1 - answer.confidence)
}

function duplicateOf(answer?: Answer): { odds: number; card: number | null } {
  if (!answer) return { odds: 0, card: null }
  const card = Number(answer.choice.match(/^#(\d+)$/)?.[1] ?? NaN)
  if (!Number.isInteger(card)) return { odds: 0, card: null }
  const none = answer.probabilities?.none
  return { odds: hundredths(Number.isFinite(none) ? 1 - none! : answer.confidence), card }
}

/** The ends, read in a fixed order: the facts that make an item not worth a task, then whether
 *  the user is needed, then its worth. A proposer's item is never dismissed. */
export function verdictOf(answers: Record<string, Answer | undefined>, proposer = false): Verdict {
  const needsUser = yes(answers.needsUser)
  if (proposer) {
    return needsUser >= NEEDS_USER_LINE
      ? { verdict: 'human-review', reason: 'needs-user', card: null, confidence: needsUser }
      : { verdict: 'plan', reason: 'plan', card: null, confidence: hundredths(1 - needsUser) }
  }
  const worth = yes(answers.worth)
  const duplicate = duplicateOf(answers.duplicate)
  const rejected = yes(answers.rejected)
  const [fact, odds] = duplicate.odds > rejected ? (['duplicate', duplicate.odds] as const) : (['rejected', rejected] as const)
  if (odds >= IGNORE_LINE) return { verdict: 'skip', reason: fact, card: fact === 'duplicate' ? duplicate.card : null, confidence: odds }
  if (needsUser >= NEEDS_USER_LINE) return { verdict: 'human-review', reason: 'needs-user', card: null, confidence: needsUser }
  if (hundredths(1 - worth) >= DROP_LINE) return { verdict: 'skip', reason: 'low-value', card: null, confidence: hundredths(1 - worth) }
  if (worth >= DO_LINE) return { verdict: 'plan', reason: 'plan', card: null, confidence: worth }
  return { verdict: 'human-review', reason: 'unsure', card: null, confidence: Math.max(odds, hundredths(1 - worth), worth) }
}

/** A dismissal's reason, as the Triage page shows it: no account language is known, so both. */
export function reasonWords(v: Pick<Verdict, 'reason' | 'card'>, cards: OpenCard[] = []): string {
  const title = cards.find((c) => c.id === v.card)?.title
  switch (v.reason) {
    case 'rejected':
      return 'Turned down before · 以前否决过'
    case 'duplicate':
      return title ? `Duplicates “${title}” · 与「${title}」重复` : 'Duplicates an open task · 与进行中的任务重复'
    default:
      return 'Too little worth · 价值不大'
  }
}

/** The workflow an item becomes: Jev's pick when sure of one offered, else none. */
export function workflowOf(answer: Answer | undefined, offered: Record<string, string>): string | null {
  if (!answer || answer.confidence < CONFIDENT || answer.choice === 'none') return null
  return answer.choice in offered ? answer.choice : null
}

/** One item to judge, and the workspace it is judged in. */
export interface ToSort {
  title: string
  text: string
  source_task: string | null
  workflow: string | null
  owner: string
  installed: string[]
  workflows: { id: string; name: string; description: string }[]
}

export type Outcome = 'card' | 'dismiss' | 'open'

interface SortContext {
  owner: string
  installed: string[]
  workflows: { id: string; name: string; description: string }[]
}

const PLANNER = 'memory/agents/planner/'

/** The open cards, by the number in each file's name. */
function cardsOf(rows: { path: string; content: string | null }[]): OpenCard[] {
  const cards: OpenCard[] = []
  for (const row of rows) {
    if (row.content === null) continue
    const m = /^todo\/(?:(\d+)-[^/]+\/root|(?:[^/]+\/)*(\d+)-[^/]*)\.md$/.exec(row.path)
    const id = Number(m?.[1] ?? m?.[2] ?? NaN)
    const title = cardFront(row.content).title
    if (Number.isInteger(id) && title) cards.push({ id, title })
  }
  return cards.sort((a, b) => a.id - b.id).slice(-MAX_CARDS)
}

async function judgeOne(env: Env, project: string, item: ToSort): Promise<{ outcome: Outcome; reason?: string; workflow?: string }> {
  const proposer = !!item.source_task
  const board = await boardFor(env, project)
  const [memory, todo, product] = await Promise.all([
    board.list(PLANNER),
    proposer ? Promise.resolve([]) : board.list('todo/'),
    board.read(['memory/project.md']),
  ])
  const notes = memory
    .filter((r) => r.content !== null && (r.path.endsWith('/decisions.md') || (!proposer && r.path.endsWith('/rejected.md'))))
    .map((r) => ({ key: r.path === `${PLANNER}decisions.md` ? 'decisions' : r.path, text: r.content! }))
  // An item that names its workflow (#2139) is not asked for one.
  const offered: Record<string, string> = item.workflow ? {} : Object.fromEntries([
    ...BUILTIN_WORKFLOWS.filter((w) => item.installed.includes(w.id)).map((w) => [w.id, w.description || w.name]),
    ...item.workflows.map((w) => [w.id, w.description || w.name]),
  ])
  const cards = cardsOf(todo)
  const questions = questionsFor(cards, offered, proposer)
  const state = stateFor(`title: ${item.title}\n\n${item.text}`.trim(), product[0]?.content ?? '', notes, questions)
  const out = await askJev(env, item.owner, state, questions)
  if (!out) return { outcome: 'open' }
  const verdict = verdictOf(out.answers, proposer)
  if (verdict.verdict === 'skip') return { outcome: 'dismiss', reason: reasonWords(verdict, cards) }
  if (verdict.verdict === 'human-review') return { outcome: 'open' }
  const workflow = item.workflow ?? workflowOf(out.answers.workflow, offered)
  return workflow ? { outcome: 'card', workflow } : { outcome: 'open' }
}

/** Judge one item and land the end: marked judged first, so it is judged once whatever the end.
 *  Never throws: an item not landed waits for the hourly run. */
export async function sortTriage(env: Env, id: string, ctx?: ExecutionContext): Promise<Outcome | null> {
  if (!env.OPENROUTER_API_KEY) return null
  const at = ofTriageId(id)
  if (!at) return null
  try {
    const workspace = await workspaceOfProject(env, at.project)
    const board = boardOf(env, workspace)
    const path = projectRoot(at.project) + itemPath('open', at.name)
    const [row] = await board.read([path])
    const held = row ? heldOf(row) : null
    if (!held || held.file.fields.judged_at) return null
    const claimed = stampItem(held.content, { judged_at: stampOf(new Date()) })
    if (!(await board.commit([{ path, content: claimed, base_seq: held.seq }])).ok) return null
    const scope = await call<SortContext>(env, 'v1_sort_context', { p_workspace: workspace })
    const f = held.file.fields
    const item: ToSort = {
      ...scope,
      title: f.title!,
      text: held.file.body,
      source_task: f.source_task || null,
      workflow: f.workflow ? cloudWorkflowOf(f.workflow) : null,
    }
    const billing = await readBilling(env, item.owner)
    let end: { outcome: Outcome; reason?: string; workflow?: string } = { outcome: 'open' }
    if (billing.plan === 'pro') {
      try {
        end = await judgeOne(env, at.project, item)
      } catch (e) {
        console.error('cloud: triage not judged', { id, error: e instanceof Error ? e.message : String(e) })
      }
    }
    if (end.outcome === 'dismiss') {
      const moved = await rewriteItem(board, at.project, at.name, (h) => h?.state === 'open'
        ? { state: 'dismissed', content: stampItem(h.content, { dismissed_at: stampOf(new Date()), dismissed_by: 'agent', dismissed_reason: end.reason ?? null }) }
        : null)
      if (!moved) return 'open'
      const [json] = await itemsJson(env, workspace, [moved.held])
      await call(env, 'v1_triage_emit', { p_workspace: workspace, p_type: 'triage.updated', p_data: json })
    } else if (end.outcome === 'card') {
      let task: { id: string; key: string } | null = null
      try {
        await openItem(env, id)
        task = await mutate<{ id: string; key: string }>(env, 'v1_create_task', {
          p_account: item.owner,
          p_fields: { title: item.title, request: item.text, run: true, project: at.project },
          p_workflow: workflowFor(end.workflow!),
        })
      } catch (e) {
        console.error('cloud: triage no task made', { id, error: e instanceof Error ? e.message : String(e) })
      }
      if (!task) return 'open'
      await cardItem(env, undefined, id, task)
      await placeWorkflow(env, item.owner, task.id)
    }
    if (ctx && end.outcome !== 'open') poke(env, ctx, null, workspace)
    return end.outcome
  } catch (e) {
    console.error('cloud: triage not sorted', { id, error: e instanceof Error ? e.message : String(e) })
    return null
  }
}

/** The hourly run: items a request's `waitUntil` did not finish, in workspaces whose jobs wrote
 *  to their boards lately. */
export async function sortWaitingTriage(env: Env): Promise<number> {
  if (!env.OPENROUTER_API_KEY) return 0
  let ids: string[] = []
  try {
    for (const workspace of await call<string[]>(env, 'v1_sort_workspaces', { p_limit: HOURLY })) {
      const held = await heldIn(boardOf(env, workspace), null)
      ids.push(...held.filter((h) => h.state === 'open' && !h.file.fields.judged_at).map((h) => triageId(h.project, h.name)))
      if (ids.length >= HOURLY) break
    }
  } catch (e) {
    console.error('cloud: waiting triage not read', e)
  }
  ids = ids.slice(0, HOURLY)
  let n = 0
  for (const id of ids) if (await sortTriage(env, id)) n++
  return n
}
