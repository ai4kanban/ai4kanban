---
title: Settle decisions.md from goal.md in setup, before the module map
track: skill
priority: high
roi: high
status: todo
blocked_by: []
related: [83]
modules: [skill, site]
questions:
  - "[user] How many questions may setup ask before it moves on? (a) No cap — keep going until every gap in goal.md has an answer. (b) A small cap, around 5; what's left becomes open questions on a card the board starts with. Recommend (b): setup is the user's first minutes with the product, and a long interrogation is a place to give up."
---

Settle the project-wide `decisions.md` from `goal.md` during setup itself — a short
conversation in the user's coding harness, not auto-refine — and do it before
`modules.md` is written. A new reference doc holds this setup flow.

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
  the project-wide `decisions.md` from it, then write `modules.md`, then propose the first
  tasks. Setup does not tell the user what shape the goal must take — the file has no fixed
  format.
- Settling `decisions.md` is a conversation, not auto-refine: the user is at the
  keyboard during setup, so the agent reads `goal.md`, asks the missing details a
  planner would need, and writes each settled answer as one line in the project-wide
  `decisions.md`. Anything the user leaves unanswered becomes open questions on a card,
  so the board holds them instead of losing them.
- The module map step covers a from-scratch repo: with code, read the code as today;
  without code, build the map from `goal.md` and `decisions.md` — that's why they are
  settled first.

## What the user sees
- Setup asks a few pointed questions about their goal, and ends with a `decisions.md`
  that holds the first settled calls and a module map that matches them — even in an
  empty repo.

## Todo
- [ ] Write `references/setup.md`: the agent's setup steps in order — goal, decisions,
      module map, first proposals.
- [ ] Write the decisions step in it: what to read in `goal.md`, what counts as a
      missing detail, where each answer goes, and where unanswered ones land.
- [ ] Cover the from-scratch repo in the module map step: no code to read means the map
      is built from `goal.md` and `decisions.md`.
- [ ] Point the install prompt at the new doc and cut the flow prose it replaces.
- [ ] Set up a fresh empty repo end to end and check `decisions.md` holds real settled
      lines and `modules.md` was written after them.
- [ ] Set up a repo with existing code and check the same order still holds.
