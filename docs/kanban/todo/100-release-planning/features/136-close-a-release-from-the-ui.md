---
title: Close a release from the UI
track: features
priority: med
roi: med
status: ready
release: ""
blocked_by: []
related: [100]
modules: [local-ui]
questions: []
---

The version shipped, but saying so takes a terminal: `release close` has no place in
the UI. A user who only ever opens the board can make a release, fill it, and plan
it — and then can't finish it. Offer the close in the UI. The rule is the drop's,
which already shipped: the UI offers what the script offers.

## Today
- The UI can make a release, fill it, pick it, and move cards in and out. Closing
  it is the one step that still needs the terminal.

## Scope
- The UI offers closing the release the board is showing, in the same place the
  drop sits.
- Before anything is written, the user sees what the close does — which open cards
  lose their release — and confirms. A close ends a plan, so it never fires on one
  click.
- The confirm also names any open card with every box ticked but never archived.
  Such a card counts as not shipped, and a closed release can't be reopened to fix
  that. The terminal says this after the close; the UI says it before, while the
  user can still cancel, archive the card, and then close.
- The result is exactly what `release close` does: the summary file is written, the
  open cards' release is cleared, the line comes off the list. The UI adds nothing of
  its own.
- After the close the board shows all releases — the version it was showing no
  longer exists.
- Out of this card: reading or editing the summary file in the UI. A wrong line in
  it is fixed in the user's own editor, like the memory files.

## Todo
- [ ] Offer the close in the UI, with the confirm showing which open cards lose
      their release and which look done but were never archived
- [ ] Put the board back on All releases after the close
- [ ] Update the docs: `kanban-ui/README.md` says closing is still a terminal
      job — replace that; the close-a-release section of `docs/guides/daily-loop.md`
      gets the UI path, like its drop section has
- [ ] Check it by hand: make a release, put cards in, archive one, close the
      release from the UI, then read the summary file and the cards

## Decided by the agent
- **Does close belong in the UI?** Yes — the same correction the drop made: the UI
  offers what the script offers, with the consequences shown before the confirm.
- **Where does the UI offer it?** Beside the drop, in the release picker, when the
  board is showing that release — closing and dropping are the two ways a shown
  version ends.
- **When to warn about ticked-but-never-archived cards?** In the confirm, before
  anything is written. The terminal warns after the close; the UI can warn while
  archiving the card first is still possible.
