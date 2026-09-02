// ---- moving a board into a workspace, and taking it back out (#315) ---------
//
// `packBoard` and `unpackBoard` are the two halves of a board on disk (../board/transfer.ts).
// This is the same two with the network in between: import reads the board here and writes it
// into a workspace, export reads a workspace and writes a markdown board `akb` opens as a
// Local one.
//
// Three things this file is responsible for, and the workspace owns everything else:
//
//   • **Passes.** A board arrives in batches small enough that one call can be retried, never
//     in one request nothing can recover from. Each pass is its own transaction.
//   • **Resuming.** An import that lost a reply, or was stopped halfway, is run again: it
//     reads what the workspace already holds and writes each card against the revision it is
//     at, so nothing is refused for a conflict with its own earlier pass.
//   • **Leaving the source alone.** Import only ever reads `docs/kanban/`. Nothing here
//     writes, moves or deletes a file on the board it is reading.
//
// Neither of these is synchronization. Import runs once into a new workspace; export writes a
// copy. Nothing keeps two writable boards in step.

import fs from 'node:fs'
import path from 'node:path'

import { NO_REVISION } from '../board/contract'
import { newOpId } from '../board/ops'
import { packBoard, unpackBoard, type BoardPayload, type CardPayload } from '../board/transfer'
import { KANBAN } from '../paths'
import {
  beginImport,
  exportBoard as readExport,
  exportEvents,
  finishImport,
  importDeliveries,
  importEvents,
  writeWorkspaceCards,
  writeWorkspaceDocuments,
  type CloudCall,
  type WireCard,
  type WireExport,
} from './client'

/** How much of a board one call carries. The workspace's own caps, so a pass is refused for
 *  being too big before it is sent rather than after. */
const CARDS_PER_PASS = 200
const DOCUMENTS_PER_PASS = 200
const EVENTS_PER_PASS = 500
const DELIVERIES_PER_PASS = 200

/** What an import or an export ended up moving. */
export interface BoardMoved {
  cards: number
  documents: number
  events: number
  deliveries: number
  /** The board files an import left on the machine, because neither half recognised them. */
  leftBehind?: string[]
  /** True when this import found work an earlier attempt had already done. */
  resumed?: boolean
  /** Where an export wrote the board. */
  dir?: string
}

export type MoveResult = { ok: true; moved: BoardMoved } | { ok: false; error: string }

/** One line of progress, for a command that is printing as it goes. */
export type Progress = (line: string) => void

// ---- moving one in ----------------------------------------------------------

/**
 * Read the board at `--dir` and write it into `workspaceId`.
 *
 * Refused unless the workspace is empty or already holds THIS board: a board written over a
 * live one cannot be got back, and the preview keeps no backup of its own.
 */
export async function importBoard(workspaceId: string, say: Progress = () => {}): Promise<MoveResult> {
  if (!fs.existsSync(KANBAN)) return { ok: false, error: `no board at ${KANBAN}` }
  const payload = packBoard()

  const began = await beginImport(workspaceId, newOpId(), payload.fingerprint)
  if (!began.ok) return { ok: false, error: began.error }
  const resumed = began.value.resuming === true
  if (resumed) say('carrying on an import this workspace had already begun')

  // What is already there, and at what revision. A first import reads nothing: the workspace
  // is empty, so every card is a create and expects no revision at all.
  const known = resumed ? await readExport(workspaceId) : null
  if (known && !known.ok) return { ok: false, error: known.error }
  const at = revisionsOf(known?.ok ? known.value : null)

  for (const pass of chunk(payload.cards, CARDS_PER_PASS)) {
    const wrote = await writeWorkspaceCards(workspaceId, newOpId(), pass.map((card) => wire(card, at)))
    if (!wrote.ok) return { ok: false, error: wrote.error }
    say(`cards: ${pass.length}`)
  }

  for (const pass of chunk(payload.documents, DOCUMENTS_PER_PASS)) {
    const wrote = await writeWorkspaceDocuments(
      workspaceId,
      newOpId(),
      pass.map((doc) => ({ ...doc, expect: at.get(`doc:${doc.path}`) ?? NO_REVISION })),
    )
    if (!wrote.ok) return { ok: false, error: wrote.error }
    say(`documents: ${pass.length}`)
  }

  let events = 0
  for (const pass of chunk(payload.events, EVENTS_PER_PASS)) {
    const wrote = await importEvents(workspaceId, newOpId(), pass)
    if (!wrote.ok) return { ok: false, error: wrote.error }
    events += wrote.value.added
    say(`history: ${wrote.value.added} new of ${pass.length}`)
  }

  let deliveries = 0
  for (const pass of chunk(payload.deliveries, DELIVERIES_PER_PASS)) {
    const wrote = await importDeliveries(
      workspaceId,
      newOpId(),
      pass.map((d) => ({
        sourceId: d.deliveryId,
        cardId: d.cardId,
        state: endedAs(d.record),
        record: d.record,
        approved: d.approved,
        finalBody: d.finalBody,
      })),
    )
    if (!wrote.ok) return { ok: false, error: wrote.error }
    deliveries += wrote.value.added
    say(`deliveries: ${wrote.value.added} new of ${pass.length}`)
  }

  const finished = await finishImport(workspaceId, newOpId(), payload.nextCardId)
  if (!finished.ok) return { ok: false, error: finished.error }

  // A file neither half recognised stays on the machine, and is said out loud rather than
  // dropped quietly: an export is what a board is restored from, so what it will not carry
  // is something the person running the import has to hear now.
  for (const rel of payload.leftBehind) say(`left behind, not board content: ${rel}`)

  return {
    ok: true,
    moved: {
      cards: payload.cards.length,
      documents: payload.documents.length,
      events,
      deliveries,
      leftBehind: payload.leftBehind,
      ...(resumed ? { resumed: true } : {}),
    },
  }
}

/** How a delivery ended, as the workspace records it. A record that says nothing useful is
 *  taken as finished: it is on the source board's permanent record, so it is over. */
function endedAs(record: Record<string, unknown>): string {
  const status = typeof record.status === 'string' ? record.status : ''
  if (status === 'cancelled') return 'cancelled'
  if (status === 'failed') return 'failed'
  return 'completed'
}

/** The revision every card and document in the workspace is at, so a resumed import writes
 *  against what is there rather than against what an empty workspace would have had. */
function revisionsOf(known: WireExport | null): Map<string, string> {
  const at = new Map<string, string>()
  if (!known) return at
  for (const card of known.cards) at.set(`card:${card.id}`, card.revision)
  for (const doc of known.documents) at.set(`doc:${doc.path}`, doc.revision ?? NO_REVISION)
  return at
}

/** One card as a workspace takes it: its own number, the revision it is at here, and the
 *  card's portable fields and body. */
const wire = (card: CardPayload, at: Map<string, string>): WireCard => ({
  id: card.id,
  expect: at.get(`card:${card.id}`) ?? NO_REVISION,
  archived: card.archived,
  data: { path: card.path, meta: card.meta, body: card.body },
})

// ---- taking one back out ----------------------------------------------------

/**
 * Read `workspaceId` whole and write it out as a markdown board under `dir`.
 *
 * The only copy anybody can restore a Cloud board from — the preview's free tiers keep no
 * backup of their own — so it reads the archive and the finished work as well as the live
 * board, and refuses to write over a folder that already holds one. `dir` is always named:
 * this needs no board of its own, which is what lets a restore run on a machine that has none.
 */
export async function exportBoard(
  workspaceId: string,
  dir: string,
  say: Progress = () => {},
): Promise<MoveResult> {
  const kanban = path.join(dir, 'docs', 'kanban')
  if (fs.existsSync(kanban) && fs.readdirSync(kanban).length > 0) {
    return { ok: false, error: `${kanban} already holds a board — export into an empty folder` }
  }

  const read = await readExport(workspaceId)
  if (!read.ok) return { ok: false, error: read.error }

  const payload: BoardPayload = {
    fingerprint: '',
    nextCardId: read.value.workspace.nextCardId,
    cards: read.value.cards.flatMap((card) =>
      card.data?.path && card.data.meta
        ? [{ id: card.id, archived: card.archived, path: card.data.path, meta: card.data.meta, body: card.data.body ?? '' }]
        : [],
    ),
    documents: read.value.documents,
    // The trail is Cloud's own record of what happened there. `record.csv` travels as a
    // document and comes back exactly as it was, so nothing is rebuilt from the trail.
    events: [],
    leftBehind: [],
    deliveries: read.value.deliveries.map((d) => ({ ...d, deliveryId: deliveryIdOf(d) })),
  }

  const written = unpackBoard(payload, dir)
  say(`wrote ${written.cards} cards, ${written.documents} documents and ${written.deliveries} deliveries`)

  // The trail comes out BESIDE the board rather than into it. It is the workspace's own
  // record of what happened in Cloud, not a file a Local board reads — and the preview keeps
  // no backup of its own, so an export is the only way an owner gets it at all.
  const trail = await readTrail(workspaceId)
  if (trail.length) {
    const file = path.join(dir, 'cloud-trail.json')
    fs.writeFileSync(file, `${JSON.stringify(trail, null, 2)}\n`)
    say(`wrote ${trail.length} trail entries to ${file}`)
  }

  return {
    ok: true,
    moved: {
      cards: written.cards,
      documents: written.documents,
      events: trail.length,
      deliveries: written.deliveries,
      dir: kanban,
    },
  }
}

/** The name a delivery's file is written under. The workspace names a delivery by its own
 *  row id; the id the machine that ran it gave it rides inside the record, and that is the
 *  one the board's own `deliveries/` folder is keyed by. */
function deliveryIdOf(delivery: { id: string; record: Record<string, unknown> }): string {
  const own = delivery.record?.deliveryId
  return typeof own === 'string' && own ? own : delivery.id
}

/** The whole trail, a page at a time from where the last page stopped. The one part of a
 *  board with no natural bound, so it is the one part that pages. */
async function readTrail(workspaceId: string): Promise<unknown[]> {
  const out: unknown[] = []
  let after = 0
  for (;;) {
    const page: CloudCall<{ events: { id: number }[] }> = await exportEvents(workspaceId, after, EVENTS_PER_PASS)
    if (!page.ok || page.value.events.length === 0) return out
    out.push(...page.value.events)
    after = page.value.events[page.value.events.length - 1].id
    if (page.value.events.length < EVENTS_PER_PASS) return out
  }
}

// ---- the small piece --------------------------------------------------------

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}
