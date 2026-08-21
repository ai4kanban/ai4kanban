---
title: Cross off a hand-check on the card, and add one
track: features
priority: med
roi: med
status: ready
release: 0.7.1
blocked_by: []
related: [209]
modules: [local-ui, skill]
questions: []
---

A build often ends with something only you can confirm — it needs your machine, your data,
your eye. Those land on the card as hand-checks, listed under **check by hand** on the card
page and counted by a clipboard mark on the board card. The page shows them and that is all
it does: there is nothing to click. Taking one off once you have done the check means going
back to a terminal, so the panel keeps saying there is something to look at long after you
looked.

## Scope
- Each hand-check under **check by hand** can be crossed off, which takes it off the card.
- Crossing one off cannot be undone from the screen.
- A second click confirms the cross-off. No dialog.
- Crossing off takes away the line you clicked, matched by the text of that line rather than
  by its place in the list.
- A line a run already took off cannot be crossed off twice: the screen says it has gone and
  shows the panel as it now stands.
- A hand-check can be added under **check by hand**, in your own words.
- An added hand-check is one line of text. An empty one is not added.
- **Add a check** sits at the foot of the panel, and on a card with no hand-checks it shows
  on its own where the panel would be.
- Both save the moment you act. Neither starts a run.
- The panel goes with the last line crossed off, and the board card's clipboard mark with it.
- Both are switched off while an agent run is working this card.
- Nothing about archiving changes: a card with hand-checks still open still archives.
- `kanban-ui/README.md` says a hand-check can be crossed off and added from the card page.

## Todo
- [ ] Cross a hand-check off the card page, which takes it off the card.
- [ ] Confirm a cross-off with a second click before the line goes.
- [ ] Take away the line the user clicked, and say so when it has already gone.
- [ ] Add a hand-check on a card that has some, and on a card that has none.
- [ ] Switch both off while an agent run is working the card.
- [ ] Say in `kanban-ui/README.md` that hand-checks are crossed off and added here.
- [ ] Add, cross off and archive on a real card, and check the file each time.

## Decided by the agent
- **Crossing off removes rather than ticks**: a checked-off line the card keeps is a second
  kind of history nobody reads, and the card already keeps its record in the archive.
- **Why adding one is here too**: you find a second thing to check while working through the
  first, and a note you cannot write down is a note you lose.
- **A second click, not a dialog**: clearing a conversation already confirms that way, and a
  dialog for one line is more ceremony than the loss.
- **Switched off during a run, not refused**: Priority, ROI, Release and Cadence all grey out
  while a run is working the card, and the badge beside the title already says what it is
  doing.
- **Matched by text, not by position**: a run can add or take away hand-checks while the page
  sits open, and by then the third line is a different line.

### Worth noting
- **The screen was built the other way on purpose** — a hand-check is a note on finished
  work, not a todo, so nothing in that panel could be clicked or ticked. A note you cannot
  clear stops being a note and becomes noise, which is why this card turns it round.
- **Every card page grows one line** — a card with no hand-checks shows **Add a check** where
  it has nothing to show today. Without it there is no way to write the first one.
