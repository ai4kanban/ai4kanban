---
title: Chat with the board, or with one card, without leaving the app
track: features
priority: high
roi: high
status: todo
release: 0.7.1
blocked_by: []
related: [240, 241, 242, 243, 248]
modules: [skill, local-ui]
questions:
  - question: "[user] Who writes a chat's replies?"
    mode: single
    options:
      - the coding agent already set up for this board — nothing new to configure, and it works on a Claude subscription with no API key
      - a model the board calls itself, without the coding agent — but this needs an API key, and a board set up on a Claude subscription has none
    recommend: [1]
---

Today the only way to talk about this project is to leave the app and open a coding agent.
Everything the board knows — the goal, the memory, the cards — is right there on screen, and
the user still has to explain it again somewhere else. Give the board a chat of its own: ask
about the whole board, or about the one card you are reading, and get an answer that already
knows this project. This is a group task; each piece is its own subtask in this folder.

## Scope
- A chat answers from this project — the goal, the module map, the memory, and the cards —
  not from general advice.
- Two things to talk about: the whole board, and one card. Both run on the same conversation
  underneath, so they answer the same way.
- A chat is as good as opening a coding agent and saying `/kanban` or `/kanban #12` — that is
  the bar this group is measured against.
- A conversation stays open: the second message lands in the same session as the first, and
  the agent still has everything said before.
- A reply arrives as it is written, not all at once at the end.
- A chat is not a run. It never shows in the runs panel, never locks a card, and never stops
  a run from starting.
- A conversation is still there after the app is closed and reopened, and is per project.
- A chat can do the board work it is talking about — write a card, sharpen it, answer its
  questions, start a build — through the board's own moves, never by hand.
- A chat never edits the project's code. Building is a run's job, and the chat starts one.
- Order: the conversation itself (#240), then what it knows when it opens (#241), then the
  board chat in the UI (#242), then the card chat (#248). Acting on the board (#243) needs
  only #241 and can be built beside the UI work.
- Out of this group: showing what a chat cost, more than one conversation per card, and any
  chat between people rather than with the agent.

## Todo
- [ ] Keep one conversation with the agent open, turn after turn #240
- [ ] Open a chat knowing what a coding agent knows after /kanban #241
- [ ] Chat with the whole board, not only with one card #242
- [ ] Let a chat do the board work it is talking about #243
- [ ] Chat about one card, from the card's page #248

## Decided by the agent
- **Why the pieces cannot ship one at a time**: the command holds no conversation until
  #240, a conversation knows nothing about this project until #241, and a user sees none of
  it until #242 and #248. Chat is one feature, cut into pieces small enough to build.
- **Does the board become a chat app?**: no. The board stays the centre — `goal.md` says so
  plainly. A chat is a second way in, folded away until the user asks for it.
- **Where is a conversation kept?**: on the user's machine, beside the run logs, and never in
  git. Only what the user sends through a board move reaches a card.
- **One conversation per card, or many?**: one, and one for the board. It stays until the
  user clears it.
- **Does a chat show what it cost in money?**: no. That belongs to runs.
- **Does the chat write the card itself?**: that is #243's open question, not this card's.
  Whichever way it lands, a card is written by the board's own move.

### Worth noting
- **The card chat (#248) waits on the board chat (#242)**: #242 settles whether the right
  rail follows the page or always shows the board. That answer decides whether the card chat
  is a panel in the page or the rail showing the open card, so building it first would risk
  building the wrong one.
