# Redesign

Design mistakes to avoid when writing a card, grouped by topic. One entry each: the
mistake, then the design we actually want. Read before writing or reviewing a card.

## What the UI does

- ❌ **Make Slack the only place to inspect and test notification messages** → ✅ prove the
  complete event, message, and action flow in a desktop notification center first, then let
  external connectors reuse it.
- ❌ **Name a local publisher without saying which process owns it** → ✅ ship one shared
  publisher module in the desktop board server and `akb`, beside every process that can
  commit an actionable board write.
- ❌ **Route the app's own control through the network so every surface shares one path**
  (Implement on the card page in front of you records a Cloud action and waits for the board's
  server) → ✅ a control on the machine that holds the board acts at once; the act is recorded
  and pushed out afterwards, and the remote surfaces showing it are redrawn as already answered.
  Uniformity is not worth making the local case wait on the remote one.

- ❌ **UI lets people hand-edit the board** (toggle todos, write cards, move, mark done) →
  ✅ the UI spawns agent runs to do the kanban work; on-card buttons call the agent
  connector. Only priority/roi and a title/body edit are direct.
- ❌ **A control is hidden when the thing it drives doesn't exist yet** (no releases → no
  release dropdown, so the UI never says releases exist and gives no way to make one) →
  ✅ the empty state is where the UI teaches the feature: keep the control and let it offer
  the first step. A user who only ever opens the UI must be able to find a feature the
  script has.
- ❌ **A board action stays terminal-only because it feels rare or administrative** → ✅ the
  UI offers what the script offers, with the consequences shown before the user confirms.
- ❌ **A control is kept alive for its leftover cases after the thing it served is
  replaced** (a guided first run takes over setup, and the old setup card stays on for a
  setup left halfway and a goal gone weak) → ✅ send each leftover case where it belongs —
  resuming setup reopens the flow, and asking for a goal is not asking for setup — then
  take the control away. A surface kept for scraps is a second way to do the same thing.
- ❌ **Setup reports itself finished while the board still can't run anything** (every box
  ticked, no agent and no key ever asked for) → ✅ whatever the board needs to do its first
  piece of work is a step of setup, and setup doesn't end until it is answered.
- ❌ **One control changes meaning with a field above it** (the same switch is "fill from
  the goal" or "put the high-priority cards in", depending on whether a box has words) →
  ✅ two modes get two tabs that name them, and each tab shows only its own fields. A
  control the user has to look elsewhere to read is worse than the extra control it saved.

- ❌ **A feature the board can do on its own also gets a "run it on this thing" button**
  (a spec agents panel that asks which card, plus the same button on every card page) →
  ✅ an automatic feature is switched on or off, never aimed by hand: the flow working the
  card picks the agent it needs, and the UI's job is to list what exists and let the user
  turn one off. A per-card trigger makes the user do the deciding, every card.

## Runs

- ❌ **A run's log is a moment** (in memory only, or visible while the run is live and gone
  after it) → ✅ the log is a place: every run's full output is written to a gitignored
  file, the card keeps its most recent run openable after a restart, and one global runs
  panel in the header browses all of them, live and past. Keep 30.
- ❌ **A run's result waits in a new review state the user has to accept or discard**
  (with a file to hold it, and rules for when it expires) → ✅ a run changes the board when
  it finishes and the user reads the log. An approval step is a new notion to learn and a
  new state to keep alive across restarts, for a question the user often can't answer.
- ❌ **A run the server starts on the side is invisible to the tab that asked for it** (the
  board jumps to the new release and shows it empty, the runs panel notices it seconds
  later on an idle poll, and nothing refreshes when it ends) → ✅ a run a click starts is
  that tab's own run: it is in the runs panel at once, the thing it works on says it is
  running, and the board re-reads itself when it finishes.
- ❌ **Infer which cards became unblocked after every run** → ✅ a rough card saves a one-shot
  refine when it first becomes blocked. While it waits the Refine button is replaced by the
  saved schedule and its cancel control; cancelling brings the button back for that episode.
- ❌ **Waiting for a blocker is built for one action** (a Schedule button that always means
  implement) → ✅ scheduling is a modifier on an action, never an action itself: every run
  a blocked card offers — implement, refine — can be scheduled instead of forced through
  an "anyway".
- ❌ **One word — "run" — names both the whole job and each agent invocation inside it**
  (a "delivery run" made of "sessions", so a card's lifecycle and one step of it read the
  same) → ✅ give each level its own word: **delivery** is the tracked lifecycle one
  **Implement** click starts, **session** is one agent invocation, **commit** is what
  lands. "Run" stays a verb — run a check.
- ❌ **A card edited mid-delivery retires the delivery** (hash the approved requirements, compare
  before each step, stop and offer Implement again) → ✅ deliver the card as it was approved, from
  a snapshot taken at the start, and keep the card from changing under it: Edit, Refine, Resolve,
  Reject and Archive are off while a delivery is in flight, and **Discard** is the one way
  to take the card back. Throwing away a build because someone fixed a typo is a punishment, not a
  safeguard.
- ❌ **Two controls that end the same thing stand side by side, told apart only by their
  names** (Stop run and Cancel delivery in one strip, both wearing an ✕) → ✅ ask one
  question at a time: while a run is live, the only control is Stop run; once nothing is
  running, Resume and Discard take its place. Two ways to end something in one row are read
  as one, and a shared glyph settles it.
- ❌ **A control is named after a noun the page never says anywhere else** (Cancel
  *delivery*, on a page where the word appears in no heading, pill or label) → ✅ name the
  control after what it does — **Discard** — rather than teaching the page a noun to carry
  it. A caption added to hold up a name is a second thing to read, not a fix.
- ❌ **A line of prose restates a mark right above it** (an IN PROGRESS pill, then
  "Building this card as it was approved when work started") → ✅ say it once, in the
  smallest mark that can carry it. Prose earns its place by saying what the reader has to
  act on — what a delivery waits on, and what answers it.
- ❌ **Two controls differ only in what they leave on disk** (Cancel ends the delivery and
  keeps its worktree; Discard removes it, so the tidy way out is two clicks and two
  confirmations) → ✅ one control does the whole thing, and its confirmation names what will
  be lost. The salvage path stays in the terminal, where someone who wants the branch
  already is.

## Settings

- ❌ **A new settings section is named by adding a qualifier to a section that already
  exists** (an Agent section for the coding tool, a Spec agents section beside it) → ✅ two
  sections get two names that stand apart — Harness and Agents. A reader should not have to
  hold a qualifier in mind to tell two entries of the same sidebar apart.
- ❌ **A new global setting gets its own labeled control in the header** → ✅ one
  configuration (gear) icon that opens a single Configuration dialog; global settings live
  inside it, so the header stays quiet instead of growing a control per setting.
- ❌ **A new settings-file shape to hold a new setting** (a map keyed by the picked thing's
  name, plus a migration and a "no longer in effect" notice) → ✅ a new setting is one more
  key in the block that already exists, and a file written before the card keeps working
  untouched. Only reshape the file when a user really loses something today.
- ❌ **A dialog's fields are seeded once, from the page's first load** (a setting saved a
  moment ago reads back empty next time it opens) → ✅ a settings dialog shows what the
  file holds every time it opens, with no page reload.
- ❌ **A background sweep with its own on/off switch, for work a run already causes**
  (a timer walking the backlog for cards to refine, behind an Auto-refine switch) → ✅ work
  follows the run that caused it: a run that touches a card starts the next step on that
  card. No sweep, so no switch to turn the sweep off — and the frugality rules the sweep
  needed (skip the blocked cards, cap how many at once) go with it.
- ❌ **A board-wide setting ships with a per-card override beside it** (a `critical` mark that
  forces diff approval whatever the setting says) → ✅ ship the setting alone until a card really
  has to differ from its board. The override costs a field, a flag, a control and a chip while
  switching on nothing the setting cannot, and a mark with no rule for when to set it gets set by
  mood until it means nothing.
- ❌ **Say whether a setup can run by checking its pieces up front** (is the CLI installed,
  is it logged in, is the key set) → ✅ one **Test** button that really runs the thing once
  and shows what came back. A real run answers what a checklist can't see — a revoked key,
  a gateway that refuses this model.

## Keys

- ❌ **The board holds no secret, so a key comes from whatever the user exported before
  starting the server** (a shell profile, a wrapper script, a different place per machine)
  → ✅ one fixed file the board owns, `docs/kanban/.env`, kept out of git. `ui.config.json`
  is checked in and never holds a key.
- ❌ **Send a key out under every variable the agent might read, so it works whichever one
  the other end wants** → ✅ one auth variable per run, the one the picked provider names.
  A second one isn't a harmless spare: an agent reads it as another login and changes what
  it does — Claude Code turns the user's claude.ai connectors off the moment
  `ANTHROPIC_API_KEY` is set.

## The header

- ❌ **Put a long file on the board as one summarized line** (a headline stripped out of
  `goal.md`, truncated to fit a row) → ✅ a file the user wrote in full is opened in full,
  from a control that costs no space. A one-line squeeze drops the part worth rereading and
  takes a row from every board, every day.
- ❌ **A read-only reference control joins the header's action cluster on the right** → ✅ it
  goes on the left, beside the board's name and folder path, with no border, no shadow,
  icon only. The left of the header says what this board is; the right is what you do.

## Insights

- ❌ **Planning scores live only in CLI output or release text** → ✅ chart them beside
  Daily progress in the same header dialog, one full-width chart each.
- ❌ **Two unrelated charts stacked in one scrolling dialog** → ✅ a tab each. Stacking made
  the reader scroll past the chart they didn't ask for, and forced a title — "Progress" — that
  only described one of them.

## Recurring tasks

- ❌ **A recurring-task feature that only adds a Run button** → ✅ say how runs start without
  a click: the server's dispatcher runs due cards on a card-set cadence — scheduling is the
  server's job, never an in-session loop like Claude Code's `/loop`.
- ❌ **A schedule is a pick from a few named options** (daily / weekly / monthly) → ✅ a
  number and a unit, down to the minute, plus an optional time of day — `30m`, `6h`,
  `1d at 09:30`. Real jobs don't fall into three buckets: a health check wants minutes and
  a report wants a fixed hour.

## Shipping the desktop app

- ❌ **A gesture ships behind a system setting the user has to go turn on** (the app hears
  only the old three-finger swipe, so on a Mac as it comes the swipe does nothing, and the
  README asks the user to change System Settings) → ✅ a gesture people already make in
  their browser has to work in the app with no setup at all. If the toolkit only offers
  the old path, that's a reason to keep looking, not a reason to ask the user.
- ❌ **A release waits on a paid developer account** (Apple's $99 program, days to approve)
  → ✅ ship unsigned and write down the clicks that get past the warning. A signature is a
  follow-up card, never a gate on the release.
- ❌ **A password dialog on every machine** (copy Cursor to the letter: every install
  writes `/usr/local/bin` and raises the administrator dialog) → ✅ keep Cursor's shape — a
  symlink to a launcher inside the app — but write it into a user-owned bin folder the PATH
  already reads (`~/.local/bin`, then `~/bin`) with no password, and keep `/usr/local/bin`
  and its dialog only as the fallback. Never edit a shell startup file to make a folder
  qualify.
- ❌ **A dialog before a write that needs no privilege** (offer the no-password install and
  wait for a press) → ✅ when nothing has to be asked for, do it and say where it went;
  a dialog is only earned by the password it warns about.
