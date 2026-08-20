---
title: Let a chat do the board work it is talking about
track: features
priority: high
roi: high
status: todo
release: 0.7.1
blocked_by: [241]
related: [237, 248]
modules: [skill, local-ui]
questions:
  - question: "[user] #237 decided a card's discussion never writes the card — it only hands a change request to the Edit and Resolve buttons. This version asks for a chat that can act. Which one holds?"
    mode: single
    options:
      - "keep both: the chat writes what it would do, the user reads it, and one click carries it out — nothing lands unseen"
      - the chat does the work itself as soon as it is asked, and #237's panel becomes that chat
      - the card's panel stays a discussion that changes nothing, and only the board chat is allowed to act
    recommend: [1]
  - question: "[user] Which actions may a chat take without asking first?"
    mode: single
    options:
      - everything git can undo goes straight through; archive, reject and starting a build ask first
      - none — every change the chat makes is shown first and waits for a yes
      - all of them — the working tree is in git and the user can undo any of it there
    recommend: [1]
---

A chat that can only talk sends the user back to the buttons for every single thing it just
agreed to. Saying "yes, split that card in two" and then doing it by hand is worse than not
asking. A chat in the board should be able to do the board work it is talking about — the
same work a coding agent does when you say it there.

## Scope
- From a chat the user can write a card, sharpen one, answer its open questions, change what
  it says, move it into or out of a version, finish it, or drop it.
- From a chat the user can start a build on a card.
- A change the chat makes is the board's own move, the same one the button calls — nothing
  writes a card's fields by hand.
- A build the chat starts is an ordinary run: it shows in the runs panel, streams its log,
  and can be stopped and resumed.
- The board redraws as soon as the chat changes it — no reload, no leaving the page.
- The chat itself never edits the project's code. Building is a run's job, and the chat
  starts one.
- An action on a card a run is already holding is refused, with which run is holding it.
- The chat says what it did, in one line, and names the card it did it to.
- Anything the chat cannot do it says it cannot do, rather than saying it did.

## Todo
- [ ] Let a chat call the board's moves — create, refine, resolve, revise, release, archive,
      reject.
- [ ] Let a chat start a build, as an ordinary run in the runs panel.
- [ ] Settle the ask-first rule from the open questions and build it.
- [ ] Redraw the board as soon as a chat changes it.
- [ ] Refuse an action on a card a run already holds, and say which run.
- [ ] Have the chat report what it did, naming the card.
- [ ] Update `kanban-ui/README.md` and `docs/guides/daily-loop.md`.
- [ ] Check it end to end: from one chat, write a card, sharpen it, put it in a version, and
      start a build on it, then confirm the board and the files agree.

## Decided by the agent
- **Does the chat write files itself?**: only the board's own files, and only through the
  board's moves. Project code is changed by a run the chat starts, never by the chat.
- **Does a chat run under the same one-writer rule as a run?**: yes. Two things writing the
  board at once is the same problem whoever is doing it (#156).
