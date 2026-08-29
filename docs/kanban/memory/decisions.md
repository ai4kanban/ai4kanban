# Decisions

Settled answers to cards' open questions for the project as a whole — the calls that
aren't any single module's. A module's own decisions live in
`docs/kanban/memory/<module>/decisions.md`, never here.

Keep only **user-facing** calls that still guide future planning — what a user can see,
do, or would care about. Code detail stays on the card. Read before proposing so you
don't re-ask a settled call.

## What local-first promises

- Local-first is a promise about the default backend — markdown in git — not about every
  backend a user can pick.

## How far agents go alone

- There is no single on/off switch for what the board does on its own, and no ladder of
  levels. Work that needs no user follows whatever caused it — a refine follows the run
  that touched the card — and each further step brings its own setting if it needs one.
- One click already carries a card from build to landed and archived. The next step is the
  board starting a `ready` card with no click at all, which waits on limits for concurrent
  runs, card count and spend. Letting it reject a card is a separate feature: nothing today
  ever decides a card should be rejected.
