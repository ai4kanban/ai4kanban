---
title: Refine a group's subtasks as soon as they are created
track: skill
priority: med
roi: high
status: ready
release: 0.8.0
blocked_by: []
related: [141]
modules: [local-ui, skill]
questions: []
---

A subtask is born rough: the run that split the group wrote enough to name the piece, not
enough to build it. An add-task run already leaves a refine on every card it wrote, but a
refine pass that splits a card into a group starts nothing, so the new subtasks sit at
`todo` with nobody coming for them. Give every card the refine that follows its creation,
whichever run created it.

## Worth noting
- **Which cards does a refine pass follow — every card it touched, or only the ones it
  created?**: only the ones it created. The pass is already in its own loop for its own
  card, and the cards it merely edited were edited by the judgment that just closed; a
  refine on those spends a run re-doing it.
- **Does finishing setup refine the first cards it writes?**: yes. They are the roughest
  cards the board will ever hold and nothing else comes for them; the alternative is the
  user pressing Refine ten times on a board they have not read yet.
- **Should the board meter the loops several created cards start?**: no. A group split into
  four children starts four refine loops, and a finished setup up to ten, each up to six
  passes — the same fan-out add-task already produces, and a brand-new board opens with
  those runs already going. A queue would be a second, slower answer to a cost nobody has
  complained about yet.

<!-- agent -->

## Scope
- **A created card gets its refine whoever created it**: `refinesAfter`
  (`cli/src/lib/agent/refine.ts`) drops the whole follow-up when the run's own action is
  `refine`, `implement`, `setup` or `spec`. Those actions instead start a refine on each
  card that is on the board now and was not in the run's `before` mark, and nothing on a
  card they only changed.
- **Every other action keeps what it has**: `create`, `propose`, `resolve`, `review` and
  the rest still follow every card they changed, the ones they created included.
- **Setup follows the whole board**: a setup run that finished starts a refine on every card
  the board holds, not only the ones that run created.
- **The existing filters still apply**: skip a card that is blocked, already carries a
  schedule, or that `canRefine` says a refine would not move. A blocked subtask keeps the
  one-shot schedule `board create --blocked-by` gives it at creation, and setup's questions
  card is skipped because its questions are all `[user]`.
- **The loop's own card is never doubled**: a pass's own card was on the board before it
  ran, so it is never in the created set, and the filter that keeps a resolve from starting
  a second run on it stays.
- **Setup says what it started**: the lines that close a setup run say each of the first
  cards is getting a refine of its own, so a board that opens with runs going is explained
  rather than surprising.

## Todo
- [ ] Give `refinesAfter` the created-cards path for the actions that follow nothing today,
      and the whole-board path for setup.
- [ ] Cover it with tests: a refine run that creates a group starts a refine per unblocked
      subtask and none for the cards it merely edited; a finished setup starts one per card
      the board holds; a blocked subtask starts none; an action outside the list still
      follows every card it changed.
- [ ] Add the closing line to `cli/src/guide/setup.md` ("When setup ends").
- [ ] Say in `docs/guides/daily-loop.md` ("Push a card forward") that a card a run splits
      off comes back refined too, and that finishing setup refines its first cards.
- [ ] Note in `docs/kanban/memory/local-ui/readme.md` ("Refining") that a card is refined as
      soon as a run creates it, setup's first cards included.

## Decided by the agent
- **Why does setup follow the whole board rather than only the cards it created?**: the
  `before` mark is taken per run and only a run that finished starts follow-ups, so a setup
  that failed part-way and was started again would leave the first attempt's cards
  unrefined. The setup gate means no card but setup's own and the install's questions card
  can be on the board, so the wider net catches nothing else.
