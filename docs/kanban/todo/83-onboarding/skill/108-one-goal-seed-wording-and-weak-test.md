---
title: Make the goal.md seed one wording and the weak test simple
track: skill
priority: med
roi: med
status: ready
release: 0.5.0
blocked_by: []
related: [83]
modules: [skill, local-ui, docs]
questions: []
---

New boards give two different starting descriptions for `goal.md`, and a goal the user
has written can still be called weak. Give the file one starting point and stop judging
free-form prose.

## Scope
- Use one short, free-form seed in a new `goal.md` and in the goal editor when the file
  is missing. It says the goal holds the user's long-term direction, not the current
  cards, and links the guide on what a good goal can cover.
- A goal is `weak` only when it is missing, empty, or still the untouched seed. Any
  other text counts as at least `good`; no agent judges it against a format.
- The goal nudge follows that same rule. After the user writes a goal, stale review
  metadata cannot bring the nudge back on reload.
- Keep all three review values documented: `strong`, `good`, and `weak`. `strong` and
  `good` both mean the goal does not need a nudge.

## What the user sees
- The same words whether they open `goal.md` in an editor or the UI's goal box.
- Once they write a goal, the nudge stops. It comes back only if the file is removed,
  emptied, or put back to the seed.

## Decided by the agent
- Does an empty file count as missing? Yes. Neither contains a user-written goal.
- Can stale `reviewed: weak` metadata bring the nudge back after a save? No. The text
  itself is the source for the mechanical weak rule.

## Todo
- [ ] Give a newly scaffolded file and the missing-file goal editor the same seed,
      including the guide link.
- [ ] Use the goal text as the mechanical weak test everywhere the board decides
      whether to show the nudge.
- [ ] Update the skill rules, the daily-loop guide, and the local UI guide with the
      three review values and the new weak rule.
- [ ] On a fresh board, compare the file and editor text, write a goal, reload the
      board, and check that the nudge stays gone.
