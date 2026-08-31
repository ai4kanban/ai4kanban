# Rejected

Ideas we turned down, grouped by topic. One line each: the idea, and why we said no. Read
before proposing so you don't re-suggest them.

## The board

- **A file-storage-only switch for team collaboration** — a Cloud screen must handle
  members, stale revisions, active writers and conflicts; treating Cloud as another file
  location leaves those states invisible.
- **A board-location picker as the whole collaboration UI** — choosing Local or Cloud is
  only onboarding. The app must also show membership, questions, card ownership, shared
  memory and delivery recovery.
- **GitHub Projects as the team's board UI** — the shared board lives in AI4Kanban Cloud.
  GitHub Issues supplies proposals and receives progress, but never becomes a second place
  a card can be changed.
- **Ready-only focus toggle**, and **muting cards you can't start yet** — the board is small
  enough to scan, and the `ready` label already says what can be started and, by absence,
  what can't.
- **Marking the cards that hold up other work** — a "holds up 3" badge says less than the
  padlock beside it and competes for the same glance. A card's place in a chain is what a
  group task's map is for.
- **A Finished view that browses archived cards** — too little value: an archived card is a
  plain file next to the board.
- **Switching between projects from the browser UI** — a server serves the board it was
  started in. The desktop app is where this shipped.
- **Ticking several cards to move them into a release at once** — cards go into and out of a
  release by asking the agent in plain words; a multi-select bar builds the manual path we
  don't want.
- **Answering the board's open questions from your phone** — too big for one card: the way
  in, who can reach it, and every screen a small display needs are each their own piece of
  work. The mobile board is planned later as a group task.
- **Route every card read and write through the command** — listing cards and writing
  frontmatter already do, and that covers what needs one owner. A full API changes nothing
  a user sees and slows down work that reads files today.
- **Rendering a drawing of a screen inside an open question** — a question lives in
  frontmatter, which is no place for full detail. The drawing stays in the card body.
- **Dropping the Edit button from the card page** — the chat rail is folded away by default,
  so cutting it would leave no visible way in.
- **Editing a card's title, body, track and links straight from the card page** — priority,
  ROI, release and cadence are settings; the rest is the spec a flow wrote and a human
  approved. You ask, the agent rewrites.
- **Writing a new hand-check on the card page** — hand-checks come from the spec the board
  clarifies; a box for typing your own turns a spec line into hand-entered data. Crossing
  one off stays.
- **Putting a specialist agent on a card from the card page** — Configuration → Agents
  switches each one on or off, `akb spec <agent> <id>` puts one on a card, and the board
  asks for one itself while planning. Asking by hand is too rare to buy a control per card.
- **Reading a closed version's changelog in the board UI** — not a common demand. A closed
  version leaves a plain-words file in `docs/kanban/.release-summaries/`.
- **A separate group for the UI work behind design questions** — the pieces sit with the
  spec agents work that raises the questions; a group of its own would hold a card or two.
- **Working the board from the keyboard** — the current UI is simple enough that a
  shortcut set, its own dispatcher and a panel to list it would cost more than the mouse
  trips they save.

- **Serving the board to a phone from the user's own machine** — a LAN address, a tunnel or
  a QR code onto the local server, with the owner approving each device at the board. The
  Cloud workspace's URL and its GitHub sign-in reach a phone from anywhere, work while the
  machine is asleep, and need no second way in; the cost we accepted is that a user who
  never turns Cloud on has no phone access at all.

## Runs

- **Human-in-the-loop / mid-run reply to the agent** — no live reply channel. The agent
  raises open questions on the card; watching a run is a read-only tail of its log.
- **A follow-up prompt box on any finished run** — Resume covers the real need with no
  typing. A prompt box is the first step toward replicating a full chat inside the board.
- **Per-card run history list** — the most recent run's log surviving a restart is enough,
  and the global runs panel covers browsing.
- **A plain-words reason beside a failed run** — the only reason on offer is the tail of the
  agent's own output, which the log already shows.
- **Telling the user what the agent must be allowed to do before a button works** — written
  from a guess; raise it again from an actual case.
- **Clicking a run id in a chat reply to open its log** — saves one click and costs link
  rules for which id-shaped words count.
- **A read-only view of everything uncommitted in the folder a run worked in** — it could
  never say "this run changed these files". The card's diff, scoped to the delivery's own
  branch and then to the squash commit, replaced it.
- **A switch that lets the board start building a ready card by itself** — anything that
  starts cards without a click needs limits on concurrent runs, card count and spend first.
- **Handing a whole group's subtask graph to one long unattended agent run** — one run
  implements one approved version of one card, and is reviewed and landed as that card.
  Subtasks without declared dependencies already run at the same time.

## Connectors

- **A Gemini CLI connector** — not an agent we want to reach; anything past the ones we
  ship waits for users to ask.
- **A pi connector** — a user asked, and pi does stream and resume, but it never asks
  permission and nothing holds a run to the project, so picking it would hand a run the
  whole machine. No wording in the dialog makes that safe.
- **Offering a list of model ids in the Model field** — a list we keep goes stale, and
  offering only the ids already used on this board is empty on a fresh board, which is the
  one moment a newcomer needs telling what to type. It stays a plain box.
- **A login line in the agent dialog** — the board does not set a harness up. The user
  installs and signs in; the dialog connects to what is already there, and Test says whether
  it did.

## Setup

- **An "I'll drive this board from my own coding agent" answer** — the board always has an
  agent to run, so "none of them" was never a state it could hold. The agent step ends on a
  passing test, and the line to paste serves the user who works from their own agent.
