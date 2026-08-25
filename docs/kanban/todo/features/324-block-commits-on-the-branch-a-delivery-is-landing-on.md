---
title: Block commits on the branch a delivery is landing on
track: features
priority: high
roi: high
status: todo
release: ""
blocked_by: []
related: []
modules: [skill]
questions:
  - "[user] Should the hook be installed by default? Installing it from `akb update` means an existing user's next commit can suddenly fail on a board they never configured for it — safe, since the refusal names its own escape hatch, but it is still the board reaching into git on their behalf. The alternative is a setting that is off until they turn it on, which protects nobody who does not already know about this failure."
---

A delivery forks from your last commit and lands back on the branch you were on. Every
commit you make on that branch while it builds moves the target under it, so the board
rebases — and after three rebases it gives up, stops, and leaves you to finish the landing
by hand. Nothing warns you at the moment that costs you: the commit succeeds, and the
failure arrives an hour later. Refuse that commit instead, and say which delivery it would
break.

## Worth noting
- **Only the branch a delivery is landing on**: a commit on any other branch is free, so
  the block is not "no committing while the board works". You keep your own branches, and
  the one rule you have to remember is the one that matches the actual failure.
- **`--no-verify` is the way past it**: git's own escape hatch, so nobody has to learn a
  board setting to get out of the way of the board. It also means the block is advice with
  teeth rather than a lock — the user is always the one who decides.
- **The board can't lock itself out**: every git command it scripts already runs with
  `core.hooksPath=/dev/null` and `--no-verify` (`cli/src/lib/agent/worktree.ts`), so its own
  squash, rebase and landing commits never see this hook. Worth stating because git shares
  one hook directory across every worktree, which is the shape of bug this would otherwise
  have.
- **A repo that already has a `pre-commit` hook is left alone**: the board writes one only
  where there is none, and otherwise prints the line to add. Taking over somebody's existing
  hook to protect them from a rebase is a bad trade.

<!-- agent -->

## Scope
- **Refuse the commit**: a `pre-commit` hook that fails when the checkout's current branch is
  the `targetBranch` of an active delivery whose landing has not finished, naming the
  delivery, its card, and `--no-verify` as the way past.
- **Read the board directly**: the hook reads the delivery records itself rather than
  shelling out to `akb`, so a commit does not pay a node start-up and the hook works before
  `cli/dist` is built.
- **Let it through everywhere else**: another branch, no active delivery, a delivery in
  manual commit mode (there the user's commit IS the landing), or a commit made inside a
  delivery's own worktree under `.akb/worktrees/`.
- **Install it where the skill is installed**: `akb skill install` and `akb update` write
  `.git/hooks/pre-commit` when there is none. Where a hook already exists, write nothing and
  print the one line to add to it.
- **Say it is there**: `akb skill` reports whether the hook is installed, next to what it
  already says about the skill.

## Todo
- [ ] Write the hook script and the check it runs: current branch vs. the active deliveries'
      `targetBranch`, skipping manual-mode deliveries and worktree checkouts.
- [ ] Word the refusal — the delivery, the card, and `--no-verify`, in the same one-line
      style as the landing refusals in `cli/src/lib/agent/landing.ts`.
- [ ] Install it from `akb skill install` and `akb update`, never over an existing hook.
- [ ] Report it in `akb skill`.
- [ ] Cover it with tests: a commit on the target branch refused, a commit on another branch
      allowed, a commit with no delivery in flight allowed, a worktree commit allowed, and an
      existing hook left untouched.
- [ ] Document it where the delivery workflow is taught (`docs/guides/`), one line.
