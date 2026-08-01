---
title: Move several cards into a release at once
track: features
priority: low
roi: med
status: ready
release: next
blocked_by: []
related: [100]
modules: [local-ui]
questions: []
---

Planning a version one card at a time is slow, and a version planned too full has no fast way
back — #106 only ever adds cards to a release. Let the user tick several cards on the board
and send them all into a release, or back to `next`, in one action.

## Scope
- The user can tick more than one open card, in the board view and the queue view. The tick
  is its own small target on the card — clicking the card itself still opens its page.
- While at least one card is ticked, a bar says how many, offers the release to move them
  into, and unticks everything again. With nothing ticked the board looks exactly as it does
  today.
- The release is picked from the open releases plus `next` — the same list the card page's
  release picker reads. Nothing is typed, and a release that is not on the list can't be
  chosen.
- `next` is on that list, so the same action also sends many cards back out of a release.
  This is the only fast way out — #106 only adds.
- Each card is written on its own, the same single-card write the card page's release picker
  makes. If one card fails, the rest still move and the bar names the one that did not.
- A ticked group root moves itself only. A subtask ships in the release it names itself, and
  neither view draws subtasks, so a root moving its whole group would change cards the user
  never saw.
- After the move the selection is cleared and the board is redrawn from the files, so what is
  on screen is what the cards say. Cards that left the release being shown drop off the
  screen, the way a single move already takes a card off it.
- Changing the release dropdown or switching view also clears the selection, so a move never
  touches a card the user can no longer see.
- This is the hand-picked move. #106 is the agent's first pass, where the agent decides what
  belongs; here the user has already decided and only wants fewer clicks.
- Out of this card: ticking cards to do anything else — archive, priority, track. This
  action only sets the release.

## Todo
- [ ] Let the user tick several open cards in both views, with a target that doesn't open the
      card page.
- [ ] Add the bar that shows while cards are ticked: the count, the release to move them
      into, and a way to untick everything.
- [ ] Move each ticked card on its own, refuse a release that isn't on the list, and name any
      card that failed while the rest go through.
- [ ] Move a ticked group root alone, leaving its subtasks where they are.
- [ ] Clear the selection after the move, and when the release dropdown or the view changes.
- [ ] Redraw the board from the files after the move.
- [ ] Write it into `kanban-ui/README.md`.
- [ ] Check it by hand: tick four cards, move them into a release, read the four files, then
      tick them again and send them back to `next`.
- [ ] Check it by hand: pick a release, tick cards, move them somewhere else, and see them
      leave the screen with nothing left ticked.

## Decided by the agent
- **Out is the same action as in.** `next` already sits on the list, so sending cards back
  out of a release is one more pick, not a second button.
- **Ticking works in both views.** Both draw the same cards, so a user planning a version in
  the queue view should not have to switch to the board to move them.
- **A group root moves alone.** Each subtask already carries its own release, so a root is
  one card here like any other.
- **A filter change unticks everything.** The release dropdown can hide a ticked card, and
  moving a card the user stopped looking at is the one way this action surprises someone.
