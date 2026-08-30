// The board as a reader sees it — every shape a front end draws.
//
// This file is pure types and constants, and it imports nothing. That is what lets it be
// copied straight into the board UI (`scripts/sync-format.mjs` → `kanban-ui/lib/format/
// view/types.ts`), so the browser can name what the server hands it without a second,
// hand-kept copy of the same shapes drifting out of step.
//
// Where a shape here overlaps one the writing side uses, this is the one that travels: the
// writers read a card's `Meta` (../types.ts), readers read a `Card`.

/** How a card ranks. Unranked (empty or unknown) sorts after all of these. */
export type Level = 'high' | 'med' | 'low'

/** A card with no release — wanted, but not promised to a version. The empty string IS
 *  that state; there is no sentinel name for it. */
export const NO_RELEASE = ''

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
 *  The two the board runs on a one-shot card without stopping for anybody: `implement`
 *  builds it, `refine` sharpens its plan. Resolve is not one — it waits on the user's
 *  answers, so a run nobody is watching would only sit there — and a recurring card's Run is
 *  not either, since a recurring card is never blocked and its cadence is already its
 *  schedule. */
export type ScheduledAction = 'implement' | 'refine'

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
  track: string
  /** The release this subtask ships in. A subtask carries its own — the root is a tracking
   *  card — and no column ever draws a subtask, so this is what lets a root stand in for a
   *  group under a picked release. */
  release: string
  todos: { total: number; done: number }
  /** The subtask's raw `blocked_by` ids, so the root page can draw the group's build
   *  order. Raw rather than the card's `openBlockers`: those are attached after this list
   *  is built, and a finished subtask has already left the group folder anyway. */
  blocked_by: number[]
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
   *  from the card's open questions and the delivery's own review, landing and commit
   *  records — never stored, so it can't go stale. */
  state: CardDeliveryState
  /** How it commits (#303): `auto` builds on a branch of its own and the board lands it,
   *  `manual` works in the user's checkout and stops after review for their own commit. */
  commitMode: 'auto' | 'manual'
  /** The delivery this one replaced, when the card's approved requirements changed while
   *  the last one was paused (#307). It ended, and this one is building the card as it now
   *  reads. Absent on a delivery that replaced nothing. */
  supersedes?: string
  /** The run working right now, when one is. A delivery between runs — its last one
   *  failed or was cut off — has none, and still holds the card. */
  sessionId?: string
  /** Why the delivery's review stopped and is waiting on the user, in one plain sentence
   *  (#302). It has put an open question on this card, so the card page says so and lets
   *  Resolve through the hold — answering is the way on. */
  waiting?: string
  /** The run the delivery is due to start next and has not (#302). It is normally
   *  gone in the same instant the watcher takes it; one that is still here belongs to a
   *  delivery whose watcher died in between, and the card page offers to start it. */
  next?: 'review'
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
  /** Whether this delivery has to be approved before it lands, and what an approval covers
   *  (#308). Absent on a delivery that needs none, and then the block has no **Approval**
   *  tab. */
  approval?: CardApproval
}

/** A delivery's diff approval, as the card page's **Approval** tab draws it (#308). */
export interface CardApproval {
  /** This delivery may not land until the user approves the tree. Frozen when it started. */
  required: boolean
  /** An approval stands and still covers what would land. */
  approved: boolean
  /** What an approval covers, or what the standing one covered: the base commit and the
   *  candidate's fingerprint, in one line. */
  covers: string
  /** Why the last approval stopped counting — the base moved, or the tree did. Absent until
   *  one has been cancelled. */
  cancelled?: string
}

/** Where a delivery stands, as the card page's pill reads it (#307). The stages are the
 *  delivery record's own (`agent/pause.ts`); this file imports nothing, so they are spelled
 *  again rather than shared. */
export type CardDeliveryStage =
  | 'working'
  | 'stopped'
  | 'held'
  | 'approval'
  | 'commit'
  | 'rereview'
  | 'refused'
  | 'queued'
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
}

/** A delivery's landing, as the card page reads it (#304). The states are the delivery
 *  record's own (`agent/types.ts`); this file imports nothing, so they are spelled again
 *  rather than shared. */
export type CardLandingStatus = 'waiting' | 'landing' | 'landed' | 'conflict'

/** What one delivery changed, as the card page's **Diff** tab draws it (#305).
 *
 *  Two things are being shown under one shape: while a delivery builds, its branch against
 *  the base it forked from; once it has landed, the squash commit against the tip it landed
 *  onto. The tab appears only when there is one of these to show. */
export interface DeliveryDiff {
  /** The delivery this is the diff of. */
  id: string
  /** Files changed, insertions and deletions — one line, always drawn first. Empty when
   *  `note` says why there is nothing. */
  stat: string
  /** The diff itself, in git's own format. Empty beside a `note`. */
  diff: string
  /** `diff` is cut short — `whole` is the command that prints all of it. */
  truncated?: boolean
  whole?: string
  /** Manual commit mode: this is the working tree, and nothing has been committed yet. */
  uncommitted?: boolean
  /** A case the view cannot show, in one plain line: no git, a worktree someone removed, a
   *  commit that is no longer there. */
  note?: string
}

/** The card's newest FINISHED delivery, when nothing is building the card (#305). The card
 *  is normally archived in the same breath as its delivery lands, so this is the blink
 *  between the two — and, in manual commit mode, the delivery that ended on the user's own
 *  commit. It carries what the delivery block's foot names; the diff itself is read
 *  separately by `id`. */
export interface CardFinished {
  id: string
  commitMode: 'auto' | 'manual'
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
  /** The squash commit on the target branch, once it has landed. */
  commit?: string
  /** Cards being built over the same files. A warning, never a reason to refuse. */
  overlap?: number[]
}

export interface Card {
  id: number
  /** What version of this card was read (#312). A write passes it back as the revision it
   *  expects, and a board that has moved on refuses with a conflict instead of overwriting
   *  someone else's edit. Opaque: nothing but equality may be read into it, and it is
   *  derived rather than stored, so it never reaches the card's portable frontmatter. */
  revision: string
  /** Path relative to `docs/kanban/todo/`, e.g. `features/07-local-kanban-ui.md`. */
  relPath: string
  title: string
  track: string
  priority: string
  roi: string
  status: CardStatus
  /** The release this card ships in — a free-text version id like `v1`, or empty for a
   *  card in no release: wanted, not promised to a version. */
  release: string
  blocked_by: number[]
  related: number[]
  /** The card's open questions, plain and options ones alike. */
  questions: Question[]
  /** What the user should check by hand before accepting the finished work — one short line
   *  each, left by the build. A note to read, not a question: nothing here waits on an
   *  answer, and nothing here holds the card back. Empty on most cards. */
  verify: string[]
  /** The parts of the product this card touches (names from `docs/kanban/modules.md`). */
  modules: string[]
  /** When this card last ran, as `YYYY-MM-DD HH:MM` — recurring cards only, and only once
   *  one has run. Empty means never run. */
  last_run: string
  /** How often this card repeats — `30m`, `6h`, `1d at 09:30`. Recurring cards only, and
   *  optional there: empty means the card runs only when someone asks for it. */
  cadence: string
  /** The action waiting to run on this card once every card it waits on has left the board,
   *  or null on a card nobody scheduled. Only a blocked card can carry one. */
  schedule: CardSchedule | null
  /** The card body below the frontmatter (markdown). */
  body: string
  todos: { total: number; done: number }
  /** True when this card is a group root — a `<id>-<slug>/` folder holding a `root.md`.
   *  Read from that folder shape, never from the subtask count: a finished subtask's file
   *  is removed, so a group with everything done would otherwise stop reading as a group. */
  isGroup: boolean
  /** True when this card is a recurring job — it lives under `todo/recurring/`, a reserved
   *  folder whose cards repeat on a cadence instead of being built once. */
  recurring: boolean
  /** When this card comes round again, ready to print: a `YYYY-MM-DD HH:MM` stamp, or "Due
   *  now" when the wait is already over. Empty on a card with no cadence and on every
   *  one-shot card. Worked out on the server, whose clock the schedule runs on. */
  nextRun: string
  /** The `blocked_by` ids that still point at an open card, so this card really is blocked.
   *  An id no longer on the board was archived or rejected and blocks nothing; a recurring
   *  card never closes, so it is skipped too, as is the card's own id. */
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
  /** The delivery in flight on this card, when one is. While it is there the card is held:
   *  Edit, Refine, Resolve, Reject and Archive are off, and Discard is what takes
   *  the card back. Absent on every card nothing is building. */
  delivery?: CardDelivery
  /** A delivery of this card whose worktree is still on disk and can be thrown away
   *  (#303) — the one in flight, or the newest ended one that still holds one. The card
   *  page's **Discard** says what this would lose before it asks. */
  discard?: { id: string; worktree: string; branch?: string; active: boolean }
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

/** What an Implement click would do on this board right now, as the Implement dialog says
 *  it (#307). It belongs to the project rather than to any card: the branch is whichever one
 *  is checked out at the moment of the click. It answers BOTH sides at once (#346) — what a
 *  build with its own worktree would do, and what one without would — so the dialog's tick
 *  rewrites its own sentence without asking the board again. */
export interface DeliveryPlan {
  /** The branch a build with its own worktree would land on. Absent when none is possible. */
  branch?: string
  /** Which side the dialog's tick starts on: `auto` when the repository allows automatic Git
   *  commits and a worktree is possible, `manual` otherwise. */
  commitMode: 'auto' | 'manual'
  /** Why this build can have no worktree — no git, no commit to fork from, or a detached
   *  HEAD. Absent whenever one is possible, including when the setting is what chose manual. */
  manualWhy?: string
  /** A build with its own worktree waits for the user to approve the tree before it lands
   *  (#308). Read from the setting alone, so it holds whichever side the tick picks. */
  needsApproval?: boolean
  /** Whether the dialog may offer the tick at all (#346): false where no worktree is
   *  possible. Absent on rules older than the choice, and the dialog then offers no box and
   *  says only what `commitMode` alone always said. */
  canChooseWorktree?: boolean
}

export interface Column {
  /** Track folder name, or `blockers`. */
  track: string
  /** Heading to show above the column ("Blockers", or the track name). */
  title: string
  cards: Card[]
}

export interface ArchiveGroup {
  /** The topic heading from `archive.md` (e.g. "Skill", "Board format"). */
  category: string
  /** Raw markdown of the entries under that heading. */
  markdown: string
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

/** The steps a guided first run asks for itself, in the order it asks them — the user's
 *  own, in the checklist's names. The agent comes first (#280): the run talks its way
 *  through the other two, and nothing may be spent on an agent nobody chose. A board whose
 *  checklist predates these names simply has fewer of them. */
export const GUIDED_STEPS = ['agent', 'project', 'goal'] as const

/** The boxes that say the first run is over. The goal is not among them — it can be left
 *  for later, and a run that reopened on it would make "later" mean nothing. */
export const FIRST_RUN_DONE = ['agent', 'project'] as const

/** One track as the first-run flow shows it: the folder's name, and the plain line saying
 *  what belongs in it. `was` is the folder this row came from, which is what makes renaming
 *  a track a rename rather than "one gone, another arrived". */
export interface TrackDraft {
  name: string
  note: string
  was?: string
}

/** What a guided first run opens with — the board's own answers as they stand, so every
 *  screen starts on something sensible rather than an empty box. */
export interface SetupDraft {
  /** The project's name and the one line saying what it is, from `docs/kanban/config.md`.
   *  The name falls back to the repo's folder name; the line to empty. */
  project: { name: string; description: string }
  /** The tracks work falls into — the folders under `docs/kanban/todo/`, with whatever the
   *  config says each is for. */
  tracks: TrackDraft[]
  /** The tracks that already hold cards, so the flow can refuse to drop one out from under
   *  the work in it. */
  usedTracks: string[]
  /** The goal as it stands, for the flow's goal box (empty on a fresh board). */
  goal: string
}

/** Everything one board read hands back. */
export interface Board {
  columns: Column[]
  archive: ArchiveGroup[]
  /** Ids of every open card, subtasks included — used to linkify only the `#<id>`s that
   *  still exist. */
  openIds: number[]
  /** The open releases from `docs/kanban/releases.md`, in ship order. Empty on a board that
   *  plans no versions — then nothing about releases is drawn at all. */
  releases: string[]
  /** What each release is for, keyed by version id — the goal on its line in
   *  `releases.md`. A release with no goal is absent, not an empty string. */
  releaseGoals: Record<string, string>
  /** How many open cards name each release, keyed by version id, with the empty key for the
   *  cards in no release. Counted over every open card — subtasks answer for themselves —
   *  so it is the number `release list` prints. A release with nothing open is absent. */
  releaseCounts: Record<string, number>
  /** True when the board should ask for a goal: `memory/goal.md` is missing or empty, or
   *  the agent judged what's in it `weak`. */
  goalNeedsWork: boolean
  /** True when `memory/goal.md` holds the user's own words, so a goal button has something
   *  to open. */
  goalWritten: boolean
  /** The modules the memory panel offers, in the map's order (#130). Empty on a board whose
   *  map names none — then the panel is the project's four files and nothing else. */
  memoryModules: MemoryModule[]
  /** Setup's checklist while it exists, null once setup deleted it. */
  setup: SetupState | null
}

// ---- what a write hands back -----------------------------------------------

/** Every refusal a board write can answer with reads the same way: it did not happen, and
 *  this line says why. Never a throw — the caller is a dialog the user is still typing in. */
export interface WriteResult {
  ok: boolean
  error?: string
}

/** The fields a direct edit may write. Everything else about a card (track, id, links,
 *  questions) stays with the agents and the commands. */
export interface CardPatch {
  title?: string
  body?: string
  priority?: string
  roi?: string
  /** A version id from `releases.md`, or empty to take the card out of a release. */
  release?: string
  /** How often a recurring card repeats, or empty to take the cadence off and leave the
   *  card running only when someone asks. Recurring cards only. */
  cadence?: string
}

/** One hand-check added or crossed off. `verify` is the card's list as it now stands, so
 *  the panel redraws from the card rather than from what the screen had — a cross-off
 *  refused because a run had already taken that line off still carries it. */
export interface VerifyResult extends WriteResult {
  verify?: string[]
}

/** One bulk release move. `failed` names the cards that did not move and why, so a bar can
 *  say so while the rest go through. `error` is the whole move refused before anything was
 *  written — then nothing was touched at all. */
export interface BulkReleaseResult {
  moved: number
  failed: { id: number; error: string }[]
  error?: string
}

/** What a save of the project and its tracks did: the tracks it made, the ones it renamed,
 *  and the ones it left alone because they hold cards. */
export interface SaveProjectResult extends WriteResult {
  added?: string[]
  renamed?: { from: string; to: string }[]
  keptBecauseUsed?: string[]
}

/** A card named in a release plan. */
export interface PlanCard {
  id: number
  title: string
}

/** A card a close would send back. `done` means every todo is ticked but it was never
 *  archived — such a card counts as not shipped, and a closed release can't be reopened to
 *  fix that, so the confirm names it while archiving it first is still possible. */
export interface ClosePlanCard extends PlanCard {
  done: boolean
}

export interface ClosePlan {
  /** The open cards whose release the close clears, in id order. */
  left: ClosePlanCard[]
  /** How many archived cards the close would write down as shipped. */
  shipped: number
}

export interface DropPlan {
  /** The archived cards that stay archived under this release, in id order. */
  archived: PlanCard[]
  /** The open cards whose release the drop clears, in id order. */
  left: PlanCard[]
}

/** A high-priority card the fill leaves out, with the test it failed. */
export interface FillSkip extends PlanCard {
  reason: string
}

export interface FillPlan {
  /** The cards a fill would move, in id order. */
  fill: PlanCard[]
  /** The high-priority cards it would leave, each with why. */
  skipped: FillSkip[]
}

// ---- the project's memory --------------------------------------------------

/** Which of the four memory files. The name is also the file's own, without `.md`, and the
 *  word an address carries — `/memory/decisions`. */
export type MemoryName = 'readme' | 'decisions' | 'redesign' | 'rejected'

/** One of the four, named as a reader meets it. `label` is what a row and a heading say:
 *  the file is called `decisions.md`, but a page headed that reads as a different thing. */
export interface MemoryRef {
  name: MemoryName
  label: string
}

/** The four, in the order they are listed — what shipped, what was settled, what to avoid,
 *  what was turned down. Shipped work leads because it is the one a reader wants oftenest;
 *  the two the agent writes against sit in the middle, and rejected ideas close. */
export const MEMORY_FILES: readonly MemoryRef[] = [
  { name: 'readme', label: 'What shipped' },
  { name: 'decisions', label: 'Settled decisions' },
  { name: 'redesign', label: 'Design mistakes' },
  { name: 'rejected', label: 'Rejected ideas' },
]

/** One module the memory panel can open — a name from `docs/kanban/modules.md`, in the
 *  order the map lists it. A module the map doesn't name is not one of these, whatever is
 *  in the memory folder. */
export interface MemoryModule {
  name: string
  /** True once `docs/kanban/memory/<name>/` exists. False means nothing has been remembered
   *  about this module yet, and its four rows would all lead nowhere. */
  hasMemory: boolean
}

/** One memory file, whole. A file nobody has written keeps its place with an empty `text`
 *  and `written: false`, so the four rows never change shape from one board to the next. */
export interface MemoryFile extends MemoryRef {
  /** The module whose set this file belongs to, or empty for the project's own copy. */
  module: string
  /** The full path on disk — what "Copy path" copies. */
  path: string
  /** The path from the repo root, forward slashes — what "Copy relative path" copies, and
   *  the form pasted to an agent working in that repo. */
  relPath: string
  /** The file as it stands, frontmatter and all. Empty when there is nothing to read. */
  text: string
  written: boolean
}

// ---- the daily numbers -----------------------------------------------------

/** How many days a progress view covers, ending today. */
export const METRICS_WINDOW_DAYS = 30

/** One day in the window. `date` is `YYYY-MM-DD`, UTC — the stamp the board writes. A day
 *  the file doesn't mention is filled in with zeros, so every day has a point. */
export interface MetricsDay {
  date: string
  completed: number
  created: number
  rejected: number
}

export interface MetricsView {
  days: MetricsDay[]
  totals: { completed: number; created: number; rejected: number }
  /** True when the board has no numbers at all — no file, or a header alone. A file whose
   *  rows all fall outside the window is NOT empty: a board that went quiet is real
   *  progress, and shows a chart flat at zero. */
  empty: boolean
}

/** What one metrics read gives back. The two outcomes are kept apart on purpose, so a view
 *  can't fall back to the "no activity" note on a failure. */
export type MetricsResult = { ok: true; view: MetricsView } | { ok: false; error: string }

// ---- the planning scores ---------------------------------------------------

/** The three numbers the board scores its own planning by (#222). */
export const SCORE_SERIES = ['details', 'decisions', 'proposals'] as const
export type ScoreSeriesKey = (typeof SCORE_SERIES)[number]

/** One of the two counts a percentage came from, named for the readout. */
export interface ScoreCount {
  label: string
  value: number
}

/** One series in one window. `percent` is null below the evidence floor — a series with too
 *  little evidence has no point at all, and a zero there would read as a score of nothing. */
export interface ScoreSeries {
  key: ScoreSeriesKey
  /** what the series is called wherever it is drawn or read out */
  label: string
  /** 0–100, rounded to a whole number; null below the floor */
  percent: number | null
  /** the two counts the formula divides, in the order they are read out */
  counts: [ScoreCount, ScoreCount]
  /** the sum of those counts — the evidence this window holds for the series */
  evidence: number
  /** how much evidence the series needs before it is drawn */
  floor: number
  /** the cards that contributed, in id order, each named once however often it contributed */
  cards: number[]
}

/** One release's window: the record lines between its own boundary and the one before it. */
export interface ScoreWindow {
  /** the release this window scores; the open window carries the release being planned now */
  release: string
  /** true for the one window that has not been closed yet, whose score still moves */
  open: boolean
  series: ScoreSeries[]
}

export interface ScoreView {
  /** every closed release in close order, then the current open window — always last */
  windows: ScoreWindow[]
  /** True when the record holds no lines at all. A board with lines but no closed release
   *  is NOT empty: it has one open window, which is a real reading. */
  empty: boolean
}

/** What one score read gives back. Kept apart from the metrics result for the same reason
 *  it is there: a failure must not fall through to the "no evidence yet" note. */
export type ScoreResult = { ok: true; view: ScoreView } | { ok: false; error: string }
