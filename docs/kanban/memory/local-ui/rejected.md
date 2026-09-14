# Rejected

Ideas we turned down, grouped by topic. One line each: the idea, and why we said no. Read
before proposing so you don't re-suggest them.

## The board

- **A file-storage-only switch for team collaboration** — a Cloud screen must handle members,
  stale revisions, active writers and conflicts, which treating Cloud as another file location
  leaves invisible.
- **A board-location picker as the whole collaboration UI** — choosing Local or Cloud is only
  onboarding; the app must also show membership, questions, card ownership, shared memory and
  delivery recovery.
- **GitHub Projects as the team's board UI** — the shared board lives in Cloud; GitHub Issues
  supplies proposals and receives progress, never a second place a card can be changed.
- **Ready-only focus toggle**, and **muting cards you can't start yet** — the board is small
  enough to scan, and the `ready` label already says what can be started.
- **Marking the cards that hold up other work** — a "holds up 3" badge says less than the
  padlock beside it; a card's place in a chain is what a group's map is for.
- **Switching between projects from the browser UI** — a server serves the board it was
  started in.
- **Ticking several cards to move them into a release at once** — a multi-select bar builds
  the manual path we don't want.
- **Route every card read and write through the command** — listing cards and writing
  frontmatter already do, which covers what needs one owner.
- **Rendering a drawing of a screen inside an open question** — a question lives in
  frontmatter; the drawing stays in the card body.
- **Dropping the Edit button from the card page** — the chat rail is folded away by default,
  so cutting it would leave no visible way in.
- **Editing a card's title, body and links straight from the card page** — priority, ROI,
  release and cadence are settings; the rest is the spec a flow wrote and a human approved.
- **Writing a new hand-check on the card page** — hand-checks come from the spec; a box for
  typing your own turns a spec line into hand-entered data. Crossing one off stays.
- **Putting a specialist agent on a card from the card page** — the board asks for one itself
  while planning, and asking by hand is too rare to buy a control per card.
- **Working the board from the keyboard** — a shortcut set, its dispatcher and a panel listing
  it would cost more than the mouse trips they save.
- **A `#` card picker over the chat box** — pointing at a card is already typing `#12`, and a
  list with its keyboard mode is UI bought for a string the user can type.
- **Serving the board to a phone from the user's own machine** — Cloud's URL and sign-in reach
  a phone from anywhere and work while the machine is asleep; the cost we accepted is that a
  user who never turns Cloud on has no phone access.
- **Kanbo, a desktop pet that speaks the board's notifications** — the system notification
  center already delivers the same alerts and gets out of the way after.
- **Laying a card's screens out side by side on a canvas** — it trades scrolling for panning
  and zooming, and pays a fixed-height viewport and a gesture layer over the iframes for it.

## Runs

- **Human-in-the-loop / mid-run reply to the agent** — the agent raises open questions on the
  card; watching a run is a read-only tail of its log.
- **A follow-up prompt box on any finished run** — Resume covers the real need with no typing,
  and a prompt box is the first step toward a full chat inside the board.
- **Per-card run history list** — the most recent run's log surviving a restart is enough, and
  the runs panel covers browsing.
- **A plain-words reason beside a failed run** — the only reason on offer is the tail of the
  agent's own output, which the log already shows.
- **Clicking a run id in a chat reply to open its log** — saves one click and costs link rules
  for which id-shaped words count.
- **A read-only view of everything uncommitted in the folder a run worked in** — it could never
  say "this run changed these files"; the card's diff replaced it.
- **A switch that lets the board start building a ready card by itself** — anything that starts
  cards without a click needs limits on concurrent runs, card count and spend first.
- **Handing a whole group's subtask graph to one long unattended run** — one run implements one
  approved version of one card, and is reviewed and landed as that card.

## Connectors

- **A Gemini CLI connector** — not an agent we want to reach; anything past the ones we ship
  waits for users to ask.
- **A pi connector** — it streams and resumes, but it never asks permission and nothing holds a
  run to the project, so picking it would hand a run the whole machine.
- **Offering a list of model ids in the Model field** — a list we keep goes stale, and offering
  only the ids already used is empty on a fresh board, the one moment it would help.
- **A login line in the agent dialog** — the board does not set a harness up; Test says whether
  it connected.

## Setup

- **An "I'll drive this board from my own coding agent" answer** — the board always has an agent
  to run, so "none of them" was never a state it could hold.
- **Requiring a git repo before a folder becomes a project** — builds there already fall back to
  manual mode and say why, so refusing at the front door shuts AI4Kanban out of every project
  that is not under git.

## Feedback

- **A lasting list of shared feedback numbers in Settings** — the feedback path is a side
  channel, not a product surface; a machine-level append log plus a Settings entry with its own
  count, empty state and unreadable state is more than it earns.
- **A details dialog for the install id in Privacy settings** — reading the id is a rare,
  one-off need already served by `akb telemetry status`; a copy button, an empty state, a
  reset warning and a deletion walkthrough over-build a side channel the settings pane only
  has to switch on and off.
