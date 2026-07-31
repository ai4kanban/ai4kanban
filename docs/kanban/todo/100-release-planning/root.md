---
title: "Releases: plan what ships in this version and what waits"
track: features
priority: med
roi: high
status: todo
blocked_by: []
related: [101, 102, 103, 104, 105, 106, 91]
modules: [skill, local-ui]
questions:
  - "[user] Does this replace the v1 / vnext group tasks that setup creates (#91)? (a) Yes — setup creates release v1 and leaves everything else unversioned, and #91 is dropped. (b) No — the two live side by side, a group task for the first release and a release field for everything after. Recommend (a): two ways to say what ships first is one too many, and a release field survives a card moving between tracks in a way a folder does not."
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
- A card names the release it ships in. A card that names none reads as `next`: wanted, not
  promised to a version (#101).
- A release is a real thing on the board — a version id, a place that says what is in it,
  and an order (#102).
- Closing a release is the user's call, not something that happens on its own. The cards
  still open in it move to the release after it, so nothing is dropped (#103).
- Board and queue view get one dropdown: which release am I looking at (#104).
- A card's release can be changed from the UI, the way its priority can (#105).
- Filling a release card by card is slow, so the agent can do the first pass: put the
  urgent, short-term work into version {id} and leave the rest at `next` (#106).
- Order: #101 first — every other piece is about the field it adds. #102 next, because a
  release has to exist before anything can group by it. #103, #104 and #106 all need #102
  and can land in any order after it. #105 needs only #101.
- Out of this group: release notes or a changelog of what a closed release shipped, dates
  and deadlines on a release, and telling people about any of it on the site.

## Todo
- [ ] Say which release a card ships in #101
- [ ] Create a release and see what is in it #102
- [ ] Close a release and move the undone cards to the next one #103
- [ ] Pick which release the board and queue view show #104
- [ ] Set a card's release from the UI #105
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