---
title: Chat with the board, or with one card, without leaving the app
track: features
priority: high
roi: high
status: todo
release: 0.7.1
blocked_by: []
related: [240, 241, 242, 243, 248]
modules: [skill, local-ui]
questions:
  - question: "[user] Who writes a chat's replies?"
    mode: single
    options:
      - the coding agent already set up for this board — nothing new to configure, and it works on a Claude subscription with no API key
      - a model the board calls itself, without the coding agent — but this needs an API key, and a board set up on a Claude subscription has none
    recommend: [1]
---

The board gives a user no way to discuss a card. Someone who wants to think out loud about
one — what it is really for, whether it is the right shape — has to leave the app and go
say it to a coding agent. Give them a **discussion panel** on the card page: a box where
they write a message about the card and read the reply. A card can then be argued over and
corrected before any work starts on it.

## Scope
- The card page has a discussion panel.
- The user writes a message in the panel, and the reply appears under it.
- The reply appears word by word as it is written, not all at once at the end.
- The card and its open questions are sent along with every message.
- The reply can also read the board's memory files — what this project has already decided
  and already turned down.
- A discussion changes nothing in the project. It never writes the card and never writes
  any other file the user works in.
- The panel can turn what was discussed into a short change request for the card.
- That change request goes to the card's own **Edit** button.
- The panel can turn what was discussed into an answer to one of the card's open questions.
- That answer goes to the card's own **Resolve** button.
- The user sees what the panel wrote before it goes anywhere.
- The user can rewrite it first.
- A discussion never shows up in the runs panel.
- A user can discuss a card while work is running on it.
- Sending a change to **Edit** or **Resolve** is refused while work is running on the card.
- A discussion belongs to one card and is never shared with another card.
- A discussion is still there after the app is closed and reopened.
- The user can clear a card's discussion.
- Where no coding agent has been set up, the panel says so, and says where to set one up.
- Where a reply stops part way, the panel says so, and keeps what arrived.

## Todo
- [ ] Put the discussion panel on the card page: write a message, get a reply, and see the
      whole exchange so far.
- [ ] Make the reply appear word by word as it is written.
- [ ] Send the card and its open questions along with every message.
- [ ] Let the reply read the board's memory files too.
- [ ] Add the step that writes a change request from the discussion and sends it to
      **Edit**.
- [ ] Add the same step for an open question, sending it to **Resolve**.
- [ ] Show the user what the panel wrote, and let them rewrite it, before it goes.
- [ ] Keep a discussion after the app is closed and reopened.
- [ ] Give the user a way to clear a card's discussion.
- [ ] Show the panel's empty state where no coding agent has been set up.
- [ ] Show what happened where a reply stops part way.
- [ ] Update the UI guide, `kanban-ui/README.md`.
- [ ] Check that a discussion alone leaves the card untouched.
- [ ] Check the whole path end to end: discuss a vague card, send the change, and confirm
      the card changed only where the user asked.

## Decided by the agent
- **Is this a chat window for the whole board?**: no. Each discussion sits on one card page
  and is about that card. The board is still where work starts.
- **Does the discussion change the card itself?**: no. An ordinary **Edit** or **Resolve**
  does that, so the card is written the same way it always was.
- **Where is a discussion kept?**: on the user's machine, beside the run logs, and never in
  git. Only what the user sends reaches the card.
- **One discussion per card, or many?**: one. It stays until the user clears it.
- **Does a discussion show what it cost in money?**: no. That belongs to runs.
