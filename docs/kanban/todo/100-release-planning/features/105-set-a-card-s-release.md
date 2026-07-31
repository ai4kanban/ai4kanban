---
title: Set a card's release from the UI
track: features
priority: med
roi: high
status: todo
blocked_by: [101]
related: [100]
modules: [local-ui]
questions: []
---

Planning a version means moving cards into it one at a time. Let that happen where the user
already is — on the card — instead of in a terminal.

## Scope
- The card page shows the card's release and lets the user change it, in the same place
  priority and roi are set today.
- The list to pick from is the open releases plus `next`. Nothing is typed, so a version id
  cannot be misspelled into existence.
- A card shows its release wherever it already shows its track — a card sitting in `next`
  says so too, so an unplanned card is not silently blank.
- Making a new release is not done here. This is only moving a card into one that exists.
- Changing the release writes the card through the script, like every other field, so the
  board file stays the record.
- With a release picked in the dropdown (#104), moving a card out of it takes the card off
  the screen. That is the filter doing its job, and the card is where it was sent.

## Todo
- [ ] Show a card's release on its page and let the user pick another one.
- [ ] Fill the picker from the open releases plus `next`, with no free typing.
- [ ] Show the release on the card wherever the track already shows.
- [ ] Write the change through the script, and refresh the board from the file.
- [ ] Write it into `kanban-ui/README.md`.
- [ ] Check it by hand: move a card into a release and back to `next`, and read the card
      file after each move.

## Decided by the agent
- **This is a direct edit, not an agent run.** Picking a release is the same kind of change
  as priority or roi — one field, no judgment — and those are already direct. The buttons
  that spawn an agent stay the ones that write a card's words.