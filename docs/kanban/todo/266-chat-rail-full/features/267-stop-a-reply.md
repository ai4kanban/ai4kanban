---
title: Stop a reply while it is being written
track: features
priority: high
roi: high
status: todo
release: 0.7.2
blocked_by: []
related: [266]
modules: [local-ui]
questions:
  - question: "[user] What does the box say after a stopped reply — the plain composer again, or the message put back so it can be reworded and sent?"
    mode: single
    options:
      - The plain composer, with what arrived kept above it.
      - The message goes back in the box, ready to reword.
    recommend: [1]
---

A reply that has gone the wrong way is watched to the end. There is no way to stop it, so
the user waits out an answer they already know is wrong, then sends the correction.

## Today
- The command hands the caller a way to end a reply mid-flight — `onOpen(stop)` in
  `cli/src/lib/agent/chat.ts`. `akb chat` in a terminal takes it, and Ctrl-C stops a reply
  there.
- The window never passes `onOpen` (`kanban-ui/lib/chat.ts`), so nothing in the UI can end
  one.
- The composer's only button is Send, and it is greyed while a reply is coming.

## Scope
- **Stop where Send is**: while a reply is being written, the Send button becomes Stop.
  One click, no confirmation — nothing is lost.
- **What arrived is kept**: the words already written stay in the transcript, with the same
  note a reply that died on its own gets — "you stopped the reply."
- **The conversation carries on**: the next message continues where it stopped, exactly as
  a reply that stopped by itself does today.
- **Esc stops it too**, while the rail has focus.
- **It works from anywhere**: a reply is owned by the server, so stopping one started on
  another page, or in a terminal, works the same and stops that reply.
- **Stopping is instant on screen**: the box opens again the moment it is pressed, without
  waiting for the agent to finish dying.

## Scope out
- No change to `akb chat` — Ctrl-C already does this there.
- Not run Stop: a chat is not a run and shows in no runs panel.

## Todo
- [ ] Pass `onOpen` through `kanban-ui/lib/chat.ts` and hold the stop handle beside the
      in-flight reply.
- [ ] Add a server action that calls it, keyed the same way the flight is.
- [ ] Turn Send into Stop while a reply is coming, and wire Esc to it.
- [ ] Keep what arrived, with the "you stopped the reply" note under it.
- [ ] Open the box the moment Stop is pressed, not when the agent dies.
- [ ] Cover it in `kanban-ui/README.md`, beside "One message at a time".
