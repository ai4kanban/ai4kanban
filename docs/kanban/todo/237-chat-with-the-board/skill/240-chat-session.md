---
title: Keep one conversation with the agent open, turn after turn
track: skill
priority: high
roi: high
status: todo
release: 0.7.1
blocked_by: []
related: [237]
modules: [skill]
questions:
  - question: "[user] Which agents can hold a live conversation?"
    mode: single
    options:
      - only the ones whose command can keep a session open and take a second message — the rest say chat is not available on this agent, and name the ones that are
      - every agent — the ones that cannot keep a session are sent the whole conversation again each turn, which works but costs more every message
    recommend: [1]
---

Every run today is one job and then it ends: the board sends the work, the log scrolls, the
run is over. The only way back in is Resume, and that is one more turn, not a conversation.
A chat needs the session to stay open, so the second message lands in the same session as
the first and the agent still has everything said before. Give the board that.

## Scope
- `akb chat` opens a conversation about the board; `akb chat <id>` opens one about that card.
- A message gets a reply, and the reply arrives as it is written, not all at once at the end.
- The next message goes into the same session — the agent still has the whole exchange.
- A conversation is not a run. It never shows in the runs panel, never locks a card, and
  never stops a run from starting on the same card.
- The board's conversation and each card's conversation are separate, and one card's is
  never mixed with another's.
- A conversation is still there after the app or the terminal is closed, and carries on
  from where it stopped.
- One control clears a conversation and starts fresh.
- Where a reply stops part way, what arrived is kept and the user is told it stopped.
- Where the agent set up for this board cannot hold a conversation, the chat says so and
  names the agents that can.
- The UI drives its chat through this command, the same way it drives every run, so a chat
  in the app and a chat in a terminal are the same conversation code.

## Todo
- [ ] Add the chat command: open a conversation, send a message, read the reply.
- [ ] Make the reply arrive as it is written.
- [ ] Keep the session between messages, so the agent remembers the exchange.
- [ ] Keep a conversation on disk, beside the run logs and out of git, so it survives a
      restart.
- [ ] Keep the board's conversation and each card's conversation apart.
- [ ] Add the way to clear one.
- [ ] Say what happened when a reply stops part way, and keep what arrived.
- [ ] Say so where the agent in use cannot hold a conversation.
- [ ] Give the UI a way to drive a conversation through the command.
- [ ] Update `cli/README.md` and `akb help runs`.
- [ ] Check it end to end: three messages about one card, close the terminal, come back and
      send a fourth that depends on the first.

## Decided by the agent
- **Is a chat a run?**: no. Runs are jobs the board owns — they lock a card, they can be
  stopped and resumed, and they cost money the board reports. A chat is the user typing, so
  it stays out of the runs panel and out of every rule that keeps two runs off one card.
- **Where is a conversation kept?**: on the user's machine, beside the run logs, never in
  git — the same call #237 already made for this group.
- **One conversation per card, or many?**: one, and one for the board. It stays until the
  user clears it.
- **Can a chat be open while a run works the same card?**: yes. Reading and talking never
  clash with a run; what a chat is allowed to *change* is #243's question, not this card's.
