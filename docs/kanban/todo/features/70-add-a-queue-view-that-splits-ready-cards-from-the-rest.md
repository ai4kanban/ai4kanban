---
title: Add a queue view that splits ready cards from the rest
track: features
priority: med
roi: med
status: ready
blocked_by: []
related: []
modules: [local-ui]
questions: []
---

Add a second way to look at the board: a queue view that puts ready cards on one side
and everything not ready on the other. The kanban view groups by track. The queue view
answers one question: what can I start now?

Both views show every card. The queue view is not a filter — it hides nothing, it only
groups the same cards a different way.

## Scope
- A switch button in the header toggles between the kanban view and the queue view.
  The card page shares the header, so the switch only shows on the board.
- The queue view splits the screen into two halves, side by side, each scrolling on its own:
  - "Ready to build" — cards with status `ready`, and below them the ones being
    implemented. A running card is already being built, so it needs nothing from you.
  - "Not ready" — everything else, the cards still `todo`.
- Each half shows a count. The ready half shows both numbers ("5 ready · 1 implementing"),
  so the first one is what you can start.
- A half with no cards keeps its label and says "no open cards", the way an empty column does.
- Each half lays cards in a grid that wraps to fill the width. No columns.
- The split uses the `status` already on each card (`todo | ready | implementing`).
  No new board data.
- Every card the kanban view shows appears here too. Blocker and recurring cards are
  plain track folders, so they split by status like any other card. Group roots show,
  their subtasks don't — same as today.
- Inside each half, cards sort in the board's existing pick order, with two rules ahead
  of it. Both apply only between cards at the same status:
  - a card blocked by an open card sinks below the cards you can start.
  - among the rest, a card from the blockers track rises to the top. The kanban view
    gives blockers their own column, and merging tracks would otherwise bury them.
- A card looks the same in both views — same title, chips, blocked marker, running badge,
  and the running badge still opens the log overlay. One addition: the queue view merges
  every track, so a card also shows its track there. The kanban view leaves it off,
  because the column heading already says it.
- The view you last picked is remembered in the browser, per project. Nothing is written
  to the board files.
- Clicking a card opens its page as it does today. Coming back lands on the view you
  last picked.

## Todo
- [x] Move `byPickOrder` out of `board.ts` into a module the client can import.
- [x] Pull the card markup out of the column loop in `Board.tsx` into one shared card
      component. It takes the running session and the log click as props, so the log
      overlay still opens.
- [x] Add the view switch to the header, off unless asked for, so the card page
      doesn't show it.
- [x] Build the queue view: two halves side by side, each a wrapping grid of the
      shared card.
- [x] Sort each half with the pick order. Between cards at the same status, blocked
      cards sink to the bottom, and blocker-track cards rise to the top of the rest.
- [x] Show the card's track in the queue view, beside priority and ROI. The kanban view
      leaves it off.
- [x] Label each half ("Ready to build" / "Not ready"), show the counts, and handle
      a half with no cards.
- [x] Remember the chosen view in `localStorage` under `kanban-ui.view:<project root>`.
      Read it after mount; show the kanban view until it is read.
- [x] Update the "The board" section of `kanban-ui/README.md`: the new view, and the
      header list that now names one more thing.
- [x] Open the board and check both views end to end: every card the kanban view shows
      appears in the queue view, the counts match, a blocked ready card is not on top,
      a running badge still opens the log, and the view survives opening a card and
      coming back.

## Decided by the agent
- What to call the new view? "Queue" — the ready half is a queue of work you can start.
- Where do implementing cards sit? In the ready half, below the ready cards. The board
  never hides a card, and their pill already tells them apart.
- Do blocker and recurring cards show? Yes, split by status like any card. A recurring
  card carries no status, which reads as `todo`, so it lands on the not-ready half.
- Does a blocker card outrank a ready card? No. Status comes first, so a blocker that is
  only being implemented still sits below the ready cards.
- Where does a blocked card sit? In the ready half like any `ready` card, but at the
  bottom of its status. The half promises the top is what you can start, and a blocked
  card is not. This only reorders cards — it never hides or gates one, which is the line
  #63 drew.
- Does this card detect blocked cards? No. #63 shipped the marker and the data behind it;
  this card only reads it.
- Why show the track only in the queue view? The queue view drops the track columns, so
  without it a blocker at the top of the ready half looks like any other card. In the
  kanban view the column heading already says the track, so a chip there is noise.
- Where is the chosen view remembered? `localStorage`, key `kanban-ui.view:<project root>`
  — the browser, like the drafts the dialogs keep. Not `ui.config.json`: that file is in
  git and holds settings the agent reads.
- What do the two switch buttons say? "Board" and "Queue". The kanban view had no name in
  the UI before, and "Board" is what a user already calls the columns.
- Does a blocker card rise among the blocked ones too? Yes. A blocked blocker leads the
  other blocked cards. One rule read the same way everywhere beats an exception nobody
  can predict, and it changes nothing about which cards you can start.
- What shape is the switch? One two-segment control, not two buttons — the views are a
  single choice, so the filled segment says which one you're in without a second mark.
