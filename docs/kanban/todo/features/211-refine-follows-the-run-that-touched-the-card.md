---
title: Drop the auto-refine switch — a refine follows the run that touched the card
track: features
priority: med
roi: high
status: todo
release: 0.6.0
blocked_by: []
related: []
modules: [skill, local-ui]
questions: []
---

Ask the board to add a card, change one, or answer its questions, and that same agent run
keeps going afterwards to refine what it just wrote. You see one long run in the panel and
can't tell the two jobs apart. Separately, a timer picks cards out of the backlog and refines
them on its own, behind an **Auto-refine** switch in the settings.

Split the first job in two and delete the second. A command does what you asked and stops.
The board then starts a refine on that card as its own run — visible, with its own log, and
stoppable. Nothing hunts through the backlog any more, so the switch and the timer's refine
pass go away: every refine now follows something you just did.

## Scope
- **A command does one job and stops.** Adding a card, changing one, or answering its
  questions no longer rolls into a refine at the end of the same run.
- **The board refines the card afterwards, as its own run.** It sits in the runs panel with
  its own log and can be stopped like anything else.
- **A run that wrote several cards gets one refine run per card.** Ask for three new cards or
  a group task and each card is refined.
- **Cards a refine can't move are skipped**: one still waiting on a blocker, one the run
  already left `ready`, a recurring card, one whose todos are all ticked, one whose open
  questions are all yours to answer.
- **Finishing or rejecting a card refines the ones it was holding up.** Archive or reject a
  card and every card it was blocking that now has nothing left in its way gets its own
  refine run. A group task's subtasks are refined one wave at a time, each when its turn
  comes. The group's own main card is not refined by a subtask finishing — only by a run
  that changes its plan.
- **The Auto-refine section leaves the settings** — the switch and the "cards at once"
  stepper both — and so does `akb agent auto-refine`.
- **The Refine button on a card page does not change.** It is still there, on the same cards,
  and still the way to refine something whenever you want.
- This hangs off the end of a run, so it works the same whether the run started from the
  board UI or from a terminal.

## Decided by the agent
- **Does anything still refine a card nobody touched?** No, and nothing needs to. A refine
  run already loops a card all the way to ready by itself, so one follow-up per card is
  enough. A card left over from before this change gets its refine from the Refine button.
- **Why keep skipping a blocked card?** Because building the blocker often changes the plan
  of what comes after it, so a refine now is a refine you throw away. Waiting until the
  blocker is gone gets it refined at the moment it can be built.
- **Does the unblock refine count as "something you just did"?** Yes — archiving or rejecting
  a card is a command like any other, so its follow-up refines hang off the end of that run,
  from the board UI or from a terminal.
- **A card you write by hand in your editor, with no run?** No follow-up. There is no run to
  hang it off, and you are right there.
- **How many refine runs go at once?** Not this card's business. They are ordinary runs and
  take whatever limit ordinary runs take.
- **Where does the board's autonomy setting live now?** Nowhere, and that is a change of
  plan. `decisions.md` says the auto-refine switch is the one on/off switch for the whole
  board, with auto-implement joining it later as a sibling. With the switch gone,
  auto-implement (#16) brings its own setting instead.
- **Which runs get a follow-up refine?** Every run except an implement and a refine. An
  implement is building the plan, not writing it — a refine landing on a card mid-build
  would rewrite the very plan being followed — and a refine that starts a refine never
  ends. The other half of the rule is separate: a card whose last blocker just left is
  refined after any run at all, an implement included, because archiving inside an implement
  run is how a card usually leaves the board.
- **What about a run that failed or that you stopped?** Nothing follows it. It left the
  board half-written, and a refine of half a card is a refine you throw away. The same goes
  for a run whose process was killed outright.
- **A run that changes a group root — does the root get refined?** Only when the run
  changed the plan. Finishing or rejecting a subtask ticks or strikes its line on the root,
  and that mark alone doesn't count: it is the group's progress bar, not a new plan, and
  counting it would refine the root once for every subtask that finishes. Edit the root
  itself and it is refined like any other card.
- **What is left of the Configuration dialog's sidebar with one section in it?** The
  sidebar stays. It is how the dialog grows, and auto-implement is already due to bring a
  section of its own.

## Todo
- [x] Make the add-a-card, change-a-card and answer-the-questions runs stop when their job is
      done, instead of refining the card in the same session.
- [x] After a run finishes, start a refine on each card it wrote or changed, each as its own
      run.
- [x] Skip the cards a refine can't move — still blocked, already ready, recurring, all todos
      ticked, or waiting only on your answers.
- [x] After a card is archived or rejected, start a refine on each card it was blocking that
      has nothing left in its way.
- [x] Delete the timer's pass that hunts the backlog for cards to refine.
- [x] Delete the **Auto-refine** section from the settings — the switch and the "cards at
      once" stepper — and the settings behind them.
- [x] Delete the `akb agent auto-refine` command, and drop auto-refine from what `akb agent`
      reports.
- [x] Fix the message that tells you to "let auto-refine take it to ready first" when you try
      to build a rough card — point it at the Refine button instead.
- [x] Update what we say about it: the board UI's README, `cli/README.md`,
      `docs/guides/daily-loop.md`, and the main README and its Chinese version.
- [x] Rewrite the autonomy line in `docs/kanban/memory/decisions.md` — the board no longer
      has one on/off switch for what it does on its own.
- [x] Stop a subtask finishing or being rejected from counting as a change to its group's
      main card, so a group of ten subtasks doesn't refine its main card ten times.
- [ ] Add two cards from the UI, then change one, and check each comes back refined as its
      own separate run.
- [ ] Ask for a group task and check only the free subtasks come back refined, then finish
      one of them and check the subtask it was blocking refines itself right after.
