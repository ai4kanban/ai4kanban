import { executionOf, type CloudExecution } from '../cloud/execution'
import fs from 'node:fs'
import path from 'node:path'

import { locate, locateArchived } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { DELIVERIES, REPO_ROOT, rel } from '../paths'
import { candidateBase } from './candidate'
import { boardCommand } from './command'
import { newDeliveryId, type DeliveryStart } from './commit-mode'
import { insideRun } from './env'
import { DELIVERY_FLOWS } from './flows'
import { deliveryState, type DeliveryState } from './pause'
import { deliveryRules, readRule } from './rules'
import { openOf } from '../view/rules'
import { cardWorkflowId, frozenWorkflow } from './workflows'
import { logPathOf, readDeliveryRow, readStore, runIsLive, withStore, type Store } from './store'
import {
  refusal,
  type AgentRequest,
  type DeliveryCarryOn,
  type DeliveryRecord,
  type DeliveryStatus,
  type DirectBuild,
  type RunRecord,
  type RunRefusal,
} from './types'
import { worktreeExists } from './worktree'
import { withBoardLock } from '../lock'

// ---- the permanent record ---------------------------------------------------

const auditPath = (deliveryId: string): string => path.join(DELIVERIES, `${deliveryId}.json`)

/** One run, as the permanent record keeps it: what ran, how it went, and where its log
 *  was — the path, never the contents. A log is this machine's and ages out; the record is
 *  the repository's and does not. */
interface DeliverySessionEntry {
  sessionId: string
  action: string
  status: string
  startedAt: number
  endedAt?: number
  harness?: string
  model?: string
  costUsd?: number
  resumedFrom?: string
  /** On a review after the first: why it started (#417). Kept here so the reason outlives
   *  the live record's window, which forgets a run long before the delivery is history. */
  trigger?: string
  log: string
}

/** Write the delivery's permanent record, or bring it up to date. Best-effort: a delivery
 *  that couldn't write its file is still a delivery, and failing the run that owns it
 *  would cost the user their work over an audit line. */
export function writeAudit(delivery: DeliveryRecord, runs: RunRecord[]): void {
  // What this file already said about each run. The live record keeps only the newest
  // 30, so a long delivery's first run leaves it long before the delivery ends — and
  // the permanent record is exactly the thing that must not forget it.
  const known = new Map(readAudit(delivery.deliveryId)?.sessions.map((s) => [s.sessionId, s]) ?? [])
  const sessions: DeliverySessionEntry[] = delivery.sessions.flatMap((id) => {
    const run = runs.find((r) => r.sessionId === id)
    if (!run) {
      const before = known.get(id)
      return before ? [before] : []
    }
    return [
      {
        sessionId: run.sessionId,
        action: run.action,
        status: run.status,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        harness: run.harness || undefined,
        model: run.model,
        costUsd: run.costUsd,
        resumedFrom: run.resumedFrom,
        log: rel(run.logPath),
      },
    ]
  })
  // an unwritable folder is not worth failing over — the live row is still the truth for the lock
  writeAuditFile({ ...delivery, sessions })
}

/** The permanent record as it sits on disk: the delivery, with each of its sessions spelled
 *  out rather than named. */
type DeliveryAudit = Omit<DeliveryRecord, 'sessions'> & { sessions: DeliverySessionEntry[] }

// Write one whole and move it into place, so no reader ever sees half of it.
function writeAuditFile(record: DeliveryAudit): boolean {
  try {
    fs.mkdirSync(DELIVERIES, { recursive: true })
    const tmp = `${auditPath(record.deliveryId)}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(record, null, 2) + '\n')
    fs.renameSync(tmp, auditPath(record.deliveryId))
    return true
  } catch {
    return false
  }
}

/** The permanent record as it stands, or null when there is none to read. */
function readAudit(deliveryId: string): { sessions: DeliverySessionEntry[] } | null {
  try {
    const data = JSON.parse(fs.readFileSync(auditPath(deliveryId), 'utf8')) as { sessions?: unknown }
    return { sessions: Array.isArray(data?.sessions) ? (data.sessions as DeliverySessionEntry[]) : [] }
  } catch {
    return null
  }
}

export function syncAudit(deliveryId: string, just?: RunRecord): void {
  const store = readStore()
  const delivery = store.deliveries.find((d) => d.deliveryId === deliveryId)
  if (!delivery) return
  const runs = just ? [just, ...store.runs.filter((r) => r.sessionId !== just.sessionId)] : store.runs
  writeAudit(delivery, runs)
}

// ---- the deliveries this board lost track of --------------------------------

/** One delivery's permanent record, when the file holds a whole one. Null for anything
 *  else — half-written, or not a record at all. */
function wholeAudit(file: string): DeliveryAudit | null {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8')) as DeliveryAudit
    return typeof data?.deliveryId === 'string' && Array.isArray(data.sessions) ? data : null
  } catch {
    return null
  }
}

/** The same, only when it still says `active` — a delivery that has already ended is not
 *  the orphan scan's to judge. */
function activeAudit(file: string): DeliveryAudit | null {
  const audit = wholeAudit(file)
  return audit?.status === 'active' ? audit : null
}

/** Every permanent record on disk, read from the files themselves: the live record is
 *  exactly the thing that may have lost them. */
function allAudits(): DeliveryAudit[] {
  let names: string[]
  try {
    names = fs.readdirSync(DELIVERIES)
  } catch {
    return []
  }
  const out: DeliveryAudit[] = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    const audit = wholeAudit(path.join(DELIVERIES, name))
    if (audit) out.push(audit)
  }
  return out
}

/** One landing that left a commit on the target branch. */
export interface LandedDelivery {
  cardId: number
  title: string
  /** The workflow the delivery ran on; a record that names none ran on the default. */
  workflow: string
  at: number
  commit: string
}

/** Every landing with a commit, oldest first — optionally only those after `since` (ms) or on
 *  one workflow. Read from the permanent records, which outlive the archived card file. */
export function landedDeliveries(filter: { since?: number; workflow?: string } = {}): LandedDelivery[] {
  const out: LandedDelivery[] = []
  for (const audit of allAudits()) {
    const landing = audit.landing
    if (typeof audit.cardId !== 'number' || landing?.status !== 'landed' || !landing.commit) continue
    // A delivery frozen before workflows were recorded was a Coding one.
    const workflow = audit.workflow?.id || 'coding'
    if (filter.since !== undefined && !(landing.at > filter.since)) continue
    if (filter.workflow !== undefined && workflow !== filter.workflow) continue
    out.push({ cardId: audit.cardId, title: audit.title, workflow, at: landing.at, commit: landing.commit })
  }
  return out.sort((a, b) => a.at - b.at)
}

/** Every delivery the permanent record still calls `active`. */
const activeAudits = (): DeliveryAudit[] => allAudits().filter((a) => a.status === 'active')

/** A permanent record as a live row, read through the record's own reader so nothing can
 *  tell it apart from a row the record wrote itself. */
const auditRow = (audit: DeliveryAudit): DeliveryRecord | null =>
  readDeliveryRow({ ...audit, sessions: audit.sessions.map((s) => s.sessionId) })

const lastSessionRunning = (audit: DeliveryAudit): boolean =>
  audit.sessions[audit.sessions.length - 1]?.status === 'running'

/** What one scan of the permanent records did: the deliveries a lost row ended, and the
 *  ones it put back. */
export interface OrphanScan {
  /** Failed, and their cards are the caller's to hand back. */
  failed: DeliveryRecord[]
  /** Back in the live record as ordinary `active` deliveries, still holding their cards. */
  recovered: DeliveryRecord[]
}

const localAudit = (audit: DeliveryAudit): boolean => worktreeExists(audit.worktree) ||
  audit.sessions.some((session) => path.resolve(REPO_ROOT, session.log) === logPathOf(session.sessionId) &&
    fs.existsSync(logPathOf(session.sessionId)))

export function settleOrphanedDeliveries(): OrphanScan {
  const audits = activeAudits()
  if (!audits.length) return { failed: [], recovered: [] }
  const losing: DeliveryAudit[] = []
  const recovered: DeliveryRecord[] = []
  withStore((store) => {
    const known = new Set<string>(store.deliveries.map((d) => d.deliveryId))
    for (const run of store.runs) if (run.deliveryId) known.add(run.deliveryId)
    for (const audit of audits) {
      if (known.has(audit.deliveryId) || !localAudit(audit)) continue
      if (lastSessionRunning(audit)) {
        losing.push(audit)
        continue
      }
      const fresh = activeAudit(auditPath(audit.deliveryId))
      if (!fresh || lastSessionRunning(fresh) || !localAudit(fresh)) continue
      const row = recoveredRow(fresh)
      if (!row || !cardTakesItBack(store, row)) continue
      store.deliveries.push(row)
      recovered.push(row)
    }
  })
  return { failed: losing.flatMap(failAudit), recovered }
}

/** The permanent record as a live row, read through the record's own reader so a recovered
 *  delivery is a row nothing can tell apart from one the record wrote itself. Null when
 *  there is no whole row in it. */
function recoveredRow(audit: DeliveryAudit): DeliveryRecord | null {
  const row = auditRow(audit)
  if (!row || row.status !== 'active') return null
  return row
}

function cardTakesItBack(store: Store, row: DeliveryRecord): boolean {
  if (row.cardId === null) return true
  return !!locate(row.cardId) && !activeIn(store, row.cardId)
}

/** Fail one orphaned delivery's permanent record, and hand it back so its card can be
 *  released. Empty when the file would not write — the ending nobody could record is one
 *  the next scan tries again. */
function failAudit(audit: DeliveryAudit): DeliveryRecord[] {
  // We only know it ended by the time we noticed, so these stamps are an upper bound —
  // the same bound `reap` puts on a run whose watcher died.
  const endedAt = Date.now()
  const record: DeliveryAudit = {
    ...audit,
    status: 'failed',
    endedAt,
    sessions: audit.sessions.map((s) =>
      s.status === 'running' ? { ...s, status: 'interrupted', endedAt: s.endedAt ?? endedAt } : s,
    ),
  }
  if (!writeAuditFile(record)) return []
  return [{ ...record, sessions: record.sessions.map((s) => s.sessionId) }]
}

// ---- carrying an ended delivery on (#639) -----------------------------------

export function endedDelivery(id: string): DeliveryRecord | undefined {
  const key = id.trim()
  if (!key) return undefined
  const rows = new Map<string, DeliveryRecord>()
  for (const row of readStore().deliveries) rows.set(row.deliveryId, row)
  for (const audit of allAudits()) {
    const row = auditRow(audit)
    if (row) rows.set(row.deliveryId, row)
  }
  const all = [...rows.values()].sort((a, b) => a.startedAt - b.startedAt)
  if (/^#?\d+$/.test(key)) {
    const cardId = Number(key.replace('#', ''))
    const mine = all.filter((d) => d.cardId === cardId)
    // Its newest one either way, so a card whose every delivery is still in flight is
    // refused by `resumeRefusal` — which names the delivery and what is wrong with it —
    // rather than read as a card with no delivery at all.
    return mine.filter((d) => d.status !== 'active').pop() ?? mine.pop()
  }
  return all.find((d) => d.deliveryId === key) ?? all.find((d) => d.deliveryId.startsWith(key))
}

export function resumeRefusal(delivery: DeliveryRecord, store?: Store): RunRefusal | undefined {
  const id = delivery.deliveryId
  const what = delivery.cardId === null ? 'the build' : `#${delivery.cardId}`
  const task = delivery.cardId === null ? '' : String(delivery.cardId)
  if (delivery.status === 'active') {
    return refusal('deliveryActive', `delivery ${id} has not ended — it is still in flight on ${what}.`, { id, task })
  }
  if (delivery.status === 'finished') {
    return refusal('deliveryFinished', `delivery ${id} finished; resume carries on one that ended abnormally.`, { id })
  }
  if (delivery.status === 'cancelled') {
    return refusal('deliveryCancelled', `delivery ${id} was cancelled, and its files were preserved. Start ${what} again.`, { id, task })
  }
  // A **Start now** delivery holds no card (#428), so there is nothing here to check.
  if (delivery.cardId === null) return undefined
  const card = String(delivery.cardId)
  const pendingArchive = delivery.completions?.some((c) => !c.finished && c.step + 1 >= (delivery.workflow?.land?.length ?? 1))
  if (cardOnBoard(delivery.cardId) === false && !(pendingArchive && locateArchived(delivery.cardId))) {
    return refusal(
      'deliveryCardGone',
      `#${card} is no longer on the board, so delivery ${id} has nothing left to finish.`,
      { id, card },
    )
  }
  const live = store ?? readStore()
  const holder = activeIn(live, delivery.cardId)
  if (holder) {
    const command = `${boardCommand()} delivery cancel ${holder.deliveryId}`
    return refusal(
      'deliveryHeld',
      `delivery ${holder.deliveryId} is building #${card} now — end that one first with \`${command}\`.`,
      { other: holder.deliveryId, card, command },
    )
  }
  // And a delivery that opened on this card after this one ended has taken the job over,
  // even though it has ended too: the newer one is what a reader means by "the delivery
  // that stopped on this card", and two checkouts for one card is what #720 set out to end.
  const after =
    delivery.endedAt === undefined
      ? undefined
      : live.deliveries.find(
          (d) => d.cardId === delivery.cardId && d.deliveryId !== id && d.startedAt >= delivery.endedAt!,
        )
  if (after) {
    return refusal(
      'deliveryTakenOver',
      `delivery ${after.deliveryId} took #${card} over after this one ended, so there is nothing left to carry on.`,
      { other: after.deliveryId, card },
    )
  }
  return undefined
}

/** The refusal for a delivery id that names none. */
export const unknownDelivery = (id: string): RunRefusal =>
  refusal('deliveryNotFound', `no delivery here answers to "${id}"`, { id })

/** Is this card still on the board? `undefined` when the board could not be read — a
 *  folder that would not open is not a card somebody removed, and reading it as one would
 *  delete the checkout of every delivery on the board (#720). */
function cardOnBoard(cardId: number): boolean | undefined {
  try {
    return !!locate(cardId)
  } catch {
    return undefined
  }
}

/** Whether the card page may offer this ended delivery a **Resume** (#639) — and whether
 *  the board keeps its checkout at all (#720). */
export const isResumable = (delivery: DeliveryRecord): boolean => !resumeRefusal(delivery)

/** Preserve delivery progress. Continuing an active delivery requires a verified Cloud
 *  execution; a running agent keeps ownership. */
export function resumeRecord(id: string, execution?: CloudExecution): { ok: true; delivery: DeliveryRecord } | ({ ok: false } & RunRefusal) {
  const found = namedDelivery(id) ?? endedDelivery(id)
  if (!found) return { ok: false, ...unknownDelivery(id) }
  const refused = resumeRefusal(found)
  if (refused && found.status !== 'active') return { ok: false, ...refused }
  const out = withStore<{ ok: true; delivery: DeliveryRecord } | ({ ok: false } & RunRefusal)>((store) => {
    const audit = wholeAudit(auditPath(found.deliveryId))
    const live = store.deliveries.find((d) => d.deliveryId === found.deliveryId)
    const row = live?.status === 'active' ? live : (audit && auditRow(audit)) ?? live
    if (!row) return { ok: false, ...unknownDelivery(id) }
    const again = resumeRefusal(row, store)
    if (row.status === 'active') {
      if (store.runs.some((r) => r.deliveryId === row.deliveryId && runIsLive(r))) {
        return { ok: false, ...refusal('deliveryRunGoing', 'the delivery still has a running agent; stop it before continuing') }
      }
    } else if (again) return { ok: false, ...again }
    const at = Date.now()
    const resumed: DeliveryRecord = {
      ...row,
      cloudExecution: execution ?? executionOf() ?? row.cloudExecution,
      status: 'active',
      endedAt: undefined,
      steps: [...row.steps, { step: 'resume', at }],
      // The process that was walking it through the queue died with the delivery, so the
      // slot it claimed is nobody's — the same rule a recovered delivery follows (#638).
      landing: row.landing,
    }
    const seat = store.deliveries.findIndex((d) => d.deliveryId === row.deliveryId)
    if (seat >= 0) store.deliveries[seat] = resumed
    else store.deliveries.push(resumed)
    writeAudit(resumed, store.runs)
    return { ok: true, delivery: resumed }
  })
  return out
}

export function carryOnFrom(_deliveryId: string): DeliveryCarryOn {
  return 'build'
}

// ---- the approved requirements ----------------------------------------------

// What a delivery is approved to build. Everything else on the card — `## Todo` and its
// ticks, status, questions, the notes a delivery leaves as it works — sits
// outside, so a delivery writing to its own card is never a change to its requirements.
const APPROVED = [
  /^##\s+Worth noting\s*$/i,
  /^##\s+Scope\s*$/i,
  /^##\s+Scope out\s*$/i,
  // `skill` is the word a spec section carries now; `agent` is the word it carried before
  // #403, and a card written by an older release still has to travel whole.
  /^##\s+By\s+`[^`]+`\s+(skill|agent)\s*$/i,
]

const isApproved = (heading: string): boolean => APPROVED.some((re) => re.test(heading))

export function approvedRequirements(cardId: number): string {
  const found = locate(cardId)
  if (!found) return ''
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  let text: string
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
  const { meta, body } = parseFrontmatter(text)
  const out: string[] = []
  if (meta?.title) out.push(`# ${meta.title}`, '')
  // The opening paragraph is everything before the first heading. The `<!-- agent -->`
  // boundary is a marker, not content, so it never travels.
  const opening: string[] = []
  const sections: string[] = []
  let keeping = false
  let started = false
  for (const line of body.split('\n')) {
    if (/^##(?!#)\s/.test(line)) {
      started = true
      keeping = isApproved(line)
      if (keeping) sections.push('', line)
      continue
    }
    if (line.trim() === '<!-- agent -->') continue
    if (!started) opening.push(line)
    else if (keeping) sections.push(line)
  }
  out.push(opening.join('\n').trim())
  out.push(sections.join('\n').trim())
  // A dropped section leaves the blank lines that framed it, so the copy is squeezed back
  // to one blank line between blocks — it is read by a person as well as by an agent.
  return out.filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

// The card's frontmatter as it stands, or nothing when there is no reading it.
function cardMeta(cardId: number): ReturnType<typeof parseFrontmatter>['meta'] | null {
  try {
    const found = locate(cardId)
    if (!found) return null
    const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
    return parseFrontmatter(fs.readFileSync(file, 'utf8')).meta
  } catch {
    return null
  }
}

/** The card's stage as it stands, or `todo` when there is no reading it. */
export const cardStatus = (cardId: number): string => cardMeta(cardId)?.status || 'todo'

/** How many questions this card still has open — the count landing holds on (#307), and the
 *  one the Implement dialog and `akb card implement` warn about. A card nobody can read has
 *  none: a missing card holds nothing up. */
export const openQuestions = (cardId: number): number => openOf(cardMeta(cardId)?.questions ?? []).length

// ---- the live row -------------------------------------------------------------

/** The delivery in flight on this card, or nothing when the card is free. */
export const activeIn = (store: Store, cardId: number): DeliveryRecord | undefined =>
  store.deliveries.find((d) => d.status === 'active' && d.cardId === cardId)

/** The delivery in flight on this card right now. */
export function activeDelivery(cardId: number): DeliveryRecord | undefined {
  return activeIn(readStore(), cardId)
}

/** One delivery by id, or by any prefix of one that names exactly one. */
export function findDelivery(id: string): DeliveryRecord | undefined {
  const key = id.trim()
  if (!key) return undefined
  const all = readStore().deliveries
  return all.find((d) => d.deliveryId === key) ?? all.find((d) => d.deliveryId.startsWith(key))
}

/** A delivery named by its own id, by any prefix of one, or by the card it is building —
 *  the one way `cancel`, `discard` and `approve` read what the user typed, so they can never
 *  disagree about which delivery was meant. */
export function namedDelivery(id: string): DeliveryRecord | undefined {
  const key = id.trim()
  if (!key) return undefined
  const byCard = /^#?\d+$/.test(key) ? activeDelivery(Number(key.replace('#', ''))) : undefined
  return byCard ?? findDelivery(key) ?? endedDelivery(key)
}

/** Every delivery the live record holds, oldest first. */
export const listDeliveries = (): DeliveryRecord[] => readStore().deliveries

/** The delivery one run belongs to: the one it names outright — the only way a build with
 *  no card can be found (#428) — or the one in flight on its card. Nothing on a run that is
 *  not a delivery's own. */
export const withWorkflow = (req: AgentRequest): AgentRequest =>
  req.workflow
    ? req
    : {
        ...req,
        workflow:
          deliveryFor(req)?.workflow?.id ??
          (typeof req.id === 'number' ? cardWorkflowId(req.id) || undefined : undefined),
      }

export function deliveryFor(req: Pick<AgentRequest, 'action' | 'id' | 'deliveryId'>): DeliveryRecord | undefined {
  if (!DELIVERY_FLOWS.has(req.action)) return undefined
  // In flight, either way: a delivery that has ended is not one to build, review or resolve
  // a conflict against, however it was named.
  if (req.deliveryId) {
    const found = findDelivery(req.deliveryId)
    return found?.status === 'active' ? found : undefined
  }
  return req.id === undefined ? undefined : activeDelivery(req.id)
}

export function joinDelivery(
  store: Store,
  run: RunRecord,
  title: string,
  step: string,
  start?: DeliveryStart,
  direct?: DirectBuild,
): DeliveryRecord {
  const cardId = run.cardId
  // A build with no card joins nothing (#428): there is no card to look one up by, and two
  // Start now sends are two builds — each opens a delivery of its own.
  let delivery = run.deliveryId
    ? store.deliveries.find((d) => d.deliveryId === run.deliveryId && d.status === 'active')
    : cardId === null ? undefined : activeIn(store, cardId)
  if (!delivery) {
    delivery = {
      deliveryId: start?.deliveryId ?? newDeliveryId(store.deliveries),
      cardId,
      title,
      status: 'active',
      startedAt: run.startedAt,
      sessions: [],
      // The one read of the card this delivery will ever make for its requirements — or,
      // with no card, the sentence or the plan's words it was handed, which can never move
      // under it.
      cloudExecution: executionOf(),
      approved: cardId === null ? direct?.approved ?? '' : approvedRequirements(cardId),
      // …and, where that was a plan, the file it was read from (#481) — the one way back to
      // it once the panel has let the plan go.
      plan: cardId === null ? direct?.plan : undefined,
      initialQuestions: cardId === null ? 0 : openQuestions(cardId),
      steps: [],
      // And the one read of where the code stood before it started. Everything the
      // delivery writes is the difference from here.
      base: start ? start.base : (candidateBase() ?? undefined),
      // The stage to put back when the whole delivery ends. Read here, from the first
      // run, because every run after this one would read `implementing` — the
      // stage this delivery itself put there. There is no stage to hold with no card.
      priorStatus: cardId === null ? undefined : cardStatus(cardId),
      planned: start?.planned,
      rules: {
        ...deliveryRules(cardId === null ? direct?.scheduled?.workflow : cardWorkflowId(cardId)),
        ...(direct?.scheduled && readRule(direct.scheduled.agent) ? { [direct.scheduled.agent]: readRule(direct.scheduled.agent) } : {}),
      },
      // And the one read of the workflow it builds under (#715) — its name and all three
      // stages' assignments, frozen the way the rules are. Reassigning a stage, renaming the
      // workflow or deleting it changes the next delivery and never this one.
      workflow: frozenWorkflow(cardId === null ? direct?.scheduled?.workflow ?? '' : cardWorkflowId(cardId)),
      scheduled: direct?.scheduled,
      targetBranch: start?.targetBranch,

    }
    store.deliveries.push(delivery)
  } else if (step === 'implement' && delivery.review?.stopped) {
    // Building again is how a stopped delivery carries on (#1203): the build looks at what
    // stopped it, and its close decides again.
    delivery.review.stopped = undefined
  }
  delivery.sessions.push(run.sessionId)
  delivery.steps.push({ step, at: run.startedAt })
  joinFlow(run, delivery)
  // The permanent record exists from the delivery's first moment, not from its first
  // ending: a delivery whose machine died in its first minute still left one behind.
  writeAudit(delivery, store.runs)
  return delivery
}

export function adoptDirectCard(sessionId: string, cardId: number): boolean {
  return withStore((store) => {
    const run = store.runs.find((r) => r.sessionId === sessionId && r.status === 'running')
    if (!run || run.action !== 'implement' || run.cardId !== null) return false
    const delivery = run.deliveryId
      ? store.deliveries.find((d) => d.deliveryId === run.deliveryId && d.status === 'active')
      : undefined
    if (run.deliveryId && (!delivery || delivery.cardId !== null)) return false
    // Where the card rests when the job ends without archiving it. `raw create` writes every
    // card at `todo` and the caller takes this one straight to `implementing`; nothing plans
    // it, so a cancel or a discard hands back a settled card rather than one to refine.
    const idle = 'ready'
    run.cardId = cardId
    run.priorStatus = idle
    if (!delivery) return true
    delivery.cardId = cardId
    delivery.priorStatus = idle
    writeAudit(delivery, store.runs)
    return true
  })
}

/** Put a conflict run into the delivery already in flight on its card. Unlike
 *  `joinDelivery` it opens nothing: undefined when the card has no active delivery, and the
 *  caller refuses. Starting one also clears the stop it may be waiting at. */
export function joinActive(
  store: Store,
  run: RunRecord,
  step: string,
  deliveryId?: string,
): DeliveryRecord | undefined {
  // By the delivery the caller named, or by the card when it named none — the same delivery
  // either way, and the only one a build with no card can be found by (#428).
  const delivery = deliveryId
    ? store.deliveries.find((d) => d.status === 'active' && d.deliveryId === deliveryId)
    : run.cardId === null
      ? undefined
      : activeIn(store, run.cardId)
  if (!delivery) return undefined
  delivery.sessions.push(run.sessionId)
  delivery.steps.push({ step, at: run.startedAt })
  if (delivery.review?.stopped) delivery.review.stopped = undefined
  // The run the answers asked for is this one, so what they concluded has had its effect
  // (#637). Taken here rather than where it was read, so a conclusion that never started
  // anything is still waiting on the next pass.
  const now = Date.now()
  for (const answer of delivery.answers ?? []) if (!answer.actedAt) answer.actedAt = now
  joinFlow(run, delivery)
  writeAudit(delivery, store.runs)
  return delivery
}

function joinFlow(run: RunRecord, delivery: DeliveryRecord): void {
  run.deliveryId = delivery.deliveryId
  run.flowId = delivery.deliveryId
}

/** End a delivery, and say how. Nothing happens to one that has already ended: a cancel
 *  and a run closing can reach here in either order, and the first answer stands. */
export function endDelivery(deliveryId: string, status: Exclude<DeliveryStatus, 'active'>): DeliveryRecord | undefined {
  const ended = withBoardLock(() => withStore((store) => {
    const delivery = store.deliveries.find((d) => d.deliveryId === deliveryId)
    if (!delivery || delivery.status !== 'active') return undefined
    delivery.status = status
    delivery.endedAt = Date.now()
    return { ...delivery }
  }))
  if (ended) {
    syncAudit(deliveryId)
    // The checkout it built in, unless it is one somebody can still carry on (#720). A
    // cancel reaches here before its run is stopped, so that one is left for the second
    // call `cancelDelivery` makes once the run is down.

  }
  return ended
}

export async function settleDelivery(run: RunRecord): Promise<void> {
  // A successful process exit is not a delivery receipt.
  if (run.deliveryId) syncAudit(run.deliveryId, run)
}

/** True while the delivery on this card is stopped on questions only the user can answer.
 *  What the hold lets `resolve` through on: it rewrites questions and never the approved
 *  copy, so the delivery is building exactly what it was building before. */
export function deliveryAcceptsAnswers(cardId: number): boolean {
  return !!deliveryStateOf(cardId)?.paused
}

// ---- the hold a delivery puts on its card -----------------------------------

/** True when THIS process is a run of that card's delivery, so the hold does not apply
 *  to it. The implement flow closes by ticking todos and archiving
 *  the card — card writes like any other, so a hold that couldn't tell them from a user's
 *  edit would refuse the delivery its last step. */
export function insideDelivery(cardId: number): boolean {
  const sessionId = insideRun()
  if (!sessionId) return false
  const store = readStore()
  const delivery = activeIn(store, cardId)
  if (!delivery) return false
  return delivery.sessions.includes(sessionId)
}

/** Where the delivery in flight on this card stands (#307), or nothing when the card is
 *  free. Derived on every read from the card's questions and the delivery's own records. */
export function deliveryStateOf(cardId: number): DeliveryState | undefined {
  const delivery = activeDelivery(cardId)
  return delivery && deliveryState(delivery, openQuestions(cardId))
}

export function heldByDelivery(cardId: number, program?: string): string | undefined {
  const delivery = activeDelivery(cardId)
  if (!delivery) return undefined
  if (insideDelivery(cardId)) return undefined
  const cmd = program ?? boardCommand()
  const state = deliveryState(delivery, openQuestions(cardId))
  const answer =
    `Answer it with \`${cmd} card resolve ${cardId}\`.`
  const doing = state.paused
    ? `is waiting on you on #${cardId} — ${state.line} — so the board won't change the card. ` +
      `${answer} Or take the card back with `
    : `is in flight on #${cardId} — it is building the card as it was approved when it started, ` +
        `so the board won't change it. Take the card back with `
  return (
    `delivery ${delivery.deliveryId} ${doing}` +
    `Discard on the card page, or \`${cmd} delivery cancel ${delivery.deliveryId}\` to end it here.`
  )
}
