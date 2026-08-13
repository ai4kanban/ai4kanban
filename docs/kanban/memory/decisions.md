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

- The board has no single on/off switch for what it does on its own, and there is no
  ladder of levels. Work that needs no user follows the thing that caused it: a refine
  follows the run that touched the card. Each further autonomy step brings its own setting
  if it needs one.
- The next level is auto-implement: the agent builds a `ready` card on its own. Letting
  the agent archive a card too waits until an archived card is kept instead of deleted.
  Letting it reject a card on its own is a separate feature — nothing today ever decides
  a card should be rejected.
