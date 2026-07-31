---
title: Write a guide on what makes a good goal, and point setup at it
track: docs
priority: med
roi: med
status: todo
blocked_by: []
related: [83, 84]
modules: [docs, skill]
questions: []
---

`goal.md` has no fixed format, so nothing tells a first-time user what belongs in it.
Write that down once as advice — a guide they read or skip — and link it where they are
asked to write the goal.

## Today
- Setup asks the user to write the goal in their own words and stops there.
- A user opening an empty `goal.md` has to guess: the business goal? this quarter? a
  feature list?
- Every proposal is judged against this file, so a guess costs them later.

## Scope
- A new page in `docs/guides/`: what a good goal covers — the business goal, the long
  horizon it aims at, a rough roadmap of what comes next, and the direction behind it.
  Short, with one example of a goal written well.
- Advice, not a format. Nothing checks a goal against the guide, and a goal that ignores
  it is still a good goal. Say that in the page itself, so nobody reads it as a template.
- Setup's goal step links the guide when it asks for the goal — one line the user can
  skip.
- The UI's write-the-goal box links the same page.

## What the user sees
- One page that answers "what am I supposed to put in this file?", linked at the moment
  they are asked to write it — in setup and in the UI.

## Decided by the agent
- Where does setup point, given the guide lives in this repo and setup runs in the
  user's? At the published link. The guide is advice for a person; the skill folder
  carries the agent's instructions, and a copy shipped into every project would go stale.

## Todo
- [ ] Write the guide page in `docs/guides/`.
- [ ] Link it from setup's goal step in `references/setup.md` (#84).
- [ ] Link it from the UI's write-the-goal box.
- [ ] Read the page as a first-time user with an empty `goal.md` and check it answers
      what to write without turning into a form to fill in.
