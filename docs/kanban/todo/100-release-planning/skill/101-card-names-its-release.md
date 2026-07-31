---
title: Say which release a card ships in
track: skill
priority: high
roi: high
status: ready
blocked_by: []
related: [100]
modules: [skill, local-ui]
questions: []
---

Add one field to a card: the release it ships in. This is the base the rest of the group
sits on — until a card can name a version, nothing can group by one.

## Scope
- A card carries a `release` field in its frontmatter, holding a version id like `v1`.
- A card with no release reads as `next`. So does one whose line is empty, blank or
  damaged, so an old or hand-edited card still opens. Every card on the board today is
  `next` and nobody has to touch a file.
- The release is set the same way every other field is: `create --release v1` when the card
  is made, `update <id> --release v1` after. Never by hand.
- `update <id> --release next` (or an empty value) takes a card back out of a version.
  `next` is accepted whatever the case.
- A version id is free text, so `0.5.0` and `august` work as well as `v1`. It is kept
  exactly as typed, minus any spaces at the start or end. Upper and lower case stay apart,
  the way a track or module name works today: `V1` and `v1` are two different names.
- Nothing here rewrites a name to make it match. A name that fits no release is caught
  once the release list exists (#102), which says which names do exist.
- A release set in the terminal survives an edit made in the local UI. Changing a card's
  priority, roi, title or wording there leaves its release alone. Picking a release in the
  UI is #105; this card only stops the field being lost.
- A group root and its subtasks each carry their own release. The root is a tracking card,
  so a subtask ships in the release it names itself.

## Todo
- [ ] Add the `release` field to the card format, defaulting to `next` when it is missing,
      empty or unreadable.
- [ ] Take `--release` on `create` and `update`: keep the id as typed after cutting the
      spaces off the ends, never change its case, and let an empty value clear it.
- [ ] Keep a card's release when the card is edited in the local UI.
- [ ] Say in the skill docs what a release is, that `next` is the default, and that only
      the script writes the field.
- [ ] Check it by hand: make a card with `--release v1`, move it back to `next`, and read
      both an old card with no field at all and one whose line was blanked by hand.
- [ ] Check it by hand: put a card in `v1` from the terminal, change its priority in the
      UI, and see the release still on the card.

## Decided by the agent
- **Showing a card's release belongs to #105.** Outside the local UI nothing on the board
  shows a card's track or priority — the board index is titles only — so there is no
  listing here for the release to join.
- **The local UI has to keep a field it does not own.** It writes card files itself, so a
  release it had never heard of would be wiped the next time someone edited that card
  there, and the card would drop out of the version in silence. `modules` and `status`
  were added to both writers for the same reason.
- **An id is kept as typed, not lowercased.** Lowercasing would break an id like
  `0.5.0-RC1` and still not stop a typo. Matching names is the release list's job (#102).