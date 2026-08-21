---
title: Keep typing while a reply is still coming
track: features
priority: high
roi: high
status: todo
release: ""
blocked_by: []
related: [266]
modules: [local-ui]
questions:
  - question: "[user] A message typed while a reply is coming: sent the moment the reply lands, or held until the user presses send again?"
    mode: single
    options:
      - Sent the moment the reply lands, shown waiting under the box, and cancellable.
      - Held in the box; the user sends it themselves.
    recommend: [1]
---

The box is shut while a reply is coming, and it is three rows tall whatever is typed into
it. So a thought that arrives mid-reply is held in the user's head until the agent stops
talking.

## Today
- `Composer` is a fixed `rows={3}` textarea, disabled whenever a reply is in flight, with
  "One message at a time." under it.
- Anything typed and then thrown away is gone — nothing brings back the last message.
- Opening the rail and putting the cursor in the box takes two clicks and a mouse.

## Scope
- **The box grows with what is typed**, to a few rows, then scrolls. It never pushes the
  transcript off the screen.
- **You can type while a reply is coming.** The box stays live.
- **A message written mid-reply waits and then goes.** It sits under the box saying it is
  waiting, and a ✕ takes it back.
- **Up-arrow in an empty box brings back what you last sent**, ready to reword. Down-arrow
  walks back the other way.
- **A half-typed message survives folding the rail** — as it does today.
- **One key opens the chat and puts the cursor in the box**, from anywhere in the app.

## Scope out
- No queue of several messages — one waiting message, and that is the limit.
- Walking to another card still drops what was typed. That is a settled call.

## Todo
- [ ] Grow the box with what is typed, to a ceiling, then scroll.
- [ ] Keep the box live while a reply is coming.
- [ ] Hold one message written mid-reply, show it waiting, send it when the reply lands,
      and let ✕ take it back.
- [ ] Bring back the last sent messages with up- and down-arrow in an empty box.
- [ ] Add the key that opens the rail and focuses the box, and say what it is in the UI.
- [ ] Cover it in `kanban-ui/README.md` — the line saying the box is shut is no longer true.
