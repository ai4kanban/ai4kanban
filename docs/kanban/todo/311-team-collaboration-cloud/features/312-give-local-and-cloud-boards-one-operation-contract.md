---
title: Give Local and Cloud boards one operation contract
track: features
priority: high
roi: high
status: implementing
release: 0.8.0
blocked_by: []
related: [311, 56]
modules: [skill, cloud]
questions: []
---

Make every part of AI4Kanban reach the board through the same small set of operations,
instead of each part editing the markdown files its own way. Without this, putting a team's
board in Cloud means rewriting `akb`, the app, and the background runs one command at a
time — and because none of them can currently tell that a card changed since they read it,
two teammates editing the same card would silently overwrite each other.

## Worth noting
- **Nothing changes for anyone using the board today**: the same commands, the same card
  files, the same terminal output, the same screens. This card changes how the code reaches
  the board, so there is nothing for a user to notice or learn.
- **A save is finished before the command returns**: nothing is held back and sent later.
  That is what stops two people's edits drifting apart, and the price is that a Cloud save
  takes as long as the network does, with `akb` waiting for it.
- **Local computes real revisions even though a solo user never sees a conflict**: one
  machine's board is already serialized, so a local write cannot lose a race. Building the
  revision and conflict path here anyway means it is written once and covered by tests,
  rather than invented later inside the Cloud work, where the first thing to exercise it
  would be a real team.
- **This is the biggest refactor in 0.8.0 and ships no visible feature**: four separate parts
  of the code write the board today, and all four move onto the new path. It is worth doing
  first because #313 through #320 each assume this seam already exists — build any of them
  before it, and they get rewritten afterwards.

<!-- agent -->

## Today
- **Screens have one door; nothing else does**: `cli/src/lib/view/api.ts`, exported from
  `cli/src/kanban.ts` and loaded by `kanban-ui/lib/cli.ts`, is every read and write a screen
  makes. `akb board` runs `runBoard` into `cli/src/commands/*.ts`, and the run engine
  (`agent/sessions.ts`, `agent/complete.ts`, `agent/review.ts`) and the board timer
  (`view/dispatch.ts`) call those same `cmd*` moves directly.
- **Nothing returns a promise**: `runBoard`, each `cmd*`, and every `view/api.ts` export
  return values rather than promises.
- **The lock does not yield**: `withBoardLock` in `cli/src/lib/lock.ts` serializes writes and
  waits with a blocking `Atomics.wait`, written on the assumption that every move is
  synchronous.
- **A refusal is a string**: `view/api.ts` answers `{ ok: false, error }`, with nothing in it
  that tells a stale write from an invalid one.
- **Nothing carries a revision**: a card's state is its file, and no caller can say which
  version of it that caller read.

## Scope
- One contract covers board snapshots, card reads, lifecycle and frontmatter changes,
  memory, releases, history, and the delivery lifecycle.
- Every mutation commits to the authoritative board before its call returns: no write queue,
  no background flush, no local copy applied first and reconciled afterwards.
- Every mutation carries a caller-supplied operation ID and the revision it expects, and
  returns either the changed resources with a new revision, or a conflict naming the current
  one. A conflict is its own result kind, so a caller refreshes that card instead of showing
  a message.
- A caller that did not read the card first takes its expected revision from the lease it
  acquires, so no mutation is a blind write.
- Card mutations take a writer lease, so no card can be written without one.
- Revisions, leases, operation IDs, and delivery-attempt state travel in the contract's
  envelope, never in a card's portable frontmatter.
- The Local provider is the existing markdown board behind the contract: no network calls,
  no new files on a user's board, no change to what a command writes or prints.
- Every board write goes through the contract — the app's screens, `akb board`, the run
  engine's own moves, and the board timer. None of them keeps a direct `cmd*` call.

## Todo
- [ ] Define the complete operation contract, its result shapes, and its conflict result.
- [ ] Make the contract's calls promise-returning, and convert `runBoard` and every
      `akb board` move to await them, with each write committed before its call resolves.
- [ ] Put the existing markdown board behind the Local provider, holding `withBoardLock`
      around its file work so the lock itself is not rewritten.
- [ ] Derive a Local card revision from card file content, outside frontmatter.
- [ ] Answer lease and delivery operations locally with the existing board lock and delivery flow.
- [ ] Move the run engine's board moves and the board timer's writes onto the provider.
- [ ] Route every app screen through the provider.
- [ ] Cover a stale revision, an unknown card, and a refused lifecycle change with contract tests.
- [ ] Check every `akb board` command and every app screen still writes the files and output it does today.

## Decided by the agent
- **The contract lives in the CLI package and is exported from `cli/src/kanban.ts`**: that is
  the file both the app and the commands already load, so one door stays one door.
- **The lock stays synchronous, underneath the contract**: the Local provider takes
  `withBoardLock` around its own file work, so the promise boundary sits above the lock and
  `cli/src/lib/lock.ts` is not rewritten. It is also what makes a Local write literally
  synchronous — the file is on disk before the call resolves.
- **Promise-returning is plumbing, not deferral**: a Cloud write crosses the network, so the
  contract's calls return promises and every caller awaits them. The write has landed by the
  time the call resolves; nothing is queued behind it.
- **Reads may be stale, writes never are**: a client renders from a snapshot it already has,
  while every write is checked against the current revision on the authoritative board. That
  check, not cache freshness, is what refuses a stale edit.
- **The lease is the read a blind write needs**: someone typing `akb board update` never read
  the card first, and refusing them for having no revision would make the CLI unusable, so
  acquiring the lease is what hands them the revision they write against.
- **The CLI converts here rather than in #316**: #316 builds the Cloud client on the
  assumption that one write path already exists, so leaving the conversion to it would mean
  shipping a contract nothing calls.
- **Duplicate-operation detection belongs to #314**: this card declares the operation ID and
  its result shape, and a Local board has no lost network response to deduplicate.
- **Local grants every lease**: a single machine's board is already serialized by
  `withBoardLock`, so lease operations answer immediately and fencing is Cloud's to enforce.
- **Local revisions are derived, never stored**: a content hash leaves a portable card exactly
  as it is on disk while still letting a caller detect that the card moved under it.
- **Obsidian (#56) stays a Local format option**: it changes how a card file is written, not
  which board is authoritative, so it never becomes a third provider.

### Overruled by the user
- **Every board operation becomes asynchronous**: a Cloud provider is network-bound, so the
  contract returns promises and every `akb board` command must await its work. The app
  already awaits its side, so almost all of that cost falls on the CLI.

## Source
- `plan.md`, "Board data plane", "Metadata model", and "Consistency and concurrency" — the
  operations, the portable/coordination split, and the revision and lease model this contract
  has to express.
- `plan.md`, "Shipping order" step 1 — why this card comes before intake, the control plane,
  and the clients.
