# Auto-implement

Let a human approve a task, click Implement, and trust the system to deliver a reviewed change.
Boards can add stricter checks without changing this basic workflow.

## Terms

- **Run**: one end-to-end effort to implement an exact version of a card, review it, and land it.
  Clicking Implement creates a unique run ID that connects its worktree, agent sessions, commits,
  approvals, and audit events. A run may use separate agent sessions for implementation, review,
  correction, and conflict resolution. Retrying an interrupted step keeps the run ID; changing
  the approved requirements or restarting a failed run creates a new one.
- **Landing**: adding the reviewed code to the target branch as its final commit.

## What the human reviews

The default policy asks a human to review four parts of each card:

1. **Task summary** — what the task should achieve.
2. **Worth noting** — useful context that does not require a decision.
3. **Open questions** — decisions required before implementation or landing.
4. **Worth noting after implementation** — non-blocking context found during implementation or
   review.

Stricter boards may also require approval of acceptance tests or the full diff.

## Core workflow

- **One-click flow**: after all open questions are resolved, one click runs implementation,
  review, corrections, landing, and completion. The flow pauses only for a failed check or a
  human decision. Several cards may be in implementation or review at once; landing waits in a
  repository-wide queue.
- **Automatic corrections**: review compares the result with the approved spec and sends clear
  mistakes back for correction. Allow two correction rounds by default. Stop if the same issue
  returns, no progress is made, a limit is reached, or an agent session fails or is cancelled, and
  add an open question with the evidence and the decision needed.
- **Identify drift**: a change is drift only when it is clearly unnecessary for the approved
  spec. Required wiring, configuration, and dependencies are in scope. If a required change
  would significantly affect user-visible behavior, technical design, security, compatibility,
  or ongoing cost, add an open question before making that choice.
- **Remove clear drift**: remove an unnecessary change without blocking when it has no meaningful
  value on its own. Record the correction in the run log.
- **Propose useful follow-up work**: when an unnecessary change is safely separable but may be
  valuable, remove it from the current implementation and propose a new task. Do not block the
  current card.
- **Ask when scope is unclear**: if it is unclear whether a change is required, or removing it
  would require a significant choice with a downside, do not classify it as drift yet. Add an open
  question and block landing. The human updates the spec or approves an exception for the exact
  implementation; review then runs again. A separate problem that does not prevent the current
  spec from being completed belongs in a follow-up task, not an open question.
- **Post-implementation notes**: useful findings that need awareness but no decision go in
  `## Worth noting after implementation`. They never block landing. Routine findings and
  corrected mistakes stay in the run log.
- **Independent review**: use a new session with a clean checkout, the approved spec, and the
  task diff. The reviewer may inspect the repository and run checks, but does not receive the
  implementation transcript or reasoning.
- **Survive interruptions**: if the app, computer, or agent process stops unexpectedly, preserve
  the run and continue it without repeating completed work. Save the run ID and its current step —
  `implementing`, `reviewing`, or `landing` — plus a final `done` or `failed`. Record each agent
  session under the run. Derive pauses from unresolved questions, pending approval, or manual mode
  instead of saving a separate blocked state. Keep temporary process state in ignored `.akb/` and
  permanent audit events with the board.
- **One board writer**: agents never edit board-managed files directly. They return structured
  updates to a repository-wide writer, which reads the latest revision, applies field-level
  changes, writes atomically, and records them with the run. A stale requirements update starts
  a new run; additive notes and audit events merge into the latest card. Code work remains
  parallel while card IDs, indexes, metrics, questions, notes, and audit records cannot overwrite
  one another.
- **Approved spec**: hash the implementation requirements when a run starts. A requirement
  change starts a new run. Status, audit data, and post-implementation notes do not affect
  the hash.
- **Task size**: many questions or notes suggest that a card is too large. Recommend a split,
  but let the human decide.

Each click starts one run, and several cards may have active runs concurrently. Any future
feature that starts cards automatically also needs limits for concurrent runs, total cards,
and total spending.

## Parallel work with Git worktrees

Cards without declared dependencies may run in parallel. This controls scheduling; it does not
mean their changes cannot overlap. A card has at most one active run.

- **One worktree per run**: create
  `git worktree add -b card/<id>/<run> .akb/worktrees/<id>/<run> <forkSHA>`. Record the target
  branch, fork commit, worktree, task branch, and run ID. Ignore `.akb/worktrees/` in Git. Retrying
  an interrupted step reuses the run's worktree; a requirement change creates a new run and
  worktree. Never overwrite an existing branch or worktree.
- **Separate board files from code**: declare board-managed paths such as `docs/kanban/` and
  exclude them from task worktrees. Pass the approved spec to the run, route proposed card updates
  through the board writer, and keep code changes in the worktree. Reject a task commit that
  changes a board-managed path; sparse checkout alone is not the enforcement boundary.
- **Review the committed tree**: commit all task changes and require a clean worktree before
  review. This makes the reviewed tree the exact candidate for landing.
- **Land one card at a time**: a repository-wide coordinator verifies the target branch and
  commit before landing. The index must be clean, and only board-managed paths may have local
  changes. Board changes stay unstaged. Path overlap with another card is a warning, not a reason
  to refuse landing. Stage only task changes, never `git add -A`.
- **Rebase before landing**: if the target branch moved, rebase onto its new tip, save that tip
  as the new comparison base, and rerun review and all required checks. Land the result as one
  squash commit and record its SHA.
- **Resolve conflicts as new work**: a conflict agent may inspect both specs, both diffs, and
  the checkout. Review its result from scratch. If the conflict remains unclear, add an open
  question that explains the conflict.
- **Protect local code changes**: uncommitted code blocks both start and landing. It is never
  copied into a worktree or included by rebase. A reviewed card waits safely on its task branch
  until the local code is clean. Commits made while a task runs are included during the landing
  rebase.
- **Manual commit mode**: boards that forbid tool-made commits run one card in place under an
  exclusive lock. Start with clean code and save the final patch before releasing the lock.
  Label it as a workspace snapshot because outside edits cannot be attributed reliably. Stop
  after review and record the human's commit before marking the card done.
- **Setup and cleanup**: the implement flow's rule may tell the agent how to prepare
  the worktree, such as installing dependencies. Keep worktrees while a run is active,
  blocked, or unaudited; remove them only after landing and only when clean. On startup, recover
  or report abandoned runs, interrupted rebases, and incomplete squash operations.

## Diffs on the card

- **Use the current base**: show `git diff <baseSHA>..<branch>`. Use the fork commit at first
  and the new target tip after a rebase. The original fork would include other cards' changes.
- **Keep the landed diff**: after landing, the squash commit is the permanent audit diff. Manual
  mode keeps a clearly labeled workspace snapshot instead.
- **Use diffs for audit**: show the diff on CardPage for investigation, trust-building, and
  reverting a task. The default policy should not require a human to read it.

## Flow rules

The single extension system: a user-written rule appended to a flow's built-in prompt. No
custom shell commands, and no per-run approval — that would break the one-click flow.

- **Any flow**: add-task, refine, revise, review, archive, split, and future flows each accept
  one rule.
- **Stored with the board**: one file per flow, such as `docs/kanban/rules/review.md`,
  versioned in git.
- **Managed in Configuration**: a "Flow rules" section in the configuration dialog lists every
  flow with a text box. Empty means the flow runs unchanged.
- **Checks**: a rule may tell the agent to run tests or linters with its own tools. A required
  failure is corrected, or becomes an open question that blocks landing. A non-blocking finding
  becomes a post-implementation note; full output stays in the audit log.
- **Other review models**: a rule may have review consult another model's CLI. Its verdict can
  still be wrong.

User-authored agent modules can come later; the rule system should leave room for them.

## Policy and risk levels

- **Optional diff approval**: a board may require approval of the exact reviewed tree before
  landing. A rebase, correction, or later tree change cancels that approval.
- **Critical cards**: a `critical` label requires diff approval and every check the flow rules
  require. Routine cards keep the default four-part review.

## Acceptance tests

Boards may add acceptance tests as a fifth review surface. Before implementation, an agent writes
the tests in the task worktree from the approved spec. The human approves their files and content
hashes before clicking Auto-implement. Changing, deleting, or weakening an approved test cancels
that approval. The acceptance tests and existing test suite must pass before landing.

This provides stronger evidence without promising zero defects.

## Audit trail

Create an audit record when a run starts. Record its run ID, agent sessions, approved spec, base
and task commits, state changes, corrections, agent/model and prompt versions, command results,
approvals, landing commit, timestamps, and redacted log references. Store it in a board-managed
path so archiving a card does not erase it. Never include that path in a code landing commit.

## Learning from bugs

A bug card may link to the run and landing commit that introduced it. Add the confirmed
lesson to `docs/kanban/memory/` so future planning and review use that evidence.

## Non-goals

- Do not promise a coverage or defect-prevention percentage. Promise only that the selected
  checks are enforced.
- Do not require the strictest policy for every card. Diff and acceptance-test approval remain
  optional.

## Suggested task breakdown

1. **Run records and board writer**: runs, saved states, spec hashes, serialized board updates,
   recovery, and audit data.
2. **Review and decisions**: correction rounds, post-implementation notes, new open questions,
   and repeat review. Depends on 1.
3. **Worktree management**: branches, board/code separation, clean-start rules, manual mode, and
   cleanup. Depends on 1.
4. **Landing**: locking, rebase, repeated checks, squash commits, conflicts, and recovery.
   Depends on 2–3.
5. **Card diff**: current-base diffs, landed diffs, and manual-mode snapshots. Depends on 3–4.
6. **Flow rules**: per-flow rule files, the Configuration pane, checks, and worktree setup.
   Depends on 1 and 3.
7. **Auto-implement action**: the one-click UI and CLI flow, concurrent-run limit, and landing
   queue. Depends on 2 and 4.
8. **Policy controls**: exact-tree approval and the `critical` level. Depends on 5–7.
9. **Acceptance tests**: generation, approval, protection, and required checks. Depends on 6
   and 8.
10. **Bug links**: connect a bug to its source run and landing commit. Depends on 1.

## Existing cards

This plan replaces conflicting decisions in cards #16, #48, and #50. Revise or replace them
before implementation. Keep useful UI and worktree details instead of creating duplicate tasks.
