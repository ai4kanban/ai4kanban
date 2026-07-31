---
title: Close a release and move the undone cards to the next one
track: skill
priority: med
roi: med
status: todo
blocked_by: [102]
related: [100]
modules: [skill]
questions:
  - "[user] Can a release be closed while cards in it are still open? (a) Close is always allowed and every open card moves to the release after it. (b) Close is only offered once every card in the release is done or rejected. Recommend (a): a version ships when the user says it ships, and the leftovers are exactly what the move rule is for."
---

A version ships and the board has to move on. Close the release, and the cards still open
in it move to the release after it instead of being left behind in a version nobody is
working on.

## Scope
- `release close <id>` marks the release closed in `docs/kanban/releases.md`.
- Every card still open in it moves to the next release on the list. If there is none, they
  go back to `next`.
- The command says what it did before it is done: how many cards moved, and where to.
- A closed release takes no new cards. `--release` naming it is an error that says it is
  closed.
- Closing is not undone by a second command. Reopening is `release new` for the next
  version and moving work into it.
- A card that was archived or rejected while the release was open is already off the board.
  Closing does not go looking for it.

## Todo
- [ ] Add `release close <id>`: mark it closed and move every card still open in it to the
      next release, or to `next` when it is the last one.
- [ ] Print what moved and where, so the user can read it before trusting it.
- [ ] Refuse a `--release` that names a closed release, and say it is closed.
- [ ] Say in the skill docs what closing does to the work that did not make it.
- [ ] Write the close-and-move rule into `docs/guides/daily-loop.md`.
- [ ] Check it by hand: close a release holding one done and two open cards, and see both
      open ones land in the next release.