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

## Worth noting
- `Cmd/Ctrl-\` would be the app's first keyboard shortcut. Nothing in the board UI answers
  a key pressed outside a text box today, so this sets the precedent for the rest.
- The box grows to about eight rows and then scrolls. A long message is still written in a
  small window, because the rail is 360px wide and the conversation has to stay visible
  above it.

<!-- agent -->

## Today
- `Composer` is a fixed `rows={3}` textarea, disabled whenever a reply is in flight, with
  "One message at a time." under it.
- Anything typed and then thrown away is gone — nothing brings back the last message.
- Opening the rail and putting the cursor in the box takes two clicks and a mouse.

## Scope
- **The box grows with what is typed**, to about eight rows, then scrolls. It never pushes
  the conversation off the screen.
- **You can type while a reply is coming.** The box stays live.
- **A message written mid-reply waits and then goes.** It sits under the box saying it is
  waiting, and a ✕ takes it back.
- **Up-arrow in an empty box brings back what you last sent**, ready to reword. Down-arrow
  walks back the other way.
- **What up-arrow walks is this conversation's own sent messages**, read from the
  transcript, so the history survives a reload and is not shared with another card's chat.
- **A half-typed message survives folding the rail** — as it does today.
- **`Cmd/Ctrl-\` opens the rail and puts the cursor in the box**, from anywhere in the app.
  Pressing it again folds the rail. The line under the box says what the key is.

## Scope out
- No queue of several messages — one waiting message, and that is the limit.
- Walking to another card still drops what was typed. That is a settled call.

## Todo
- [ ] Grow the box with what is typed, to a ceiling, then scroll.
- [ ] Keep the box live while a reply is coming.
- [ ] Hold one message written mid-reply, show it waiting, send it when the reply lands,
      and let ✕ take it back.
- [ ] Bring back this conversation's sent messages with up- and down-arrow in an empty box,
      reading them from the transcript.
- [ ] Add `Cmd/Ctrl-\` as the key that opens the rail and focuses the box, folds it again,
      and say what it is under the box.
- [ ] Cover it in `kanban-ui/README.md` — the line saying the box is shut is no longer true.
