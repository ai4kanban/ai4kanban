---
title: Say which release a card ships in
track: skill
priority: high
roi: high
status: todo
blocked_by: []
related: [100]
modules: [skill]
questions: []
---

Add one field to a card: the release it ships in. This is the base the rest of the group
sits on — until a card can name a version, nothing can group by one.

## Scope
- A card carries a `release` field in its frontmatter, holding a version id like `v1`.
- A card with no release, or an empty one, reads as `next`. Every card on the board today
  is `next` and nobody has to touch a file.
- The release is set the same way every other field is: `create --release v1` when the card
  is made, `update <id> --release v1` after. Never by hand.
- `update <id> --release next` (or an empty value) takes a card back out of a version.
- The field is a plain string the board does not parse, so `0.5.0` and `august` work as
  well as `v1`.
- The card page and any listing that already shows a card's track and priority shows its
  release too.
- A group root and its subtasks each carry their own release. Say what happens when they
  disagree: the root is a tracking card, so a subtask ships in the release it names itself.

## Todo
- [ ] Add the `release` field to the card format, defaulting to `next` when it is missing
      or empty.
- [ ] Take `--release` on `create` and `update`, and let an empty value clear it.
- [ ] Say in the skill docs what a release is, that `next` is the default, and that only
      the script writes the field.
- [ ] Check it by hand: make a card with `--release v1`, move it back to `next`, and read
      an old card that has no field at all.