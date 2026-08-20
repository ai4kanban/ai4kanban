---
title: Open a chat knowing what a coding agent knows after /kanban
track: skill
priority: high
roi: high
status: todo
release: 0.7.1
blocked_by: [240]
related: [237]
modules: [skill]
questions: []
---

A chat is only worth having if it already knows the board. Someone who opens a coding agent
and says `/kanban #12` gets a session that has read the board's rules, knows what the
project is for, has the card in front of it, and knows which board move answers which ask.
A chat in the board must start from the same place, or the user spends the first three
messages explaining their own project.

## Scope
- A board chat opens knowing the project goal, the module map, the board's tracks, and what
  is open on the board.
- A card chat opens knowing all of that plus the card itself: its body, its fields, what it
  is waiting on, and its open questions.
- Either one can read the memory of the modules it is about — what this project has already
  decided and already turned down — so it never re-suggests a rejected idea.
- It knows which board actions exist and which one an ask maps to, the same routing the
  skill note gives a coding agent.
- It says plainly what it can and cannot do when the user asks.
- One flow, `akb guide chat`, is what a conversation follows, so a chat in the app and a
  chat in a terminal answer the same way.
- Opening a chat does not read the whole board card by card, and the second message does not
  read it all again.
- A chat opened on a card can still look at the rest of the board when the answer needs it.

## Todo
- [ ] Write the chat flow: what a conversation opens with, and how it answers.
- [ ] Give a board chat the goal, the module map, the tracks, and the open cards.
- [ ] Give a card chat the card in full on top of that.
- [ ] Let a chat read the memory of the modules it is about.
- [ ] Teach it which board move answers which ask.
- [ ] Give it a plain answer for "what can you do?".
- [ ] Keep the opening cheap — no whole-board read on every message.
- [ ] Update `docs/guides/daily-loop.md` with what a chat is for and when to reach for one.
- [ ] Check it: open a chat on a vague card and ask what is unclear about it, with no other
      context typed in, and see whether the answer is about this project.

## Decided by the agent
- **Is the chat flow one flow or two?**: one. A board chat and a card chat differ only in
  whether a card is named, so two flows would go out of step with each other.
- **Does a chat carry the flows for refine, resolve and the rest?**: no, not up front. It
  knows they exist and asks the command for the one it needs, which is how a coding agent
  already works and keeps the opening small.
