---
title: Build, review and land an approved card from one click
track: features
priority: high
roi: high
status: ready
release: 0.8.0
blocked_by: []
related: [308, 309, 310]
modules: [local-ui, skill]
questions: []
---

Today a session writes code into your working tree and stops. You read the diff, decide whether it
matches the card, fix what drifted, and commit — every time, for every card. Make the board do
that part: one click on an approved card implements it, reviews the result against the card in a
fresh session, corrects clear mistakes, and lands it on the target branch. This is a group task —
each piece below is its own subtask in this folder.

## Worth noting
- **What the board calls this**: a click on **Implement** starts a **delivery** — the tracked
  lifecycle that ends with a **commit** on the target branch. Each agent invocation inside it is a
  **session**. The board reads "Delivery in progress", "Resume delivery", "Landed as `abc123`".
- **Does the board write to git?**: yes — it creates branches, commits inside them, and adds one
  squash commit to the target branch. Nothing is deployed anywhere.
- **What if a user does not want that?**: they turn off **Allow automatic Git commits**. Deliveries
  then work in the main folder, one at a time, and stop after review for the user to commit — what
  happens today, plus a review.
- **What does the human approve?**: the card, not the diff — what it should achieve, what to
  weigh, its open questions, and what turned up while it was built. A board that wants diff
  approval turns that on separately.
- **How much is in flight at once?**: several cards may be building, so several branches exist at
  a time. Only one card lands at a time.
- **Two settled decisions are reversed**: `docs/kanban/memory/local-ui/decisions.md` records that
  the board never commits and uses no branches or worktrees. That note and the comparison copy on the
  site change with this group.
- **Acceptance tests wait for a later release**: the plan's fifth review surface — an agent
  writes tests from the approved card, and the user approves them before the build starts — is
  not one of the nine cards here.
- **Three planned cards are replaced**: a worktree per implement run, the working-tree diff view,
  and the auto-implement switch are rejected; their useful detail moved onto the subtasks here.

<!-- agent -->

## Today
- **Sessions share one working tree**: every session spawns in the repo root, so two of them write
  the same files and their changes mix.
- **Board files and code race**: they sit in the same tree, so an agent editing a card and an
  agent editing code overwrite each other.
- **Nothing leaves the working tree**: a reviewed delivery has no branch, no commit and no way to
  reach the target branch.

## Scope
- **Vocabulary, used by every subtask, screen, flow text and record in this group**:
  - **Implement**: the button and the `akb implement` action. One click starts one delivery.
  - **Delivery**: the tracked lifecycle that click starts — implementation, review, corrections,
    checks, landing — against one exact version of a card. It has a delivery id, and a card has at
    most one active delivery.
  - **Session**: one agent invocation. A delivery is several sessions; every other flow — refine,
    resolve, propose — is a single session and never a delivery.
  - **Commit**: the code a delivery lands, one squash commit on the target branch.
- **"Run" is retired as a noun**: nothing this group writes — screens, flow text, records, CLI
  output — calls a delivery or a session a run. It survives as the verb, and as the name of the
  shipped `akb runs` command, which now reports deliveries and sessions.
- **Build the nine cards below in dependency order**: each is its own card, and this root only
  tracks them.
- **`plan.md`, in commit `1127a91`, is the specification**: every subtask quotes the part it owns,
  and translates its wording into the vocabulary above.

## Todo
- [x] Give every delivery a record #301
- [x] Review a delivery's work against the approved card, and send clear mistakes back #302
- [x] Give each delivery its own git worktree, with the board kept out of it #303
- [x] Land reviewed code on the target branch, one card at a time #304
- [x] Show a delivery's diff on the card, and keep the commit that landed #305
- [x] Let a user add one rule to any flow #306
- [x] Make one Implement click carry a card all the way to landed #307
- [ ] Require diff approval on the cards that need it #308
- [ ] Link a bug back to the delivery that introduced it #309

## Scope out
- **No deploy**: landing puts the change on the target branch and stops there.
- **No promise about defect rates or coverage**: the promise is that the checks a board turns on
  are the checks that run.
- **No acceptance tests**: nothing in this group writes tests from a card, asks the user to
  approve them, or requires them to pass before landing.
- **No user-written agent modules**: a flow takes one rule in plain words, not a shell command.
- **Nothing starts a delivery without a click**: anything that does needs limits on concurrent
  deliveries, card count and spend first.
- **No card-size check**: the plan's advice to recommend a split when a card is too large is #155's
  job, on the refine flow, and not part of this group.
- **No sweep of the older flow text**: #310 finishes retiring "run" from the guides and CLI help
  that this group's own subtasks never touch.

## Decided by the agent
- **Why is a delivery not called a run?**: "run" already names each agent invocation, so one word
  covered both the whole job and one step of it. Delivery names the lifecycle, session names the
  invocation, and neither has to be qualified.
- **What replaces "delivery run"?**: nothing — a delivery is by definition what Implement starts,
  so the qualifier that separated it from a refine run is no longer needed.
- **Why are acceptance tests not a tenth card?**: the plan calls the surface optional and puts it
  last, behind #306 and #308, and the 0.8.0 release goal does not promise it. It gets its own card
  once this group lands.
- **Why pin the specification to a commit?**: `plan.md` at that path now holds an unrelated
  document, so only the commit reaches the auto-delivery plan.

## Source
- `plan.md`, in commit `1127a91` — the full auto-delivery specification this group builds. The
  file at that path today is a different document. It says "run" where this group says delivery.
