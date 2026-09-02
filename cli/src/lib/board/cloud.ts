// ---- the Cloud board -------------------------------------------------------
//
// A board whose authority is a workspace, behind the same contract the Local one answers
// (#316). Nothing that reads or writes a board knows the difference: `akb board`, the app's
// screens and the run engine call the operations in ./contract.ts, and this is one more
// implementation of them.
//
// The shape of it, and the reason for it:
//
//   • **The workspace is the authority; the machine keeps a copy.** `docs/kanban/` is
//     hydrated from one snapshot and the board's OWN rules run over that copy — the Local
//     provider, unchanged, behind this one. Re-implementing lifecycle rules, release fill,
//     scoring and delivery state where the workspace is would be a second board.
//   • **Every read is served from the copy.** It is refreshed after a successful write,
//     after a write the workspace refused as stale, and when the user asks. Never on a
//     timer, so a change made on another machine stays invisible until one of those.
//   • **A write is applied to the copy, then sent.** What the move changed is the difference
//     between the copy before it and the copy after, and that difference is what travels —
//     the cards under the revisions they were read at, then the documents. A refusal puts
//     the copy back exactly as it was, so nothing is left behind that the workspace does not
//     hold.
//   • **Only a call that never reached the service is offline.** A conflict, a held card and
//     a free-tier limit are all answers: they are shown as they stand and the board stays
//     live. Offline serves the copy read-only and retries the workspace on every read, under
//     a short timeout, so the board comes back on its own with nothing to press.
//
// What is deliberately NOT here: creating, importing, exporting and leaving a workspace
// (#317), who else is holding a card (#375), and what a run does around the copy — the
// session-long lock, the refresh before it starts and the upload at its close (#398).

import {
  isOffline,
  readWorkspaceArchive,
  readWorkspaceDocuments,
  readWorkspaceSnapshot,
  registerWorkspaceNode,
  releaseWorkspaceLock,
  takeWorkspaceLock,
  writeWorkspaceCards,
  writeWorkspaceDocuments,
  type CloudCall,
  type SendOptions,
  type WireCard,
  type WireDocument,
  type WireWorkspaceCard,
} from '../cloud/client'
import { readBoardCopy, rememberBoardCopy } from '../cloud/copy'
import { serializeFrontmatter } from '../frontmatter'
import { thisMachine } from '../machine/identity'
import fs from 'node:fs'

import { ignoreBoardCopyIfMissing, readNextId, TODO } from '../paths'
import { nextWork as dispatchNextWork } from '../view/dispatch'
import type { BulkReleaseResult, SaveProjectResult } from '../view/types'
import { NO_REVISION } from './contract'
import type {
  BoardProvider,
  Lease,
  LeaseId,
  LeaseResult,
  LeaseTarget,
  OpEnvelope,
  OpResult,
  Revision,
} from './contract'
import { localBoard } from './local'
import { leaseAnd, moveTarget, opConflict, opOk, opRefused, targetName } from './ops'
import { cardRevision } from './revision'
import {
  clearBoardCopy,
  packBoard,
  unpackBoard,
  type BoardPayload,
  type CardPayload,
  type DocumentPayload,
} from './transfer'

/** How much of a board one call carries — the workspace's own caps, so a move too large is
 *  refused before any of it has been sent. */
const CARDS_PER_CALL = 200
const DOCUMENTS_PER_CALL = 200

/** How long a read taken while offline waits for the workspace before settling for the
 *  copy. Short on purpose: a service that hangs must not hang the screen. */
const OFFLINE_PROBE_MS = 4_000

/** How many times a write whose reply never came is sent again, under the same operation id
 *  so the workspace recognises the retry rather than doing the work twice. */
const LOST_REPLY_TRIES = 3

/** Why a Cloud board could not be opened. Each one is a different sentence to a person, and
 *  a different thing for them to do about it. */
export type OpenRefusal = 'signed-out' | 'not-yours' | 'unreachable' | 'refused'

export type OpenCloudBoard =
  | { ok: true; board: CloudBoardHandle }
  | { ok: false; reason: OpenRefusal; error: string }

/** An open Cloud board: the provider every caller reaches it through, how it stands right
 *  now, and the one re-read that is the user asking rather than a timer. */
export interface CloudBoardHandle {
  provider: BoardProvider
  workspaceId: string
  state(): CloudBoardState
  refresh(): Promise<{ ok: true } | { ok: false; reason: OpenRefusal; error: string }>
}

/** How the board in front of the user stands. The app's strip and `akb` say the same two
 *  things from it: the board is offline, and when its copy was last read. */
export interface CloudBoardState {
  workspaceId: string
  workspaceName: string
  /** True when the last call never reached the service. Every read is still served. */
  offline: boolean
  /** When the copy was last read from the workspace, as an ISO timestamp. */
  readAt: string
}

// ---- the copy, and what this machine knows about it -------------------------

interface Context {
  root: string
  workspaceId: string
  workspaceName: string
  /** The workspace revision the copy was last read or written at. */
  revision: string
  readAt: string
  offline: boolean
  /** This machine's node row in the workspace, once it has registered. */
  nodeId: string
  /** What the workspace holds each card and document at — what a write expects. Keyed by
   *  the card's number and the document's board-relative path. */
  cardAt: Map<number, string>
  docAt: Map<string, string>
  /** True once the archive has been pulled into the copy, so closing a release reads it. */
  archiveIn: boolean
}

/** The lock this process holds over one resource, and the Local lease standing behind it. */
interface HeldLease {
  target: LeaseTarget
  /** The lease the workspace minted — what a write presents. */
  workspace: string
  /** The Local provider's own lease over the copy. Every card write goes through the Local
   *  rules, and those refuse a card written without one. */
  local: LeaseId
}

// ---- opening one ------------------------------------------------------------

/**
 * Open the board `workspaceId` names, hydrating this checkout's copy from one snapshot.
 *
 * A machine with no sign-in, an account the workspace does not belong to and a service that
 * cannot be reached are three different answers, because a person does three different
 * things about them. The third still opens the board when there is a copy to open — and says
 * plainly that there is not, rather than showing an empty board, when there isn't.
 *
 * `retry` says this is a second attempt after one of those refusals, and bounds the read the
 * way an offline one is bounded: a retry sits on the path of every screen read.
 */
export async function openCloudBoard(
  root: string,
  workspaceId: string,
  opts: { retry?: boolean } = {},
): Promise<OpenCloudBoard> {
  const known = readBoardCopy(root)
  const mine = known?.workspaceId === workspaceId ? known : null
  const ctx: Context = {
    root,
    workspaceId,
    workspaceName: '',
    revision: mine?.revision ?? '',
    readAt: mine?.readAt ?? '',
    offline: false,
    nodeId: mine?.nodeId ?? '',
    cardAt: new Map(),
    docAt: new Map(),
    archiveIn: false,
  }

  const read = await hydrate(ctx, opts.retry ? { timeoutMs: OFFLINE_PROBE_MS } : {})
  if (!read.ok) {
    if (read.reason !== 'unreachable') return read
    // Unreachable, and this checkout has never hydrated: there is no copy to open, and an
    // empty board shown in its place would read as a workspace with nothing in it.
    if (!ctx.readAt) {
      return {
        ok: false,
        reason: 'unreachable',
        error:
          'Cloud could not be reached, and this checkout has never read its workspace — ' +
          `so there is no copy of the board to open. (${read.error})`,
      }
    }
    ctx.offline = true
  }

  return {
    ok: true,
    board: {
      provider: cloudBoard(ctx),
      workspaceId: ctx.workspaceId,
      state: () => stateOf(ctx),
      refresh: () => hydrate(ctx),
    },
  }
}

const stateOf = (ctx: Context): CloudBoardState => ({
  workspaceId: ctx.workspaceId,
  workspaceName: ctx.workspaceName,
  offline: ctx.offline,
  readAt: ctx.readAt,
})

/**
 * Read the workspace whole and write it over this checkout's `docs/kanban/`.
 *
 * Three reads, not one. The snapshot is the LIVE board — its cards and the documents being
 * worked on now — and the history and summary files come beside it because the board's own
 * rules append to `record.csv` and `metrics.csv` on almost every move and read `archive.md`
 * on every board draw. The ARCHIVE is the one part left out: this board holds three times as
 * many archived cards as live ones, and closing a release is the only thing that reads them.
 *
 * The copy is cleared first, so a checkout that still holds committed cards opens the
 * workspace's board and not a mixture of the two.
 */
async function hydrate(
  ctx: Context,
  opts: { timeoutMs?: number } = {},
): Promise<{ ok: true } | { ok: false; reason: OpenRefusal; error: string }> {
  // All three under ONE deadline, not one each: a probe that bounded them separately would
  // still hang the screen for three times as long on a service that answers the snapshot
  // and then stops.
  const call: SendOptions = opts.timeoutMs ? { signal: AbortSignal.timeout(opts.timeoutMs) } : {}
  const snapshot = await readWorkspaceSnapshot(ctx.workspaceId, call)
  if (!snapshot.ok) return unread(ctx, snapshot)
  const history = await readWorkspaceDocuments(ctx.workspaceId, 'history', call)
  if (!history.ok) return unread(ctx, history)
  const summaries = await readWorkspaceDocuments(ctx.workspaceId, 'summary', call)
  if (!summaries.ok) return unread(ctx, summaries)

  const documents = [
    ...snapshot.value.documents,
    ...history.value.documents,
    ...summaries.value.documents,
  ]

  // The copy is not the record on this checkout, so it is kept out of git before it is
  // written — a Cloud board that committed its `docs/kanban/` would commit a folder the
  // next read overwrites.
  ignoreBoardCopyIfMissing()
  clearBoardCopy()
  unpackBoard(
    {
      fingerprint: '',
      nextCardId: snapshot.value.workspace.nextCardId,
      cards: snapshot.value.cards.flatMap(cardOf),
      documents: documents.map((d) => ({ path: d.path, kind: d.kind, body: d.body })),
      events: [],
      deliveries: [],
      leftBehind: [],
    },
    ctx.root,
  )
  // A workspace with no live cards writes no `todo/`, and every read below expects one: a
  // board with an empty column is not the same thing as a board that will not read.
  fs.mkdirSync(TODO, { recursive: true })

  ctx.workspaceName = snapshot.value.workspace.name
  ctx.revision = snapshot.value.revision
  ctx.readAt = new Date().toISOString()
  ctx.offline = false
  ctx.archiveIn = false
  ctx.cardAt = new Map(snapshot.value.cards.map((c) => [c.id, c.revision]))
  ctx.docAt = new Map(documents.map((d) => [d.path, d.revision]))
  remember(ctx)

  // The machine says it is here once the board is open, so its writes are attributed. A
  // board that opened offline registers on the first read that reaches the workspace, which
  // is this same call.
  await registerHere(ctx)
  return { ok: true }
}

/** One card off the wire, or nothing for a row whose `data` no card can be drawn from — the
 *  workspace stores it opaquely and reads nothing out of it. */
const cardOf = (card: WireWorkspaceCard): CardPayload[] =>
  card.data?.path && card.data.meta
    ? [
        {
          id: card.id,
          archived: card.archived,
          path: card.data.path,
          meta: card.data.meta,
          body: card.data.body ?? '',
        },
      ]
    : []

/** A read that did not happen. A call that never reached the service leaves the board
 *  offline wherever the read was asked for — opening it, refreshing it, or re-reading it
 *  after a refusal — rather than only where the caller remembered to say so. */
function unread(
  ctx: Context,
  call: { ok: false; error: string; code?: string },
): { ok: false; reason: OpenRefusal; error: string } {
  const refusal = refusalOf(call)
  if (refusal.reason === 'unreachable') ctx.offline = true
  return refusal
}

function refusalOf(call: { ok: false; error: string; code?: string }): {
  ok: false
  reason: OpenRefusal
  error: string
} {
  if (isOffline(call)) return { ok: false, reason: 'unreachable', error: call.error }
  if (call.code === 'unauthenticated') {
    return {
      ok: false,
      reason: 'signed-out',
      error:
        'This machine is not signed in to Cloud, so it cannot open this board. ' +
        "Sign in from the app's Configuration dialog.",
    }
  }
  if (call.code === 'not_yours' || call.code === 'not_found') {
    return {
      ok: false,
      reason: 'not-yours',
      error:
        'This checkout points at a workspace that is not this account’s. Sign in as the ' +
        'account that owns it, or point the checkout at one of your own.',
    }
  }
  return { ok: false, reason: 'refused', error: call.error }
}

function remember(ctx: Context): void {
  rememberBoardCopy(ctx.root, {
    workspaceId: ctx.workspaceId,
    revision: ctx.revision,
    readAt: ctx.readAt,
    ...(ctx.nodeId ? { nodeId: ctx.nodeId } : {}),
  })
}

/** Register this machine as one of the workspace's nodes. Best effort: a machine with no
 *  identity to write down still reads and writes the board — what it loses is its name on
 *  the trail. */
async function registerHere(ctx: Context): Promise<void> {
  const machine = thisMachine()
  if (!machine) return
  const got = await registerWorkspaceNode(ctx.workspaceId, machine.id, machine.name)
  if (!got.ok) return
  ctx.nodeId = got.value.node.id
  remember(ctx)
}

// ---- the provider -----------------------------------------------------------

function cloudBoard(ctx: Context): BoardProvider {
  const local = localBoard()
  const held = new Map<string, HeldLease>()

  /** The one line every refused write says while the board is offline, and the one `akb`
   *  and the app both draw the board's own notice from. */
  const offlineLine = () =>
    `This board is offline — Cloud could not be reached. It was last read ${when(ctx.readAt)}, ` +
    'and nothing can be saved until Cloud answers.'

  /**
   * Give the workspace a chance before a read settles for the copy.
   *
   * Only while offline: that is the one state where a read does not settle for the copy, so
   * the reads the app already makes — after an action, on coming back to the tab — are what
   * bring the board back live, with nothing to press and nothing on a timer.
   */
  async function tryLive(): Promise<void> {
    if (!ctx.offline) return
    const read = await hydrate(ctx, { timeoutMs: OFFLINE_PROBE_MS })
    if (!read.ok) ctx.offline = true
  }

  /** The copy's own next number, so writing one card back does not move `next-id`. */
  const nextIdOf = (): number => {
    try {
      return readNextId()
    } catch {
      return 1
    }
  }

  /** Pull the archive into the copy, so the moves that read `.archive/` — closing and
   *  dropping a release — see what the workspace holds. Once per hydration. */
  async function withArchive(): Promise<boolean> {
    if (ctx.archiveIn) return true
    await tryLive()
    const read = await readWorkspaceArchive(ctx.workspaceId)
    if (!read.ok) {
      if (isOffline(read)) {
        ctx.offline = true
        remember(ctx)
      }
      return false
    }
    const cards = read.value.cards.flatMap(cardOf)
    if (cards.length) {
      unpackBoard(
        { fingerprint: '', nextCardId: nextIdOf(), cards, documents: [], events: [], deliveries: [], leftBehind: [] },
        ctx.root,
      )
    }
    for (const card of read.value.cards) ctx.cardAt.set(card.id, card.revision)
    ctx.archiveIn = true
    return true
  }

  // ---- one write, over the copy and then to the workspace -------------------

  /**
   * Run one mutation over the copy and send what it changed.
   *
   * The order is the whole of it: the move is applied to the copy by the board's own rules,
   * the difference is measured, and only then does anything travel. A refusal — the card
   * moved, another writer holds it, the free tier ran out, the service never answered — puts
   * the copy back exactly as it was, so a screen never shows a change the workspace does not
   * hold.
   */
  async function through<T extends object>(
    target: LeaseTarget,
    env: OpEnvelope,
    run: (env: OpEnvelope) => Promise<OpResult<T>>,
  ): Promise<OpResult<T>> {
    await tryLive()
    if (ctx.offline) return opRefused(new Error(offlineLine()))

    const before = packBoard()
    const result = await run(localEnv(env))
    if (!result.ok) return result

    const change = difference(before, packBoard())
    if (!change.cards.length && !change.documents.length) return result

    // One board move is one transaction, and this service takes at most one call's worth of
    // cards at a time. Sending it in pieces would leave the workspace holding half a move,
    // so the move is undone here instead and the copy comes back to what the workspace has.
    if (change.cards.length > CARDS_PER_CALL || change.documents.length > DOCUMENTS_PER_CALL) {
      restore(before)
      return opRefused(
        new Error(
          `that move changes ${change.cards.length} cards and ${change.documents.length} files, ` +
            `and one Cloud write carries at most ${CARDS_PER_CALL} cards and ` +
            `${DOCUMENTS_PER_CALL} files. Make it in smaller pieces.`,
        ),
      )
    }

    const sent = await push(change, env)
    if (sent.ok) return result

    restore(before)
    // Two reasons the copy is no longer what the workspace holds, and one answer to both:
    // a conflict says the copy was already stale, and `landed` says the cards went through
    // and the documents beside them did not — so undoing the move here has put the copy
    // BEHIND a change the workspace kept. Read the whole board again either way.
    if (sent.conflict || sent.landed) await hydrate(ctx)
    if (sent.conflict) {
      // Hand the caller the revision the resource reads at HERE, after that re-read, which
      // is what it repeats the change through.
      return opConflict(revisionAt(target), targetName(target))
    }
    if (sent.unreachable) {
      ctx.offline = true
      remember(ctx)
      return opRefused(new Error(offlineLine()))
    }
    // Everything else is the workspace's own sentence, shown as it stands — a card another
    // writer holds, a machine taken off the workspace, a free tier that has run out. The
    // edit stays where the caller typed it, because nothing here was kept.
    return opRefused(new Error(sent.error))
  }

  /** What a mutation is checked against on the copy: the Local lease standing behind the
   *  workspace lock the caller holds. */
  function localEnv(env: OpEnvelope): OpEnvelope {
    const lease = env.lease ? held.get(env.lease) : undefined
    return lease ? { ...env, lease: lease.local } : env
  }

  const revisionAt = (target: LeaseTarget): Revision => ('card' in target ? cardRevision(target.card) : '')

  /** Put the copy back to what it was before a refused move. The board's own writing rules
   *  ran over it, so the only honest undo is the image taken before they did.
   *
   *  Deliveries are left out of that image: `clearBoardCopy` never touches them, and what
   *  `packBoard` read is a delivery with its REPOSITORY half stripped — writing it back
   *  would take the base commit, the branch and the worktree off every record on the
   *  machine, and a delivery in flight could no longer be landed or cancelled. */
  function restore(before: BoardPayload): void {
    clearBoardCopy()
    unpackBoard({ ...before, deliveries: [] }, ctx.root)
  }

  /** Send one move's cards and then its documents, folding back what each call hands over.
   *
   *  `landed` on a refusal means the cards already went through: the service takes cards and
   *  documents in two calls, so the second one refusing leaves the workspace holding the
   *  first — and the caller has to read the board again rather than trust the copy. */
  async function push(
    change: Change,
    env: OpEnvelope,
  ): Promise<
    { ok: true } | { ok: false; conflict?: true; unreachable?: true; landed?: true; error: string }
  > {
    const lease = env.lease ? held.get(env.lease) : undefined
    const overCard = (id: number) => lease && 'card' in lease.target && lease.target.card === id

    if (change.cards.length) {
      const wire: WireCard[] = change.cards.map((card) => ({
        id: card.id,
        // A card the copy has just made expects nothing, so a number another machine already
        // took comes back as a conflict rather than writing over their card.
        expect: ctx.cardAt.get(card.id) ?? NO_REVISION,
        archived: card.archived,
        ...(overCard(card.id) ? { lease: lease!.workspace } : {}),
        data: { path: card.path, meta: card.meta, body: card.body },
      }))
      // Its own attempt id: cards and documents are two calls, and the workspace records one
      // result per attempt — sharing an id would answer the second call with the first's.
      const wrote = await sendUntilAnswered(
        (opId) => writeWorkspaceCards(ctx.workspaceId, opId, wire, ctx.nodeId),
        `${env.opId}-cards`,
      )
      if (!wrote.ok) return failureOf(wrote)
      ctx.revision = wrote.value.revision
      for (const card of wrote.value.cards) ctx.cardAt.set(card.id, card.revision)
    }
    const landed = change.cards.length > 0

    if (change.documents.length) {
      const wire: WireDocument[] = change.documents.map((doc) => ({
        ...doc,
        expect: ctx.docAt.get(doc.path) ?? NO_REVISION,
      }))
      const wrote = await sendUntilAnswered(
        (opId) =>
          writeWorkspaceDocuments(
            ctx.workspaceId,
            opId,
            wire,
            ctx.nodeId,
            lease && !('card' in lease.target) ? lease.workspace : '',
          ),
        `${env.opId}-documents`,
      )
      if (!wrote.ok) return { ...failureOf(wrote), ...(landed ? { landed: true as const } : {}) }
      ctx.revision = wrote.value.revision
      for (const doc of wrote.value.documents) ctx.docAt.set(doc.path, doc.revision)
      for (const doc of change.documents) if (!doc.body) ctx.docAt.delete(doc.path)
    }

    ctx.readAt = new Date().toISOString()
    remember(ctx)
    return { ok: true }
  }

  const failureOf = (call: { ok: false; error: string; code?: string }) =>
    isOffline(call)
      ? { ok: false as const, unreachable: true as const, error: call.error }
      : call.code === 'revision_conflict'
        ? { ok: false as const, conflict: true as const, error: call.error }
        : { ok: false as const, error: call.error }

  // ---- the operations -------------------------------------------------------

  const provider: BoardProvider = {
    kind: 'cloud',

    // Reads are the copy's, and the copy alone — unless the board is offline, when each of
    // them is also the attempt that brings it back live.
    readBoard: async () => (await tryLive(), local.readBoard()),
    boardStamp: () => local.boardStamp(),
    readCard: async (id) => (await tryLive(), local.readCard(id)),
    readCards: async () => (await tryLive(), local.readCards()),
    readReleases: () => local.readReleases(),
    readModules: () => local.readModules(),
    readGoalText: () => local.readGoalText(),
    readMemoryFile: (name, module) => local.readMemoryFile(name, module),
    readMemoryModules: () => local.readMemoryModules(),
    readSetupState: () => local.readSetupState(),
    readSetupDraft: () => local.readSetupDraft(),
    readMetricsView: () => local.readMetricsView(),
    readScoreView: () => local.readScoreView(),
    fillPlan: () => local.fillPlan(),

    // All four read `.archive/` — the one part of the board a snapshot leaves out — so each
    // pulls it into the copy first. Closing and dropping a release count what leaves the
    // board; the other two are the archive itself (#380).
    closePlan: async (id) => (await withArchive(), local.closePlan(id)),
    dropPlan: async (id) => (await withArchive(), local.dropPlan(id)),
    readArchive: async () => (await withArchive(), local.readArchive()),
    readArchivedCard: async (id) => (await withArchive(), local.readArchivedCard(id)),

    // The board timer's own write goes through THIS provider, not the Local one under it:
    // taking a mark off a scheduled card is a board write like every other.
    nextWork: () =>
      dispatchNextWork(async (id) => {
        const res = await leaseAnd(provider, { card: id }, (env) => provider.setSchedule(id, null, env))
        return res.ok
      }),

    // ---- the writer lease ---------------------------------------------------

    /**
     * Take the workspace's lock, and a Local lease behind it.
     *
     * Two leases, one grant. The workspace's is what fences other machines off; the Local
     * one is what the copy's own writing rules check a card write against. What the caller
     * is handed is the workspace's id and the COPY's revision — the revision it writes
     * against is the copy's, because the copy is what its move runs over.
     */
    async lease(target: LeaseTarget): Promise<LeaseResult> {
      await tryLive()
      if (ctx.offline) return { ok: false, error: offlineLine() }
      const got = await takeWorkspaceLock(ctx.workspaceId, {
        ...('card' in target ? { cardId: target.card } : {}),
        nodeId: ctx.nodeId,
      })
      if (!got.ok) {
        if (isOffline(got)) {
          ctx.offline = true
          remember(ctx)
          return { ok: false, error: offlineLine() }
        }
        // A card another writer holds says when the hold runs out, so somebody waiting knows
        // how long rather than being told "later".
        return { ok: false, error: got.until ? `${got.error} The hold runs out at ${got.until}.` : got.error }
      }
      const mine = await local.lease(target)
      if (!mine.ok) {
        // The workspace's half is already granted. Left standing it would fence every other
        // machine off a resource nothing here is writing, until it expired on its own.
        await releaseWorkspaceLock(ctx.workspaceId, {
          ...('card' in target ? { cardId: target.card } : {}),
          lease: got.value.lock.leaseId,
        })
        return mine
      }
      const lease: Lease = { id: got.value.lock.leaseId, target, revision: mine.lease.revision }
      held.set(lease.id, { target, workspace: lease.id, local: mine.lease.id })
      return { ok: true, lease }
    },

    async releaseLease(id: LeaseId): Promise<void> {
      const lease = held.get(id)
      if (!lease) return
      held.delete(id)
      await local.releaseLease(lease.local)
      await releaseWorkspaceLock(ctx.workspaceId, {
        ...('card' in lease.target ? { cardId: lease.target.card } : {}),
        lease: lease.workspace,
      })
    },

    // ---- a card's lifecycle and frontmatter ---------------------------------

    patchCard: (id, patch, env) => through({ card: id }, env, (e) => local.patchCard(id, patch, e)),
    setStatus: (id, status, env) => through({ card: id }, env, (e) => local.setStatus(id, status, e)),
    setSchedule: (id, schedule, env) => through({ card: id }, env, (e) => local.setSchedule(id, schedule, e)),
    addVerify: (id, line, env) => through({ card: id }, env, (e) => local.addVerify(id, line, e)),
    dropVerify: (id, line, env) => through({ card: id }, env, (e) => local.dropVerify(id, line, e)),
    appendQuestion: (id, question, options, env) =>
      through({ card: id }, env, (e) => local.appendQuestion(id, question, options, e)),
    archiveCard: (id, env) => through({ card: id }, env, (e) => local.archiveCard(id, e)),
    rejectCard: (id, env) => through({ card: id }, env, (e) => local.rejectCard(id, e)),

    // ---- releases -----------------------------------------------------------

    /** Each card on its own, under its own lease and its own workspace write: one card the
     *  workspace refuses must not cost the rest their move, exactly as on a Local board. */
    async setCardsRelease(ids: number[], release: string): Promise<BulkReleaseResult> {
      const failed: { id: number; error: string }[] = []
      let moved = 0
      for (const id of ids) {
        try {
          const res = await leaseAnd(provider, { card: id }, (env) =>
            provider.patchCard(id, { release }, env),
          )
          if (res.ok) moved += 1
          else failed.push({ id, error: res.error || 'could not be moved' })
        } catch (e) {
          failed.push({ id, error: opRefused(e).error })
        }
      }
      return { moved, failed }
    },

    newRelease: (id, goal, fill, env) => through({ board: true }, env, (e) => local.newRelease(id, goal, fill, e)),
    setReleaseGoal: (id, goal, env) => through({ board: true }, env, (e) => local.setReleaseGoal(id, goal, e)),

    // Closing a release writes the shipped cards up from the archive, so the archive has to
    // be in the copy before the move runs over it.
    async closeRelease(id, env) {
      if (!(await withArchive())) return opRefused(new Error(offlineLine()))
      return through({ board: true }, env, (e) => local.closeRelease(id, e))
    },

    async dropRelease(id, env) {
      if (!(await withArchive())) return opRefused(new Error(offlineLine()))
      return through({ board: true }, env, (e) => local.dropRelease(id, e))
    },

    // ---- memory, the goal and setup -----------------------------------------

    saveGoal: (text, env) => through({ board: true }, env, (e) => local.saveGoal(text, e)),

    /** The one write whose Local half answers `{ ok, error }` rather than an operation
     *  result, so it is turned into one on the way in and back on the way out. */
    async saveProject(name, description, tracks, env): Promise<SaveProjectResult> {
      const res = await through({ board: true }, env, async (e) => {
        const saved = await local.saveProject(name, description, tracks, e)
        if (!saved.ok) return opRefused(new Error(saved.error ?? 'the project could not be saved'))
        return opOk('', {
          added: saved.added,
          renamed: saved.renamed,
          keptBecauseUsed: saved.keptBecauseUsed,
        })
      })
      if (!res.ok) return { ok: false, error: res.error }
      return { ok: true, added: res.added, renamed: res.renamed, keptBecauseUsed: res.keptBecauseUsed }
    },

    finishSetupStep: (name, env) => through({ board: true }, env, (e) => local.finishSetupStep(name, e)),
    saveMemoryFile: (name, text, module, env) =>
      through({ board: true }, env, (e) => local.saveMemoryFile(name, text, module, e)),

    // ---- the per-flow rules -------------------------------------------------

    readFlowRules: () => local.readFlowRules(),
    saveFlowRule: (command, text, env) => through({ board: true }, env, (e) => local.saveFlowRule(command, text, e)),
    deliveryRules: () => local.deliveryRules(),

    // ---- history ------------------------------------------------------------

    recordRun: (id, env) => through({ card: id }, env, (e) => local.recordRun(id, e)),

    // ---- the delivery lifecycle ---------------------------------------------
    //
    // A delivery is a job on THIS machine — a worktree, a branch, a record under
    // `docs/kanban/deliveries/` — so its own bookkeeping stays where the repository is.
    // What reaches the board through it is the card it hands back, and that travels like
    // every other card write. Carrying a delivery into the workspace is #398's.

    listDeliveries: () => local.listDeliveries(),
    activeDelivery: (cardId) => local.activeDelivery(cardId),
    deliveryPlan: () => local.deliveryPlan(),
    deliveryDiff: (deliveryId) => local.deliveryDiff(deliveryId),
    cancelDelivery: (deliveryId, env) => through({ board: true }, env, (e) => local.cancelDelivery(deliveryId, e)),
    discardDelivery: (deliveryId, env) => through({ board: true }, env, (e) => local.discardDelivery(deliveryId, e)),
    approveDelivery: (deliveryId, from, env) =>
      through({ board: true }, env, (e) => local.approveDelivery(deliveryId, from, e)),

    // ---- the named `akb board` moves ----------------------------------------

    runMove: (move, args, env) => through(moveTarget(move, args), env, (e) => local.runMove(move, args, e)),
    readMove: async (move, args) => (await tryLive(), local.readMove(move, args)),
  }

  return provider
}

// ---- what one move changed --------------------------------------------------

interface Change {
  cards: CardPayload[]
  /** A document with an empty body is one the move deleted — that is how the workspace
   *  spells it, and how an emptied per-flow rule already travels. */
  documents: DocumentPayload[]
}

/**
 * The difference between the copy before a move and the copy after it.
 *
 * A card is compared by what would be written back: where it sits, whether it is on the
 * board, its frontmatter and its body. A card that has GONE — `reject` deletes the file — is
 * sent as archived: the workspace keeps a card's row and its number for good, and taking it
 * off the board is the closest it has to what a rejection does here.
 */
function difference(before: BoardPayload, after: BoardPayload): Change {
  const was = new Map(before.cards.map((c) => [c.id, c]))
  const now = new Map(after.cards.map((c) => [c.id, c]))
  const cards: CardPayload[] = []
  for (const card of after.cards) {
    const had = was.get(card.id)
    if (!had || textOf(had) !== textOf(card)) cards.push(card)
  }
  for (const card of before.cards) {
    if (!now.has(card.id) && !card.archived) cards.push({ ...card, archived: true })
  }

  const had = new Map(before.documents.map((d) => [d.path, d.body]))
  const here = new Set(after.documents.map((d) => d.path))
  const documents: DocumentPayload[] = []
  for (const doc of after.documents) if (had.get(doc.path) !== doc.body) documents.push(doc)
  for (const doc of before.documents) if (!here.has(doc.path)) documents.push({ ...doc, body: '' })

  return { cards, documents }
}

/**
 * When the copy was read, in one spelling everywhere.
 *
 * Minute precision and always UTC: this sentence is rendered on a server and again in a
 * browser, and a local format would disagree between the two — the reader only has to judge
 * how old the screen is, which a minute answers.
 */
export const when = (iso: string): string =>
  iso ? `${iso.replace('T', ' ').slice(0, 16)} UTC` : 'never'

/** One card as the workspace stores it, for telling two reads of the copy apart. */
const textOf = (card: CardPayload): string =>
  `${card.path}\n${card.archived ? '1' : '0'}\n${serializeFrontmatter(card.meta)}\n${card.body}`

// ---- a write whose reply never came ------------------------------------------

/**
 * Send one call, and send it again under the SAME operation id when the reply never came.
 *
 * A lost reply is the one failure a client cannot tell from a call that never landed, so it
 * is the one the workspace's operation ledger exists for: a change it already recorded is
 * answered with the result it recorded, never made twice.
 */
async function sendUntilAnswered<T>(
  call: (opId: string) => Promise<CloudCall<T>>,
  opId: string,
): Promise<CloudCall<T>> {
  let last: CloudCall<T> = { ok: false, error: 'Cloud could not be reached.' }
  for (let attempt = 0; attempt < LOST_REPLY_TRIES; attempt++) {
    last = await call(opId)
    if (last.ok || !isOffline(last)) return last
  }
  return last
}
