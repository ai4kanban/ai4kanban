---
title: Pick which release the board and queue view show
track: features
priority: med
roi: high
status: todo
release: next
blocked_by: []
related: [100]
modules: [local-ui]
questions: []
---

One dropdown in the header: which release am I looking at. Both the board and the queue
view answer it, so the user can work on this version without the rest of the backlog in
the way.

## Scope
- The header gets a release dropdown beside the view toggle, listing: All releases, each
  open release in ship order, and `next`.
- Picking one **hides the cards in every other release**. That is the point of the
  dropdown: you see one version at a time. Both views obey it — the columns and the
  ready / not-ready halves regroup on the same set of cards.
- Blockers are the one exception: every blocker stays on screen whatever release is picked.
  A blocker is usually in the way of the version being planned, and the whole point of the
  blockers track is that a blocker is never out of sight. Both views keep them — the
  Blockers column in the kanban view, and the blockers that rise to the top of the queue
  view's halves.
- All releases is the way back to the whole board, and the default. It is also what a board
  with no releases always shows: a user who never makes a release sees today's board,
  without a dropdown getting in the way.
- Each entry says how many open cards it holds, so the user can see a version is nearly
  empty without opening it.
- A release with nothing open in it says so on screen, instead of looking like a broken
  board. All releases stays one click away.
- The choice is remembered per project in the browser, like the view toggle. It is not
  written to the board. If the remembered release is gone from the board — closed, or
  renamed by hand — the board opens on All releases.
- There are no closed releases to hide. Closing takes a release out of the board file, so
  the list in the file is exactly the list in the dropdown.
- A group root is shown when the root or any of its subtasks names the picked release.
  Neither view draws a subtask, so hiding the root would hide every subtask planned for that
  version.
- A card made from the board while one release is picked lands in that release, so it does
  not vanish the moment it is written.
- Moving a card out of the picked release takes it off the screen. That is the filter doing
  its job, and the card is where it was sent.
- A card still names the cards blocking it even when they sit in another release. The
  dropdown hides cards; it never changes what a card says about itself.
- The pick only changes what is on screen. Background refining still works the whole board,
  and the daily progress chart still counts every card.
- The UI already reads the release list for the card page's release picker. This card uses
  that list and does not read it again.

## Todo
- [ ] Add the release dropdown to the header, with open counts, defaulting to All releases.
- [ ] Make both the kanban and the queue view show the picked release.
- [ ] Show a group root whenever the root or one of its subtasks is in the picked release.
- [ ] Keep every blocker on screen in both views, whatever release is picked.
- [ ] Put a card made while a release is picked into that release.
- [ ] Remember the choice per project in the browser, and leave the board files alone.
- [ ] Fall back to All releases when the remembered release is no longer on the board.
- [ ] Say on screen when the picked release holds nothing open.
- [ ] Hide the dropdown, or leave it quiet, on a board that has no releases yet.
- [ ] Write the dropdown into `kanban-ui/README.md`, and say plainly that picking a release
      hides the other releases' cards but keeps every blocker.
- [ ] Check it by hand: two releases with cards in each, switch between them in both views,
      reload, and see the choice stick.
- [ ] Check it by hand: a blocker sitting in another release, and one at `next`, both still
      on screen while a release is picked, in both views.
- [ ] Check it by hand: pick a release, close it with `release close`, reload, and land on
      All releases with nothing missing.

## Decided by the agent
- **An empty release says so.** A filter that can empty the screen has to explain itself,
  or the user reads it as a broken board and goes looking for their cards. Blockers on
  screen don't make a release non-empty: the note is about the release the user picked,
  and a blocker belongs to whoever it blocks.
- **A blocker is not counted in the release it shows under.** The number beside each entry
  is the open cards naming that release, the same number `release list` prints. A blocker
  shows everywhere, so counting it everywhere would make every release look fuller than it
  is.
- **A pick that no longer exists falls back to All releases.** The choice lives in the
  browser and the release list lives in git, so the two drift — a release closes, or someone
  edits the file. Showing the whole board is the safe end of that drift: nothing is hidden
  behind a version that is gone.
- **The pick never reaches the agent.** It is a browser setting, like the view toggle, so
  background refining and the progress chart keep reading the whole board. A choice one tab
  made must not quietly change what the server works on.