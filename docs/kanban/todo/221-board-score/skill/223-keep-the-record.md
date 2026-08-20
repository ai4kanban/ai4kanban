---
title: Keep the record the numbers need, as the board runs
track: skill
priority: high
roi: high
status: todo
release: 0.7.1
blocked_by: [222]
related: [221]
modules: [skill]
questions: []
---

The board throws away the very things its score needs. An answered question is cleared off
the card, and a rejected card is deleted. By the time anyone wants a number, the evidence
is gone. Keep it while the work happens.

## Today
- A card does not say where it came from — the board proposed it, or a person asked for it.
- A question is cleared once it is answered, so nothing says how many the board settled
  itself and how many it handed over.
- A rejected card is deleted, so the cards the board proposed and we turned down leave no
  trace beyond a daily count.

## Scope
- Start from the list #222 leaves: per number kept, what has to be recorded and what the
  board does not record yet.
- Record only what the numbers kept by #222 actually need.
- A card says where it came from: the board proposed it, or a person asked for it.
- A question is counted before it is cleared: who owned it, and who answered it in the end.
- A call the board made on its own, that a person later overruled, is counted as overruled.
- An overrule is counted when the user corrects a card and the board writes that correction
  down.
- A correction the board never sees — a card edited by hand — stays uncounted. #222 names
  this as the blind spot of the overrule number.
- A rejected card leaves its counts behind after the card file is gone.
- Every count is written while the work happens, never worked out afterwards by reading git.
- The user is asked for nothing new.
- Every count comes from a move the board already makes.
- The record is plain text in the repo, read and reviewed like the rest of the board.
- Where the board already records what a number needs, leave it alone.

## Todo
- [ ] record where a card came from — proposed by the board, or asked for by a person
- [ ] count a card's questions by who answered them, before they are cleared
- [ ] count a call the board made alone that a person later overruled
- [ ] keep a rejected card's counts after the card is deleted
- [ ] run a week of real board work and check the counts match what the cards say

## Decided by the agent
- **Counted as it happens, not read back out of git** — the history does hold the deleted
  cards, but digging a number out of diffs breaks the first time a flow changes shape, and
  nobody can check the result by eye.
- **No new step for the user** — a number that costs a person a click stops being collected
  within a month.
- **Recording comes after the definitions** — #222 decides which numbers survive, and only
  those get anything built for them. Recording first would build for numbers we then cut.
