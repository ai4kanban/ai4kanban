---
title: "Releases: plan what ships in this version and what waits"
track: features
priority: med
roi: high
status: ready
release: next
blocked_by: []
related: [104, 106, 114]
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
  and an order. Shipped.
- Closing a release is the user's call, not something that happens on its own. The close
  writes down what shipped, sends the cards still open back to `next`, and takes the
  release off the list. Shipped.
- A card's release can be changed from the UI, the way its priority can. Shipped.
- Several cards can be ticked and moved into a release, or back out to `next`, in one
  action (#114).
- Board and queue view get one dropdown: which release am I looking at (#104).
- A group root shows under a release when the root or any of its subtasks names it. Neither
  view draws a subtask, so hiding the root would hide every subtask planned for that
  version (#104).
- A card made from the board while one release is picked lands in that release, so new work
  is not off the screen the moment it is written (#104).
- Filling a release card by card is slow, so the agent can do the first pass: put the
  urgent, short-term work into the release and leave the rest at `next` (#106).
- Order: the `release` field on a card came first — every other piece is about that field.
  Then the release list itself, because a release has to exist before anything can point
  at one. Then the close, which nothing waited on. Then setting a card's release from the
  UI, because a release has to be filled before looking at one release at a time means
  anything, and it is where the UI first reads the release list. Those four have shipped.
  #104 next, on that same list. #114 needs nothing more and can land any time. #106 last:
  the action that starts it sits on the release #104 shows.
- Out of this group: a changelog — the close leaves a list of the cards that shipped,
  but not every change goes through the board, so a changelog stays a person's job.
  Also out: dates and deadlines on a release, and telling people about any of it on the
  site.

## Todo
- [x] Say which release a card ships in #101
- [x] Create a release and see what is in it #102
- [x] Close a release, write down what shipped, and send the rest back to next #103
- [x] Set a card's release from the UI #105
- [ ] Pick which release the board and queue view show #104
- [ ] Move several cards into a release at once #114
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
- **A closed release leaves the board.** Git already keeps the past: a tag names every
  version, and the release page serves it. A team plans a release or two ahead of where it
  is, so `releases.md` holds a line or two — closing removes the line instead of letting
  hundreds pile up.
- **The close writes a summary, not a changelog.** Not every change goes through the
  board, so only a person can say what a version changed. What the board can say is which
  of its cards shipped, and it writes that list to `docs/kanban/.release-summaries/` on
  close. A changelog, if anyone writes one, starts from there.
- **A group root answers for its subtasks.** A subtask carries its own release but
  never shows as a board card — the root is the only card either view draws. So the root has
  to stand for the whole group, the way it already stands for a blocker sitting inside it
  and for the Archive button.
- **A new card follows the release on screen.** The other option is landing every new card
  in `next`, out of sight of the person who just wrote it. Propose is different: it offers
  work nobody has planned, so its cards stay at `next`.
- **One piece owns each job, so no two repeat it.** The field work kept the local UI from
  wiping a release it did not yet show; showing and picking one on a card shipped after it.
  The field on a card is documented already, and so is what a release is and where the list
  lives. The card page is where the UI reads the release list, and #104 and #114 use that
  same list. The card page moves one card, #114 moves the cards the user picked, #106 picks
  the cards itself.