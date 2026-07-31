---
title: Settle decisions.md from goal.md in setup, before the module map
track: skill
priority: high
roi: high
status: todo
blocked_by: []
related: [83]
modules: [skill, site]
questions: []
---

Settle the project-wide `decisions.md` from `goal.md` during setup itself, before
`modules.md` is written. Setup asks the user nothing: it settles what it can from the
goal, and leaves the rest as open questions on the board. A new reference doc holds this
setup flow.

## Today
- Setup fills `config.md`, writes `modules.md` from the code, then proposes the first
  tasks. `decisions.md` stays empty until individual cards raise questions, one at a
  time.
- So the gaps in the goal — who it's for, what's out of scope, what done looks like —
  surface late, card by card, instead of once at the start.
- The module map is read from the code. That works on a repo that has code. A project
  started from scratch has none — there is nothing to read, so the map would be a guess.

## Scope
- Write a new reference doc — `references/setup.md` — for the judgment half of setup:
  the steps the agent runs inside the user's coding harness after the install script
  (#81) has done the mechanical part. The install prompt points at this doc instead of
  spelling the flow out.
- The doc fixes the order: ask the user to write `goal.md` in their own words, then settle
  the project-wide `decisions.md` from it, then write `modules.md`, then create the first
  tasks. Setup does not tell the user what shape the goal must take — the file has no fixed
  format.
- Setup never stops to ask. The agent reads `goal.md`, works out the details a planner
  would need, and settles every one it can from the goal and common sense — each as one
  line in the project-wide `decisions.md`. There is no cap on how many it settles.
- Every detail it can't settle becomes an open question tagged `[user]`, on the cards
  setup creates in its last step. No cap there either. The user answers them afterwards
  through the board's normal resolve flow, in the UI or the harness, never during setup.
- The module map step covers a from-scratch repo: with code, read the code as today;
  without code, build the map from `goal.md` and `decisions.md` — that's why they are
  settled first.

## What the user sees
- Setup runs start to finish without asking anything. It ends with a `decisions.md` that
  holds the first settled calls, a module map that matches them — even in an empty repo —
  and every question it couldn't answer waiting on the board.

## Decided by the agent
- Where do the unanswered questions live, when no card exists yet? On the cards setup
  creates in its last step. Setup keeps each gap as it goes and attaches it to the card it
  affects; a gap about the whole project goes on the root card. Nothing earlier can hold
  them — a question on no card is a question nobody sees.
- Does setup end by asking the user to confirm what it settled? No. Every call is a line
  in `decisions.md` they can read and overrule at any time; a review step at the end would
  be the interrogation this card removes.

## Todo
- [ ] Write `references/setup.md`: the agent's setup steps in order — goal, decisions,
      module map, first tasks.
- [ ] Write the decisions step in it: what to read in `goal.md`, what counts as a missing
      detail, and that the agent settles every one it can without asking.
- [ ] Write where the rest goes: each detail setup can't settle becomes a `[user]` open
      question on a card setup creates in its last step.
- [ ] Cover the from-scratch repo in the module map step: no code to read means the map
      is built from `goal.md` and `decisions.md`.
- [ ] Point the install prompt at the new doc, cut the flow prose it replaces, and drop
      its "ask me at most 3 short questions" line — setup infers and says what it chose.
- [ ] Set up a fresh empty repo end to end and check setup asked nothing, `decisions.md`
      holds real settled lines, `modules.md` was written after them, and the leftover
      questions sit on the board.
- [ ] Set up a repo with existing code and check the same order still holds.
