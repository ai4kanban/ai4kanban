---
title: Make the chat rail a full chat, not a message box
track: features
priority: high
roi: high
status: todo
release: 0.7.2
blocked_by: []
related: [267, 268, 269, 270, 271, 272, 273]
modules: [local-ui, skill]
questions:
  - question: "[user] Which subtasks ship in 0.7.2, and which wait for a later version?"
    mode: multi
    options:
      - "#267 Stop a reply"
      - "#268 Keep typing while a reply is coming"
      - "#269 Copy, resend, reword"
      - "#270 What it looked at, what it cost"
      - "#271 Point at a card"
      - "#272 The model for one conversation"
      - "#273 Past conversations"
    recommend: [1, 2, 3, 6]
---

The chat rail can send a message and read the reply, and that is all it can do. Anyone who
has used a coding agent's own chat reaches for something within a minute — stopping a reply
that went the wrong way, typing the next message while one is still coming, copying an
answer out — and finds none of it. So they close the app and go back to the terminal, where
the same agent gives them all of it.

## Worth noting
- The chat gets level with a coding agent's own chat and no further. The rail stays folded
  by default and the board stays the centre of the app; making chat the main way to work
  the board is a different project.
- All seven subtasks sit in 0.7.2 today. #267 and #268 are the two people leave over, so
  the rest can move to a later version without the card losing its point.
- `akb chat` in a terminal gains only what it shares with the rail: the same current
  conversation (#273) and the per-conversation model (#272). The rest is the rail's alone,
  so the two are deliberately not equals.
- Pointing at things (#271) is card ids only. A file picker and a flow picker were cut, so
  a path still has to be typed out in full.

<!-- agent -->

## Today
- **Nothing stops a reply.** The command already hands out a way to end one mid-flight
  (`onOpen` in `cli/src/lib/agent/chat.ts`, which `akb chat` uses for Ctrl-C). The window
  never takes it, so a reply going the wrong way is watched to the end.
- **The box shuts while a reply is coming.** "One message at a time", and a fixed three-row
  box that never grows with what is typed.
- **A message, once sent, is a dead end.** No copy, no resend, no reword, no copy of a code
  block in an answer.
- **What the agent looked at is one truncated line per call**, in grey. Nothing opens.
- **Nothing says what a reply cost.** Runs report price, tokens and model; a chat reports
  none of them, though the same connectors supply them.
- **The model is the board's, not the conversation's.** `harnessSettings.<harness>.model`
  is one setting for every run and every chat on the board. A quick question and a hard
  one get the same model, and switching means changing it for everything.
- **One conversation per card, and the only thing you can do to it is throw it away.**
- **The app answers no keyboard shortcut.** Nothing in the board UI reacts to a key pressed
  outside a text box, so the rail is opened with the mouse.

## What the other chats have that this one doesn't
Common to the coding agents' own chats — Claude Code and Codex both:

| They have | The rail |
| --- | --- |
| A key that interrupts the reply | nothing |
| Typing and queueing while it answers | the box is shut |
| Up-arrow to bring back what you last sent | nothing |
| A way to point at a thing without typing its name | nothing |
| A per-session model switch | one board-wide setting |
| Tokens and cost as it goes | nothing |
| Going back to an earlier session | clear, and it is gone |

## Scope
- Seven subtasks, each a small change to the rail. They can be built in any order; the Esc
  rule below is the only thing two of them share.
- **#267 Stop a reply** — the one that keeps people here. Build it first.
- **#268 Keep typing while a reply is coming** — the box grows, holds what is typed, and
  brings back the last message.
- **#269 Copy, resend, reword** — get an answer out, and send one again without retyping.
- **#270 What it looked at, what it cost** — the grey lines open, and the reply says its
  price.
- **#271 Point at a card** — `#` in the chat box offers the open cards by id and title.
- **#272 The model for one conversation** — the harness-agnostic one: per chat, not
  per board.
- **#273 Past conversations** — go back to one instead of only clearing it.
- **Esc belongs to whatever is on top**: while #271's card list is open, Esc closes the
  list; otherwise Esc stops the reply being written (#267). Whichever of the two ships
  second takes the rule on.
- The rail stays a rail: folded by default, the board still the centre of the app.

## Scope out
- Nothing about what the chat is allowed to do — the rail is an ordinary kanban-skill
  session and adds no restrictions. A run a chat starts gets the card and the note the
  command already takes; the conversation itself does not travel with it.
- No second chat window and no full-screen chat page.

## Todo
- [ ] #267 Stop a reply while it is being written
- [ ] #268 Keep typing while a reply is still coming
- [ ] #269 Copy, resend or reword a message without retyping it
- [ ] #270 Open up what the agent looked at, and say what the reply cost
- [ ] #271 Point at a card in the chat box
- [ ] #272 Pick the model for one conversation, not for the whole board
- [ ] #273 Keep past conversations instead of only throwing them away

## Decided by the agent
- **Does any of this have to work in `akb chat` in a terminal too?**: no. The terminal
  already has Ctrl-C for #267 and a shell line editor for #268, and the rest is screen work
  a terminal has no place for. Only the transcript (#273) and the model override (#272) are
  shared, because both live in the command rather than in the window.
- **Could the rail instead become the main way to work the board?**: no. `local-ui`
  `decisions.md` settled that the rail is folded by default so the board and the card stay
  the centre of the app, and nothing on this card reopens that.
