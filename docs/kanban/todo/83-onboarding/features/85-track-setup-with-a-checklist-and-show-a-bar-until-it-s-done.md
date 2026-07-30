---
title: Track setup with a checklist and show a bar until it's done
track: features
priority: high
roi: high
status: todo
blocked_by: [84]
related: [83]
modules: [skill, local-ui]
questions:
  - "[user] Where does setup-checklist.md live? (a) At the board root, next to config.md, so the UI and every flow read it at one fixed path. (b) Inside memory/. Recommend (a): it is board state, not memory."
  - "[user] When setup is done, does the file stay? (a) Keep it, fully ticked, as a record of how the board was set up. (b) Delete it — a missing file already means setup is done. Recommend (b): a ticked list nobody reads again is clutter, and missing-means-done stays one rule."
  - "[user] The goal can turn weak again later, when an agent re-judges it. Does the bar come back for that one item? (a) Yes — the goal item unticks and the setup bar returns. (b) No — after setup the bar is gone for good, and a weak goal shows only on the goal page. Recommend (a): the nag exists because proposals are judged against the goal, and that stays true after setup."
  - "[user] May the user add a card by hand while setup is unfinished? (a) No — the board takes no cards until the last box ticks, one rule with no exceptions. (b) Yes — the wait applies only to agent flows; a card the user types in is their call. Recommend (a): the last step creates the first tasks from the settled memory, and a card added earlier is planned against a board that isn't ready."
---

Setup keeps a checklist of its own steps in `setup-checklist.md` and ticks each box as a
step finishes. The UI shows one bar until every box is ticked. The weak-goal bar today is
one special case of this; it becomes one item on the list. Creating the first tasks is
the last box on the list: until it ticks, the board holds no cards.

This bar is the whole onboarding UI. It stays simple: when the next step needs the agent,
the bar shows the instruction to copy into the coding harness — like `/kanban setup the
current board` — and moves when the step ticks. The UI never runs setup itself.

## Today
- Setup is a run of steps with no record of which ones finished. A run that dies halfway
  leaves a board that looks done.
- The UI nags about exactly one unfinished step: when `goal.md` is judged weak, a bar
  asks the user to write the goal. Every other missing piece — an empty config, no module
  map, no first cards — shows nothing.
- Nothing in the UI says what to run next. A user with an unfinished board has to go back
  to the docs to find the setup instruction.

## Scope
- Setup writes `setup-checklist.md` at the start — one box per setup step, in the order
  the setup doc (#84) fixes. Each step ticks its own box when it finishes.
- Generalize the goal bar into a setup bar: it shows while any box is unticked, says
  which step comes next, and drops out when the last box is ticked. The weak goal is one
  item on the list, not its own bar; writing the goal stays that item's action.
- When the next step needs the agent, the bar shows the instruction to copy into the
  coding harness — like `/kanban setup the current board` — with a copy button. The UI
  does not start the setup run; the user pastes the instruction and the bar moves when
  the step's box ticks.
- A board with no checklist file shows no bar, so boards set up before this change stay
  quiet.
- The checklist is also how any flow asks "is setup done" — it reads the file instead of
  guessing from blanks in `config.md`.
- No cards before the last box. Creating the first tasks (#86) is the checklist's last
  item; no earlier setup step creates a card. While any box is unticked, the flows that
  create cards — propose, add — wait for setup to finish. A run that dies halfway leaves
  a board with no cards, not a half-planned one.

## What the user sees
- One bar that says how far setup got and what comes next, until the board is fully set
  up. A setup that died halfway is visible at a glance instead of looking finished.
- When the next step needs the agent, the bar hands them the instruction to copy into
  their coding harness. Proceeding is one paste, not a trip to the docs.
- No cards until setup's last step. The first cards appear at the moment the bar goes
  away, never before.

## Decided by the agent
- What does a missing checklist mean? Setup is done. Boards set up before this change
  have no file, and they must never start nagging.

## Todo
- [ ] Fix the checklist: which steps it lists, its exact place on the board, and which
      flow writes the first version.
- [ ] Make each setup step tick its own box when it finishes.
- [ ] Turn the goal bar into the setup bar: show it while boxes are unticked, name the
      next step, keep write-the-goal as the goal item's button.
- [ ] Show no bar when the file is absent, so existing boards stay quiet.
- [ ] Show the copyable harness instruction on the bar when the next step needs the
      agent, like `/kanban setup the current board`.
- [ ] Put creating the first tasks (#86) last on the checklist and make sure no earlier
      step creates a card.
- [ ] Make the propose and add flows wait while any box is unticked.
- [ ] Kill setup halfway, open the UI, and check the bar shows the remaining steps and
      the board has no cards; finish setup and check the bar goes away and the first
      cards appear.
