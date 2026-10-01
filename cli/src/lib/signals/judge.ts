// Judging one triage item with Jev (#1221), for Pro.
//
// The sort's session names the item and any open card it suspects; this reads the files,
// asks Cloud two choice questions, records the verdict on the item and prints the one command
// that lands it. It never creates a card or ignores an item — the session does, through the
// same commands a non-Pro sort uses.

import fs from 'node:fs'
import path from 'node:path'

import { idPrefix, walkMd } from '../cards'
import { cloudEndpoints } from '../cloud/config'
import { forgetPro } from '../cloud/pro'
import { accessToken } from '../cloud/session'
import { PLANNER, agentMemoryDir, agentMemoryFile, onlyStarter } from '../memory'
import { BOARD_FLAG, KANBAN, PRODUCT, REPO_ROOT, TODO, die, rel } from '../paths'
import { unquote } from '../yaml'
import type { Signal, TriageReason, TriageVerdict } from '../view/types'
import { readInbox, recordVerdict } from './inbox'

/** Below this verdict confidence the item is held for the user, whatever was picked. */
export const CONFIDENT = 0.6

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

const DUPLICATE_ASKS = 'Which open card already owns the work this item asks for? Pick none when no card does.'

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

export function questionsFor(cards: OpenCard[]): Record<string, unknown> {
  return {
    verdict: VERDICT,
    duplicate: {
      type: 'choice',
      instructions: DUPLICATE_ASKS,
      criteria: {
        ...Object.fromEntries(cards.map((card) => [`#${card.id}`, card.title])),
        none: 'no open card owns this work.',
      },
    },
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

/** The files Jev is given alongside the item: fixed by the board, plus the cards the session
 *  named. Cut to fit in the order the card lays down; the item itself never is. */
export function judgementState(item: Signal, named: string[], questions: Record<string, unknown>): Judgement {
  const product = read(PRODUCT)
  const readme = onlyStarter('product.md', product) ? read(path.join(REPO_ROOT, 'README.md')) : ''
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
  const cards = named.map((file) => {
    const text = read(file)
    const id = idPrefix(path.basename(file)) ?? idPrefix(path.basename(path.dirname(file)))
    const title = unquote(text.match(/^title:\s*(.*)$/m)?.[1]?.trim() ?? path.basename(file))
    return { card: id === null ? boardRel(file) : `#${id} ${title}`, text }
  })
  let readmeText = readme

  const build = (): Record<string, unknown> => {
    const state: Record<string, unknown> = { item: read(path.join(REPO_ROOT, item.relPath)) || itemText(item) }
    if (readmeText) state.readme = readmeText
    else if (product.trim()) state.product = product
    const decisions = read(agentMemoryFile(PLANNER, 'decisions.md'))
    if (decisions.trim()) state.decisions = decisions
    for (const kept of memory) state[boardRel(kept.file)] = kept.lines.join('\n')
    if (cards.length) state.cards = cards.map((card) => (card.text ? card : { card: card.card }))
    return state
  }
  const fits = (): boolean => tokensOf({ state: build(), questions }) <= MAX_TOKENS
  const trimmed: string[] = []

  for (const card of cards) {
    if (fits()) break
    card.text = ''
    trimmed.push(`${card.card} — its body`)
  }
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
}

/** The four ends, from what Jev picked. */
export function verdictOf(answers: { verdict: Answer; duplicate?: Answer }): Verdict {
  const pick = answers.verdict.choice as Option
  const confidence = answers.verdict.confidence
  const card = pick === 'duplicate' ? Number(answers.duplicate?.choice.match(/^#(\d+)$/)?.[1] ?? NaN) : NaN
  const base = { card: Number.isInteger(card) ? card : null, confidence }
  if (!(pick in VERDICT.criteria)) throw new Error(`Jev picked an option it was not offered: ${pick}`)
  if (confidence < CONFIDENT) return { ...base, card: null, verdict: 'human-review', reason: 'unsure' }
  if (pick === 'needs-user') return { ...base, verdict: 'human-review', reason: 'needs-user' }
  if (pick === 'small') return { ...base, verdict: 'plan-without-refine', reason: 'small' }
  if (pick === 'plan') return { ...base, verdict: 'plan', reason: 'plan' }
  return { ...base, card: pick === 'duplicate' ? base.card : null, verdict: 'skip', reason: pick }
}

/** The reason, in the words `triage dismiss` records and the log reads. */
export function reasonWords(v: Pick<Verdict, 'reason' | 'card'>): string {
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
    case 'unsure':
      return 'unsure'
    case 'small':
      return 'small and fully specified'
    case 'plan':
      return 'worth doing, needs planning'
  }
}

/** The command that lands a verdict — the one line the session acts on. */
export function nextStep(sourceId: string, v: Verdict, program = 'akb'): string {
  const self = `${program}${BOARD_FLAG}`
  const create = `${self} raw create --title ".." --slug <english-slug> --modules <modules> --priority <level> --roi <level> --triage ${sourceId}`
  const archive = `${self} triage archive ${sourceId} --card <id>`
  switch (v.verdict) {
    case 'skip':
      return `${self} triage dismiss ${sourceId} --reason "${reasonWords(v)}"`
    case 'human-review':
      return 'leave it waiting — the user decides'
    case 'plan':
      return `${create} --schedule refine --body-file <path>, then ${archive}`
    case 'plan-without-refine':
      return `${create} --body-file <path> — no refine, the body ready to build; then ${self} raw update <id> --status ready, then ${archive}`
  }
}

/** Items the sort still has to deal with: never judged, or judged worth a card not yet written.
 *  Held and restored items are the user's. */
export const awaitsJudging = (item: Signal): boolean => item.verdict === ''
export const awaitsCard = (item: Signal): boolean => item.verdict === 'plan' || item.verdict === 'plan-without-refine'
export const sortable = (item: Signal): boolean => awaitsJudging(item) || awaitsCard(item)

/** The `--files` a session passed, as absolute paths inside the board. */
export function namedFiles(files: string[]): string[] {
  const board = path.resolve(KANBAN)
  return files
    .flatMap((said) => said.split(','))
    .map((said) => said.trim())
    .filter(Boolean)
    .map((said) => {
      const file = path.resolve(REPO_ROOT, said)
      const inside = path.relative(board, file)
      if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) {
        die(`--files ${said}: only files under ${boardRel(KANBAN)}/ can be passed`, { kind: 'bad-args' })
      }
      if (!fs.existsSync(file)) die(`--files ${said}: no such file`, { kind: 'bad-args' })
      return file
    })
}

const ASK_MS = 60_000

/** Ask Cloud; answers or dies with what the session should do instead. */
async function ask(body: Record<string, unknown>, sourceId: string): Promise<{ verdict: Answer; duplicate?: Answer }> {
  const skip = `leave ${sourceId} waiting and go on to the next item`
  const token = await accessToken()
  if (!token.ok) die(`couldn't judge ${sourceId}: not signed in to AI4Kanban Cloud — ${skip}`, { kind: 'judge-failed' })
  let res: Response
  try {
    res = await fetch(`${cloudEndpoints().api}/v1/judge`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ASK_MS),
    })
  } catch {
    die(`couldn't judge ${sourceId}: Cloud could not be reached — ${skip}`, { kind: 'judge-failed' })
  }
  const answer = (await res.json().catch(() => ({}))) as {
    answers?: { verdict?: Answer; duplicate?: Answer }
    error?: { code?: string; message?: string }
  }
  if (answer.error?.code === 'pro_required') {
    forgetPro()
    die(
      'pro_required: this account no longer has Pro. Stop judging: card the items already judged worth a card, and leave the rest waiting.',
      { kind: 'pro-required' },
    )
  }
  if (!res.ok || !answer.answers?.verdict) {
    die(`couldn't judge ${sourceId}: ${answer.error?.message ?? `Cloud answered ${res.status}`} — ${skip}`, { kind: 'judge-failed' })
  }
  return answer.answers as { verdict: Answer; duplicate?: Answer }
}

/** `akb triage judge <source-id> [--files <paths>]`. */
export async function judgeItem(sourceId: string, files: string[], program = 'akb'): Promise<{ item: Signal; verdict: Verdict; next: string; trimmed: string[] }> {
  const item = readInbox().find((one) => one.sourceId === sourceId)
  if (!item) die(`nothing waiting in triage is ${sourceId}`, { kind: 'triage-item-gone' })
  if (item.verdict) {
    die(`${sourceId} was already judged: ${item.verdict} — an item is judged once`, { kind: 'triage-already-judged' })
  }
  const named = namedFiles(files)
  const questions = questionsFor(openCards())
  const { state, trimmed } = judgementState(item, named, questions)
  const verdict = verdictOf(await ask({ state, questions }, sourceId))
  const recorded = recordVerdict(sourceId, verdict)
  if (!recorded.ok) die(recorded.error, { kind: 'triage-item-gone' })
  return { item, verdict, next: nextStep(sourceId, verdict, program), trimmed }
}
