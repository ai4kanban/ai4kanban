---
title: "Releases: plan what ships in this version and what waits"
track: features
priority: med
roi: high
status: ready
blocked_by: []
related: [102, 103, 104, 105, 106]
modules: [skill, local-ui]
questions: []
---

The board knows what a task is, but not when it ships. Give a card a release, so the user
can say "these go in v1, the rest waits" and both views can show one release at a time.
This is a group task; each piece is its own subtask in this folder.

## Today
- A card carries a track, a priority and a roi. Nothing on it says which version it belongs
  to.
- The only way to plan a version today is to build a group task by hand and drag work into
  it. That works once, and it makes ordinary cards live inside someone else's folder.
- Board and queue view show every open card at once — the work for this week next to work
  nobody has promised for anything.

## Scope
- Releases are optional. A user must be able to see that the board has releases and to
  create one when they want, but nothing ever asks them for one. A project that never
  plans a version works exactly as it does today.
- A card names the release it ships in. A card that names none reads as `next`: wanted, not
  promised to a version. Shipped.
- A release is a real thing on the board — a version id, a place that says what is in it,
  and an order (#102).
- Closing a release is the user's call, not something that happens on its own. The cards
  still open in it move to the release after it, so nothing is dropped (#103).
- A card's release can be changed from the UI, the way its priority can (#105).
- Board and queue view get one dropdown: which release am I looking at (#104).
- A group root shows under a release when the root or any of its subtasks names it. Neither
  view draws a subtask, so hiding the root would hide every subtask planned for that
  version (#104).
- A card made from the board while one release is picked lands in that release, so new work
  is not off the screen the moment it is written (#104).
- Filling a release card by card is slow, so the agent can do the first pass: put the
  urgent, short-term work into the release and leave the rest at `next` (#106).
- Order: the `release` field on a card came first — every other piece is about that field,
  and it has shipped. #102 next, because a release has to exist before anything can point
  at one. #103 needs only #102 and can land
  any time after it; nothing waits on it. Then #105, because a release has to be filled
  before looking at one release at a time means anything, and it is where the UI first
  reads the release list. #104 after #105, on that same list. #106 last: the action that
  starts it sits on the release #104 shows.
- Out of this group: release notes or a changelog of what a closed release shipped, dates
  and deadlines on a release, and telling people about any of it on the site.

## Todo
- [x] Say which release a card ships in #101
- [ ] Create a release and see what is in it #102
- [ ] Close a release and move the undone cards to the next one #103
- [ ] Set a card's release from the UI #105
- [ ] Pick which release the board and queue view show #104
- [ ] Fill a release with the urgent work in one go #106

## Decided by the agent
- **A field on the card, not a folder per release.** A card already sits in a track folder,
  and a group task takes a second folder level. A third would leave no room for either. A
  field also moves with one command and can be read by both views without walking the tree.
- **The default name is `next`.** One word, and it reads right in the dropdown and on a
  card. `vnext` looks like a version id, which is the one thing it is not.
- **A version id is free text.** `v1`, `0.5.0`, `august` — the board never parses it. The
  order releases come in is the order they are written down, not something derived from the
  id.
- **A closed release is not a changelog.** Archiving a card takes it off the board as it
  always has. A release holds open work, and closing one says the plan is done, not what
  shipped.
- **A group root answers for its subtasks.** A subtask carries its own release but
  never shows as a board card — the root is the only card either view draws. So the root has
  to stand for the whole group, the way it already stands for a blocker sitting inside it
  and for the Archive button.
- **A new card follows the release on screen.** The other option is landing every new card
  in `next`, out of sight of the person who just wrote it. Propose is different: it offers
  work nobody has planned, so its cards stay at `next`.
- **One piece owns each job, so no two repeat it.** The field work keeps the local UI from
  wiping a release it does not yet show; showing and picking one is #105. The field on a
  card is documented already, #102 documents what a release is and where the list lives.
  #105 is where the UI reads the release list, and #104 uses that same list.