---
title: Chat about one card, from the card's page
track: features
priority: high
roi: high
status: ready
release: 0.7.1
blocked_by: []
related: [237]
modules: [local-ui]
questions: []
---

Most of what a user wants to say is about the card in front of them: what is this really
for, is it too big, what is still unclear. Give the card's page a chat about that card, so
it can be argued over and corrected before any work starts on it.

## Scope
- The chat sits in the chat rail — the column down the right of the window that the **Chat**
  button opens.
- While a card's page is up, the rail shows that card's chat and not the board's.
- The chat opens knowing the card: its body, its fields, the cards it waits on, and its open
  questions.
- It also knows the rest of the board.
- One card's exchange is never mixed with another card's.
- A card's exchange is never mixed with the board chat.
- Moving to another card's page leaves none of the last card's messages on screen.
- A half-typed message does not follow the user from one card's chat to another's.
- Neither does an error from the last card's chat.
- Before anything is said, the chat says its answers come from this card and the rest of the
  board.
- Under that line it suggests three questions worth asking about a card.
- The words in the empty message box ask about this card, not about the whole board.
- The exchange is still there after the app is closed and reopened.
- One control clears it.
- A user can chat about a card while a run is working on that card.
- This chat acts on the board like the board's own does — what it may do is #243's.
- When the chat names another card, that name is a link to that card's page.
- When no coding agent has been set up, the chat says so.
- It also says where to set one up.
- When a reply stops part way, the chat says so.
- The part of the reply that already came through is kept.

## Todo
- [x] Put a chat about one card in the window's chat rail, while that card's page is up.
- [x] Open it knowing the card, its fields, what it is waiting on, and its open questions.
- [x] Keep each card's exchange apart from every other card's and from the board chat.
- [x] Keep it after the app is closed and reopened, and give the user a way to clear it.
- [x] Let the user chat about a card while a run is working on it.
- [x] Make a card the chat names a link to that card's page.
- [x] Show the empty state where no coding agent has been set up.
- [x] Say what happened where a reply stops part way.
- [x] Update the UI guide, `kanban-ui/README.md`.
- [ ] Say what a card's chat is for in an empty rail.
- [ ] Suggest three questions worth asking about a card, under that line.
- [ ] Make the words in the empty message box ask about this card.
- [ ] Drop the last card's messages, half-typed message and error when the page moves to
      another card.
- [ ] Check it end to end: open a vague card's page and ask the chat what is unclear about
      the card, without pasting the card in. The answer should be about that card and this
      board.

## Decided by the agent
- **Is a card's chat a run?**: no. It never shows in the runs panel and never locks the
  card, so a user can talk about a card that is being built.
- **One chat per card, or many?**: one. It stays until the user clears it.
- **Does this card build the conversation itself?**: no. `akb chat <id>` already holds the
  conversation and opens it knowing the card. This card only puts it on the card's page.
- **May a chat change the board?**: yes — settled on #243, and this is that same chat. This
  card is only where it sits and what it opens with.
- **What the empty chat says on a card's page**: that its answers come from this card and the
  rest of the board, then three questions — what is unclear about this card, is it too big to
  build in one go, what could be cut.

### Worth noting
- **Most of this was built with the board chat**: the rail was made to follow the page, so a
  card's page already gets that card's own conversation and keeps it apart. What is left is
  what the rail says on a card's page, and what it drops when the page moves to another card.
