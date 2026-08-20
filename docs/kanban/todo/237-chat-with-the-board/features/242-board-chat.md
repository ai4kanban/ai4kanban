---
title: Chat with the whole board, not only with one card
track: features
priority: high
roi: high
status: todo
release: 0.7.1
blocked_by: [240, 241]
related: [237]
modules: [local-ui]
questions:
  - question: "[user] The chat rail is on every page, including a card's. What does it show while a card is open?"
    mode: single
    options:
      - that card's own chat — the rail follows what you are reading, and #248 lives in it, so only one chat is ever on screen
      - the board chat, always — the card page carries #248 as a panel of its own, so a card page can show two chats
      - the board chat, always, and #248 is dropped — you name the card in your message instead
    recommend: [1]
---

A chat about one card (#248) only answers what that card is about. But most of what a user
wants to say is not about one card: "what should I build next", "what is holding everything up", "add a
task for the thing I just thought of", "is this version too full". Today that means leaving
the app for a coding agent. Give the board a chat of its own, about the whole board.

## Scope
- The board has a chat that belongs to no card.
- The chat lives in a rail down the right side of the window, the full height of it — the
  mirror of the card rail on the left.
- It is folded away by default, so the board and the card being read keep the screen.
- A **Chat** button in the header, beside **Create task**, opens and folds it.
- Opening it narrows what is beside it, the same way the left rail does; the user drags its
  left edge to make it wider.
- On a window too narrow to hold both rails, the chat covers the board instead of squeezing
  it.
- The rail belongs to the window, not to a page: it stays open while the user moves between
  the board, a card, and a memory file.
- Whether the rail was left open is remembered, the same as how wide the left rail is and
  whether the Memory panel is open.
- The user types a message and the reply appears under it, word by word as it is written.
- A reply that arrives while the rail is folded keeps arriving, and the button says there is
  something new to read.
- The exchange stays on screen and is still there after the app is closed and reopened.
- One control clears it and starts fresh.
- The chat is about this project: it answers from the board, the goal, and the memory, not
  from general advice.
- It is per project — opening another project opens that project's own chat.
- It never shows in the runs panel, and it never stops a run from starting.
- Where no coding agent has been set up, the chat says so and says where to set one up.
- Where a reply stops part way, the chat says so and keeps what arrived.
- Where the chat names a card, that name is a link to the card's page.

## Todo
- [ ] Add the right rail and the header **Chat** button that folds it, folded by default.
- [ ] Keep the rail open across pages, and remember whether it was left open.
- [ ] Send a message and show the reply as it is written.
- [ ] Mark the button when a reply arrives while the rail is folded.
- [ ] Keep the exchange after the app is closed and reopened, per project.
- [ ] Give the user a way to clear it.
- [ ] Make a card the chat names a link to that card's page.
- [ ] Show the empty state where no coding agent has been set up.
- [ ] Say what happened where a reply stops part way.
- [ ] Settle what the rail shows on a card page, from the open question, and build it.
- [ ] Update the UI guide, `kanban-ui/README.md`.
- [ ] Check it end to end: ask what to build next on a real board, then ask a follow-up that
      only makes sense if the first answer was remembered.

## Decided by the agent
- **One board chat or several?**: one per project. A second one is a second history to keep
  and nothing on the board points at either.
- **Does the board chat replace the card chat?**: no. #248 stays — asking about one card
  from that card's page is where most of it happens. This is the chat for everything else.
- **Does the chat show what it cost?**: no. Cost belongs to runs, which is the call #237
  already made.
- **Does the rail push the board or cover it?**: it narrows what is beside it, like the left
  rail, and only covers the board on a window too narrow for both.
- **Is the fold remembered?**: yes, and for the window rather than for one project — the
  same as the left rail's width and the Memory panel. What is in the chat is per project;
  how the user likes the rail is not.

### Worth noting
- **A folded rail is not a stopped chat**: a reply still arrives while it is folded, and the
  button marks that there is something to read. Folding hides the chat, it never cancels it.
