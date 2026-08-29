# Rejected

Ideas we turned down, grouped by topic. One line each: the idea, and why we said no. Read
before proposing so you don't re-suggest them.

## Agents

- **The pi coding agent** — it has no permission prompts and nothing keeps a run inside the
  project: a container is the only fence it offers. Every agent we run stays in the repo.
- **Asking each harness for its model list** — no harness hands one over for free, and a
  cache per provider goes stale anyway. The model stays a box you fill in.
- **Telling the user how to log in to an agent** — setting a harness up is the user's own
  business; the board only connects to what is already there, and Test answers the one
  question it can.
- **Calling spec agents when a card is written** — a card written from a one-line ask has no
  spec to fill in yet, and a second place to call them means two flows to keep in step.
  Refine asks; add-task doesn't.

## Chat

- **A separate flow that limits what chat may do** — a chat is an ordinary kanban-skill
  session, so it needs no second workflow or permission layer.
- **A chat handing the run a summary of what the conversation settled** — asking chat to
  decide what a run needs to know gives it a job of its own. Anything that changes what gets
  built goes on the card, which chat already does.

## Goal

- **A fixed template for `goal.md`** — what we write instead is a best-practices guide the
  user can ignore, not a shape the agent enforces.

## Install

- **A per-agent install that writes each editor's own rules file** — Cursor and Windsurf
  both read the shared `.agents` folder, which install already writes.

## Outside sources

- **Built-in connectors that pull outside sources onto the board** — a recurring card or a
  user prompt can supply the material to idea extraction. The connector belongs outside the
  open core; the skill only evaluates material it can already read.

## Planning

- **Repairing one internal guide line as a user-facing task** — repairs found during review
  stay with the delivery or are dropped; they don't enter the planning loop.
- **Telling the agent which cards a card is holding up** — it is `blocked_by` read
  backwards, and the weaker half: "start this first" is a guess about order, "don't start
  this yet" is a fact. Where a chain matters we make it a group task.
- **Grouping the cards a release plan writes** — a release is already the group.
- **Changing a card's spec by hand instead of asking a flow to rewrite it** — hand edits
  have no flow behind them and the next refine rewrites them anyway.
- **A card carrying its own acceptance check, run before the card closes** — review already
  judges the delivery against the approved card. What only a person can confirm goes under
  **check by hand**, and making those a gate stalls a board on notes nobody comes back to.
- **release-completeness, a score for how right a release plan turned out** — nothing runs
  at the moment a plan is finished, so there is no roster to compare the close against, and
  the work that belonged in the plan and was never written down needs a person to say so.

## Questions

- **A drawing of a screen inside an open question** — a question lives in frontmatter, which
  is no place for full detail. Questions stay one short line each and point at the drawing
  in the card body.

## Setup

- **Ending setup with a v1 and a vnext group task** — not every project plans releases on
  day one. Setup ends with the first tasks, not a version split.
- **Reading a deadline from the goal and splitting decisions by it** — the board has no
  deadlines, so every settled call lands in one `decisions.md`.

## Storage

- **A file-storage-only backend layer for team collaboration** — Cloud also owns revisions,
  leases, audit events and lifecycle rules, which the narrower abstraction would hide.
- **A storage picker as the whole collaboration feature** — team collaboration also needs
  identity, question routing, one writer per card, shared memory and delivery recovery.
- **GitHub Projects as the shared board authority** — AI4Kanban Cloud is the shared board;
  GitHub Issues is an intake door and progress mirror, not another writable copy.
- **Mirror the board to a second backend** — two live copies means two-way sync and a
  conflict story, a product of its own rather than a setting. One backend per project.
- **Move every flow off Read and Grep and onto board commands** — the command already owns
  the part that needs one owner. Wrapping the rest buys nothing on a file board, and a
  backend that can't be read as files carries that cost on its own card.
