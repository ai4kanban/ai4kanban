/**
 * The workspace a Cloud board lives in (#314).
 *
 * One trusted place that decides what may change and in what order. Every route here is
 * behind #326's admission check and then behind the workspace's own: `cloud.workspace_for`
 * in the migration is the whole of it, and it answers the workspace's MEMBERS (#376). A
 * workspace that is not one of the caller's and one that has been deleted meet the same
 * refusal, so nothing leaks whether a workspace ever existed. The moves that manage the
 * workspace rather than work on the board — its name, its deletion, its members and its
 * nodes — keep an owner check of their own on top.
 *
 * Like every other route in this service, one call is one `api` function and therefore one
 * transaction: authorization, lifecycle rules, operation uniqueness and the expected revision
 * are checked, the change is applied, revisions advance and an audit event is appended — all
 * of it or none of it. The Worker's job is the SHAPE of the request; the rules that have to
 * hold against two machines calling at once are the migration's.
 */

import {
  CARD_LOCK_SECONDS,
  MAX_CARDS_PER_WRITE,
  MAX_DOCUMENTS_PER_WRITE,
  MAX_EVENTS_PER_IMPORT,
  NODE_LEASE_SECONDS,
} from './config.ts'
import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import { badRequest, notFound } from './errors.ts'
import { bodyOf, json, requireMethod } from './http.ts'
import { runtimes, shortName, uuid } from './input.ts'
import type { ServerRuntime } from './input.ts'
import type { Owner } from './owner.ts'

/** A board stored in Cloud. `revision` moves on every mutation, so a client holding one can
 *  tell the board changed without reading it back. */
export interface Workspace {
  id: string
  name: string
  revision: string
  /** The next card number the board has free. Import carries a board's own numbers in. */
  nextCardId: number
  createdAt: string
  updatedAt: string
}

/** One card, under the small integer the board already calls it by. What `data` holds is
 *  #315's; the control plane stores it whole and reads nothing out of it. */
export interface WorkspaceCard {
  id: number
  revision: string
  data: Record<string, unknown>
  /** The card has left the board. It keeps its number and its row: archiving is how a
   *  board records what shipped, not how it forgets it. */
  archived: boolean
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Every board file that is not a card — a memory file, the module map, a per-flow rule —
 *  under the path it is written back to. */
export interface WorkspaceDocument {
  path: string
  kind: DocumentKind
  revision: string
  body: string
  createdAt: string
  updatedAt: string
}

/** Which half of the board a document belongs to. The first three are the board being
 *  worked on now and travel in a snapshot; the last two are its finished work and its daily
 *  tally, read on demand. */
export type DocumentKind = 'config' | 'memory' | 'rule' | 'summary' | 'history'

const DOCUMENT_KINDS: DocumentKind[] = ['config', 'memory', 'rule', 'summary', 'history']

/** The lock one writer holds over a card, or over the board. `revision` is what that
 *  resource read at when the lock was granted — what a caller who never read it writes
 *  against. */
export interface WorkspaceLock {
  leaseId: string
  /** The card it is over, or null for the board itself. */
  cardId: number | null
  revision: string
  grantedAt: string
  expiresAt: string
}

/** The whole live board under one cursor: what a screen hydrates from. */
export interface BoardSnapshot {
  revision: string
  workspace: Workspace
  cards: WorkspaceCard[]
  documents: WorkspaceDocument[]
}

/** What a browser is served (#322): the two screens' own read, and no more of the workspace
 *  than they draw. */
export interface ReaderBoard {
  revision: string
  workspace: { id: string; name: string; revision: string }
  cards: { id: number; revision: string; data: Record<string, unknown> }[]
  documents: { path: string; body: string }[]
}

/** Everything a standalone markdown board is made of. The trail comes beside it, paged. */
export interface BoardExport {
  revision: string
  workspace: Workspace
  cards: WorkspaceCard[]
  documents: WorkspaceDocument[]
  deliveries: DeliveryAttempt[]
}

/** A machine registered to run this workspace's work. The account is who registered it —
 *  it attributes rather than gates, so the check in front of a node stays "this workspace's,
 *  and live" and a teammate can take a machine over (#376). */
export interface WorkspaceNode {
  id: string
  workspaceId: string
  name: string
  machineId: string
  machineName: string
  runtimes: ServerRuntime[]
  accountId: string | null
  handle: string
  leaseExpiresAt: string | null
  live: boolean
}

/** One account inside one workspace. The handle, the name and the avatar are read back off
 *  the account rather than kept a second time, so a member who renames on GitHub is one
 *  name and not two (#376). */
export interface WorkspaceMember {
  accountId: string
  handle: string
  name: string | null
  avatarUrl: string | null
  role: MemberRole
  addedAt: string
}

/** Two roles and no third. An owner manages members, roles, execution nodes and the
 *  workspace itself; a member performs every ordinary board operation. */
export type MemberRole = 'owner' | 'member'

const ROLES: MemberRole[] = ['owner', 'member']

/** One delivery attempt, under an id the service allocated. */
export interface DeliveryAttempt {
  id: string
  workspaceId: string
  cardId: number
  nodeId: string | null
  state: 'open' | 'completed' | 'failed' | 'cancelled'
  detail: Record<string, unknown>
  /** The portable half of the delivery record, as the machine that ran it wrote it down.
   *  The repository half is stripped by the database, not by the client that sent it. */
  record: Record<string, unknown>
  /** The card exactly as it was approved for this delivery. */
  approved: string
  /** The card's body as the delivery left it. */
  finalBody: string
  createdAt: string
  updatedAt: string
}

/** One line of the trail: what was done, by whom, and from which machine. */
export interface AuditEvent {
  id: number
  accountId: string | null
  handle: string
  nodeId: string | null
  action: string
  cardId: number | null
  detail: Record<string, unknown>
  at: string
}

/** How a delivery attempt may end. `open` is where it starts, never where it stops. */
const OUTCOMES = ['completed', 'failed', 'cancelled']

// ---- the workspace itself ---------------------------------------------------

/** Make one. Any admitted account may, and there is no cap: #326's list bounds who reaches
 *  the service at all, so a second refusal here would turn the same people away twice. */
export async function createWorkspace(env: Env, owner: Owner, body: unknown): Promise<{ workspace: Workspace }> {
  const input = held(body)
  return {
    workspace: await mutate<Workspace>(env, 'create_workspace', {
      p_subject: owner.accountId,
      // Optional, unlike every other mutation's: the ledger that would deduplicate a retry
      // lives inside the workspace this call is making. The workspace row carries it instead.
      p_op_id: typeof input.opId === 'string' ? opId(input.opId) : '',
      p_name: shortName(input.name),
    }),
  }
}

export async function listWorkspaces(env: Env, owner: Owner): Promise<{ workspaces: Workspace[] }> {
  const workspaces = await call<Workspace[]>(env, 'list_workspaces', { p_subject: owner.accountId })
  return { workspaces: workspaces ?? [] }
}

export async function readWorkspace(env: Env, owner: Owner, id: string): Promise<{ workspace: Workspace }> {
  return {
    workspace: await call<Workspace>(env, 'read_workspace', {
      p_subject: owner.accountId,
      p_workspace: uuid(id, 'workspace'),
    }),
  }
}

export async function renameWorkspace(env: Env, owner: Owner, id: string, body: unknown): Promise<{ workspace: Workspace }> {
  const input = held(body)
  return {
    workspace: await mutate<Workspace>(env, 'rename_workspace', {
      p_subject: owner.accountId,
      p_workspace: uuid(id, 'workspace'),
      p_op_id: opId(input.opId),
      p_node: node(input.nodeId),
      p_expect: revision(input.expect),
      p_name: shortName(input.name),
    }),
  }
}

/**
 * Delete the workspace and everything in it, inside this call. No grace window, no
 * deleted-but-answering state, and nothing left to restore from — the owner's export is the
 * only copy anyone can restore from, which is what #321's privacy page promises.
 *
 * The confirmation is the caller's: #317 is what asks a person whether they mean it.
 */
export async function deleteWorkspace(env: Env, owner: Owner, id: string): Promise<{ deleted: true; workspaceId: string; name: string }> {
  return await call(env, 'delete_workspace', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
  })
}

// ---- cards ------------------------------------------------------------------

export async function readCards(env: Env, owner: Owner, id: string): Promise<{ revision: string; cards: WorkspaceCard[] }> {
  return await call(env, 'read_cards', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
  })
}

/**
 * Write one card or twenty, in one transaction. Every expected revision is checked before
 * anything is written, so the operation commits whole or changes nothing.
 *
 * An entry naming no id is given the next number the board has free; one naming an id the
 * workspace does not hold keeps that number, which is what lets #315's import carry a board's
 * own numbering in unchanged.
 */
export async function writeCards(env: Env, owner: Owner, id: string, body: unknown): Promise<{ revision: string; cards: WorkspaceCard[] }> {
  const input = held(body)
  return await mutate(env, 'write_cards', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
    p_op_id: opId(input.opId),
    p_node: node(input.nodeId),
    p_cards: cards(input.cards),
  })
}

export async function readAudit(env: Env, owner: Owner, id: string, limit: string | null): Promise<{ events: AuditEvent[] }> {
  const events = await call<AuditEvent[]>(env, 'read_audit', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
    p_limit: Number.parseInt(limit ?? '', 10) || 100,
  })
  return { events: events ?? [] }
}

// ---- the workspace's execution nodes ----------------------------------------

/** A machine registers itself the first time it opens the workspace. Idempotent on the
 *  machine id, and free when nothing about the machine moved. */
export async function registerNode(env: Env, owner: Owner, id: string, body: unknown): Promise<{ node: WorkspaceNode }> {
  const input = held(body)
  return {
    node: await mutate<WorkspaceNode>(env, 'register_node', {
      p_subject: owner.accountId,
      p_workspace: uuid(id, 'workspace'),
      p_machine: uuid(input.machineId, 'machine'),
      p_machine_name: shortName(input.machineName),
      p_runtimes: runtimes(input.runtimes),
    }),
  }
}

export async function listNodes(env: Env, owner: Owner, id: string): Promise<{ nodes: WorkspaceNode[] }> {
  const nodes = await call<WorkspaceNode[]>(env, 'list_nodes', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
  })
  return { nodes: nodes ?? [] }
}

export async function renameNode(env: Env, owner: Owner, id: string, nodeId: string, body: unknown): Promise<{ node: WorkspaceNode }> {
  const input = held(body)
  return {
    node: await mutate<WorkspaceNode>(env, 'rename_node', {
      p_subject: owner.accountId,
      p_workspace: uuid(id, 'workspace'),
      p_op_id: opId(input.opId),
      p_node: uuid(nodeId, 'node'),
      p_name: shortName(input.name),
    }),
  }
}

/** Take a machine off the workspace. Its next renewal, write and delivery confirmation are
 *  all refused after this. */
export async function removeNode(env: Env, owner: Owner, id: string, nodeId: string, body: unknown): Promise<{ removed: true; nodeId: string }> {
  const input = held(body)
  return await mutate(env, 'remove_node', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
    p_op_id: opId(input.opId),
    p_node: uuid(nodeId, 'node'),
  })
}

/** A node saying it is still there. The lease is the SERVICE's, never one a client asked for. */
export async function renewNode(env: Env, owner: Owner, id: string, nodeId: string): Promise<{ node: WorkspaceNode }> {
  return {
    node: await mutate<WorkspaceNode>(env, 'renew_node', {
      p_subject: owner.accountId,
      p_workspace: uuid(id, 'workspace'),
      p_node: uuid(nodeId, 'node'),
      p_lease_seconds: NODE_LEASE_SECONDS,
    }),
  }
}

// ---- the accounts inside the workspace --------------------------------------

/** Who is in it, and what the CALLER's own role is — so a screen draws the owner controls
 *  off the service's answer rather than off a handle it matched itself. */
export async function listMembers(env: Env, owner: Owner, id: string): Promise<MemberList> {
  const read = await call<MemberList>(env, 'list_members', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
  })
  return { role: read?.role ?? null, members: read?.members ?? [] }
}

export interface MemberList {
  /** The caller's own role in this workspace. Never null in practice — a non-member is
   *  refused before the list is read. */
  role: MemberRole | null
  members: WorkspaceMember[]
}

/**
 * Add somebody already admitted to the preview, by GitHub handle.
 *
 * Adding a member never admits an account: a handle we have not let in is refused, and the
 * workspace keeps nothing for it — no pending member and no invitation of its own — so the
 * teammate asks the preview for themselves and an owner adds them once we have approved
 * them. Which handles are refused, and the one message they all meet, is the database's.
 */
export async function addMember(env: Env, owner: Owner, id: string, body: unknown): Promise<{ member: WorkspaceMember }> {
  const input = held(body)
  return {
    member: await mutate<WorkspaceMember>(env, 'add_member', {
      p_subject: owner.accountId,
      p_workspace: uuid(id, 'workspace'),
      p_op_id: opId(input.opId),
      p_handle: handle(input.handle),
      p_role: role(input.role),
    }),
  }
}

/** Take somebody off. Their next write and their next delivery confirmation are refused;
 *  nothing pushes to a board they already have open, so that is where they meet it. */
export async function removeMember(env: Env, owner: Owner, id: string, accountId: string, body: unknown): Promise<{ removed: true; accountId: string }> {
  const input = held(body)
  return await mutate(env, 'remove_member', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
    p_op_id: opId(input.opId),
    p_account: uuid(accountId, 'account'),
  })
}

/** Make a member an owner, or an owner a member. The one that would leave the workspace
 *  with no owner is refused by the database, with the reason. */
export async function setMemberRole(env: Env, owner: Owner, id: string, accountId: string, body: unknown): Promise<{ member: WorkspaceMember }> {
  const input = held(body)
  return {
    member: await mutate<WorkspaceMember>(env, 'set_member_role', {
      p_subject: owner.accountId,
      p_workspace: uuid(id, 'workspace'),
      p_op_id: opId(input.opId),
      p_account: uuid(accountId, 'account'),
      p_role: role(input.role),
    }),
  }
}

// ---- delivery attempts ------------------------------------------------------

export async function openDelivery(env: Env, owner: Owner, id: string, body: unknown): Promise<{ delivery: DeliveryAttempt }> {
  const input = held(body)
  return {
    delivery: await mutate<DeliveryAttempt>(env, 'open_delivery', {
      p_subject: owner.accountId,
      p_workspace: uuid(id, 'workspace'),
      p_op_id: opId(input.opId),
      p_node: node(input.nodeId),
      p_card: cardId(input.cardId),
    }),
  }
}

export async function confirmDelivery(env: Env, owner: Owner, id: string, deliveryId: string, body: unknown): Promise<{ delivery: DeliveryAttempt }> {
  const input = held(body)
  const outcome = typeof input.outcome === 'string' ? input.outcome : ''
  if (!OUTCOMES.includes(outcome)) {
    throw badRequest(`A delivery ends as ${OUTCOMES.join(', ')} — never as “${outcome}”.`)
  }
  return {
    delivery: await mutate<DeliveryAttempt>(env, 'confirm_delivery', {
      p_subject: owner.accountId,
      p_workspace: uuid(id, 'workspace'),
      p_op_id: opId(input.opId),
      p_node: node(input.nodeId),
      p_delivery: uuid(deliveryId, 'delivery'),
      p_outcome: outcome,
      p_detail: plain(input.detail),
    }),
  }
}


// ---- the whole board, and the pieces a screen re-reads ----------------------

/** One read a client hydrates from: the workspace, its live cards, and the documents that
 *  are the board being worked on now — all out of one transaction, so the revision it
 *  carries is one every row in it was read at. */
export const readSnapshot = (env: Env, owner: Owner, id: string): Promise<BoardSnapshot> =>
  call(env, 'read_snapshot', { p_subject: owner.accountId, p_workspace: uuid(id, 'workspace') })

/** One card. What a conflict is answered with — the refusal names the card whose revision
 *  moved, so the caller re-reads that card rather than the whole board. */
export const readCard = (
  env: Env,
  owner: Owner,
  id: string,
  card: string,
): Promise<{ revision: string; card: WorkspaceCard }> =>
  call(env, 'read_card', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
    p_card: cardId(card),
  })

/**
 * One read the hosted pages draw both their screens from (#322): the workspace's name, its
 * live cards and the four configuration documents those screens draw — and nothing else a
 * workspace holds.
 *
 * A read of its own rather than the snapshot above, because the snapshot carries the memory
 * set and the per-flow rules and neither belongs in a browser. The migration is what leaves
 * them behind, so a route added later cannot serve them by forgetting to.
 */
export const readForReader = (env: Env, owner: Owner, id: string): Promise<ReaderBoard> =>
  call(env, 'read_for_reader', { p_subject: owner.accountId, p_workspace: uuid(id, 'workspace') })

/** The cards that have left the board. Never in a snapshot: this board holds three times as
 *  many archived cards as live ones, and a screen draws the present. */
export const readArchive = (
  env: Env,
  owner: Owner,
  id: string,
): Promise<{ revision: string; cards: WorkspaceCard[] }> =>
  call(env, 'read_archive', { p_subject: owner.accountId, p_workspace: uuid(id, 'workspace') })

// ---- documents ---------------------------------------------------------------

export const readDocuments = (
  env: Env,
  owner: Owner,
  id: string,
  kind: string | null,
): Promise<{ revision: string; documents: WorkspaceDocument[] }> =>
  call(env, 'read_documents', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
    p_kind: documentKind(kind ?? '', true),
  })

/**
 * Write one document or twenty, under the board's own lock. An empty body deletes the
 * document, because that is what an empty per-flow rule means on a Local board — and a board
 * exported with a blank file in it would not be the board that was imported.
 */
export async function writeDocuments(
  env: Env,
  owner: Owner,
  id: string,
  body: unknown,
): Promise<{ revision: string; documents: WorkspaceDocument[] }> {
  const input = held(body)
  return await mutate(env, 'write_documents', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
    p_op_id: opId(input.opId),
    p_node: node(input.nodeId),
    p_lease: lease(input.lease),
    p_documents: documents(input.documents),
  })
}

// ---- the writer lock ---------------------------------------------------------

/**
 * Take the lock over one card, or over the board, and be handed the revision it reads at.
 *
 * Presenting the lease it was granted under takes it again and moves the expiry. The lease
 * itself is minted by the database, so nothing a client sends can name itself the holder of
 * a lock it never took, and the length is the SERVICE's — never one a client asked for.
 */
export async function takeLock(env: Env, owner: Owner, id: string, body: unknown): Promise<{ lock: WorkspaceLock }> {
  const input = held(body)
  return {
    lock: await mutate<WorkspaceLock>(env, 'take_lock', {
      p_subject: owner.accountId,
      p_workspace: uuid(id, 'workspace'),
      p_node: node(input.nodeId),
      p_card: lockTarget(input.cardId),
      p_lease: lease(input.lease),
      p_lease_seconds: CARD_LOCK_SECONDS,
    }),
  }
}

/** Give it up before it runs out. Silent about a lock this caller does not hold: a client
 *  releasing a lease that already expired must not take the next holder's away. */
export async function releaseLock(env: Env, owner: Owner, id: string, body: unknown): Promise<{ released: boolean }> {
  const input = held(body)
  return await call(env, 'release_lock', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
    p_card: lockTarget(input.cardId),
    p_lease: uuid(input.lease, 'lease'),
  })
}

export async function listLocks(env: Env, owner: Owner, id: string): Promise<{ locks: WorkspaceLock[] }> {
  const locks = await call<WorkspaceLock[]>(env, 'list_locks', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
  })
  return { locks: locks ?? [] }
}

// ---- what a delivery leaves behind -------------------------------------------

export async function readDeliveries(
  env: Env,
  owner: Owner,
  id: string,
  card: string | null,
): Promise<{ deliveries: DeliveryAttempt[] }> {
  const deliveries = await call<DeliveryAttempt[]>(env, 'read_deliveries', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
    p_card: card ? cardId(card) : null,
  })
  return { deliveries: deliveries ?? [] }
}

/** Store what a delivery prepared and the bodies it froze. The repository half of the record
 *  — the base, the branch, the worktree, the commit it landed as — is stripped by the
 *  database rather than by whatever sent it. */
export async function recordDelivery(
  env: Env,
  owner: Owner,
  id: string,
  deliveryId: string,
  body: unknown,
): Promise<{ delivery: DeliveryAttempt }> {
  const input = held(body)
  return {
    delivery: await mutate<DeliveryAttempt>(env, 'record_delivery', {
      p_subject: owner.accountId,
      p_workspace: uuid(id, 'workspace'),
      p_op_id: opId(input.opId),
      p_node: node(input.nodeId),
      p_delivery: uuid(deliveryId, 'delivery'),
      p_record: plain(input.record),
      p_approved: text(input.approved),
      p_final: text(input.finalBody),
    }),
  }
}

// ---- moving a board in, and taking it back out -------------------------------

/**
 * Claim this workspace for one source board, by the fingerprint the machine derived from it.
 *
 * A workspace that already holds a board is refused unless it holds THIS one — so an import
 * that lost its reply or was interrupted halfway carries on where it stopped, and one
 * pointed at a live board is refused before it overwrites a card. The board itself then
 * arrives through the ordinary card, document and delivery writers.
 */
export async function beginImport(env: Env, owner: Owner, id: string, body: unknown): Promise<ImportState> {
  const input = held(body)
  return await mutate(env, 'begin_import', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
    p_op_id: opId(input.opId),
    p_fingerprint: fingerprint(input.fingerprint),
  })
}

/** The source board's own history. Each row carries its own key, so a retried pass finds its
 *  own work rather than appending it again, and its own date, so the trail reads as the
 *  board's history rather than as the afternoon it was uploaded. */
export async function importEvents(env: Env, owner: Owner, id: string, body: unknown): Promise<{ added: number }> {
  const input = held(body)
  return await mutate(env, 'import_events', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
    p_op_id: opId(input.opId),
    p_events: events(input.events),
  })
}

/** The source board's finished deliveries, arriving whole rather than through the
 *  open-and-confirm pair a live one goes through. Idempotent on the id the source board gave
 *  each of them. */
export async function importDeliveries(env: Env, owner: Owner, id: string, body: unknown): Promise<{ added: number }> {
  const input = held(body)
  return await mutate(env, 'import_deliveries', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
    p_op_id: opId(input.opId),
    p_deliveries: importedDeliveries(input.deliveries),
  })
}

export async function finishImport(env: Env, owner: Owner, id: string, body: unknown): Promise<ImportState> {
  const input = held(body)
  return await mutate(env, 'finish_import', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
    p_op_id: opId(input.opId),
    p_next_card_id: input.nextCardId === undefined ? null : cardId(input.nextCardId),
  })
}

/** Everything a standalone markdown board is made of. The only copy anybody can restore a
 *  Cloud board from — the preview's free tiers keep no backup of their own. */
export const exportBoard = (env: Env, owner: Owner, id: string): Promise<BoardExport> =>
  call(env, 'export_board', { p_subject: owner.accountId, p_workspace: uuid(id, 'workspace') })

/** The trail in the order it happened, from where the last page stopped. The one part of a
 *  board with no natural bound, so it is the one part that pages. */
export async function exportEvents(
  env: Env,
  owner: Owner,
  id: string,
  after: string | null,
  limit: string | null,
): Promise<{ events: AuditEvent[] }> {
  const events = await call<AuditEvent[]>(env, 'export_events', {
    p_subject: owner.accountId,
    p_workspace: uuid(id, 'workspace'),
    p_after: Number.parseInt(after ?? '', 10) || 0,
    p_limit: Number.parseInt(limit ?? '', 10) || MAX_EVENTS_PER_IMPORT,
  })
  return { events: events ?? [] }
}

/** Where an import stands: what the workspace was claimed for, whether this call found work
 *  already done, and what it holds. */
export interface ImportState {
  workspaceId?: string
  fingerprint?: string
  resuming?: boolean
  workspace?: Workspace
  held: { cards: number; documents: number; events: number; deliveries: number }
}

// ---- the routes -------------------------------------------------------------

/**
 * Everything under `/v1/workspaces`, dispatched here rather than as a dozen patterns in
 * `index.ts`: the workspace surface is one thing, and its routes read as a list when they sit
 * together. The caller is already an admitted account — `requireOwner` ran before this.
 */
export async function routeWorkspace(env: Env, owner: Owner, request: Request, url: URL, path: string): Promise<Response> {
  const [id = '', section = '', name = '', move = '', ...rest] = path.split('/')
  // A move is the last thing a path says. Anything after it is a path this service does
  // not have, and answering it would let `…/delete/typo` remove a workspace for good.
  if (rest.length) throw notFound()

  if (!id) {
    if (request.method === 'GET') return json(await listWorkspaces(env, owner))
    requireMethod(request, 'POST')
    return json(await createWorkspace(env, owner, await bodyOf(request)))
  }

  if (!section) {
    requireMethod(request, 'GET')
    return json(await readWorkspace(env, owner, id))
  }

  if ((section === 'rename' || section === 'delete') && !name) {
    requireMethod(request, 'POST')
    return json(
      section === 'delete'
        ? await deleteWorkspace(env, owner, id)
        : await renameWorkspace(env, owner, id, await bodyOf(request)),
    )
  }

  if (section === 'cards' && !name) {
    if (request.method === 'GET') return json(await readCards(env, owner, id))
    requireMethod(request, 'POST')
    return json(await writeCards(env, owner, id, await bodyOf(request)))
  }

  // One card, by its number — what a conflict is re-read through.
  if (section === 'cards' && name && !move) {
    requireMethod(request, 'GET')
    return json(await readCard(env, owner, id, name))
  }

  if (section === 'snapshot' && !name) {
    requireMethod(request, 'GET')
    return json(await readSnapshot(env, owner, id))
  }

  // What the hosted pages read (#322). Its own route because it is its own read: less of the
  // workspace than a snapshot, and nothing a browser does not draw.
  if (section === 'read' && !name) {
    requireMethod(request, 'GET')
    return json(await readForReader(env, owner, id))
  }

  if (section === 'archive' && !name) {
    requireMethod(request, 'GET')
    return json(await readArchive(env, owner, id))
  }

  if (section === 'documents' && !name) {
    if (request.method === 'GET') return json(await readDocuments(env, owner, id, url.searchParams.get('kind')))
    requireMethod(request, 'POST')
    return json(await writeDocuments(env, owner, id, await bodyOf(request)))
  }

  if (section === 'locks' && !name) {
    if (request.method === 'GET') return json(await listLocks(env, owner, id))
    requireMethod(request, 'POST')
    return json(await takeLock(env, owner, id, await bodyOf(request)))
  }

  if (section === 'locks' && name === 'release' && !move) {
    requireMethod(request, 'POST')
    return json(await releaseLock(env, owner, id, await bodyOf(request)))
  }

  if (section === 'import' && !move &&
      (name === 'begin' || name === 'events' || name === 'deliveries' || name === 'finish')) {
    requireMethod(request, 'POST')
    const body = await bodyOf(request)
    if (name === 'begin') return json(await beginImport(env, owner, id, body))
    if (name === 'events') return json(await importEvents(env, owner, id, body))
    if (name === 'deliveries') return json(await importDeliveries(env, owner, id, body))
    return json(await finishImport(env, owner, id, body))
  }

  if (section === 'export' && !name) {
    requireMethod(request, 'GET')
    return json(await exportBoard(env, owner, id))
  }

  if (section === 'export' && name === 'events' && !move) {
    requireMethod(request, 'GET')
    return json(
      await exportEvents(env, owner, id, url.searchParams.get('after'), url.searchParams.get('limit')),
    )
  }

  if (section === 'audit' && !name) {
    requireMethod(request, 'GET')
    return json(await readAudit(env, owner, id, url.searchParams.get('limit')))
  }

  if (section === 'nodes' && !name) {
    if (request.method === 'GET') return json(await listNodes(env, owner, id))
    requireMethod(request, 'POST')
    return json(await registerNode(env, owner, id, await bodyOf(request)))
  }

  if (section === 'members' && !name) {
    if (request.method === 'GET') return json(await listMembers(env, owner, id))
    requireMethod(request, 'POST')
    return json(await addMember(env, owner, id, await bodyOf(request)))
  }

  if (section === 'members' && name && (move === 'remove' || move === 'role')) {
    requireMethod(request, 'POST')
    const body = await bodyOf(request)
    return json(
      move === 'remove'
        ? await removeMember(env, owner, id, name, body)
        : await setMemberRole(env, owner, id, name, body),
    )
  }

  if (section === 'nodes' && (move === 'rename' || move === 'remove' || move === 'renew')) {
    requireMethod(request, 'POST')
    if (move === 'renew') return json(await renewNode(env, owner, id, name))
    const body = await bodyOf(request)
    return json(
      move === 'rename'
        ? await renameNode(env, owner, id, name, body)
        : await removeNode(env, owner, id, name, body),
    )
  }

  if (section === 'deliveries' && !name && request.method === 'GET') {
    return json(await readDeliveries(env, owner, id, url.searchParams.get('card')))
  }

  if (section === 'deliveries' && (!name || (name && (move === 'confirm' || move === 'record')))) {
    requireMethod(request, 'POST')
    const body = await bodyOf(request)
    if (!name) return json(await openDelivery(env, owner, id, body))
    return json(
      move === 'record'
        ? await recordDelivery(env, owner, id, name, body)
        : await confirmDelivery(env, owner, id, name, body),
    )
  }

  throw notFound()
}

// ---- what a body has to be --------------------------------------------------

const held = (body: unknown): Record<string, unknown> => (body ?? {}) as Record<string, unknown>

/** The attempt this call is. #312 mints one per attempt, and it is what makes a retry
 *  answerable, so a mutation that carries none is refused rather than silently unrepeatable. */
function opId(value: unknown): string {
  const id = typeof value === 'string' ? value.trim().slice(0, 200) : ''
  if (!id) throw badRequest('That change names no attempt.')
  return id
}

/** The machine a call was made from, where it names one. The owner acting in the app names
 *  none, and a node that was removed is refused by the database rather than here. */
const node = (value: unknown): string | null =>
  value === undefined || value === null || value === '' ? null : uuid(value, 'node')

/** The GitHub handle an owner named. Bounded here; whether it resolves to exactly one
 *  admitted account is the database's, and every handle it cannot resolve meets one
 *  message. */
function handle(value: unknown): string {
  const named = typeof value === 'string' ? value.trim().slice(0, 100) : ''
  if (!named) throw badRequest('That names no GitHub handle.')
  return named
}

/** Which of the two roles. Refused here rather than folded into `member`, so a typo is a
 *  refusal instead of a quiet demotion. */
function role(value: unknown): MemberRole {
  const named = typeof value === 'string' ? value.trim() : ''
  if (!(ROLES as string[]).includes(named)) {
    throw badRequest(`A member is ${ROLES.join(' or ')} — never “${named}”.`)
  }
  return named as MemberRole
}

/** The revision the caller read, as it travels: opaque, and `''` for a card that does not
 *  exist yet — #312's NO_REVISION, what a create expects to find. */
function revision(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw badRequest('That change names no revision.')
  return value.trim().slice(0, 64)
}

function cardId(value: unknown): number {
  const id = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isSafeInteger(id) || id < 1) throw badRequest('That request names no card.')
  return id
}

/** `[{ id, expect, lease, archived, data }, ...]`, capped so one call cannot grow a
 *  transaction without bound. An entry naming no id is a card the board has not numbered
 *  yet; one naming no `archived` leaves the card where it is. */
interface CardEntry {
  id: number | null
  expect: string
  data: Record<string, unknown>
  lease?: string
  archived?: boolean
}

function cards(value: unknown): CardEntry[] {
  if (!Array.isArray(value) || value.length === 0) throw badRequest('That write names no card.')
  if (value.length > MAX_CARDS_PER_WRITE) {
    throw badRequest(`One write carries at most ${MAX_CARDS_PER_WRITE} cards. Send the rest in another.`)
  }
  return value.map((entry) => {
    const card = held(entry)
    const lease = leaseOf(card.lease)
    return {
      id: card.id === undefined || card.id === null ? null : cardId(card.id),
      expect: revision(card.expect),
      data: plain(card.data),
      ...(lease ? { lease } : {}),
      // Left out on purpose when the caller said nothing: an ordinary save is about a card's
      // words, so only a move that means it may take one off the board or put it back.
      ...(card.archived === undefined ? {} : { archived: card.archived === true }),
    }
  })
}

/** `[{ path, kind, expect, body }, ...]`. A body of `''` deletes the document. */
function documents(value: unknown): { path: string; kind: string; expect: string; body: string }[] {
  if (!Array.isArray(value) || value.length === 0) throw badRequest('That write names no document.')
  if (value.length > MAX_DOCUMENTS_PER_WRITE) {
    throw badRequest(`One write carries at most ${MAX_DOCUMENTS_PER_WRITE} documents. Send the rest in another.`)
  }
  return value.map((entry) => {
    const doc = held(entry)
    return {
      path: documentPath(doc.path),
      kind: documentKind(doc.kind, false),
      expect: revision(doc.expect),
      body: typeof doc.body === 'string' ? doc.body : '',
    }
  })
}

/**
 * Where a document is written back to when the board is exported — a board-relative path and
 * nothing else.
 *
 * Checked HERE and not only on the machine that exports, because an export writes these
 * paths to somebody's disk: a path that climbed out of the board's folder, or named a drive,
 * would be a workspace writing where it was never asked to. Backslashes are refused for the
 * same reason rather than translated — a Windows path is not a board path.
 */
function documentPath(value: unknown): string {
  const path = typeof value === 'string' ? value.trim() : ''
  if (!path || path.length > 400) throw badRequest('That document names no path.')
  if (path.includes('\\') || path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
    throw badRequest(`A document's path is relative to the board — “${path}” is not.`)
  }
  if (path.split('/').some((part) => part === '' || part === '.' || part === '..')) {
    throw badRequest(`A document's path stays inside the board — “${path}” does not.`)
  }
  return path
}

/** Which half of the board this document belongs to. `allowEmpty` is the read filter, where
 *  nothing named means every kind. */
function documentKind(value: unknown, allowEmpty: boolean): string {
  const kind = typeof value === 'string' ? value.trim() : ''
  if (!kind && allowEmpty) return ''
  if (!(DOCUMENT_KINDS as string[]).includes(kind)) {
    throw badRequest(`A document is one of ${DOCUMENT_KINDS.join(', ')} — never “${kind}”.`)
  }
  return kind
}

/** A source board's own history rows, as an import pass carries them. */
function events(value: unknown): { key: string; at: string; action: string; cardId: number | null; detail: Record<string, unknown> }[] {
  if (!Array.isArray(value) || value.length === 0) throw badRequest('That import names no history.')
  if (value.length > MAX_EVENTS_PER_IMPORT) {
    throw badRequest(`One pass carries at most ${MAX_EVENTS_PER_IMPORT} history rows. Send the rest in another.`)
  }
  return value.map((entry) => {
    const event = held(entry)
    const key = typeof event.key === 'string' ? event.key.trim().slice(0, 200) : ''
    if (!key) throw badRequest('A history row carries no key, so a retry could not find it again.')
    return {
      key,
      at: typeof event.at === 'string' ? event.at.trim().slice(0, 64) : '',
      action: shortName(event.action) || 'imported',
      cardId: event.cardId === undefined || event.cardId === null ? null : cardId(event.cardId),
      detail: plain(event.detail),
    }
  })
}

/** A source board's finished deliveries, as an import pass carries them. */
function importedDeliveries(value: unknown): {
  sourceId: string
  cardId: number
  state: string
  record: Record<string, unknown>
  approved: string
  finalBody: string
}[] {
  if (!Array.isArray(value) || value.length === 0) throw badRequest('That import names no delivery.')
  if (value.length > MAX_DOCUMENTS_PER_WRITE) {
    throw badRequest(`One pass carries at most ${MAX_DOCUMENTS_PER_WRITE} deliveries. Send the rest in another.`)
  }
  return value.map((entry) => {
    const delivery = held(entry)
    const sourceId = typeof delivery.sourceId === 'string' ? delivery.sourceId.trim().slice(0, 200) : ''
    if (!sourceId) throw badRequest('A delivery carries no id, so a retry could not find it again.')
    const state = typeof delivery.state === 'string' ? delivery.state : ''
    return {
      sourceId,
      cardId: cardId(delivery.cardId),
      state: OUTCOMES.includes(state) ? state : 'completed',
      record: plain(delivery.record),
      approved: text(delivery.approved),
      finalBody: text(delivery.finalBody),
    }
  })
}

/** What a source board is recognised by, so a retried import finds its own work. Opaque:
 *  the machine derives it, and nothing here reads anything into it. */
function fingerprint(value: unknown): string {
  const held = typeof value === 'string' ? value.trim().slice(0, 200) : ''
  if (!held) throw badRequest('That import names no source board.')
  return held
}

/** The resource a lock is over: a card, or the board itself when none is named. 0 is the
 *  board — card numbers start at 1, so nothing collides with it. */
const lockTarget = (value: unknown): number =>
  value === undefined || value === null || value === '' ? 0 : cardId(value)

/** The lease a caller presents — to take a lock again, or to write under one it holds. */
const lease = (value: unknown): string | null => leaseOf(value) ?? null

const leaseOf = (value: unknown): string | undefined =>
  value === undefined || value === null || value === '' ? undefined : uuid(value, 'lease')

/** A body a delivery froze. Long by nature — it is a card — and never anything but text. */
const text = (value: unknown): string => (typeof value === 'string' ? value : '')

/** A JSON object, or an empty one. Never an array or a bare value: a row's `data` is a
 *  record, and taking anything else would store a shape nothing can read back. */
function plain(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) throw badRequest('That change carries no object.')
  return value as Record<string, unknown>
}
