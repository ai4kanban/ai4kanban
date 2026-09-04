// ---- the board, read whole -------------------------------------------------
//
// One pass over `docs/kanban/todo/` that gives back every open card, the columns they fall
// into, and the handful of board-wide facts a screen draws around them — the releases and
// what each is for, the archive's topics, how far setup got, whether the goal needs
// writing.
//
// This is the reading half of what the writing commands own. It is the ONE reader: a board
// UI asks for this rather than walking the files itself, so a card can never say one thing
// on a page and another on the command line.

import fs from 'node:fs'
import path from 'node:path'

import { approvalCovers } from '../agent/approval'
import { activeDelivery, listDeliveries, manualSettled } from '../agent/deliveries'
import { deliveryState } from '../agent/pause'
import { readRuns } from '../agent/sessions'
import type { DeliveryRecord } from '../agent/types'
import { branchExists, worktreeExists } from '../agent/worktree'
import { idPrefix, isGroupFolder, subtaskLines } from '../cards'
import { ARCHIVE_MD, README, TODO } from '../paths'
import { formatStamp, nextDue } from '../cadence'
import { parseFrontmatter } from '../frontmatter'
import { moduleNames } from '../validate'
import { readReleaseEntries } from '../releases'
import { readSetupChecklist } from '../setup'
import { revisionOf } from '../board/revision'
import { goalNeedsWork, goalWritten } from './goal'
import { readMemoryModules } from './memory'
import { byPickOrder } from './rules'
import type { ArchiveGroup, Board, Card, CardApproval, CardStatus, Column, SetupState, Subtask } from './types'

function countTodos(body: string): { total: number; done: number } {
  const matches = body.match(/^[ \t]*[-*]\s+\[( |x|X)\]/gm) || []
  const done = matches.filter((l) => /\[[xX]\]/.test(l)).length
  return { total: matches.length, done }
}

// When a recurring card comes round again, in words a page can print as it stands. Empty
// when the card has no cadence — nothing will start it but a person. "Due now" when the
// wait is already over, which covers a card that has never run: it is due the moment it
// gets a cadence, so a new job is seen working instead of waiting a day for its first pass.
//
// Worked out here, on the machine whose clock the schedule runs on. A browser on another
// machine would otherwise show its own idea of the time.
function dueLabel(lastRun: string, cadence: string): string {
  const due = nextDue(lastRun, cadence)
  if (!due) return ''
  return due.getTime() <= Date.now() ? 'Due now' : formatStamp(due)
}

// Read one card file into a Card. Null when it has no id or no frontmatter.
function readCard(file: string, relFromTodo: string): Card | null {
  const id = idPrefix(path.basename(relFromTodo))
  if (id === null) {
    // Group root: the id lives on the folder, the file is root.md.
    const parts = relFromTodo.split(path.sep)
    const folderId = idPrefix(parts[parts.length - 2] || '')
    if (folderId === null) return null
    return buildCard(folderId, file, relFromTodo)
  }
  return buildCard(id, file, relFromTodo)
}

function buildCard(id: number, file: string, relFromTodo: string): Card | null {
  const text = fs.readFileSync(file, 'utf8')
  const { meta, body } = parseFrontmatter(text)
  if (!meta) return null
  const relPath = relFromTodo.split(path.sep).join('/')
  // `recurring/` is the one reserved folder: a card in it repeats on a cadence instead of
  // being built once. The path is what says so — the same test `record-run` makes before it
  // will record a run.
  const recurring = relPath.split('/')[0] === 'recurring'
  return {
    id,
    // Derived from the file exactly as it is on disk (lib/board/revision.ts), so a card
    // read here and a card read by the contract agree on what version this is.
    revision: revisionOf(text),
    relPath,
    title: meta.title,
    priority: meta.priority,
    roi: meta.roi,
    status: meta.status as CardStatus,
    release: meta.release,
    blocked_by: meta.blocked_by,
    related: meta.related,
    questions: meta.questions,
    verify: meta.verify,
    modules: meta.modules,
    last_run: meta.last_run,
    cadence: meta.cadence,
    schedule: meta.schedule,
    nextRun: recurring ? dueLabel(meta.last_run, meta.cadence) : '',
    body: body.replace(/^\n+/, '').replace(/\s+$/, ''),
    todos: countTodos(body),
    isGroup: false, // readGroup flips this on the one card that is a root
    recurring,
    openBlockers: [], // filled by attachBlockers once every card has been read
  }
}

// Work out what is really blocking each card. A `blocked_by` id counts only when it names a
// card that is still open — an id no longer on the board was archived or rejected, so that
// work is done and the block is cleared. A recurring blocker and a card that names itself
// are skipped: neither can ever clear, since a recurring card is never archived.
//
// Runs over every card at once (subtasks included), so a blocker inside a group folder
// resolves like any other card.
function attachBlockers(cards: Card[]): void {
  const byId = new Map(cards.map((c) => [c.id, c]))
  for (const card of cards) {
    card.openBlockers = card.blocked_by
      .filter((n) => n !== card.id)
      .map((n) => byId.get(n))
      .filter((b): b is Card => !!b && !b.recurring)
      .map((b) => ({ id: b.id, title: b.title }))
  }
}

// Read a group folder: its root card (carrying a light list of its subtasks for the root
// page) and the full subtask cards (each linked back to the root so a subtask page can
// point up). Subtasks never surface as their own board cards.
function readGroup(folderName: string): { root: Card; subCards: Card[] } | null {
  const groupDir = path.join(TODO, folderName)
  const rootFile = path.join(groupDir, 'root.md')
  // A group folder whose card isn't written yet — the name minted, `root.md` still to come.
  // Nothing to show for it: its name says group (../cards.ts), so it waits.
  if (!fs.existsSync(rootFile)) return null
  const root = readCard(rootFile, path.join(folderName, 'root.md'))
  if (!root) return null
  // Group-ness comes from the folder's name, not from the subtask count below: a finished
  // subtask's file is removed, so a group whose subtasks are all done reads as zero
  // subtasks and would stop looking like a group right when it becomes archiveable.
  root.isGroup = true
  // The gate is "all subtasks resolved", not "all todos done", so this can't reuse
  // `countTodos` — that one's plain done/total drives the progress bar and must keep
  // reading a struck-but-unticked line as unfinished. `ticked` is the closing rule's
  // (lib/group-close.ts) and no screen's, so it is dropped here.
  const { total, resolved } = subtaskLines(root.body)
  root.subtaskLines = { total, resolved }

  const subCards: Card[] = []
  const recurse = (dir: string, relDir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const childRel = path.join(relDir, entry.name)
      if (entry.isDirectory()) {
        recurse(path.join(dir, entry.name), childRel)
      } else if (entry.name.endsWith('.md') && entry.name !== 'README.md' && entry.name !== 'root.md') {
        const c = readCard(path.join(dir, entry.name), childRel)
        if (c) {
          c.parent = { id: root.id, title: root.title }
          subCards.push(c)
        }
      }
    }
  }
  recurse(groupDir, folderName)
  subCards.sort((a, b) => a.id - b.id)

  root.subtasks = subCards.map<Subtask>((c) => ({
    id: c.id,
    title: c.title,
    release: c.release,
    todos: c.todos,
    blocked_by: c.blocked_by,
  }))
  return { root, subCards }
}

// The plain `NN-slug.md` cards in one folder under todo/ — the board's own top level, or
// the reserved `recurring/`. Group folders are read by readGroup instead.
function standaloneCards(dirRel: string): Card[] {
  const dir = dirRel ? path.join(TODO, dirRel) : TODO
  if (!fs.existsSync(dir)) return []
  const cards: Card[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
      const c = readCard(path.join(dir, entry.name), path.join(dirRel, entry.name))
      if (c) cards.push(c)
    }
  }
  return cards.sort((a, b) => a.id - b.id)
}

// Read every card once. `board` is what the columns show: standalone cards and group roots
// (never a subtask). `every` also includes each group's subtasks, so a `#<id>` reference
// linkifies and its own page resolves for any open card.
function collectCards(): { board: Card[]; every: Card[] } {
  const board: Card[] = []
  const every: Card[] = []
  // todo/ is flat, so its own `NN-slug.md` files are cards in their own right.
  const top = standaloneCards('')
  board.push(...top)
  every.push(...top)
  for (const entry of fs.readdirSync(TODO, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (isGroupFolder(entry.name)) {
      const g = readGroup(entry.name)
      if (g) {
        board.push(g.root)
        every.push(g.root, ...g.subCards)
      }
    } else {
      const cards = standaloneCards(entry.name)
      board.push(...cards)
      every.push(...cards)
    }
  }
  // The two arrays hold the same card objects, so annotating `every` covers the board cards
  // as well.
  attachBlockers(every)
  return { board, every }
}

/** Any open card by id, including a group subtask the columns don't show. */
export function findCard(id: number): Card | null {
  const card = collectCards().every.find((c) => c.id === id) ?? null
  if (card) attachDelivery(card)
  return card
}

// The delivery in flight on this card, read fresh. Only the single-card read attaches it:
// the board draws no delivery of its own, and the hold it feeds is the card page's.
//
// A plain read of the record, never `listRuns()`: that one reaps, which writes the record
// and calls board moves, and a card can be read with the board's own lock already held.
function attachDelivery(card: Card): void {
  const delivery = activeDelivery(card.id)
  // In manual commit mode a passed review leaves the commit to the user, and this read is
  // where that is noticed (#303): they committed what review passed and the delivery ends
  // here, they committed something else and it goes back through review, or it is still
  // waiting and the sentence below says so.
  const awaitingCommit = delivery ? manualSettled(delivery) : undefined
  // Read again when that settled it: a delivery that just finished is no longer in flight,
  // and the card is free.
  const live = awaitingCommit ? delivery : activeDelivery(card.id)
  attachDiscard(card, live)
  attachLanded(card, live)
  attachFinished(card, live)
  if (!live) return
  const session = readRuns().find((r) => r.status === 'running' && r.deliveryId === live.deliveryId)
  card.delivery = {
    id: live.deliveryId,
    startedAt: live.startedAt,
    state: deliveryState(live, card.questions.length),
    commitMode: live.commitMode === 'auto' ? 'auto' : 'manual',
    supersedes: supersededBy(card.id, live),
    sessionId: session?.sessionId,
    waiting: live.review?.stopped?.why,
    next: live.next,
    worktree: live.worktree,
    branch: live.branch,
    targetBranch: live.targetBranch,
    manualWhy: live.manualWhy,
    lost: lostCheckout(live),
    landing: live.landing && {
      status: live.landing.status,
      why: live.landing.why,
      commit: live.landing.commit,
      overlap: live.landing.overlap?.length ? live.landing.overlap : undefined,
    },
    approval: cardApproval(live),
  }
}

// This delivery's diff approval, as the block's **Approval** tab draws it (#308). Read from
// the record and never from git: landing drops an approval the moment it stops covering the
// tree, so a required approval that isn't there is exactly one still owed.
function cardApproval(live: DeliveryRecord): CardApproval | undefined {
  const approval = live.approval
  if (!approval?.required) return undefined
  const granted = approval.granted
  const last = [...approval.events].reverse().find((e) => e.kind === 'cancelled')
  return {
    required: true,
    approved: !!granted,
    covers: approvalCovers(granted?.base ?? live.base, granted?.mark),
    cancelled:
      !granted && last
        ? last.moved === 'base'
          ? 'the commit it was built on moved, so your last approval was cancelled'
          : 'the tree changed, so your last approval was cancelled'
        : undefined,
  }
}

// The delivery this one replaced (#307): the newest ended delivery on this card that the
// landing queue superseded, when it ended before this one started. Read from the steps
// rather than from a field of its own — a delivery the user cancelled carries no such step,
// and reads as what it was.
function supersededBy(cardId: number, live: DeliveryRecord): string | undefined {
  const before = listDeliveries()
    .filter((d) => d.cardId === cardId && d.status !== 'active' && (d.endedAt ?? 0) <= live.startedAt)
    .pop()
  return before?.steps.some((s) => s.step === 'superseded') ? before.deliveryId : undefined
}

// The delivery that landed and left the card behind (#307). Normally there is nothing to
// see — the board archives the card in the same breath — so this is the blink between the
// two, and what the page says when the archive itself could not be made.
function attachLanded(card: Card, active: DeliveryRecord | undefined): void {
  if (active) return
  const landed = listDeliveries()
    .filter((d) => d.cardId === card.id && d.status === 'finished' && d.landing?.status === 'landed')
    .pop()
  if (landed) card.landed = { id: landed.deliveryId, commit: landed.landing?.commit }
}

// The card's newest finished delivery (#305), so the delivery block can go on drawing what
// the last one built after it has ended — its **Diff** tab is where the commit that landed
// is read. A cancelled delivery is not one of these: it finished nothing.
function attachFinished(card: Card, active: DeliveryRecord | undefined): void {
  if (active) return
  const last = listDeliveries()
    .filter((d) => d.cardId === card.id && d.status === 'finished')
    .pop()
  if (!last) return
  card.finished = {
    id: last.deliveryId,
    commitMode: last.commitMode === 'auto' ? 'auto' : 'manual',
    commit: last.landing?.commit,
    targetBranch: last.targetBranch,
  }
}

// A delivery whose checkout has gone missing since it was written down: the folder was
// deleted, or the branch was. Said plainly, because nothing will put it back — the card is
// cancelled and started again, and a board that silently forked a second worktree would
// build the card twice.
function lostCheckout(delivery: DeliveryRecord): string | undefined {
  if (!delivery.worktree) return undefined
  const lostTree = !worktreeExists(delivery.worktree)
  const lostBranch = !branchExists(delivery.branch)
  if (!lostTree && !lostBranch) return undefined
  const gone = lostTree && lostBranch ? 'worktree and branch are' : lostTree ? 'worktree is' : 'branch is'
  return `its ${gone} gone — discard this delivery and start the card again, nothing will rebuild it`
}

// The delivery of this card whose worktree could still be thrown away: the one in flight,
// or the newest ended one that never gave its worktree back. `akb delivery cancel` leaves a worktree
// where it is on purpose, so this is the only way one of those is ever offered up.
function attachDiscard(card: Card, active: DeliveryRecord | undefined): void {
  const holder =
    active?.worktree
      ? active
      : listDeliveries()
          .filter((d) => d.cardId === card.id && d.status !== 'active' && d.worktree)
          .pop()
  if (!holder?.worktree) return
  card.discard = {
    id: holder.deliveryId,
    worktree: holder.worktree,
    branch: holder.branch,
    active: holder.status === 'active',
  }
}

/** Every open card, subtasks included. */
export function allCards(): Card[] {
  return collectCards().every
}

/** The catch-all band's heading — cards whose `modules:` is empty. */
const UNTAGGED = 'Untagged'

// Band order follows `docs/kanban/modules.md`, so the board reads in the same order as the
// module map. A module nothing is tagged with draws no band (readBoard drops the empties),
// and cards naming no module fall to one catch-all band at the end.
function orderedModules(present: Set<string>): { module: string; title: string }[] {
  const ordered: { module: string; title: string }[] = []
  const seen = new Set<string>()
  for (const name of moduleNames() ?? []) {
    if (seen.has(name)) continue
    ordered.push({ module: name, title: name })
    seen.add(name)
  }
  // A card can name a module the map has since lost — band it rather than drop it.
  for (const name of Array.from(present).sort()) {
    if (name && !seen.has(name)) ordered.push({ module: name, title: name })
  }
  ordered.push({ module: '', title: UNTAGGED })
  return ordered
}

// Parse archive.md into groups keyed by topic heading. Read-only, no ids.
function readArchiveNotes(): ArchiveGroup[] {
  if (!fs.existsSync(ARCHIVE_MD)) return []
  const groups: ArchiveGroup[] = []
  let current: ArchiveGroup | null = null
  for (const line of fs.readFileSync(ARCHIVE_MD, 'utf8').split('\n')) {
    const h2 = line.match(/^##\s+(.+?)\s*$/)
    if (h2) {
      current = { category: h2[1]!, markdown: '' }
      groups.push(current)
      continue
    }
    if (/^#\s/.test(line)) continue // skip the top "# Archive" title
    if (current) current.markdown += line + '\n'
  }
  return groups.map((g) => ({ ...g, markdown: g.markdown.trim() })).filter((g) => g.markdown.length > 0)
}

// How many open cards name each release. Counted over EVERY open card, subtasks included,
// so the number a release dropdown shows is the number `release list` prints — a group's
// subtasks answer for themselves there too. A blocker counts once, in the release it names.
function countByRelease(cards: Card[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const card of cards) counts[card.release] = (counts[card.release] ?? 0) + 1
  return counts
}

/** How far setup got: every box in order, the count, and the first unticked one. Null when
 *  there is no checklist (setup is finished) and also when there is one we can't read a
 *  single box out of — a file we don't understand is not something to nag about. */
export function readSetupState(): SetupState | null {
  const steps = readSetupChecklist()
  if (!steps || steps.length === 0) return null
  const done = steps.filter((s) => s.done).length
  return { steps, done, total: steps.length, next: steps.find((s) => !s.done) ?? null }
}

/** The whole board in one read. */
export function readBoard(): Board {
  const { board, every } = collectCards()
  // Bucket the board cards by their first module, then lay the bands out in module-map
  // order. A card tagged with several bands under the first; one tagged with none falls to
  // the catch-all. An empty band is dropped — a module nobody is working on says nothing.
  const byModule = new Map<string, Card[]>()
  for (const card of board) {
    const key = card.modules[0] ?? ''
    const list = byModule.get(key)
    if (list) list.push(card)
    else byModule.set(key, [card])
  }
  const columns: Column[] = orderedModules(new Set(byModule.keys()))
    .map(({ module, title }) => ({
      module,
      title,
      cards: (byModule.get(module) ?? []).sort(byPickOrder),
    }))
    .filter((col) => col.cards.length > 0)
  const entries = readReleaseEntries()
  const releaseGoals: Record<string, string> = {}
  for (const entry of entries) if (entry.goal) releaseGoals[entry.id] = entry.goal
  return {
    columns,
    archive: readArchiveNotes(),
    // Linkify every open id, subtasks included — not just the cards the columns show.
    openIds: Array.from(new Set(every.map((card) => card.id))),
    releases: entries.map((e) => e.id),
    releaseGoals,
    releaseCounts: countByRelease(every),
    goalNeedsWork: goalNeedsWork(),
    goalWritten: goalWritten(),
    memoryModules: readMemoryModules(),
    setup: readSetupState(),
  }
}
