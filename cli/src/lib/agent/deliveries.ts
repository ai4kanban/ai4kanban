// A delivery: everything one Implement click starts.
//
// One click, one delivery, one card — and several sessions inside it: implementation
// today, review and correction as later cards land. What makes it more than a label is the
// SNAPSHOT: a delivery copies the card's approved requirements the moment it starts and
// builds from that copy, so a card edited underneath it never changes what it was approved
// to build. While it is in flight the card is held — the board's own screens and commands
// won't change it — and the way to take the card back is Cancel delivery.
//
// It leaves two records. The live row sits in docs/kanban/.sessions.json, where the lock
// and the card page read it. The permanent one is a JSON file per delivery under
// docs/kanban/deliveries/, tracked in git, kept after the card is archived, and never
// pruned while the delivery is unfinished — #309 links a bug back to it long afterwards.

import fs from 'node:fs'
import path from 'node:path'

import { locate } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { DELIVERIES, rel } from '../paths'
import { candidateBase } from './candidate'
import { boardCommand } from './command'
import { insideRun } from './env'
import {
  askUser,
  lastRound,
  markCandidate,
  nextAfterSession,
  parseFindings,
  reviewOf,
  stopQuestion,
} from './review'
import { readStore, withStore, type Store } from './store'
import type {
  AgentRequest,
  DeliveryRecord,
  DeliveryStatus,
  ReviewVerdict,
  RunRecord,
} from './types'

// A delivery id is read inside a branch name and typed into `akb cancel`, so it is short
// and unambiguous: eight characters from an alphabet with no look-alike pairs.
const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const ID_LENGTH = 8

// ---- the permanent record ---------------------------------------------------

const auditPath = (deliveryId: string): string => path.join(DELIVERIES, `${deliveryId}.json`)

/** Every delivery id the permanent record already holds, so a new one can't collide with a
 *  delivery that ended months ago. */
function recordedIds(): Set<string> {
  try {
    return new Set(
      fs
        .readdirSync(DELIVERIES)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.slice(0, -'.json'.length)),
    )
  } catch {
    return new Set()
  }
}

// Drawn at random and checked against the record as it is allocated — both records, the
// live rows and the files, since a delivery leaves the first long before it leaves the
// second.
function newDeliveryId(deliveries: DeliveryRecord[]): string {
  const taken = recordedIds()
  for (const d of deliveries) taken.add(d.deliveryId)
  for (;;) {
    let id = ''
    for (let i = 0; i < ID_LENGTH; i++) id += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)]
    if (!taken.has(id)) return id
  }
}

/** One session, as the permanent record keeps it: what ran, how it went, and where its log
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
  log: string
}

/** Write the delivery's permanent record, or bring it up to date. Best-effort: a delivery
 *  that couldn't write its file is still a delivery, and failing the session that owns it
 *  would cost the user their work over an audit line. */
export function writeAudit(delivery: DeliveryRecord, runs: RunRecord[]): void {
  // What this file already said about each session. The live record keeps only the newest
  // 30, so a long delivery's first session leaves it long before the delivery ends — and
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
  try {
    fs.mkdirSync(DELIVERIES, { recursive: true })
    const tmp = `${auditPath(delivery.deliveryId)}.tmp`
    fs.writeFileSync(tmp, JSON.stringify({ ...delivery, sessions }, null, 2) + '\n')
    fs.renameSync(tmp, auditPath(delivery.deliveryId))
  } catch {
    // an unwritable folder — the live row is still the truth for the lock
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

/** Bring one delivery's permanent record up to date from the live record.
 *
 *  `just` is a session the caller holds that the live record may already have let go of: a
 *  session closes and is pruned in the same write, so the caller's copy is the only one
 *  carrying how it ended. */
export function syncAudit(deliveryId: string, just?: RunRecord): void {
  const store = readStore()
  const delivery = store.deliveries.find((d) => d.deliveryId === deliveryId)
  if (!delivery) return
  const runs = just ? [just, ...store.runs.filter((r) => r.sessionId !== just.sessionId)] : store.runs
  writeAudit(delivery, runs)
}

// ---- the approved requirements ----------------------------------------------

// What a delivery is approved to build. Everything else on the card — `## Todo` and its
// ticks, status, questions, verify lines, the notes a delivery leaves as it works — sits
// outside, so a delivery writing to its own card is never a change to its requirements.
const APPROVED = [
  /^##\s+Worth noting\s*$/i,
  /^##\s+Scope\s*$/i,
  /^##\s+Scope out\s*$/i,
  /^##\s+By\s+`[^`]+`\s+agent\s*$/i,
]

const isApproved = (heading: string): boolean => APPROVED.some((re) => re.test(heading))

/** The card's approved requirements as one block of markdown: its title, its opening
 *  paragraph, `## Worth noting`, `## Scope`, `## Scope out`, and every spec agent's
 *  section, in the order the card writes them.
 *
 *  Empty when there is no such card — a delivery is refused before that can happen, and a
 *  snapshot of nothing is a truthful answer either way. */
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

// The card's stage as it stands, or `todo` when there is no reading it.
function cardStatus(cardId: number): string {
  try {
    const found = locate(cardId)
    if (!found) return 'todo'
    const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
    return parseFrontmatter(fs.readFileSync(file, 'utf8')).meta?.status || 'todo'
  } catch {
    return 'todo'
  }
}

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

/** Every delivery the live record holds, oldest first. */
export const listDeliveries = (): DeliveryRecord[] => readStore().deliveries

/** Put a session into the delivery its card is being built under, opening one when the
 *  card has none. Called with the record's lock already held, from inside the same
 *  transaction that writes the session down — so a delivery can never exist with no
 *  session to it, and two clicks can never open two deliveries on one card.
 *
 *  `step` is what the session is entering the delivery to do. It is kept as history and
 *  never trusted on a resume: a stored position goes stale in exactly the crash it exists
 *  for. */
export function joinDelivery(store: Store, run: RunRecord, title: string, step: string): DeliveryRecord {
  const cardId = run.cardId as number
  let delivery = activeIn(store, cardId)
  if (!delivery) {
    delivery = {
      deliveryId: newDeliveryId(store.deliveries),
      cardId,
      title,
      status: 'active',
      startedAt: run.startedAt,
      sessions: [],
      // The one read of the card this delivery will ever make for its requirements.
      approved: approvedRequirements(cardId),
      steps: [],
      // And the one read of where the code stood before it started. Everything the
      // delivery writes is the difference from here, which is the diff review judges.
      base: candidateBase() ?? undefined,
      // The stage to put back when the whole delivery ends. Read here, from the first
      // session, because every session after this one would read `implementing` — the
      // stage this delivery itself put there.
      priorStatus: cardStatus(cardId),
    }
    store.deliveries.push(delivery)
  }
  delivery.sessions.push(run.sessionId)
  delivery.steps.push({ step, at: run.startedAt })
  run.deliveryId = delivery.deliveryId
  // The permanent record exists from the delivery's first moment, not from its first
  // ending: a delivery whose machine died in its first minute still left one behind.
  writeAudit(delivery, store.runs)
  return delivery
}

/** Put a review or a correction session into the delivery already in flight on its card.
 *
 *  Unlike `joinDelivery` it opens nothing: there is no delivery to review when nobody has
 *  built anything, and a session that quietly started one would review an empty diff
 *  against a card it had just captured. Undefined when the card has no active delivery,
 *  and the caller refuses.
 *
 *  Starting one also clears the stop it may be waiting at: the user has answered, approved
 *  an exception, or asked for another look, and this session is that look. */
export function joinActive(store: Store, run: RunRecord, step: string): DeliveryRecord | undefined {
  const cardId = run.cardId as number
  const delivery = activeIn(store, cardId)
  if (!delivery) return undefined
  delivery.sessions.push(run.sessionId)
  delivery.steps.push({ step, at: run.startedAt })
  if (delivery.review?.stopped) delivery.review.stopped = undefined
  run.deliveryId = delivery.deliveryId
  writeAudit(delivery, store.runs)
  return delivery
}

/** End a delivery, and say how. Nothing happens to one that has already ended: a cancel
 *  and a session closing can reach here in either order, and the first answer stands. */
export function endDelivery(deliveryId: string, status: Exclude<DeliveryStatus, 'active'>): DeliveryRecord | undefined {
  const ended = withStore((store) => {
    const delivery = store.deliveries.find((d) => d.deliveryId === deliveryId)
    if (!delivery || delivery.status !== 'active') return undefined
    delivery.status = status
    delivery.endedAt = Date.now()
    return { ...delivery }
  })
  if (ended) syncAudit(deliveryId)
  return ended
}

// ---- review, across a delivery's sessions (#302) -----------------------------

/** Write one review's verdict onto the delivery in flight on this card.
 *
 *  The review session records its own verdict — it is the only thing that read the diff —
 *  and everything the loop does next is decided from it once the session has closed. A
 *  second call in one session REPLACES the first: a reviewer that changed its mind mid-
 *  session leaves one verdict, not two. */
export function recordVerdict(
  cardId: number,
  sessionId: string,
  verdict: ReviewVerdict,
  findingsText: string,
): { ok: true; delivery: DeliveryRecord } | { ok: false; error: string } {
  const findings = parseFindings(findingsText)
  if (verdict !== 'pass' && !findings.length) {
    return { ok: false, error: `a "${verdict}" verdict has to say what was found — pass the findings with --file` }
  }
  const out = withStore<{ ok: true; delivery: DeliveryRecord } | { ok: false; error: string }>((store) => {
    const delivery = activeIn(store, cardId)
    if (!delivery) return { ok: false, error: `no delivery is in flight on #${cardId}, so there is nothing to review` }
    const review = reviewOf(delivery)
    const mine = review.rounds[review.rounds.length - 1]
    const round = { sessionId, verdict, findings, at: Date.now() }
    if (mine?.sessionId === sessionId) review.rounds[review.rounds.length - 1] = round
    else review.rounds.push(round)
    return { ok: true, delivery: { ...delivery } }
  })
  if (out.ok) syncAudit(out.delivery.deliveryId)
  return out
}

/** What a session's ending means for the delivery it belonged to.
 *
 *  A delivery is implementation, then review, then a correction and another review for as
 *  long as review asks for one. So the end of a session is a decision rather than an
 *  ending: the delivery finishes only when review passes it, stops with a question on the
 *  card when review can go no further, and otherwise writes down the session it starts
 *  next. A session that failed or was cut off mid-build leaves it ACTIVE and unfinished,
 *  with the card still held, until Resume carries it on or Cancel delivery ends it. A
 *  session somebody stopped is the same: stopping a session is not ending the job. */
export function settleDelivery(run: RunRecord): void {
  if (!run.deliveryId) return
  type Settled = { end: 'finished' } | { ask: string; cardId: number }
  const settled = withStore<Settled | null>((store) => {
    const delivery = store.deliveries.find((d) => d.deliveryId === run.deliveryId)
    if (!delivery) return null
    const next = nextAfterSession(delivery, run)
    if ('hold' in next) return null
    if ('finish' in next) {
      delivery.next = undefined
      return { end: 'finished' }
    }
    if ('stop' in next) {
      const review = reviewOf(delivery)
      review.stopped = { reason: next.stop, why: next.why, at: Date.now() }
      delivery.next = undefined
      // The delivery stays ACTIVE. It has not failed and it has not finished — it is
      // waiting for the user, and the card it is holding is the card their answer goes on.
      return { ask: stopQuestion(delivery, next.why), cardId: delivery.cardId }
    }
    delivery.next = next.start
    if (next.start === 'correct') {
      const review = reviewOf(delivery)
      review.corrections += 1
      // Taken now, before the correction writes anything, so the session after it can be
      // told whether the candidate moved at all.
      review.mark = markCandidate(delivery)
    }
    return null
  })
  if (settled && 'end' in settled) endDelivery(run.deliveryId, settled.end)
  if (settled && 'ask' in settled) askUser(settled.cardId, settled.ask)
  // Whatever happened, the permanent record follows the session that just closed — from
  // the caller's copy, since closing and pruning it are one write.
  syncAudit(run.deliveryId, run)
}

/** The session this delivery starts next, now that one of its own has closed — and it is
 *  taken as it is read, so nothing starts it twice.
 *
 *  Called by the watcher of the session that just closed, which is the one process that
 *  can start it: a session never starts another. A watcher that dies in between leaves
 *  `next` on the record, so the delivery still says what it was about to do and
 *  `akb review <id>` puts it back in motion. */
export function deliveryRunAfter(run: RunRecord): AgentRequest | null {
  if (!run.deliveryId) return null
  const taken = withStore((store) => {
    const delivery = store.deliveries.find((d) => d.deliveryId === run.deliveryId)
    if (!delivery || delivery.status !== 'active' || !delivery.next) return null
    const action = delivery.next
    delivery.next = undefined
    return { action, cardId: delivery.cardId, title: delivery.title }
  })
  if (!taken) return null
  return { action: taken.action, id: taken.cardId, title: taken.title }
}

/** The verdict this delivery's last review left, for a flow that has to say where it
 *  stands. */
export const latestVerdict = (delivery: DeliveryRecord): ReviewVerdict | undefined =>
  lastRound(delivery)?.verdict

// ---- the hold a delivery puts on its card -----------------------------------

/** True when THIS process is a session of that card's delivery, so the hold does not apply
 *  to it. The implement flow closes by ticking todos, appending verify lines and archiving
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

/** Why the delivery in flight on this card has stopped and is waiting for the user — one
 *  plain sentence — or nothing while it is still working.
 *
 *  A waiting delivery is not a stuck one: it put a question on the card, and answering
 *  that question is the way on. So the hold below lets a resolve through while it waits,
 *  and the card page offers the same. */
export function deliveryWaiting(cardId: number): string | undefined {
  return activeDelivery(cardId)?.review?.stopped?.why
}

/** Why this card can't be changed from outside its delivery — one is in flight — or
 *  nothing when it is free. The sentence names the delivery, says what it is building, and
 *  names the one thing that takes the card back; "try again later" without any of those is
 *  a refusal nobody can act on.
 *
 *  A session of the delivery itself passes straight through. */
export function heldByDelivery(cardId: number, program?: string): string | undefined {
  const delivery = activeDelivery(cardId)
  if (!delivery) return undefined
  if (insideDelivery(cardId)) return undefined
  const cmd = program ?? boardCommand()
  const waiting = delivery.review?.stopped?.why
  const doing = waiting
    ? `has stopped on #${cardId} and is waiting on you — ${waiting} — so the board won't change the card. ` +
      `Answer the question it left (\`${cmd} resolve ${cardId}\`), then \`${cmd} review ${cardId}\`. Or take the card back with `
    : `is in flight on #${cardId} — it is building the card as it was approved when it started, ` +
      `so the board won't change it. Take the card back with `
  return (
    `delivery ${delivery.deliveryId} ${doing}` +
    `Cancel delivery on the card page, or \`${cmd} cancel ${delivery.deliveryId}\`.`
  )
}
