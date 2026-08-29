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
questions: []
verify:
  - type a message while a reply is coming — the words stay in the box, sending stays off, and nothing is sent when the reply lands until you press send yourself
  - paste a long message into the box — it grows to about eight rows and then scrolls, and the conversation above it is still readable
  - send two messages, reload the page, then press up-arrow twice in the empty box — both come back in order, and another card's chat offers its own messages instead
  - press Cmd/Ctrl-\ from the board, a card page and a memory file — the rail opens with the cursor in the box each time, and pressing it again folds it
---

The box is shut while a reply is coming, and it is three rows tall whatever is typed into
it. So a thought that arrives mid-reply is held in the user's head until the agent stops
talking.

## Worth noting
- **A message typed while a reply is coming waits for the user, not for the reply**: it
  stays in the box and sending stays off until the reply lands, so nothing is ever sent on
  the user's behalf. Anyone who wanted it to go straight away presses send a second time.
- `Cmd/Ctrl-\` would be the app's first keyboard shortcut. Nothing in the board UI answers
  a key pressed outside a text box today, so this sets the precedent for the rest.

<!-- agent -->

## Today
- `Composer` is a fixed `rows={3}` textarea, disabled whenever a reply is in flight, with
  "One message at a time." under it.
- One `blocked` string from the command shuts the box, and it covers a board with no agent
  and a conversation held with a retired agent as well as a reply in flight. Nothing tells
  the three apart today.
- Anything typed and then thrown away is gone — nothing brings back the last message.
- Opening the rail and putting the cursor in the box takes two clicks and a mouse.

## Scope
- **The box grows with what is typed**, to about eight rows, then scrolls. It never pushes
  the conversation off the screen.
- **You can type while a reply is coming.** The box stays live, and an empty one still
  invites the next message rather than saying it is waiting for the reply.
- **A message written mid-reply stays in the box.** Nothing sends while a reply is coming:
  Enter does nothing, and the corner button is Stop once #267 lands and a greyed Send before
  it. The moment the reply is done the box can send again, and the user presses send.
- **Up-arrow in an empty box brings back what you last sent**, ready to reword. Down-arrow
  walks back the other way, and once walking both keys keep walking until the box is typed
  into.
- **What up-arrow walks is this conversation's own sent messages**, read from the
  transcript, so the history survives a reload and is not shared with another card's chat.
- **A half-typed message survives folding the rail** — as it does today.
- **`Cmd/Ctrl-\` opens the rail and puts the cursor in the box**, from anywhere in the app.
  Pressing it again folds the rail.
- **The line under the box says the one thing that matters right then**: while a reply is
  coming, that sending waits for it; otherwise, what `Cmd/Ctrl-\` does. It stays one short
  line in a 360px rail, not a list of every key.

## Scope out
- Nothing sends by itself. A message typed mid-reply never leaves the box until the user
  sends it, so there is no queue and nothing to cancel.
- Walking to another card still drops what was typed. That is a settled call.

## Todo
- [ ] Grow the box with what is typed, to a ceiling, then scroll.
- [ ] Keep the box live while a reply is coming.
- [ ] Keep sending off while a reply is coming — the corner button and Enter both — and
      tell the reply-in-flight block apart from the reasons that shut the box for good.
- [ ] Say under the box that sending waits for the reply, and what `Cmd/Ctrl-\` does the
      rest of the time.
- [ ] Bring back this conversation's sent messages with up- and down-arrow in an empty box,
      reading them from the transcript.
- [ ] Add `Cmd/Ctrl-\` as the key that opens the rail and focuses the box, and folds it
      again.
- [ ] Cover it in `kanban-ui/README.md` — the line saying the box is shut is no longer true.

## Decided by the agent
- **How tall does the box get?**: about eight rows, then it scrolls. The rail is 360px wide
  and the conversation has to stay visible above the box, so a long message is still written
  in a small window.
