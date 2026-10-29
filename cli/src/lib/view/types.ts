// The board as a reader sees it — every shape a front end draws.
//
// This file is pure types and constants, and it imports nothing. That is what lets it be
// copied straight into the board UI (`scripts/sync-format.mjs` → `kanban-ui/lib/format/
// view/types.ts`), so the browser can name what the server hands it without a second,
// hand-kept copy of the same shapes drifting out of step.
//
// Where a shape here overlaps one the writing side uses, this is the one that travels: the
// writers read a card's `Meta` (../types.ts), readers read a `Card`.

/** The stage a card rests in, saved on the card so it survives a restart. In order: `todo`
 *  (raw), `ready` (plan concrete, no open questions, someone could start now),
 *  `implementing`. Archiving and rejecting take the card off the board, so neither is a
 *  status. */
export type CardStatus = 'todo' | 'ready' | 'implementing'

/** How many options a question lets the user tick. */
export type QuestionMode = 'single' | 'multi'

/** One open question on a card.
 *
 *  A PLAIN question is text only — answered in a box. An OPTIONS question carries choices
 *  to tick instead of choices buried in a sentence. Both shapes live side by side on a
 *  card, and the `[user]` tag reads the same on either: it sits at the front of `text`. */
export interface Question {
  /** The question itself, `[user]` tag included. Split it with `parseQuestion`. */
  text: string
  /** Absent on a plain question. */
  mode?: QuestionMode
  /** Each option is one short line, with its reason inside that line. Absent or empty on a
   *  plain question. */
  options?: string[]
  /** 1-based positions into `options` — the ones a question opens already ticked.
   *  Empty means nothing is recommended, so the list opens with nothing ticked. */
  recommend?: number[]
  /** The spec agent whose section this question is about (#782). Absent on a question nobody
   *  claimed. */
  agent?: string
  /** The user chose not to answer it (#831). It stays on the card as a record and is no
   *  longer open: nothing waits on it, and no run answers, rewrites or drops it. */
  skipped?: boolean
}

/** A question with options, once `hasOptions` has said so — the three fields are there. */
export type OptionsQuestion = Question & Required<Pick<Question, 'mode' | 'options' | 'recommend'>>

/** The tag a question can carry: a judgment call only the human can make. No tag means
 *  freshly raised and not yet triaged; an answered question leaves the list entirely. */
export type QuestionTag = 'user'

/** A pointer to another card — just enough to draw a link. */
export interface CardRef {
  id: number
  title: string
}

/** The action a card can be scheduled to run once nothing is standing in its way.
 *
 *  The ones the board runs on a one-shot card without stopping for anybody: `implement`
 *  builds it, `refine` sharpens its plan, `revise` rewrites it by its notes (#1578). Resolve
 *  is not one — it waits on the user's answers, so a run nobody is watching would only sit
 *  there. */
export type ScheduledAction = 'implement' | 'refine' | 'revise'

/** What a card is waiting to do, once the last card in its way leaves the board.
 *
 *  A card holds one at a time; scheduling a second replaces the first. It is a mark, not a
 *  status — the card keeps whatever stage it was in — and it lives in the card's own
 *  frontmatter, so it survives a restart and travels with the card. */
export interface CardSchedule {
  action: ScheduledAction
  /** What the user typed when they scheduled it, handed to the run when it fires. Empty when
   *  they typed nothing. */
  notes: string
}

/** A group root's subtask, as shown on the root's page. Light meta only — clicking through
 *  opens the subtask's own page for the full card. */
export interface Subtask {
  id: number
  title: string
  todos: { total: number; done: number }
  /** The subtask's raw `blocked_by` ids, so the root page can draw the group's build
   *  order. Raw rather than the card's `openBlockers`: those are attached after this list
   *  is built, and a finished subtask has already left the group folder anyway. */
  blocked_by: number[]
  /** With `updatedAt`, what keeps a group out of the Stale column while a subtask moves. */
  status: CardStatus
  updatedAt?: string
}

/** One open card, read whole. */
/** The delivery in flight on a card, as the card page reads it: enough to hold the card's
 *  controls still, say which delivery is doing it, and offer Discard.
 *
 *  Only an ACTIVE delivery reaches a card. What one built, and how it ended, is the record
 *  under `docs/kanban/deliveries/`. */
export interface CardDelivery {
  id: string
  startedAt: number
  /** Where this delivery has got to, and what it waits on (#307). Worked out on every read
   *  from the card's open questions and the delivery's own stop, landing and commit
   *  records — never stored, so it can't go stale. */
  state: CardDeliveryState
  /** How it commits (#303): `auto` builds on a branch of its own and the board lands it,
   *  `manual` works in the user's checkout and stops after the build for their own commit,
   *  `files` makes files in the project and commits nothing (#874). */
  commitMode: 'auto' | 'manual' | 'files'
  /** The delivery this one replaced, when the card's approved requirements changed while
   *  the last one was paused (#307). It ended, and this one is building the card as it now
   *  reads. Absent on a delivery that replaced nothing. */
  supersedes?: string
  /** The run working right now, when one is. A delivery between runs — its last one
   *  failed or was cut off — has none, and still holds the card. */
  sessionId?: string
  /** Why the delivery stopped and is waiting on the user, in one plain sentence (#302).
   *  Building again is the way on. */
  waiting?: string
  /** A `files` delivery stopped on what it made (#874): tracked files it changed outside the
   *  board, or recorded output files that are missing (none recorded when empty). The card
   *  page words it in the reader's language. */
  filesStop?: { reason: 'outside' | 'output'; paths: string[] }
  /** Where this delivery's code is: its own worktree, repo-relative (#303). Absent in
   *  manual commit mode, where the code is in the project itself. */
  worktree?: string
  /** The branch it builds on, beside `worktree`. */
  branch?: string
  /** The branch its work is meant to land on — the one checked out when it started. */
  targetBranch?: string
  /** Why it is working in the project rather than a worktree of its own, when that was
   *  not what the setting asked for: no git, or no commit to fork from. */
  manualWhy?: string
  /** This delivery's worktree or branch is gone — someone removed it from underneath
   *  it — in one plain sentence. Reported, never rebuilt: a delivery that quietly forked a
   *  second worktree would build the card twice. */
  lost?: string
  /** Where this delivery stands on landing its reviewed code (#304), once review has
   *  passed it: queued for the repository's one landing slot, holding it, landed, or
   *  stopped on a conflict. */
  landing?: CardLanding
}

/** Where a delivery stands, as the card page's pill reads it (#307). The stages are the
 *  delivery record's own (`agent/pause.ts`); this file imports nothing, so they are spelled
 *  again rather than shared. */
export type CardDeliveryStage =
  | 'working'
  | 'stopped'
  | 'held'
  | 'commit'
  | 'refused'
  | 'conflict'
  | 'retry'
  | 'queued'
  | 'landing'
  | 'landed'

/** The delivery's state, as the title band draws it: the pill's words, the one line under
 *  it saying what the delivery waits on and what answers it, and whether it is waiting on
 *  the user at all. */
export interface CardDeliveryState {
  stage: CardDeliveryStage
  label: string
  line: string
  /** True while it waits on the user. There is nothing to press: what continues it is the
   *  answer, the resolve or the commit — so the card page says so, and Resolve stays live
   *  while every other held control is off. */
  paused: boolean
  /** Which sentence `line` is, and the values it names (#1377) — what the page words in the
   *  reader's language. Absent from an older `akb`, and `label` / `line` are drawn as is. */
  kind?: CardDeliveryLineKind
  branch?: string
  commit?: string
  questions?: number
  files?: string[]
  attempt?: number
  /** Seconds until the next attempt, as of the read. */
  retryIn?: number
  behind?: string
  worktree?: string
  /** The command that is the way out. */
  command?: string
  /** The reason in git's or the system's own words — drawn as is. */
  raw?: string
}

/** The sentences a delivery's line can be (`agent/pause.ts`), spelled again like the stages. */
export type CardDeliveryLineKind =
  | 'landed'
  | 'landed-nothing'
  | 'uncommitted'
  | 'stopped'
  | 'commit'
  | 'questions'
  | 'conflict-wait'
  | 'conflict'
  | 'target-moved'
  | 'queued'
  | 'landing'
  | 'worktree-gone'
  | 'no-base'
  | 'target-gone'
  | 'worktree-dirty'
  | 'interrupted'
  | 'refused'
  | 'building'
  | 'building-typed'

/** A delivery's landing, as the card page reads it (#304). The states are the delivery
 *  record's own (`agent/types.ts`); this file imports nothing, so they are spelled again
 *  rather than shared. */
export type CardLandingStatus = 'waiting' | 'landing' | 'landed' | 'conflict'

/** The card's newest FINISHED delivery, when nothing is building the card (#305). The card
 *  is normally archived in the same breath as its delivery lands, so this is the blink
 *  between the two — and, in manual commit mode, the delivery that ended on the user's own
 *  commit. It carries what the delivery block's foot names; the diff itself is read
 *  separately by `id`. */
export interface CardFinished {
  id: string
  commitMode: 'auto' | 'manual' | 'files'
  /** The squash commit it landed, when it landed one. */
  commit?: string
  /** The branch that commit is on. */
  targetBranch?: string
}

/** A delivery's landing, as the card page reads it (#304). */
export interface CardLanding {
  status: CardLandingStatus
  /** Why it is waiting, or why it stopped — one plain sentence. */
  why?: string
  /** The user's own files landing will not write over (#958), while that is what it waits
   *  on. The card page words it in the reader's language; `why` says the same in the
   *  board's. */
  wait?: { kind: 'overwrite' | 'untracked'; files: string[] }
  /** The squash commit on the target branch, once it has landed. */
  commit?: string
  /** Cards being built over the same files. A warning, never a reason to refuse. */
  overlap?: number[]
  /** The landing retry the board is working through by itself, while one is on. Absent on
   *  every other landing, and gone the moment the landing goes through. */
  retry?: CardLandingRetry
}

/** A landing the board is retrying by itself, as the delivery block's retry bar draws it.
 *  It retries without limit and without asking, so this says which attempt, what it is
 *  waiting on, and when the next one opens. */
export interface CardLandingRetry {
  /** Why it is being retried: an agent is resolving a conflict with the target branch
   *  (#595), or the target branch moved under the landing (#665). */
  kind: 'conflict' | 'moved'
  /** The attempt running now, or the one the wait is for. One-based. */
  attempt: number
  /** The files still conflicted, repo-relative — on a `conflict` retry only. */
  files?: string[]
  /** When the next attempt opens, while the board is waiting between two. Absent while an
   *  agent is working, which is exactly what tells the two apart. */
  at?: number
}

/** How far a card's creation got (#564).
 *
 *  A card appears on the board the moment `akb raw create` writes its file, while the run
 *  that called for it carries on filling in the plan. Until that run finishes successfully
 *  the card is not a card to act on — this is what says so, and it is absent on every card
 *  whose creation is complete.
 *
 *  `creating` is a creator still going; `unfinished` is one that ended any other way, and
 *  it never clears itself — the run has to be picked back up. */
export interface CardCreation {
  state: 'creating' | 'unfinished'
  /** The run that created the card — what a recovery picks back up. */
  runId: string
}

/** One place a card came from, as the card page links it (#1306). No path is ever here. */
export interface SourceLink {
  kind: 'plan' | 'triage' | 'card' | 'url'
  /** What it opens: the plan's id, the item's source id, the card's id, or the address. */
  ref: string
  /** Hover text: the plan's, item's or card's title, or the address's host. */
  title: string
  /** A card that has left the board, so the link goes to its archive page. */
  archived?: boolean
}

export interface Card {
  id: number
  /** What version of this card was read (#312). A write passes it back as the revision it
   *  expects, and a board that has moved on refuses with a conflict instead of overwriting
   *  someone else's edit. Opaque: nothing but equality may be read into it, and it is
   *  derived rather than stored, so it never reaches the card's portable frontmatter. */
  revision: string
  /** When the card was last written (ISO): the file's mtime locally, `updatedAt` on Cloud.
   *  Absent when unknown. What puts a card in the board's Stale column (#1640). */
  updatedAt?: string
  /** Path relative to `docs/kanban/todo/`, e.g. `features/07-local-kanban-ui.md`. */
  relPath: string
  title: string
  priority: string
  roi: string
  status: CardStatus
  blocked_by: number[]
  related: number[]
  /** The card's open questions, plain and options ones alike. */
  questions: Question[]
  /** The workflow this card runs through (#715) — a workflow's stable id, never its name.
   *  Empty on a card that names none and on a board that picks no workflows, and both read
   *  as the default workflow. */
  workflow: string
  /** Its workflow lands nothing (#1057, #2152): its last approval archives the card. */
  deliversIn?: 'plan'
  /** The approvals its previews make and the one it is on, 1-based (#2154). Absent when it
   *  has one. */
  stages?: number
  stage?: number
  /** The parts of the product this card touches (names from `docs/kanban/modules.md`). */
  modules: string[]
  /** The action waiting to run on this card once every card it waits on has left the board,
   *  or null on a card nobody scheduled. Only a blocked card can carry one. */
  schedule: CardSchedule | null
  /** The card body below the frontmatter (markdown). */
  body: string
  /** Where it came from. Read on the card's own page only, and absent when nothing is known
   *  or readable; when present the page leaves `## Source` out of the body. */
  sources?: SourceLink[]
  todos: { total: number; done: number }
  /** True when this card is a group root — a `<id>-<slug>/` folder holding a `root.md`.
   *  Read from that folder shape, never from the subtask count: a finished subtask's file
   *  is removed, so a group with everything done would otherwise stop reading as a group. */
  isGroup: boolean
  /** The `blocked_by` ids that still point at an open card, so this card really is blocked.
   *  An id no longer on the board was archived or rejected and blocks nothing, and the
   *  card's own id is skipped. */
  openBlockers: CardRef[]
  /** For a group root: the subtask lines in its `## Todo` (the ones carrying a `#<subid>`
   *  ref), and how many are resolved — ticked `[x]` (done) or struck `~~…~~` (rejected).
   *  The root file keeps this true after the subtask files are gone, so it is what says a
   *  group is finished. Absent on a plain card. */
  subtaskLines?: { total: number; resolved: number }
  /** For a group root: its subtasks, in id order. Only the OPEN ones — a done or rejected
   *  subtask has no file left. Absent on a plain card. */
  subtasks?: Subtask[]
  /** For a subtask nested in a group folder: a link back up to the group root. Absent on a
   *  standalone card or a root. */
  parent?: CardRef
  /** This card is not finished being created (#564): its creator is still going, or it
   *  stopped short. Absent on every ordinary card — including one created outside a run,
   *  which is complete as soon as its file exists. */
  creation?: CardCreation
  /** The delivery in flight on this card, when one is. While it is there the card is held:
   *  Edit, Refine, Resolve, Reject and Archive are off, and Discard is what takes
   *  the card back. Absent on every card nothing is building. */
  delivery?: CardDelivery
  /** A delivery of this card whose worktree is still on disk and can be thrown away
   *  (#303) — the one in flight, or the newest ended one that still holds one. The card
   *  page's **Discard** says what this would lose before it asks. */
  /** The delivery whose checkout could still be thrown away — and, when it has ended,
   *  whether it can be carried on instead (#639). */
  discard?: { id: string; worktree: string; branch?: string; active: boolean; resumable?: boolean }
  /** This card's newest delivery landed, and the card is still on the board (#307). The
   *  board archives it in the same breath, so this is normally the blink between the two —
   *  and the honest thing to show when the archive itself could not be made. `commit` is
   *  absent when the delivery passed review having changed nothing. */
  landed?: { id: string; commit?: string }
  /** This card's newest finished delivery, when nothing is building the card (#305). It is
   *  what the delivery block draws once the delivery it was drawing has ended, so its
   *  **Diff** tab still says what landed. Absent while a delivery is in flight — that one
   *  is `delivery` — and on a card whose last delivery was cancelled. */
  finished?: CardFinished
}

/** One box on setup's checklist. `owner` says who does the step: `script` is already done
 *  by the time the board exists, `agent` needs a run that reads the repo and thinks, `you`
 *  is the user's own — the three a guided first run settles, one thing to a view. */
export interface SetupStepView {
  name: string
  owner: 'script' | 'agent' | 'you'
  text: string
  done: boolean
}

/** How far setup got, read from `docs/kanban/setup-checklist.md`. Null means there is no
 *  checklist — setup is finished, or the board predates it. */
export interface SetupState {
  /** Every box, in the checklist's own order. */
  steps: SetupStepView[]
  done: number
  total: number
  /** The first unticked step — what setup does next. */
  next: SetupStepView | null
}

// ---- what a write hands back -----------------------------------------------

/** Every refusal a board write can answer with reads the same way: it did not happen, and
 *  this line says why. Never a throw — the caller is a dialog the user is still typing in. */
export interface WriteResult {
  ok: boolean
  error?: string
  /** Which of the three a refusal was (#312). `conflict` means the resource moved under the
   *  caller and NOTHING was written — the screen re-reads it and repeats the change on what
   *  it says now; anything else is a refusal that re-reading would not change. Absent on a
   *  board running rules older than the contract. */
  kind?: string
  /** On a conflict, the revision the board holds now — what the screen re-reads through. */
  current?: string
  /** The refusal's kind and the values it names (#955), for a screen that says it in its own
   *  language — one of `RunRefusalKind`. */
  reason?: string
  args?: Record<string, string>
}

/** What turning an older board's recurring cards into scheduled agents did (#1414). */
export interface RecurringMigration {
  /** The cards that became agents. */
  agents: { card: string; agent: string; workflow: string; on: boolean; cadence: string }[]
  /** The cards deleted with no agent made — "Fetch triage items". */
  removed: string[]
  /** The cards left where they were, each with why. The next pass tries them again. */
  failed: { card: string; why: string }[]
}

// ---- the project's memory --------------------------------------------------

// ---- the archive -----------------------------------------------------------
//
// The cards that left the board, in `docs/kanban/.archive` (#380) — finished or rejected. Archiving is a rename and the board
// forgets the card, so these shapes are the only way back to one that isn't a file browser.

/** One archived card, as the list draws it. */
export interface ArchivedCard {
  id: number
  title: string
  /** The day it was archived, `YYYY-MM-DD`. Empty on every card archived before the board
   *  stamped one — nothing is backfilled, so the dates fill in over time rather than at
   *  once. */
  archived: string
  /** Rejected or discarded rather than finished: filed here, never shipped. */
  rejected: boolean
  /** The path from the repo root, forward slashes. */
  relPath: string
}

/** What the archive holds. */
export interface ArchiveList {
  /** The folder, from the repo root — what the heading names. */
  relPath: string
  /** Every card in it, by id, highest first: ids are allocated in order, so that is newest
   *  first and it survives a fresh clone. Empty on a board that has archived nothing. */
  cards: ArchivedCard[]
}

// ---- the daily numbers -----------------------------------------------------

// ---- the inbox: anything that might become work (#453, #499) ---------------

/** One thing an item's source said about it (#560): the key it was written under and its
 *  value. Free key-value pairs — the board neither validates, translates nor fills them in,
 *  and the page draws the values alone. */
export interface SignalMeta {
  key: string
  value: string
}

/** One item in the inbox — something worth turning into a card, and not yet a card. */
export interface Signal {
  /** Its identity: two pulls of the same post carry the same one, and that is what every
   *  duplicate check across triage is keyed on. Derived when nothing supplies one. */
  sourceId: string
  title: string
  /** Its own words — the post, the pasted text, or what the dropped file is. */
  summary: string
  /** Which source it came from (#560): a key from the board's source list, or a key an
   *  endpoint sent that the list has not got. Empty when nothing said what it is — and an
   *  empty one is left empty rather than filled in from a domain or a file name. */
  sourceType: string
  /** Whatever else its source said about it, in the order the file writes it. */
  meta: SignalMeta[]
  /** The agent whose run added it (#1475), or absent when no run did. */
  agent?: string
  /** The workflow that does its work, as `akb triage add` named it (#2139). Absent on an older item. */
  workflow?: string
  /** The thing itself, when there is one to open. Empty otherwise. */
  url: string
  /** When it was collected, `YYYY-MM-DD HH:MM` local. What the list sorts on. */
  collectedAt: string
  /** When this board wrote it into the inbox, same form. */
  importedAt: string
  /** When it was ignored, same form, for an item read out of `triage/dismissed/`. Empty on
   *  one still waiting, and on a record migrated from a board that never wrote one. */
  dismissedAt: string
  /** Who ignored it: `user` from the page, `agent` from a run. Empty when the record does
   *  not say — a migrated one never did. */
  dismissedBy: 'user' | 'agent' | ''
  /** Why it was ignored, in the judge's own words. Empty on an ignore from before #894. */
  dismissedReason: string
  /** The card it became, on an item read out of `triage/archived/` — or out of `dismissed/`,
   *  when a card was made of it after it was ignored. Null otherwise. */
  cardId: number | null
  /** When it was archived onto that card, `YYYY-MM-DD HH:MM` local. Empty otherwise. */
  archivedAt: string
  /** False on a record carried over from the old handled list, which held a source id and a
   *  time and nothing else. The page draws such an item as the stub it is rather than as an
   *  item with an empty title. */
  contentKept: boolean
  /** What Jev judged of it (#1221), kept through every move. Empty when it was never judged. */
  verdict: TriageVerdict | ''
  /** Why, as a fixed label the page words in its own language. Empty with no verdict. */
  verdictReason: TriageReason | ''
  /** The open card it duplicates, when the reason is `duplicate` and one was named. */
  verdictCard: number | null
  /** How sure Jev was the item should be ignored, and that it is worth doing (#1356), 0 to 1.
   *  Null when it was never judged, or judged before the two were kept. */
  dropConfidence: number | null
  doConfidence: number | null
  /** The path from the repo root, forward slashes. */
  relPath: string
}

/** The four ends of a judged item (#1221). */
export type TriageVerdict = 'plan' | 'plan-without-refine' | 'skip' | 'human-review'

/** The label a verdict carries: the option it rests on, or `unsure` when neither confidence reached its line. */
export type TriageReason = 'supported' | 'rejected' | 'duplicate' | 'low-value' | 'needs-user' | 'unsure' | 'small' | 'plan' | 'no-workflow'

/** A card triage points at: its title, and whether it has left the board. */
export interface SignalCardRef {
  title: string
  archived: boolean
}

/** A setting a fetch needs and the board hasn't got, and the file it is filled in. */
export interface SignalConfigGap {
  what: 'endpoint' | 'token'
  /** The file to fill it in, from the repo root. */
  file: string
}

/** What the inbox holds. */
export interface SignalInbox {
  /** The folder, from the repo root — what the heading names. */
  relPath: string
  /** Everything waiting, newest collected first. */
  signals: Signal[]
  /** What has been ignored and is still inside the window below, newest judged first. The
   *  files are kept for good; this is only what is drawn. */
  dismissed: Signal[]
  /** What a card was made of inside the same window, newest archived first. */
  archived: Signal[]
  /** How far back History reaches, in days — what its label says. */
  dismissedDays: number
  /** The title of every card an item names as its source (`meta.source: "#706"`) or became,
   *  open or archived, by id — what a group heading and a History link are drawn with. */
  cards: Record<number, SignalCardRef>
  /** The board's source list in its own order (#560): what orders the groups, and the keys
   *  the page's icon table is keyed on. */
  sourceTypes: string[]
  /** The newest import stamp among them, or empty when the inbox is. Read off the signals,
   *  so dismissing the newest one moves it back rather than forward. */
  latestImport: string
  /** What is still to be filled in before a fetch can run. Empty when both are set. */
  missing: SignalConfigGap[]
}

/** What **Add to inbox** was handed: what was pasted, a dropped file, or both. One of the
 *  two has to carry something — an add with neither is refused. */
export interface InboxDrop {
  /** Pasted text, or a link on its own. */
  text?: string
  /** A dropped file: its name, what the browser called it, and its bytes. */
  file?: { name: string; type: string; data: Uint8Array }
  /** The item's title, when the caller knows it rather than leaving it to be read off the
   *  first line (#534) — what `akb triage add` passes. */
  title?: string
  /** And where it came from, for the same reason: a proposal names the card that prompted
   *  it. Empty or absent leaves whatever the input itself gave. */
  source?: string
  /** A short English name for the item's file (#1263). Absent, the title names it. */
  slug?: string
  /** The agent whose run is adding it (#1475). */
  agent?: string
  /** The workflow that does its work (#2139). */
  workflow?: string
}

/** What one add did. The failure carries the one sentence the page shows. */
export type InboxAddResult = { ok: true; signal: Signal } | { ok: false; error: string }

