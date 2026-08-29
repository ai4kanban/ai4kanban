# Rejected

Ideas we turned down, grouped by topic. One line each: the idea, and why we said no. Read
before proposing so you don't re-suggest them.

## The board

- **A file-storage-only switch for team collaboration** — a Cloud screen must handle
  members, stale revisions, active writers, and conflicts. Treating Cloud as another file
  location would leave those states invisible.
- **GitHub Projects as the team's board UI** — the shared board lives in AI4Kanban Cloud.
  GitHub Issues supplies proposals and receives progress, but never becomes a second place
  where a card can be changed.
- **A board-location picker as the whole collaboration UI** — choosing Local or Cloud is
  only onboarding. The app must also show membership, questions, card ownership, shared
  memory, and delivery recovery.
- **Ready-only focus toggle** — hiding every card that isn't `ready` isn't useful; the
  board is small enough to scan. The queue view and the release dropdown are both different
  ideas and both fine.
- **Mute cards you can't start yet** — the `ready` label already shows what can be started
  and, by absence, what can't, so a second "waiting" signal is redundant.
- **A Finished view that browses archived cards** — too little value for the work. An
  archived card is a plain file next to the board; anyone can read it in their editor.
- **Switching between projects from the browser UI** — a server serves the board it was
  started in, so a second board means a second server. This does not apply to the desktop
  app, where it shipped.
- **Open-questions notification center in the header** — no clear incentive to build it;
  open questions already show on the card. Worth revisiting if the board ever grows a
  human-in-the-loop center.
- **Ticking several cards to move them into a release at once** — cards go into and out of
  a release by asking the agent in plain words. A multi-select bar builds the manual path
  we don't want.
- **Answering the board's open questions from your phone** — too big to carry as one card:
  the way in, who can reach it, and every screen a small display needs are each their own
  piece of work. The mobile board gets planned later as a group task.
- **Marking the cards that hold up other work** — a "holds up 3" badge beside the blocked
  padlock says less than the padlock does and competes with it for the same glance. A card's
  place in a chain of work is what a group task is for: the tree is drawn once, in the
  group, instead of being reassembled from a count on each card.
- **Route every card read and write through the script** — listing cards and writing a
  card's frontmatter already go through it, and that covers what the board needs one owner
  for. A full read-and-write API on top changes nothing a user sees and slows down work
  that reads files today.
- **A separate group for the UI work behind design questions** — the pieces are small enough
  to sit with the spec agents work that raises those questions in the first place. A group of
  its own would hold a card or two.
- **Rendering a drawing of a screen inside an open question** — we don't put a drawing in a
  question. A question lives in the card's frontmatter, which is no place for full detail, so
  there is nothing for the Resolve dialog to draw. The drawing stays in the card body, where
  the card page renders it.
- **Dropping the Edit button from the card page** — keep it. A button that says Edit is the
  straightforward way to ask for a rewrite; the chat rail is folded away by default, so
  cutting it would leave no visible way in.
- **Editing a card's title, body, track and links straight from the card page** — keep the
  card page as it is. Priority, ROI, release and cadence are settings; the rest of a card is
  the spec a flow wrote and a human approved, and a box you type over by hand has no flow
  behind it. Edit stays the way to change a card: you ask, the agent rewrites.
- **Putting a specialist agent on a card from the card page** — spec agents are already
  supported: Configuration → Agents switches each one on or off, `akb spec <agent> <id>` puts
  one on a card, and the board asks for one itself while it plans a card. Asking by hand is
  rare enough that a button, a dialog and a list of specialists on every card page buy
  nothing for it.
- **Writing a new hand-check on the card page** — hand-checks are part of the spec, and the
  board's whole point is that the agent clarifies a vague idea into that spec. A box for
  typing your own turns a spec line into hand-entered data. Crossing a hand-check off, which
  already ships, stays.
- **Reading a closed version's changelog in the board UI** — not a common demand, and the
  board stays cleaner without a screen for it. A closed version leaves a plain-words file
  in `docs/kanban/.release-summaries/`, readable in an editor or on GitHub Releases.

## Runs

- **A separate flow that limits what chat may do** — the chat rail is just a kanban-skill
  session, like chatting with Claude Code. Users may run any `akb` command in it, so chat
  needs no second workflow or permission layer.
- **Human-in-the-loop / mid-run reply to the agent** — no live reply channel. The agent
  raises open questions on the card and the user answers those; watching a run is a
  read-only tail of its log.
- **A follow-up prompt box on any finished run** — Resume covers the real need: a run that
  stopped short gets one "continue" turn, no typing. A prompt box on every finished run is
  the first step toward replicating a full chat inside the board. Worth reconsidering
  later, as a whole.
- **Per-card run history list** — the most recent run's log surviving a restart is enough;
  the global runs panel covers browsing. Older logs stay on disk for anyone who digs.
- **Telling the user what the agent must be allowed to do before a button works** — written
  from a guess. Nobody has reported a button that quietly does nothing because of
  permissions; raise it again from the actual case if it turns out to be real.
- **A plain-words reason beside a failed run** — the only reason on offer was the tail of
  the agent's own output, which the log already shows; putting it on the run tells the user
  no more than they can read today.
- **Clicking a run id in a chat reply to open its log** — low priority, and the value
  isn't there: a reply that starts a run is followed by the activity button in the top bar,
  which opens the runs panel with that run at the top of the list. Linking the id saves one
  click and costs link rules for which id-shaped words count.
- **A worktree per implement run that merges itself back to main** — the idea is right and
  is being built, but not as its own card. The v0.8.0 auto-delivery plan settles it
  differently: a worktree belongs to a run rather than to a card, review happens before
  anything reaches main, and landing is one squash commit through a repository-wide queue.
  Its worktree and fallback detail moved onto the auto-delivery cards.
- **A read-only view of everything uncommitted in the folder a run worked in** — replaced by
  a diff scoped to the run itself. Auto-delivery commits a run's work on its own branch, so
  the card can show `git diff <base>..<branch>` and, after landing, the squash commit. The
  old view could never say "this run changed these files"; the new one can, so the guessing
  rules it was built around are gone.
- **A switch that lets the board start building a ready card by itself** — not a setting on
  its own. v0.8.0 makes one click run implementation, review, correction and landing, and
  the plan says anything that starts cards without a click needs limits on concurrent runs,
  card count and spend first. Revisit once those limits exist.
- **Handing a whole group's subtask graph to one long unattended agent run** — the pain it
  solved was clicking Implement on each subtask and waiting for each one. v0.8.0 removes the
  waiting instead: subtasks without declared dependencies run at the same time, and landing
  queues itself. One run across many cards also breaks the model the rest of v0.8.0 rests
  on — one run implements one approved version of one card, and is reviewed and landed as
  that card.

## Connectors

- **A Gemini CLI connector** — not one of the agents we want to reach. Cursor and OpenCode
  come first, and any agent past them waits for users to ask.
- **A pi connector** — a user asked for it, and pi does show its log and pick up a stopped
  run. We still said no: pi never asks permission and nothing holds a run to the project,
  so picking it in the agent dialog would hand a run the whole machine. The other four
  agents stay in the repo, and no wording in the dialog makes that safe.
- **A harness picker per action row and per spec agent row** — Configuration → Harness and
  Configuration → Agents were each growing a harness-and-model control per row, against a pick
  that pins the whole team to one coding tool. #342's group draws those rows against runtimes
  and adds the per-computer binding beside them, so the panes are rebuilt once.

- **Offering a list of model ids in the Harness pane's Model field** — neither source of ids
  was worth the field it would change. A list we keep per harness goes stale and is the same
  maintenance that sank asking each harness for its own list; offering only the ids already
  used on this board is empty on a fresh board, which is the one moment a newcomer needs
  telling what to type. The Model field stays a plain box you type any id into.

- **A login line in the agent dialog, under the install line** — the board does not set a
  harness up. The user installs it and signs in themselves; the dialog's job is to connect to
  what is already on the machine, and Test tells them straight away whether it did. Teaching
  each agent's own login command is the harness's business, not the board's.

## Setup

- **An "I'll drive this board from my own coding agent" answer** — a checkbox whose only
  effect was hiding the offer to finish setup, while every other button went on starting
  runs under the default agent. The board always has an agent to run, so "none of them" was
  never a state it could hold. The agent step ends on a passing test; the line to paste is
  what serves the user who works from their own agent.
