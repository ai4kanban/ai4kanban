---
title: Give every run a record, and the board one writer
track: features
priority: high
roi: high
status: todo
release: 0.8.0
blocked_by: []
related: [300]
modules: [local-ui, skill]
questions: []
---

From #303 on, runs work in parallel, and two finishing at once can overwrite each other's card
edits: `akb board` moves take the board's write lock, but agents edit the markdown below the
frontmatter with their own file tools, outside it. Put every card change through one writer. And
when a run starts, record a fingerprint of the requirements it was approved for, so work is never
landed against a card that has changed since.

## Worth noting
- Agents stop editing card files. They return the sections they want changed and the writer
  applies them, so a card the user is also editing cannot be clobbered.
- Editing an approved card's requirements while its run is in flight starts a new run. Its work is
  not landed against a card that no longer says the same thing.
- Any wording change inside the card's requirement sections counts. Changing status, questions or
  notes does not.
- The writer and the fingerprint ship together: the writer needs the fingerprint to spot a stale
  update, and there is no other reason to keep one.

<!-- agent -->

## Today
- `docs/kanban/.sessions.json` holds one row per run — id, card, action, status, timestamps —
  shared by the CLI, the app and every terminal.
- Every `akb board` move runs under the board's write lock, so frontmatter is already
  single-writer. Card bodies are not: flows edit that markdown directly with their own file tools.
- Nothing detects that a card changed while a run was working from it.

## Scope
- **Run**: one end-to-end effort to implement an exact version of a card, review it and land it.
  It has a run id. A card has at most one active run.
- A run may use several agent sessions — implementation, review, correction, conflict resolution.
  Record each one under the run id.
- **Approved spec hash**: when a run starts, hash the card's implementation requirements and store
  the hash on the run. Status, audit data and post-implementation notes are outside it.
- A change to that hash starts a new run.
- **One board writer**: one writer per repository. A flow returns the card changes it wants —
  frontmatter fields and whole body sections — and the writer applies them under the board's
  existing write lock, writes the file atomically, and records the change against the run.
- Extend that writer to body sections. Frontmatter already goes through `akb board update` under
  the same lock.
- Flows stop editing card files, and the flow text under `cli/src/guide/` says so.
- **Stale requirements**: reject a requirements update whose run's approved hash no longer matches
  the card, and start a new run. Additive changes — post-implementation notes, questions, audit
  events — merge into the latest card instead.
- **Survive interruptions**: after the app, machine or agent process stops, a run continues
  without repeating finished work. Re-enter the flow and let each step check its own precondition
  — no commit on the task branch, no review verdict, no landing commit — rather than storing a
  position a crash can leave stale.
- **Audit record**: create it when a run starts, in a board-managed path, so archiving a card does
  not erase it. It holds the run id, its agent sessions, the approved spec, base and task commits,
  corrections, agent, model and prompt versions, command results, approvals, the landing commit,
  timestamps, and redacted references to the run's logs.
- Never include that path in a code landing commit (#304).
- **`.akb/`**: an ignored folder at the repository root for temporary run state — worktrees (#303)
  and whatever else a run needs while it works. Permanent audit data lives with the board.

## Todo
- [ ] Give a run an id that its agent sessions, commits and audit record all carry.
- [ ] Hash the card's approved requirements when a run starts and store the hash on the run,
      leaving status, questions, notes and audit data out of it.
- [ ] Start a new run when that hash changes.
- [ ] Extend the board writer to whole body sections, applied under the board's write lock and
      written atomically.
- [ ] Record every card change against the run that made it.
- [ ] Reject a requirements update whose approved hash no longer matches the card and start a new
      run; merge notes, questions and audit events into the latest card.
- [ ] Make every flow return card updates instead of editing card files, and say so in the flow
      text under `cli/src/guide/`.
- [ ] Continue an interrupted run by re-entering the flow and checking each step's precondition,
      without repeating finished work.
- [ ] Write the audit record in a board-managed path when a run starts, keep it current as the run
      goes, and leave it in place when the card is archived.
- [ ] Add `.akb/` for temporary run state, ignored by git.
- [ ] Document in `kanban-ui/README.md` what a run records, and that flows no longer write card
      files.

## Decided by the agent
- **Where does the run record live?**: in the existing `docs/kanban/.sessions.json`, extended. It
  is already ignored by git, already shared by every process, and already what the app reads.
- **What identifies the latest revision of a card?**: the approved-spec hash itself. The writer
  compares the card's current hash with the run's, so there is one mechanism and no second
  version counter.
- **Why is there no stored step?**: every step already leaves an artifact — a commit on the task
  branch, a review verdict, a landing commit. A stored position answers nothing a read cannot,
  and goes stale in exactly the crash it exists for.

## Source
- `plan.md`, in commit `1127a91` — "Terms", "Core workflow" (survive interruptions, one board
  writer, approved spec), "Audit trail".
