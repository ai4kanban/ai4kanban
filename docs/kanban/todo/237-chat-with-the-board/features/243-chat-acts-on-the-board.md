---
title: Let a chat do the board work it is talking about
track: features
priority: high
roi: high
status: ready
release: 0.7.1
blocked_by: []
related: [237, 248]
modules: [skill, local-ui]
questions: []
---

A chat that can only talk sends the user back to the buttons for every single thing it just
agreed to. Saying "yes, split that card in two" and then leaving the user to do it with the
buttons is worse than not asking. A chat in the board should be able to do the board work it
is talking about — the same work you would get by opening a coding agent and asking it there.

## Scope
- A chat changes the board itself instead of telling the user which button to press.
- Every chat does it: the board's, a card's (#248), and `akb chat` in a terminal.
- The chat makes the change itself when the conversation has already settled what to change.
  That is: write a new card, rewrite what a card says, answer a card's open questions, put a
  card in a release or take it out, archive a card, reject a card.
- The chat starts a run instead when the user asks the board to go and work the change out
  for itself. That is: write the code for a card, work out what a vague card should say,
  propose new tasks, fill a release.
- It also starts a run when the user asks for something to happen in the background rather
  than in the conversation.
- A run the chat starts shows in the runs panel like any other.
- That run streams its log.
- That run can be stopped and resumed.
- The chat never writes the project's code itself.
- The chat makes the change straight away, without asking the user to confirm it first —
  archiving, rejecting and starting a build included.
- It never writes out what it is about to do and waits for a click.
- A card the chat changes keeps its place on the board: its index entry, its links from other
  cards and the release counts all move with it.
- The chat leaves its changes uncommitted, the same as a run does.
- The board on screen catches up as the chat changes it, without a reload.
- A change made while the reply is still being written shows straight away, not only once the
  reply has ended.
- A card's page catches up the same way.
- When the chat archives or rejects the card whose page is open, the app goes back to the
  board.
- A change to a card a run is already working on is refused.
- The refusal names the card and what that run is doing.
- The refusal holds even when the chat never looked for a run first.
- The chat says what it did in one line.
- That line names the card it acted on.
- Anything the chat cannot do it says it cannot do, rather than saying it did.

## Todo
- [ ] Let a chat make the board changes the conversation has already settled — write a card,
      rewrite one, answer its questions, put it in a release or take it out, archive it,
      reject it.
- [ ] Let a chat start a run for the work the board goes and does — write a card's code, work
      out what a vague card should say, propose tasks, fill a release.
- [ ] Have every change go through without asking the user to confirm it, from a card's chat
      as much as the board's.
- [ ] Catch the board and a card's page up while the chat is still writing its reply.
- [ ] Send the app back to the board when the chat archives or rejects the card whose page is
      open.
- [ ] Refuse a change to a card a run is working on, naming the card and what that run is
      doing.
- [ ] Have the chat report what it did, naming the card.
- [ ] Say that a chat changes the board everywhere the board still says it changes nothing:
      the words a conversation opens with, `akb guide chat`, `akb help`,
      `kanban-ui/README.md`, `docs/guides/daily-loop.md` and `cli/README.md`.
- [ ] Check it end to end: from one chat, write a card, rewrite it, put it in a release, and
      start a build on it. The board, the files and the runs panel should all agree.
- [ ] Check it from a card's page too: talk a vague card over, have the chat make the change,
      and confirm the card changed only where the user asked.

## Decided by the agent
- **Does the chat write files itself?**: only the board's own files, and only through the
  board's own moves — the same ones the buttons call. The project's code is written by a run
  the chat starts, never by the chat.
- **What happens when the chat and something else write the board in the same moment?**: one
  waits for the other, the same as two runs do (#156). That is a different case from a run
  working on a card, which is refused outright.
- **Does a chat stop a run from starting on the card it just changed?**: no. Each change
  lands in one go, so a run can start on that card the moment it has landed. A chat shows in
  no runs panel and never stops a run from starting.
- **Why does the board refuse the change rather than the chat?**: the chat could skip the
  check. The board already knows which runs are live.
- **Can a card's chat act on another card?**: yes, on any card on the board. It names the one
  it acted on, so which card was meant is never a guess.
- **Is there an undo in the chat?**: no. A change is taken back in git, the same way a run's
  changes are.
- **What is left to #248?**: where a card's chat sits, what it opens with, and what it clears
  from the screen when the user opens another card. What a chat may do is this card's, for
  both chats.

### Worth noting
- **Working out what a vague card should say is a run, not something the chat does in the
  conversation**: it takes minutes, and a chat never stops a run from starting on that card,
  so a run started meanwhile would write over it. A change the conversation has already
  settled is different — that is one write, and the chat makes it.
- **A change to a card a run holds is refused, not queued**: the card's own buttons already
  go grey while a run holds it, so the chat says no where they do.
- **A rejected card's mockups don't come back**: mockups are the drawings of a screen kept
  beside a card, and they are never in git. Git returns a rejected card's file, but its
  drawings are gone — the same as rejecting the card from the button.
