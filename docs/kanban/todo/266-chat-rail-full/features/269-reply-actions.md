---
title: Copy, resend or reword a message without retyping it
track: features
priority: med
roi: high
status: ready
release: ""
blocked_by: []
related: [266]
modules: [local-ui]
questions: []
---

An answer worth keeping cannot be got out of the rail except by selecting it with the
mouse, and a message that came back wrong has to be retyped from memory.

## Worth noting
- Reword sits on any message you sent, not only the last one. Walking a long exchange back
  with up-arrow to find the question worth asking again is counting, not reading.
- Your own messages get reword but no copy. Reword is how a message you wrote gets used
  again.
- "Copy the conversation" is one button in the header rather than a ⋯ menu. One item does
  not need a menu.
- Copying the whole conversation is a step past "a message", kept because it is the same
  need: getting an answer out of the rail.

<!-- agent -->

## Today
- A message is text on the page. Nothing hovers, nothing copies, nothing resends.
- A reply mixes what the agent said with one grey line per thing it looked at.
- A code block in a reply is rendered by `Markdown` with no copy button.
- A reply that stopped short says "send another message to carry on" — the user retypes.

## Scope
- **Copy a reply**: a quiet button under the agent's message. It copies what the agent
  said, without the grey lines of what it looked at.
- **Copy a code block**: the same button on any fenced block inside a reply.
- **Send it again**: on a reply that stopped short or came back empty, one click sends the
  same message again. A reply that finished doesn't get the button.
- **Reword**: a button on any message you sent puts its words back in the box to edit.
- **What is already typed is never overwritten**: an empty box takes the reworded words
  straight away; a box with something in it asks once, the way the header's bin does.
- **The old exchange is left alone**: a reworded message lands at the foot, and nothing
  above it changes.
- **Copy the whole conversation** as markdown, from a button in the rail's header — who
  said what, in order, with the lookup lines left out here too.
- **Send again is off while a reply is coming**, the same rule the box follows today.
- **The buttons show on hover or on keyboard focus**, so a long exchange stays quiet at
  rest and the keyboard still reaches them.
- **A copy says it worked**: the icon becomes a check for a moment, and a screen reader
  hears "copied".
- **A copy that fails says nothing**: where there is no clipboard, the words are on screen
  to select by hand.

## Scope out
- No editing a message in place, and no deleting one message out of the middle. The
  transcript is what was said.
- No branching a conversation from an earlier point.
- No copy button on code blocks anywhere else in the app. Card pages, memory files and run
  logs are drawn by the same markdown and are not part of this.
- Nothing on a reply while it is still being written.
- Up-arrow in the box is #268's. This card is the button.
- Whether the box refills by itself after a stopped reply is #267's open question. This
  card only adds the button that does it by hand.

## Todo
- [ ] Add copy to an agent's message, copying what it said and not what it looked at, and
      leaving it off a reply with no words in it.
- [ ] Add copy to a fenced code block in a reply, and nowhere else in the app.
- [ ] Add "send again" to a reply that stopped short or came back empty.
- [ ] Add "reword" to any message you sent — the words back in the box, asking once when
      something is already typed there.
- [ ] Add "copy the conversation" as markdown to the rail's header, hidden while nothing
      has been said.
- [ ] Cover the buttons in `kanban-ui/README.md`.

## Decided by the agent
- **Why is "send again" only on a stopped or empty reply?**: a chat turn carries on the
  agent's own session, so sending the same words again after a reply that finished asks
  twice instead of retrying. `rejected.md` settled the same shape for runs: Resume covers
  a run that stopped short, a prompt box on every finished run doesn't.
- **What does a copy leave out?**: the grey lookup lines, in one reply and in the whole
  conversation alike. The full text is still on disk, and `akb chat` prints it.
- **Does a copied reply carry the app's "you stopped the reply" note?**: no. Those are the
  app's words, not the agent's.
- **What happens to a half-typed message?**: it is never overwritten. Asking once is the
  idiom the header's bin already uses before it destroys something.
