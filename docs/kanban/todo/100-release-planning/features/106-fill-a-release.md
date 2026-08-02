---
title: Fill a new release with the high-priority cards
track: features
priority: low
roi: med
status: ready
release: next
blocked_by: []
related: [100]
modules: [skill, local-ui]
questions: []
---

Every version starts with the same set of cards: the ones marked high priority. Put them in
when the release is made, instead of moving them one at a time.

## Scope
- The fill is a rule the board runs, not a judgment call. Nothing reads a card to decide how
  big or how urgent it is, so the user can say what will happen before it happens.
- It looks only at the cards sitting at `next`. **A card goes in on three tests**: its
  priority is high, nothing open is blocking it, and it is not a group root. Nothing else is
  looked at.
- A subtask is tested on its own, so a group's urgent piece can go into a version even
  though its root can't.
- It only ever adds. A card already in a release stays where it is — a plan someone made by
  hand is never second-guessed.
- This happens when the release is made, and only then. The New release dialog gets one
  toggle: put the high-priority cards in. It is on, and it says how many cards that is, so
  the user sees the number before making the release. Turned off, the release is made empty,
  exactly as today.
- The same run from the terminal is `release new v1 --fill`. Without the flag the command
  does what it does today.
- The run says what it moved, one line per card, and names any high-priority card it left at
  `next` with the test it failed, so nothing is dropped silently. A card that should not have
  gone in is moved back the same way any card's release is changed.
- With nothing at `next` to move, the toggle says so and the release is made empty. A board
  that marks nothing high priority is never told it did something wrong.
- Topping up a release that already exists is not part of this. Ticking cards and moving them
  in one action (#114) is the way to do that.

## Todo
- [ ] Add the fill to `release new`: the three tests, the cards it moves, and what it leaves
      alone.
- [ ] Report what moved and which high-priority cards were skipped, one line each, with the
      test a skipped card failed.
- [ ] Add the toggle to the New release dialog, with the count of cards it would move.
- [ ] Write it into `skill/SKILL.md`, `kanban-ui/README.md`, `README.md`, `README-zh.md` and
      `docs/guides/daily-loop.md`.
- [ ] Check it by hand on a board with a mixed backlog: make a release with the toggle on,
      read every line of the report, and see that nothing already in another release moved.

## Decided by the agent
- **The fill runs when the release is made, and nowhere else.** A version is planned the
  moment it is created, and a fill that could be re-run on a filled release would keep
  pulling back work the user had already taken out. #114 is the way to add more later.
- **The toggle is on in the dialog, the flag is off in the terminal.** The dialog shows the
  count beside the toggle and the board lands on the new release with the cards in it, so
  the move is on screen as it happens. The terminal shows nothing beforehand, and an
  existing command must not start moving cards on boards that never asked for it.
- **No cap on how many cards go in.** The count sits on the toggle before the release is
  made, so a user who thinks it is too many unticks it. A cap would need a rule for which
  cards win it, and every candidate scores the same on the only thing the fill reads.
- **A card that still needs refining goes in.** A release says what ships, not what is ready
  to build today, and `release list` already prints the ready count beside the card count.
- **Blocked means blocked by a card that is still open.** An archived blocker is not in the
  way of anything, so the card it named is a candidate like any other.
- **A blocker card goes in like any other card.** It is high-priority work in the way of this
  version, and it stays on screen under every release anyway, so giving it a version hides
  nothing.
