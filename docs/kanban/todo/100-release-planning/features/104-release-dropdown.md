---
title: Pick which release the board and queue view show
track: features
priority: med
roi: high
status: todo
blocked_by: [102]
related: [100]
modules: [local-ui]
questions:
  - "[user] Does picking a release hide the cards in the other releases? (a) Yes, it filters — you see one release at a time, plus an All option. (b) No, it only jumps to that release's cards and the rest stay on screen. Recommend (a): a dropdown that hides nothing does nothing. Note the queue view was built on the rule that a view never hides a card (decisions.md), so (a) is a change of that rule."
---

One dropdown in the header: which release am I looking at. Both the board and the queue
view answer it, so the user can work on this version without the rest of the backlog in
the way.

## Scope
- The header gets a release dropdown beside the view toggle, listing: All releases, each
  open release in ship order, and `next`.
- Picking one shows the cards in that release. Both views obey it — the columns and the
  ready / not-ready halves regroup on the same set of cards.
- Each entry says how many open cards it holds, so the user can see a version is nearly
  empty without opening it.
- All releases is the default, and what a board with no releases always shows. A user who
  never makes a release sees today's board, without a dropdown getting in the way.
- The choice is remembered per project in the browser, like the view toggle. It is not
  written to the board.
- Closed releases are not in the list. A closed release holds no open cards, so there is
  nothing to look at.
- A group root and its subtasks follow the same rule as any other card: each is shown when
  its own release is picked.

## Todo
- [ ] Read `docs/kanban/releases.md` and hand the board's releases to the UI.
- [ ] Add the release dropdown to the header, with open counts, defaulting to All releases.
- [ ] Make both the kanban and the queue view show the picked release.
- [ ] Remember the choice per project in the browser, and leave the board files alone.
- [ ] Hide the dropdown, or leave it quiet, on a board that has no releases yet.
- [ ] Write the dropdown into `kanban-ui/README.md`.
- [ ] Check it by hand: two releases with cards in each, switch between them in both views,
      reload, and see the choice stick.