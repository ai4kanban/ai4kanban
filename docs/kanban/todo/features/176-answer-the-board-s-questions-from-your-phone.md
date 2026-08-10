---
title: Answer the board's questions from your phone
track: features
priority: low
roi: high
status: todo
release: 0.6.0
blocked_by: []
related: []
modules: [local-ui]
questions:
  - "[user] How does the phone reach the board — an address on the same network only, or a link that works anywhere?"
  - "[user] Is the phone for deciding only — reading cards, answering questions, moving cards — or for everything the desk screen does?"
---

The agent does the work; the person decides. But every decision has to wait until that person is back at the machine the board runs on, so a run sits blocked on a question that takes ten seconds to answer.

## Scope
- The board can be reached from another device, so a question can be answered away from
  the desk.
- The screens a decider needs work on a small screen: the board, a card, its open
  questions, and the answer boxes.
- Turning this on is the user's own choice, and it says plainly who can reach the board
  once it is on.
- The board still serves only the machine it runs on until the user turns this on.

## Todo
- [ ] Decide how another device reaches the board, and what it takes to turn that on.
- [ ] Make the way in easy to use from a phone — a link or a code, not an address to type
      from memory.
- [ ] Make the board, the card page and the answer boxes work on a small screen.
- [ ] Say who can reach the board while this is on, and let the user turn it off again.
- [ ] Answer a real open question from a phone and check the run picks it up.
- [ ] Update the README with how to turn it on and what it exposes.
