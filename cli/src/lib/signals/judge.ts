// Sorting triage with Jev (#1221, #1263), for Pro.
//
// One Cloud request per item, every question asking one thing (#1439): is it worth doing, does
// the product already do it, was it turned down, which card it duplicates, does it need the
// user, is it small — and the module, priority, ROI and workflow of the card it would become.
// A proposer's item was checked against the product, the board and what was turned down before
// it was written (#1511), so it is asked only whether it needs the user, its size and its card.
// Jev answers each alone; the order they are read in, and where each is cut, is `verdictOf`.
// The answers land here: a card written and the item archived, an ignore with its reason, or a
// hold for the user.

import fs from 'node:fs'
import path from 'node:path'

import os from 'node:os'

import { nodeOfFlow } from '../agent/stages'
import { builtinDescription, workflows } from '../agent/workflows'
import { runBoardMove } from '../board'
import { idPrefix, walkMd } from '../cards'
import { cloudEndpoints } from '../cloud/config'
import { forgetPro } from '../cloud/pro'
import { accessToken } from '../cloud/session'
import { BoardError, quietlyAsync } from '../io'
import { PLANNER, agentMemoryFile, onlyStarter, plannerCopies } from '../memory'
import { MODULES_MD, PROJECT_MD, REPO_ROOT, TODO, die, rel } from '../paths'
import { LEVELS } from '../validate'
import { unquote } from '../yaml'
import type { Signal, TriageReason, TriageVerdict } from '../view/types'
import { archiveInboxItem, dismissInboxItem, readInbox, recordVerdict } from './inbox'

/** Below this confidence a workflow pick falls back to the board's default. */
export const CONFIDENT = 0.6

// Where each answer is cut. Measured with `npm run eval:triage` on this repository's own board
// (#1439): on 229 sorted items these ignore and card no more of them wrongly than the single
// seven-option question did. Jev's answers move a few points between identical requests and
// barely tell a kept item from an ignored one, so measure again before moving a line.

/** An item is ignored at this much confidence the product already does it, it was turned down
 *  before, or an open card owns it. Strict: a wrong ignore is never seen. */
export const IGNORE_LINE = 0.9
/** An item is held for the user at this much confidence only they can settle it. */
export const NEEDS_USER_LINE = 0.5
/** An item is ignored at this much confidence it is not worth doing, and carded at this much
 *  that it is. */
export const DROP_LINE = 0.8
export const DO_LINE = 0.8
/** A card skips planning at this much confidence the item is small and fully specified. */
export const SMALL_LINE = 0.6

/** Jev reads 32K tokens; the state and questions are kept under this estimate of them. */
export const MAX_TOKENS = 30_000

// A conservative count: three UTF-8 bytes per token overcounts English and matches CJK.
export const tokensOf = (value: unknown): number => Math.ceil(Buffer.byteLength(JSON.stringify(value)) / 3)

// A yes/no question is a choice of two: Cloud forwards choice questions only. Both sides are
// described, so a near miss falls on the right one.
const yesNo = (instructions: string, yes: string, no: string) => ({ type: 'choice', instructions, criteria: { yes, no } }) as const

const WORTH = yesNo(
  "Is the work this `item` asks for worth doing for the product, as its description and the planner's `decisions` say?",
  'it fixes something users meet, or moves the product the way its description and the decisions point.',
  'it is worth too little: cosmetic or speculative, outside what the product is for, or about something the product no longer has.',
)

const SUPPORTED = yesNo(
  'Does the product already do what this `item` asks for?',
  'the product, as described, already behaves the way the item asks.',
  'the item asks for something the product does not do yet, or reports something still wrong.',
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

const SMALL = yesNo(
  'Is the work this `item` asks for small and fully specified by the item?',
  'a small change the item spells out, with no design choice left.',
  'it needs planning first: several parts, or a design choice the item leaves open.',
)

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

/** Which questions an item is asked: all of them, a proposer's, or only its card's. */
export type Asks = 'all' | 'proposer' | 'card'

/** Whether a reflection run wrote the item. */
export const fromProposer = (item: Signal): boolean => !!item.agent && item.agent === nodeOfFlow('reflect')?.agent

/** What Jev is asked of one item. A question with fewer than two options is left out — Cloud
 *  refuses it. */
export function questionsFor(cards: OpenCard[], asks: Asks = 'all'): Record<string, unknown> {
  const modules = moduleCriteria()
  return {
    ...(asks === 'card'
      ? {}
      : asks === 'proposer'
        ? { needsUser: NEEDS_USER, small: SMALL }
        : {
            worth: WORTH,
            supported: SUPPORTED,
            rejected: REJECTED,
            duplicate: {
              type: 'choice',
              instructions: DUPLICATE_ASKS,
              criteria: {
                ...Object.fromEntries(cards.map((card) => [`#${card.id}`, card.title])),
                none: 'no open card owns this work.',
              },
            },
            needsUser: NEEDS_USER,
            small: SMALL,
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
 *  never is. Open cards reach Jev as the duplicate question's options, by id and title. A
 *  proposer's item is not asked whether it was turned down, so gets no `rejected.md`. */
export function judgementState(item: Signal, questions: Record<string, unknown>): Judgement {
  const product = read(PROJECT_MD)
  const readme = onlyStarter('project.md', product) ? read(path.join(REPO_ROOT, 'README.md')) : ''
  const memory: Kept[] = (fromProposer(item) ? [] : plannerCopies('rejected.md'))
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

/** How likely the answer to a yes/no question is yes. The pick and its confidence stand in when
 *  no probabilities came. */
const yes = (answer?: Answer): number => {
  if (!answer) return 0
  const given = answer.probabilities?.yes
  if (Number.isFinite(given)) return hundredths(given!)
  return hundredths(answer.choice === 'yes' ? answer.confidence : 1 - answer.confidence)
}

/** How likely some open card owns the work, and the card Jev picked. */
function duplicateOf(answer?: Answer): { odds: number; card: number | null } {
  if (!answer) return { odds: 0, card: null }
  const card = Number(answer.choice.match(/^#(\d+)$/)?.[1] ?? NaN)
  if (!Number.isInteger(card)) return { odds: 0, card: null }
  const none = answer.probabilities?.none
  return { odds: hundredths(Number.isFinite(none) ? 1 - none! : answer.confidence), card }
}

/** The four ends, read off the answers in a fixed order: the three facts that make an item not
 *  worth a card, then whether the user is needed, then its worth. A proposer's item is never
 *  ignored here: it is held when it needs the user, and carded otherwise. */
export function verdictOf(answers: Record<string, Answer | undefined>, asks: Asks = 'all'): Verdict {
  if (asks === 'proposer') {
    const needsUser = yes(answers.needsUser)
    const small = yes(answers.small)
    const base = { card: null, drop: null, do: null }
    if (needsUser >= NEEDS_USER_LINE) return { ...base, confidence: needsUser, verdict: 'human-review', reason: 'needs-user' }
    return small >= SMALL_LINE
      ? { ...base, confidence: small, verdict: 'plan-without-refine', reason: 'small' }
      : { ...base, confidence: hundredths(1 - small), verdict: 'plan', reason: 'plan' }
  }
  const worth = yes(answers.worth)
  const duplicate = duplicateOf(answers.duplicate)
  const facts: [TriageReason, number][] = [
    ['supported', yes(answers.supported)],
    ['rejected', yes(answers.rejected)],
    ['duplicate', duplicate.odds],
  ]
  const [fact, odds] = facts.reduce((top, one) => (one[1] > top[1] ? one : top))
  const base = { card: null, drop: Math.max(odds, hundredths(1 - worth)), do: worth }

  if (odds >= IGNORE_LINE) return { ...base, card: fact === 'duplicate' ? duplicate.card : null, confidence: odds, verdict: 'skip', reason: fact }
  const needsUser = yes(answers.needsUser)
  if (needsUser >= NEEDS_USER_LINE) return { ...base, confidence: needsUser, verdict: 'human-review', reason: 'needs-user' }
  if (hundredths(1 - worth) >= DROP_LINE) return { ...base, confidence: hundredths(1 - worth), verdict: 'skip', reason: 'low-value' }
  if (worth >= DO_LINE) {
    return yes(answers.small) >= SMALL_LINE
      ? { ...base, confidence: worth, verdict: 'plan-without-refine', reason: 'small' }
      : { ...base, confidence: worth, verdict: 'plan', reason: 'plan' }
  }
  return { ...base, confidence: Math.max(base.drop, base.do), verdict: 'human-review', reason: 'unsure' }
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
export const asksOf = (item: Signal): Asks => (awaitsCard(item) ? 'card' : fromProposer(item) ? 'proposer' : 'all')

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
export async function ask(body: Record<string, unknown>, sourceId: string): Promise<Record<string, Answer | undefined>> {
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
  const asks = asksOf(item)
  const questions = questionsFor(asks === 'all' ? openCards() : [], asks)
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
  if (asks !== 'card') {
    if (!answers[asks === 'proposer' ? 'needsUser' : 'worth']) die(`couldn't judge ${item.sourceId}: Cloud left the verdict unanswered`, { kind: 'judge-failed' })
    const verdict = verdictOf(answers, asks)
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
