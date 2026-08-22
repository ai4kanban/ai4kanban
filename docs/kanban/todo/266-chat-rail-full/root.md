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
  - question: "[user] How far does this go? The chat is meant to be a second way in, folded away by default — but a full chat is what people stay for."
    mode: single
    options:
      - Bring it level with a coding agent's own chat, and leave the board as the centre of the app.
      - "Go further: make the chat the main way to work the board, and let the rail open wide."
      - Stop at the interruptions — stop, keep typing, retry — and leave the rest.
    recommend: [1]
  - "[user] Does any of this have to work in `akb chat` in a terminal too, or is the rail allowed to be the better one?"
  - "[user] Which of these ship together, and which wait for a later version?"
---

The chat rail can send a message and read the reply, and that is all it can do. Anyone who
has used a coding agent's own chat reaches for something within a minute — stopping a reply
that went the wrong way, typing the next message while one is still coming, copying an
answer out — and finds none of it. So they close the app and go back to the terminal, where
the same agent gives them all of it.

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

## What the other chats have that this one doesn't
Common to the coding agents' own chats — Claude Code and Codex both:

| They have | The rail |
| --- | --- |
| A key that interrupts the reply | nothing |
| Typing and queueing while it answers | the box is shut |
| Up-arrow to bring back what you last sent | nothing |
| `@` to point at a file | nothing |
| A per-session model switch | one board-wide setting |
| Tokens and cost as it goes | nothing |
| Going back to an earlier session | clear, and it is gone |

## Scope
- Seven subtasks, each a small change to the rail, built in any order. None depends on
  another.
- **#267 Stop a reply** — the one that keeps people here. Build it first.
- **#268 Keep typing while a reply is coming** — the box grows, holds what is typed, and
  brings back the last message.
- **#269 Copy, resend, reword** — get an answer out, and send one again without retyping.
- **#270 What it looked at, what it cost** — the grey lines open, and the reply says its
  price.
- **#271 Point at a card, a file, a memory note or a flow** — `@`, `#` and `/` in the chat box.
- **#272 The model for one conversation** — the harness-agnostic one: per chat, not
  per board.
- **#273 Past conversations** — go back to one instead of only clearing it.
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
- [ ] #271 Point at a card, a file, a memory note or a flow in the chat box
- [ ] #272 Pick the model for one conversation, not for the whole board
- [ ] #273 Keep past conversations instead of only throwing them away
