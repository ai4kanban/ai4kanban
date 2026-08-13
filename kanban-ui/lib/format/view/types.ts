// Copied from cli/src/lib/view/types.ts by scripts/sync-format.mjs — do not edit here.
// Edit the original and re-run `node scripts/sync-format.mjs`.

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
  /** 1-based positions into `options` — the ones a resolve dialog opens already ticked.
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
}

/** One open card, read whole. */
export interface Card {
  id: number
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
  /** The parts of the product this card touches (names from `docs/kanban/modules.md`). */
  modules: string[]
  /** When this card last ran, as `YYYY-MM-DD HH:MM` — recurring cards only, and only once
   *  one has run. Empty means never run. */
  last_run: string
  /** How often this card repeats — `30m`, `6h`, `1d at 09:30`. Recurring cards only, and
   *  optional there: empty means the card runs only when someone asks for it. */
  cadence: string
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
 *  is the user's own — the three a guided first run asks for, one screen at a time. */
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
 *  own, in the checklist's names. The last one is what says the flow is over: it can't be
 *  skipped, so a board that got past it has been through the whole run. A board whose
 *  checklist predates these names simply has fewer of them. */
export const GUIDED_STEPS = ['project', 'goal', 'agent'] as const

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
