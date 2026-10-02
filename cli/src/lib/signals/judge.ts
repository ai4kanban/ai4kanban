// Sorting triage with Jev (#1221, #1263), for Pro.
//
// One Cloud request per item: six choice questions — the verdict, the card it duplicates, and
// the module, priority, ROI and workflow of the card it would become. The answers land here:
// a card written and the item archived, an ignore with its reason, or a hold for the user.

import fs from 'node:fs'
import path from 'node:path'

import os from 'node:os'

import { builtinDescription, workflows } from '../agent/workflows'
import { runBoardMove } from '../board'
import { idPrefix, walkMd } from '../cards'
import { cloudEndpoints } from '../cloud/config'
import { forgetPro } from '../cloud/pro'
import { accessToken } from '../cloud/session'
import { BoardError, quietlyAsync } from '../io'
import { PLANNER, agentMemoryDir, agentMemoryFile, onlyStarter } from '../memory'
import { MODULES_MD, PROJECT_MD, REPO_ROOT, TODO, die, rel } from '../paths'
import { LEVELS } from '../validate'
import { unquote } from '../yaml'
import type { Signal, TriageReason, TriageVerdict } from '../view/types'
import { archiveInboxItem, dismissInboxItem, readInbox, recordVerdict } from './inbox'

/** Below this confidence a workflow pick falls back to the board's default. */
export const CONFIDENT = 0.6

/** An item is ignored at this much confidence it should be dropped, and carded at this much
 *  that it is worth doing. Ignoring is the stricter: a wrong ignore is never seen. */
export const DROP_LINE = 0.8
export const DO_LINE = 0.6

/** Jev reads 32K tokens; the state and questions are kept under this estimate of them. */
export const MAX_TOKENS = 30_000

// A conservative count: three UTF-8 bytes per token overcounts English and matches CJK.
export const tokensOf = (value: unknown): number => Math.ceil(Buffer.byteLength(JSON.stringify(value)) / 3)

const VERDICT = {
  type: 'choice',
  instructions:
    "What should become of this item? Judge its worth against the product, as its description and the planner's decisions say; both win over a past verdict. Pick the first option that fits.",
  criteria: {
    supported: 'the product already does what the item asks.',
    rejected: 'the same idea was turned down before.',
    duplicate: 'an open card already owns this work.',
    'low-value': 'worth too little to the product.',
    'needs-user': 'whether it is worth doing hinges on a direction or trade-off only the user can settle.',
    small: 'worth doing, small, and fully specified by the item, with no design choice left.',
    plan: 'worth doing, and needs planning first.',
  },
} as const

type Option = keyof typeof VERDICT.criteria

const DROP_OPTIONS = ['supported', 'rejected', 'duplicate', 'low-value'] as const
const DO_OPTIONS = ['small', 'plan'] as const

const DUPLICATE_ASKS = 'Which open card already owns the work this item asks for? Pick none when no card does.'

const MODULES_ASKS = 'Which part of the project does the work this item asks for touch most?'

const PRIORITY = {
  type: 'choice',
  instructions: 'How much does this item matter to the product now?',
  criteria: {
    high: 'it blocks users or the product goal.',
    med: 'a clear improvement worth doing soon.',
    low: 'nice to have.',
  },
} as const

const ROI = {
  type: 'choice',
  instructions: 'How much is this item worth for the work it takes?',
  criteria: {
    high: 'much value for little work.',
    med: 'value in proportion to the work.',
    low: 'little value for the work.',
  },
} as const

const WORKFLOW_ASKS = 'Which workflow does the work this item asks for? Pick none when no workflow here can.'

const NO_WORKFLOW = 'no workflow here can do this work.'

/** An open card, as the duplicate question offers it. */
export interface OpenCard {
  id: number
  title: string
  file: string
}

/** Every open card on the board, by id. */
export function openCards(): OpenCard[] {
  let files: string[]
  try {
    files = walkMd(TODO)
  } catch {
    return []
  }
  const cards: OpenCard[] = []
  for (const file of files) {
    const id = idPrefix(path.basename(file)) ?? (path.basename(file) === 'root.md' ? idPrefix(path.basename(path.dirname(file))) : null)
    if (id === null) continue
    const title = fs.readFileSync(file, 'utf8').match(/^title:\s*(.*)$/m)?.[1]
    if (title !== undefined) cards.push({ id, title: unquote(title.trim()), file })
  }
  return cards.sort((a, b) => a.id - b.id)
}

/** The module map, by name: what each part of the project is. */
function moduleCriteria(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of read(MODULES_MD).split('\n')) {
    const m = line.match(/^\s*[-*]\s+\*\*([^*]+)\*\*\s*(?:[—:-]\s*)?(.*)$/)
    if (m) out[m[1]!.trim()] = m[2]!.trim() || m[1]!.trim()
  }
  return out
}

const workflowCriteria = (): Record<string, string> =>
  Object.fromEntries(workflows().map((flow) => [flow.id, (flow.builtIn && builtinDescription(flow.id)) || flow.name]))

/** What Jev is asked of one item. One already judged worth a card is asked only what its
 *  card needs. A question with fewer than two options is left out — Cloud refuses it. */
export function questionsFor(cards: OpenCard[], judged = false): Record<string, unknown> {
  const modules = moduleCriteria()
  return {
    ...(judged
      ? {}
      : {
          verdict: VERDICT,
          duplicate: {
            type: 'choice',
            instructions: DUPLICATE_ASKS,
            criteria: {
              ...Object.fromEntries(cards.map((card) => [`#${card.id}`, card.title])),
              none: 'no open card owns this work.',
            },
          },
        }),
    ...(Object.keys(modules).length > 1 ? { modules: { type: 'choice', instructions: MODULES_ASKS, criteria: modules } } : {}),
    priority: PRIORITY,
    roi: ROI,
    workflow: { type: 'choice', instructions: WORKFLOW_ASKS, criteria: { ...workflowCriteria(), none: NO_WORKFLOW } },
  }
}

const read = (file: string): string => {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

const boardRel = (file: string): string => rel(file).split(path.sep).join('/')

/** A memory file, as lines, so its oldest entries can be dropped one at a time. */
interface Kept {
  file: string
  lines: string[]
}

/** What Jev is given about one item, and what had to be cut to fit. */
export interface Judgement {
  state: Record<string, unknown>
  trimmed: string[]
}

/** The files Jev is given alongside the item, fixed by the board. Cut to fit; the item itself
 *  never is. Open cards reach Jev as the duplicate question's options, by id and title. */
export function judgementState(item: Signal, questions: Record<string, unknown>): Judgement {
  const product = read(PROJECT_MD)
  const readme = onlyStarter('project.md', product) ? read(path.join(REPO_ROOT, 'README.md')) : ''
  const plannerDir = agentMemoryDir(PLANNER)
  const rejected = [agentMemoryFile(PLANNER, 'rejected.md')]
  try {
    for (const entry of fs.readdirSync(plannerDir, { withFileTypes: true })) {
      if (entry.isDirectory()) rejected.push(path.join(plannerDir, entry.name, 'rejected.md'))
    }
  } catch {
    // no planner memory yet
  }
  const memory: Kept[] = [...rejected, agentMemoryFile(PLANNER, 'dismissed.md')]
    .map((file) => ({ file, lines: read(file).split('\n') }))
    .filter((kept) => kept.lines.some((line) => line.trim()))
  let readmeText = readme

  const build = (): Record<string, unknown> => {
    const state: Record<string, unknown> = { item: read(path.join(REPO_ROOT, item.relPath)) || itemText(item) }
    if (readmeText) state.readme = readmeText
    else if (product.trim()) state.product = product
    const decisions = read(agentMemoryFile(PLANNER, 'decisions.md'))
    if (decisions.trim()) state.decisions = decisions
    for (const kept of memory) state[boardRel(kept.file)] = kept.lines.join('\n')
    return state
  }
  const fits = (): boolean => tokensOf({ state: build(), questions }) <= MAX_TOKENS
  const trimmed: string[] = []

  if (readmeText && !fits()) {
    readmeText = readmeText.slice(0, Math.floor(readmeText.length / 2))
    trimmed.push('README.md — its second half')
  }
  // The oldest entry of each memory file in turn: a file is appended to, so its first entry is
  // its oldest.
  let dropped = true
  while (!fits() && dropped) {
    dropped = false
    for (const kept of memory) {
      if (fits()) break
      const at = kept.lines.findIndex((line) => /^\s*[-*] /.test(line))
      if (at < 0) continue
      kept.lines.splice(at, 1)
      dropped = true
      const label = `${boardRel(kept.file)} — its oldest entries`
      if (!trimmed.includes(label)) trimmed.push(label)
    }
  }
  return { state: build(), trimmed }
}

// The item's own file, rebuilt from what was read, when it cannot be read again.
const itemText = (item: Signal): string =>
  [`title: ${item.title}`, item.sourceType && `source_type: ${item.sourceType}`, item.url && `url: ${item.url}`, ...item.meta.map((m) => `${m.key}: ${m.value}`), '', item.summary]
    .filter((line) => line !== '')
    .join('\n')

/** One question's answer as Cloud passes it on. */
export interface Answer {
  choice: string
  confidence: number
  probabilities?: Record<string, number>
}

/** A verdict, as recorded on the item. */
export interface Verdict {
  verdict: TriageVerdict
  reason: TriageReason
  card: number | null
  confidence: number
  /** How sure Jev was the item should be ignored, and that it is worth doing. Null when unknown. */
  drop: number | null
  do: number | null
}

// Two decimals, as the item records them: the lines are measured on what is kept.
const hundredths = (n: number): number => Math.round(n * 100) / 100

/** The four ends, from the two confidences Jev's probabilities add up to. */
export function verdictOf(answers: { verdict: Answer; duplicate?: Answer }): Verdict {
  const pick = answers.verdict.choice as Option
  const confidence = answers.verdict.confidence
  if (!(pick in VERDICT.criteria)) throw new Error(`Jev picked an option it was not offered: ${pick}`)
  const given = answers.verdict.probabilities
  const odds: Record<string, number> = given && Object.keys(given).length > 0 ? given : { [pick]: confidence }
  const of = (option: Option): number => (Number.isFinite(odds[option]) ? odds[option]! : 0)
  const sum = (options: readonly Option[]): number => hundredths(options.reduce((n, option) => n + of(option), 0))
  const base = { card: null, confidence, drop: sum(DROP_OPTIONS), do: sum(DO_OPTIONS) }

  if (pick === 'needs-user') return { ...base, verdict: 'human-review', reason: 'needs-user' }
  if (base.drop >= DROP_LINE) {
    const reason = DROP_OPTIONS.reduce((top, option) => (of(option) > of(top) ? option : top))
    const card = reason === 'duplicate' ? Number(answers.duplicate?.choice.match(/^#(\d+)$/)?.[1] ?? NaN) : NaN
    return { ...base, card: Number.isInteger(card) ? card : null, verdict: 'skip', reason }
  }
  if (base.do >= DO_LINE) {
    return hundredths(of('small')) >= DO_LINE
      ? { ...base, verdict: 'plan-without-refine', reason: 'small' }
      : { ...base, verdict: 'plan', reason: 'plan' }
  }
  return { ...base, verdict: 'human-review', reason: 'unsure' }
}

/** The reason, in the words `triage dismiss` records and the log reads. */
export function reasonWords(v: Pick<Verdict, 'reason' | 'card' | 'drop' | 'do'>): string {
  switch (v.reason) {
    case 'supported':
      return 'already supported'
    case 'rejected':
      return 'turned down before'
    case 'duplicate':
      return v.card === null ? 'duplicates an open card' : `duplicates #${v.card}`
    case 'low-value':
      return 'too little worth'
    case 'needs-user':
      return 'needs your direction'
    case 'unsure': {
      if (v.drop === null || v.do === null) return 'unsure'
      const sure = (n: number): string => `${Math.round(n * 100)}% sure`
      return v.do >= v.drop ? `likely worth doing, ${sure(v.do)}` : `likely to ignore, ${sure(v.drop)}`
    }
    case 'small':
      return 'small and fully specified'
    case 'plan':
      return 'worth doing, needs planning'
    case 'no-workflow':
      return 'no workflow does it'
  }
}

/** Items the sort still has to deal with: never judged, or judged worth a card not yet written.
 *  Held and restored items are the user's — but one held as unsure before the two confidences
 *  were kept (#1356) is judged once more. */
export const awaitsJudging = (item: Signal): boolean =>
  item.verdict === '' ||
  (item.verdict === 'human-review' && item.verdictReason === 'unsure' && (item.dropConfidence === null || item.doConfidence === null))
export const awaitsCard = (item: Signal): boolean => item.verdict === 'plan' || item.verdict === 'plan-without-refine'
export const sortable = (item: Signal): boolean => awaitsJudging(item) || awaitsCard(item)

/** What the new card takes from Jev. `workflow` is empty for the board's default — Jev was
 *  unsure — and null when no workflow here can do the work. */
export interface Picks {
  modules: string[]
  priority: string
  roi: string
  workflow: string | null
}

export function picksOf(answers: Record<string, Answer | undefined>): Picks {
  const level = (answer?: Answer): string => (answer && LEVELS.includes(answer.choice) ? answer.choice : 'med')
  const module = answers.modules?.choice
  const flow = answers.workflow
  const sure = flow !== undefined && flow.confidence >= CONFIDENT
  return {
    modules: module && module in moduleCriteria() ? [module] : [],
    priority: level(answers.priority),
    roi: level(answers.roi),
    workflow: !sure ? '' : flow.choice === 'none' ? null : flow.choice in workflowCriteria() ? flow.choice : '',
  }
}

const ASK_MS = 60_000

/** Ask Cloud; answers, or throws why not. `pro-required` and `signed-out` end the whole sort. */
async function ask(body: Record<string, unknown>, sourceId: string): Promise<Record<string, Answer | undefined>> {
  const token = await accessToken()
  if (!token.ok) die('not signed in to AI4Kanban Cloud', { kind: 'signed-out' })
  let res: Response
  try {
    res = await fetch(`${cloudEndpoints().api}/v1/judge`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ASK_MS),
    })
  } catch {
    die(`couldn't judge ${sourceId}: Cloud could not be reached`, { kind: 'judge-failed' })
  }
  const answer = (await res.json().catch(() => ({}))) as {
    answers?: Record<string, Answer | undefined>
    error?: { code?: string; message?: string }
  }
  if (answer.error?.code === 'pro_required') {
    forgetPro()
    die('this account no longer has Pro', { kind: 'pro-required' })
  }
  if (!res.ok || !answer.answers) {
    die(`couldn't judge ${sourceId}: ${answer.error?.message ?? `Cloud answered ${res.status}`}`, { kind: 'judge-failed' })
  }
  return answer.answers
}

// The item's own words open the card. Text that would break the card's structure — a heading,
// a fence, a comment — goes in a fence longer than any it holds.
function cardBody(item: Signal): string {
  const text = item.summary.trim() || item.title.trim()
  const risky = /^\s*(#|`{3,}|~{3,}|<!--|---\s*$)/m.test(text)
  const fence = '`'.repeat(Math.max(3, ...(text.match(/`+/g) ?? []).map((run) => run.length + 1)))
  return [
    risky ? `${fence}\n${text}\n${fence}` : text,
    '',
    '## Worth noting',
    '',
    '<!-- agent -->',
    '',
    '## Scope',
    '',
    '## Todo',
    // The card format requires one checkbox; the scheduled refine replaces it.
    '- [ ] every task must have todos — replace this line with the real steps.',
    '',
    '## Decided by the agent',
    '',
    '### Overruled by the user',
    '',
  ].join('\n')
}

/** Write the item's card: its title, its file name, Jev's picks, and a refine scheduled. */
async function writeCard(item: Signal, picks: Picks): Promise<{ id: number; title: string }> {
  const title = item.title.trim() || item.sourceId
  const bodyFile = path.join(os.tmpdir(), `akb-triage-${process.pid}-${Date.now()}.md`)
  fs.writeFileSync(bodyFile, cardBody(item))
  try {
    const res = await quietlyAsync(() =>
      runBoardMove('create', [], {
        title,
        slug: path.basename(item.relPath, '.md'),
        modules: picks.modules,
        priority: picks.priority,
        roi: picks.roi,
        workflow: picks.workflow ?? '',
        triage: item.sourceId,
        schedule: 'refine',
        bodyFile,
        asked: [],
      }),
    )
    if (!res.ok) throw new BoardError(res.error)
    return { id: res.data.id as number, title }
  } finally {
    fs.rmSync(bodyFile, { force: true })
  }
}

/** Where one item ended. */
export type Sorted =
  | { kind: 'card'; id: number; title: string }
  | { kind: 'ignored'; reason: string }
  | { kind: 'held'; reason: string }

/** Judge one waiting item and land the answer. Throws when Cloud or the board refuses; the
 *  item is left waiting. */
export async function sortItem(item: Signal): Promise<Sorted> {
  const judged = awaitsCard(item)
  const questions = questionsFor(openCards(), judged)
  const answers = await ask({ state: judgementState(item, questions).state, questions }, item.sourceId)
  const record = (verdict: Verdict): void => {
    const recorded = recordVerdict(item.sourceId, verdict)
    if (!recorded.ok) die(recorded.error, { kind: 'triage-item-gone' })
  }
  const ignore = (verdict: Verdict): Sorted => {
    record(verdict)
    const reason = reasonWords(verdict)
    const moved = dismissInboxItem(item.sourceId, 'agent', reason)
    if (!moved.ok) die(moved.error, { kind: 'triage-item-gone' })
    return { kind: 'ignored', reason }
  }

  let sure = { confidence: 1, drop: item.dropConfidence, do: item.doConfidence }
  if (!judged) {
    if (!answers.verdict) die(`couldn't judge ${item.sourceId}: Cloud left the verdict unanswered`, { kind: 'judge-failed' })
    const verdict = verdictOf({ verdict: answers.verdict, duplicate: answers.duplicate })
    if (verdict.verdict === 'skip') return ignore(verdict)
    record(verdict)
    if (verdict.verdict === 'human-review') return { kind: 'held', reason: reasonWords(verdict) }
    sure = verdict
  }
  const picks = picksOf(answers)
  if (picks.workflow === null) return ignore({ verdict: 'skip', reason: 'no-workflow', card: null, confidence: sure.confidence, drop: sure.drop, do: sure.do })
  const card = await writeCard(item, picks)
  const filed = archiveInboxItem(item.sourceId, card.id)
  if (!filed.ok) die(filed.error, { kind: 'triage-item-gone' })
  return { kind: 'card', ...card }
}

/** What one sort did. */
export interface SortReport {
  cards: { id: number; title: string }[]
  ignored: { title: string; reason: string }[]
  held: { title: string; reason: string }[]
  failed: { title: string; why: string }[]
}

// Refusals no later item would get past.
const ENDS_SORT = new Set(['pro-required', 'signed-out'])

/** Sort the named items one at a time, in the order given. An item that fails stays waiting
 *  and the next one is judged; `stopped` is asked between items. */
export async function sortItems(sourceIds: string[], say: (line: string) => void, stopped: () => boolean = () => false): Promise<SortReport> {
  const report: SortReport = { cards: [], ignored: [], held: [], failed: [] }
  for (const sourceId of sourceIds) {
    if (stopped()) break
    // Read again each time: the user may have ignored or carded it while the sort went.
    const item = readInbox().find((one) => one.sourceId === sourceId)
    if (!item || !sortable(item)) continue
    try {
      const done = await sortItem(item)
      if (done.kind === 'card') {
        report.cards.push({ id: done.id, title: done.title })
        say(`#${done.id} ${done.title}`)
      } else {
        report[done.kind].push({ title: item.title, reason: done.reason })
        say(`${done.kind === 'ignored' ? 'ignored' : 'left for you'}: ${item.title} — ${done.reason}`)
      }
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e)
      report.failed.push({ title: item.title, why })
      say(`left waiting: ${item.title} — ${why}`)
      if (e instanceof BoardError && ENDS_SORT.has(e.kind)) break
    }
  }
  const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`
  const sorted = report.cards.length + report.ignored.length + report.held.length
  say(
    `sorted ${count(sorted, 'item', 'items')}: ${count(report.cards.length, 'card', 'cards')}, ${report.ignored.length} ignored, ` +
      `${report.held.length} left for you${report.failed.length ? `, ${report.failed.length} failed` : ''}`,
  )
  return report
}
