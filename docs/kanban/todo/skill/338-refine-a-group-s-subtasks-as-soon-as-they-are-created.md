---
title: Refine a group's subtasks as soon as they are created
track: skill
priority: med
roi: high
status: todo
release: 0.8.0
blocked_by: []
related: [141]
modules: [local-ui, skill]
questions:
  - question: "[user] Should finishing setup start a refine on each of the 10 first cards it creates?"
    mode: single
    options:
      - Yes — those cards are the roughest on the board and nothing else picks them up
      - No — a brand-new board would spend 10 refine loops before you have looked at it; leave setup's cards to your own Refine
    recommend: [1]
---

A subtask is born rough: the run that split the group wrote enough to name the piece, not
enough to build it. An add-task run already leaves a refine on every card it wrote, but a
refine pass that splits a card into a group starts nothing, so the new subtasks sit at
`todo` with nobody coming for them. Make a card a run creates get its refine whichever run
created it.

## Worth noting
- **Which cards does a refine pass follow — every card it touched, or only the ones it
  created?**: only the ones it created. The pass is already in its own loop for its own
  card, and the cards it merely edited were edited by the judgment that just closed; a
  refine on those spends a run re-doing it.
- **Several subtasks means several loops at once**: a group split into four children starts
  four refine loops, each up to six passes — the same fan-out add-task already produces.
  Metering them behind a queue would be a second, slower answer to a cost nobody has
  complained about yet.

<!-- agent -->

## Scope
- **A created card gets its refine whoever created it**: `refinesAfter`
  (`cli/src/lib/agent/refine.ts`) drops the whole follow-up when the run's own action is
  `refine`, `implement`, `setup` or `spec`. For those actions it instead returns a refine
  for each card that is on the board now and was not in the `before` mark — a card the run
  created — and nothing for a card it only changed.
- **Every other action keeps what it has**: `create`, `propose`, `resolve`, `review` and
  the rest still follow every card they changed, the ones they created included.
- **The existing filters still apply**: skip a card that is blocked, already carries a
  schedule, or that `canRefine` says a refine would not move. A blocked subtask keeps the
  one-shot schedule `board create --blocked-by` gives it at creation.
- **The loop's own card is never doubled**: a refine pass's own card is excluded from these
  starts, as it already is today.

## Todo
- [ ] Give `refinesAfter` the created-cards path for the actions that follow nothing today.
- [ ] Cover it with tests: a refine run that creates a group starts a refine per unblocked
      subtask and none for the cards it merely edited; a blocked subtask starts none; an
      action outside the list still follows every card it changed.
- [ ] Say in `docs/guides/daily-loop.md` ("Push a card forward") that a card a run splits
      off comes back refined too.
- [ ] Note in `docs/kanban/memory/local-ui/readme.md` that a subtask is refined as soon as
      it is created, alongside "the refine that follows a run".
