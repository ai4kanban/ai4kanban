---
title: Move several cards into a release at once
track: features
priority: low
roi: med
status: todo
release: next
blocked_by: []
related: [100]
modules: [local-ui]
questions:
  - question: "[user] Is a hand-picked bulk move worth building next to #106? #106 fills a release with the agent's judgment, and the card page fixes one card at a time."
    mode: single
    options:
      - build it — #106 only adds cards to a release and never takes any out, so a version planned too full has no fast way back to next
      - skip it — a release holds a handful of cards, and #106 plus the card page already cover filling one and fixing what it got wrong
    recommend: [1]
---

Planning a version one card at a time is slow. Let the user tick several cards on the board
and send them all into a release in one action.

## Scope
- The user can tick more than one open card in the board and the queue view, and the
  screen says how many are ticked.
- One action moves every ticked card into the same release. The release is picked from the
  open releases plus `next`, the same list the card page's release picker reads. Nothing is
  typed.
- `next` is on that list, so the same action also sends many cards back out of a release.
  This is the only fast way out — #106 only adds.
- After the move the selection is cleared and the board is redrawn from the files, so what
  is on screen is what the cards say.
- Each card is written through the script, one card at a time, like a single change on the
  card page. If one card fails, the rest still move and the UI names the one that did not.
- This is the hand-picked move. #106 is the agent's first pass, where the agent decides what
  belongs; here the user has already decided and only wants fewer clicks.
- Out of this card: ticking cards to do anything else — archive, priority, track. This
  action only sets the release.

## Todo
- [ ] Let the user tick several open cards in both views, and show the count.
- [ ] Add the action that moves every ticked card into one release, picked from the open
      releases plus `next`.
- [ ] Write each card through the script, and name any card that failed while the rest go
      through.
- [ ] Clear the selection after the move and redraw the board from the files.
- [ ] Write it into `kanban-ui/README.md`.
- [ ] Check it by hand: tick four cards, move them into a release, read the four files, then
      tick them again and send them back to `next`.

## Decided by the agent
- **Out is the same action as in.** `next` already sits on the list, so sending cards back
  out of a release is one more pick, not a second button.
- **Ticking works in both views.** Both draw the same cards, so a user planning a version in
  the queue view should not have to switch to the board to move them.
