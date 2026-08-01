---
title: Make the goal.md seed one wording and the weak test simple
track: skill
priority: med
roi: med
status: todo
release: next
blocked_by: []
related: [83]
modules: [skill, local-ui]
questions: []
---

The script's `goal.md` seed and the UI's starting text say different things about the
same file. Make them one wording, and make "weak" mean one plain thing: the goal is
missing, or still that seed.

## Today
- `kanban.mjs` seeds `goal.md` with one wording; the UI's goal box shows a different,
  shorter one when the file isn't there. Two answers to "what goes in this file".
- The `reviewed:` field's test is "too vague to plan from". With no format behind the
  file, that is a guess — and nagging a user about a goal they did write is worse than
  not nagging at all.
- `docs/guides/daily-loop.md` still describes two states, `strong | weak`.

## Scope
- One seed wording, short and free-form, in the script; the UI's starting text is the
  same words. It says the file is the user's own words and what it is not — not this
  week's work, that's the cards — and links `docs/guides/what-makes-a-good-goal.md` for
  what a good one covers, at the published URL setup already uses.
- The weak test becomes mechanical: `weak` only when `goal.md` is missing or still the
  seed. Anything the user wrote counts as at least `good`. No agent judges free-form
  prose against a format that doesn't exist.
- Update the docs that state the old test: the `reviewed:` line in `SKILL.md` and
  `docs/guides/daily-loop.md`, which is also missing the third state.

## What the user sees
- The same words whether they open `goal.md` in an editor or the UI's goal box.
- Once they write a goal, the nag stops for good. It comes back only if the file goes
  missing or is put back to the seed.

## Decided by the agent
- What still separates `strong` from `good`? Nothing the user sees. Both mean clear
  enough to plan from and the UI treats them alike; only `weak` has a rule.
- Does saving the goal in the UI write the field itself? No. The agent still owns
  `reviewed:`; the UI hides the bar for the session after a save, as it does today.

## Todo
- [ ] Write the one seed wording in `kanban.mjs` and use the same words in the UI's goal
      box.
- [ ] Rewrite the weak test in `SKILL.md`: missing or still the seed, nothing else.
- [ ] Fix `docs/guides/daily-loop.md`: three states, and the new test.
- [ ] Scaffold a fresh board, open the UI, and check the file and the goal box say the
      same thing; write a line into the goal and check the nag does not come back.
