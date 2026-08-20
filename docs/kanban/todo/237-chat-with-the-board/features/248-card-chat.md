---
title: Chat about one card, from the card's page
track: features
priority: high
roi: high
status: todo
release: 0.7.1
blocked_by: [240, 241, 242]
related: [237]
modules: [local-ui]
questions: []
---

Most of what a user wants to say is about the card in front of them: what is this really
for, is it the right shape, what is still unclear. Give the card's page a chat about that
card, so it can be argued over and corrected before any work starts on it.

## Scope
- The card's page has a chat, and it is about that card.
- Where it appears is what #242's open question settles: either the right rail shows the
  open card's chat, or the card page carries a panel of its own.
- The chat opens knowing the card — its body, its fields, what it is waiting on, and its
  open questions — and knowing the rest of the board when the answer needs it (#241).
- Each card's exchange is its own. It is never mixed with another card's, and never mixed
  with the board chat.
- The exchange is still there after the app is closed and reopened, and one control clears
  it.
- A user can chat about a card while a run is working on that card.
- What the chat is allowed to change is #243's question. Chatting alone writes nothing: the
  card file is untouched until a board move runs.
- Where the chat names another card, that name is a link to its page.
- Where no coding agent has been set up, the chat says so, and says where to set one up.
- Where a reply stops part way, the chat says so, and keeps what arrived.

## Todo
- [ ] Put a chat about one card on the card's page, in the place #242 settled.
- [ ] Open it knowing the card, its fields, what it is waiting on, and its open questions.
- [ ] Keep each card's exchange apart from every other card's and from the board chat.
- [ ] Keep it after the app is closed and reopened, and give the user a way to clear it.
- [ ] Let the user chat about a card while a run is working on it.
- [ ] Make a card the chat names a link to that card's page.
- [ ] Show the empty state where no coding agent has been set up.
- [ ] Say what happened where a reply stops part way.
- [ ] Update the UI guide, `kanban-ui/README.md`.
- [ ] Check that chatting about a card leaves the card file untouched.
- [ ] Check it end to end: chat about a vague card, ask what is unclear about it with
      nothing else typed in, and see whether the answer is about that card and this project.

## Decided by the agent
- **Is a card's chat a run?**: no. It never shows in the runs panel and never locks the
  card, so a user can talk about a card that is being built.
- **One chat per card, or many?**: one. It stays until the user clears it.
- **Does this card build the chat itself?**: no. The conversation is #240's and what it
  knows is #241's. This card is the card page's surface onto them.
