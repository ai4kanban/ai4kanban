---
title: Flag a card that is too big to build in one run
track: skill
priority: med
roi: high
status: ready
release: ""
blocked_by: []
related: [118]
modules: [skill]
questions: []
verify:
  - run the new check on a real oversized card and see whether the split is the one you would have made
---

A card can be clear and still be three days of work. Nothing catches that today, so the
card goes to an agent as one run and comes back half done. Refine should judge size and
split the card that is too big before it is marked ready.

## Scope
- Refine runs one more check: can one agent run finish this card?
- A card is too big when any one of these is true:
  - it delivers two things a user could ask for separately;
  - one piece of it has to ship and be checked before the next piece can start;
  - it has more than eight unchecked todos of real work.
- A card that fails the check becomes several cards, in the order they have to be built.
- The original card keeps its id and becomes the first piece.
- Each later piece is a new card that waits on the one before it.
- The pieces become a group task instead when one of them is itself too big for one run.
- The original card gets one line naming what it was split into.
- Refine asks the user only when it can find no split that leaves every piece worth
  building on its own.
- That question lists the splits refine considered.
- The check never fires on a group root.
- The check never fires on a recurring card.
- A subtask that is too big splits into more subtasks under the same root, never into a
  group root of its own.

## Todo
- [ ] Add the size check and its rule to the refine flow, written so a user reading the
      flow can tell in advance which of their cards would fail it.
- [ ] Split a card that fails the check into cards in build order, the original keeping
      its id as the first piece.
- [ ] Build a group task instead when one of the pieces is itself too big.
- [ ] Ask the user, with the candidate splits as options, when no split leaves every piece
      worth building alone.
- [ ] Add the command that turns an open card into a group root, keeping its id, its links
      and its line in the board index.
- [ ] Exempt the cards the check must not fire on: a group root, a recurring card, and a
      subtask.
- [ ] Cover it in the daily-loop guide, so the user knows why a refine turned one card
      into several.

## Decided by the agent
- **Why not make every split a group?** A group is for a card whose pieces themselves need
  splitting, and this board already turned down writing a root above pieces that each
  deliver on their own. So the default is ordinary cards in a chain.
- **Why does the original card stay?** Keeping its id as the first piece keeps its history,
  its links and its place in the index through the split.
- **Why only at refine?** Every new card is refined right after it is written, so refine is
  already the gate every card passes. Nothing else needs a check of its own.
- **Why a rule and not a score?** Task Master scores complexity 1-10 against a threshold. A
  number nobody can predict is worse here than three lines a user can argue with.
- **Why not count files or modules?** A card that edits six files can still be one run's
  work. What costs a run is separate deliverables, not spread.
- **Where does the split live?** In one place. #118 splits cards that have sat too long and
  uses the same move on a different trigger.

### Worth noting
- Eight unchecked todos is a guess at where a card stops fitting one run. It is the only
  number in the rule and the easiest part to get wrong.
- Refine splits without asking. That widens what a refine does: today it rewrites one card,
  after this it can turn one card into four.

## Source
- Competitive analysis of Task Master, 2026-08-05 —
  https://github.com/eyaltoledano/claude-task-master; their `analyze-complexity` scores
  every task 1-10 against a threshold, and the `expand` that follows is a normal step in
  their loop rather than a rescue for a task that went stale.
