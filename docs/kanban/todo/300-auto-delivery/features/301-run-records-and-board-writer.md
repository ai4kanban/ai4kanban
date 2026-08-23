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
frontmatter with their own file tools, outside it. Put every card change through one writer. Give
each run an id and a permanent record of what it was asked to build and what it did, and
fingerprint the requirements it was approved for, so work is never landed against a card that has
changed since.

## Worth noting
- Agents stop editing card files. They hand the sections they want changed to one board command,
  so a card the user is also editing cannot be clobbered.
- Every flow changes with it — refine, resolve, create, propose and the rest — not only the ones
  that build code. That is the cost of having a single writer at all.
- Editing an approved card's requirements while its run is in flight retires that run. Its work
  is never landed, and the card offers Implement again; nothing restarts on its own.
- Any wording change inside the card's requirement sections retires the run. Ticking a todo,
  answering a question, or adding a note after implementation does not.
- Every run leaves one small record file in `docs/kanban/runs/`, tracked in git and committed
  with your other board changes. It stays after the card is archived.
- The writer and the fingerprint ship together: the writer needs the fingerprint to spot a stale
  update, and there is no other reason to keep one.

<!-- agent -->

## Today
- `docs/kanban/.sessions.json` holds one row per agent session — id, card, action, status,
  timestamps — shared by the CLI, the app and every terminal. It is ignored by git and keeps only
  the newest 30 finished rows.
- Every `akb board` move runs under the board's write lock, so frontmatter is already
  single-writer. Card bodies are not: flows edit that markdown directly with their own file tools.
- `akb board spec-write` is the one exception: it splices one named section into a card and
  leaves every other byte alone. It is the shape the body writer should take.
- Nothing detects that a card changed while a run was working from it.

## Scope
- **Run**: one end-to-end effort to implement an exact version of a card, review it and land it.
  It has a run id. A card has at most one active run.
- A run may use several agent sessions — implementation, review, correction, conflict resolution.
  Each session row carries the run id it belongs to; today's single-session actions are a run of
  one session, so every run has the same shape.
- **Approved requirements**: what a run is held to — the card's title, its opening paragraph,
  `## Worth noting`, `## Scope`, `## Scope out`, the text of each `## Todo` line, and every
  ``## By `<name>` agent`` section.
- Everything else is outside them: status, questions, verify lines, whether a todo is ticked,
  `## Today`, `## Decided by the agent`, `## Source`, notes added after implementation, and all
  run and audit data.
- Hash the approved requirements when the run starts and store the hash on the run. Compare
  normalized text, so re-wrapping a line is not a change.
- **Retire a run whose card no longer matches its hash**: it stops at its next step boundary and
  never lands. Its worktree is left in place for the user (#303), and the card offers Implement
  again — no run starts without a click.
- **One board writer**: one per repository. A flow returns the card changes it wants —
  frontmatter fields and whole body sections — and the writer applies them under the board's
  existing write lock, writes the file atomically, and records the change against the run.
- Add a board move that replaces or adds one named body section, splicing it the way
  `spec-write` already does. Frontmatter keeps going through today's `update`,
  `update-questions` and `update-verify`.
- Every writing move names the run it acts for, and the run's audit record lists the card
  changes it made.
- A write to a requirement section names the hash it was written against and is refused when the
  card no longer matches it. Additive writes — notes after implementation, questions, audit
  events — always apply to the latest card.
- Flows stop editing card files, and the flow text under `cli/src/guide/` says so.
- **Survive interruptions**: after the app, machine or agent process stops, a run continues
  without repeating finished work. Re-enter the flow and let each step check its own precondition
  — no commit on the task branch, no review verdict, no landing commit.
- An unfinished run is never dropped from the record, however many newer runs there have been.
  Only a run that ended ages out.
- **Audit record**: one file per run under `docs/kanban/runs/`, created when the run starts and
  kept current as it goes. It holds the run id, its agent sessions, the approved requirements and
  their hash, the steps it entered, base and task commits, corrections, agent, model and prompt
  versions, command results, approvals, the landing commit, timestamps, and redacted references
  to the run's logs.
- It is tracked in git, never pruned, and stays when the card is archived. Never include it in a
  code landing commit (#304).
- **`.akb/`**: a folder at the repository root for temporary run state — worktrees (#303) and
  whatever else a run needs while it works. This card adds the path and its ignore line;
  permanent audit data lives with the board.

## Scope out
- No worktrees, no commits, no review. This card records runs and owns card writes; #302, #303
  and #304 do the rest.
- No new screen. Grouping a run's sessions in the runs panel belongs to the first flow that uses
  more than one (#302).

## Todo
- [ ] Give a run an id that its agent sessions, commits and audit record all carry.
- [ ] Hash the card's approved requirements when a run starts, and store the hash on the run.
- [ ] Compare normalized text, and leave tick marks, status, questions, verify lines and later
      notes out of the hash.
- [ ] Retire a run whose card no longer matches its hash: stop at the next step boundary, never
      land, and offer Implement again.
- [ ] Add the board move that replaces or adds one named body section, under the board's write
      lock and written atomically.
- [ ] Let every writing move name the run it acts for, and list that change on the run's audit
      record.
- [ ] Refuse a requirement-section write whose hash no longer matches, and apply notes, questions
      and audit events to the latest card.
- [ ] Make every flow return card updates instead of editing card files, and say so in the flow
      text under `cli/src/guide/`.
- [ ] Continue an interrupted run by re-entering the flow and checking each step's precondition,
      without repeating finished work.
- [ ] Keep an unfinished run in the record until it ends, whatever has run since.
- [ ] Write the audit record under `docs/kanban/runs/` when a run starts, keep it current, track
      it in git, and leave it in place when the card is archived.
- [ ] Add `.akb/` for temporary run state, and its line in the repository's root `.gitignore`.
- [ ] Document in `kanban-ui/README.md` what a run records, and that flows no longer write card
      files.

## Decided by the agent
- **Where does the live run record live?**: in the existing `docs/kanban/.sessions.json`,
  extended. It is already ignored by git, already shared by every process, and already what the
  app reads. It stays this machine's answer to "what is running now".
- **Why a second, permanent record?**: that file keeps only the newest 30 finished runs and never
  leaves the machine. #309 links a bug to the run that introduced it long afterwards, so that
  evidence has to be in git.
- **What shape is an audit record?**: JSON, one file per run named by its run id. The board
  writes and reads it; nobody edits it by hand, and the card page renders it.
- **What identifies the latest revision of a card?**: the approved-requirements hash itself. The
  writer compares the card's current hash with the run's, so there is one mechanism and no second
  version counter.
- **Does a run store which step it is on?**: it records each step it entered, as history for the
  audit record. Resuming never trusts it — every step re-checks its own precondition, because a
  stored position goes stale in exactly the crash it exists for.
- **Why is a retired run not restarted for the user?**: nothing in this group starts a card
  without a click (#300).
- **Who writes the root `.gitignore` line?**: the board, the way it already writes
  `docs/kanban/.gitignore`. `.akb/` sits at the repository root because it holds worktrees of the
  repository itself, which cannot live inside the board folder they exclude.

## Source
- `plan.md`, in commit `1127a91` — "Terms", "Core workflow" (survive interruptions, one board
  writer, approved spec), "Audit trail".
