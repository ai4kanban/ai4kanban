---
title: Stop a reply while it is being written
track: features
priority: high
roi: high
status: todo
release: ""
blocked_by: []
related: [266]
modules: [local-ui, skill]
questions: []
verify:
  - Stop a reply from a second window on the same project, and check it ends in both.
  - "With a reply coming, open Configuration and press Esc: the dialog closes and the reply keeps arriving."
---

A reply that has gone the wrong way is watched to the end, so the user waits out an answer
they already know is wrong before sending the correction. Stop ends the reply from the
chat rail and keeps what arrived.

## Worth noting
- **Stop replaces Send in that corner rather than sitting beside it**: one button there is
  one thing to learn, and nothing can be sent while a reply is coming until #268 lands.
- **Stopping asks nothing, and the box comes back empty**: a reply stopped by accident is
  gone, and asking the same thing again means typing it out a second time until #269's
  Reword lands.
- **A reply `akb chat` is writing still cannot be stopped from the window**: that turn
  belongs to the terminal's own process, so Ctrl-C there stays the only way to end it.

<!-- agent -->

## Today
- The command hands the caller a way to end a reply mid-flight — `onOpen(stop)` in
  `cli/src/lib/agent/chat.ts`. `akb chat` takes it, and Ctrl-C stops a reply in a terminal.
- The window never passes `onOpen` (`kanban-ui/lib/chat.ts`), so nothing in the UI can end
  one.
- The composer's only button is Send, and it is greyed while a reply is coming.
- A reply `akb chat` is writing belongs to that process. The server sees only the marker on
  disk saying the conversation is answering, and shuts the box on it.
- A stopped reply gets three seconds to die before the turn is declared over
  (`CLOSE_GRACE_MS`), so a read taken in that window still reports it in flight, and the
  transcript does not hold what arrived until the turn ends.
- Six places already answer Esc — the dialogs, the runs panel, two popovers and the card
  rail's search box — each on a listener of its own, and none of them tells the others the
  key is taken.

## Scope
- **Stop where Send is**: while a reply is being written, the Send button becomes Stop —
  one click, no confirmation.
- **The line under the box names Esc**: the line that reads "One message at a time." while
  a reply comes says how to stop it too.
- **Esc stops it too**: while the rail is open, nothing above it has claimed the key, and
  the key was not pressed inside a text box — clearing the card rail's search leaves the
  reply alone. Once #271's card list is open, Esc closes that list and the reply keeps
  coming.
- **What arrived is kept**: the words already written stay in the transcript, under the
  same note a reply that died on its own gets — "you stopped the reply."
- **The conversation carries on**: the next message continues where it stopped, exactly as
  it does after a reply that stopped by itself. A first reply stopped before it said a word
  still leaves the conversation on the session the agent opened.
- **It reaches every window on this board**: one server serves the whole project and owns
  the reply, so a reply started on another page or in another window is stopped from here
  too.
- **A terminal's reply is left alone**: the box stays shut on a conversation `akb chat` is
  answering, exactly as today, and no Stop is offered for it.
- **The box comes back plain**: it opens again empty, ready for the next message. The
  message that was sent is not put back to be reworded.
- **Stopping is instant on screen**: the reply is over from the click — the words that
  arrived stay put, and the button goes back to Send. A read taken during the seconds the
  agent is given to die does not put the reply back on screen, and a message sent in that
  gap is held until the turn ends rather than refused.
- **Stop always lands**: pressed before the agent is up — the gap a first message spends
  installing the skill — it is remembered and ends the reply as soon as there is one to
  end; pressed after the reply has landed, it quietly does nothing.

## Scope out
- No stop of its own for `akb chat` — Ctrl-C already does this there. Keeping the session a
  first reply opened is shared with the command, so a turn Ctrl-C'd in a terminal keeps it
  too.
- Not run Stop: a chat is not a run and shows in no runs panel.

## Todo
- [ ] Pass `onOpen` through `kanban-ui/lib/chat.ts`, hold the stop handle beside the
      in-flight reply, and remember a stop asked for before the handle arrives.
- [ ] Add a server action that calls it, keyed the same way the flight is, answering quietly
      when there is no flight to stop.
- [ ] Turn Send into Stop while a reply is coming, keeping that button live while the box
      itself is shut, and name Esc in the line under the box.
- [ ] Let whatever is layered over the rail claim Esc first, and stop the reply only on a
      key nothing above the rail claimed and nothing was being typed into.
- [ ] Leave the box shut, as today, on a conversation this server holds no flight for.
- [ ] Hold a stopped reply's words on screen with the turn marked over from the click, hand
      them to the transcript when the agent's grace ends, and hold a message sent in that
      gap until the turn is done.
- [ ] Keep the session the agent opened when a first reply is stopped before it says
      anything, so the next message carries on rather than starting fresh.
- [ ] Cover it in `kanban-ui/README.md`, beside "One message at a time".

## Decided by the agent
- **What does Esc listen on, and who gets it first?**: the window while the rail is open,
  not the rail's own focus — the box is disabled while a reply is coming, so nothing inside
  the rail can hold focus to hear the key. A layer above the rail takes the key in the
  capture phase, and a key pressed inside a text box belongs to that box, so the rail sees
  only a key nothing else wanted.
