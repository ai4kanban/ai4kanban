---
title: Make the daily loop something you can do from buttons
track: features
priority: med
roi: med
status: todo
release: 0.7.2
blocked_by: []
related: [274, 275, 276, 277]
modules: [local-ui, skill, docs]
questions:
  - question: "[user] The guide teaches \"review the board\" — but there is no akb review, no flow for it, and no button. What should it be?"
    mode: single
    options:
      - leave it as something you only say to a coding agent, and say so in the guide
      - write the flow and give the board a button for it
      - drop it from the guide
    recommend: [1]
  - question: "[user] The guide teaches an order — pick, sharpen, build, finish. Nothing in the app says that order to a new user. Add a fourth subtask for it?"
    mode: single
    options:
      - "no — the two columns already answer \"what can I start now?\", and a panel naming the steps is a tutorial the board would have to keep true"
      - yes — add a subtask for a panel that names the steps, shown until the user has been round the loop once
    recommend: [1]
---

`docs/guides/daily-loop.md` teaches every step of the working rhythm as a sentence you say
to a coding agent. It can only lead with the button where a button exists, and three steps
have none: changing a card's own words, putting a specialist agent on a card, and crossing
off a hand-check the build left you. Someone who arrived through the app is sent back to a
terminal for those.

So this is two jobs in order: build the three missing buttons, then rewrite the guide to
lead with them. This is a group task; each piece is its own subtask in this folder.

## Scope
- Every step the daily-loop guide teaches can be done from the board app, with no terminal.
- The guide reads as if the app is the normal way and the sentence is the other one.
- Where `kanban-ui/README.md` already covers a screen, the guide points at it instead of
  describing the screen again.
- Out of this group: how the kanban skill handles a request in its ordinary chat session,
  and handing the board a file or your voice (#250). Those are other ways in, not missing
  buttons.

## Todo
- [ ] Change a card's words and fields without starting an agent run #274
- [ ] Put a specialist agent on a card from the card's page #275
- [ ] Cross off a hand-check on the card, and add one #276
- [ ] Rewrite the daily-loop guide so each step leads with the button #277

## Decided by the agent
- **What is already a button, and needs nothing**: proposing, creating, refining,
  resolving, scheduling, archiving, rejecting, every release move, running and stopping a
  run, the goal, the metrics, the agent settings, and installing the skill. Pruning the
  memory is the recurring card #142 with its own Run button. The audit that found the three
  gaps covered the whole guide.
- **The guide rewrite goes last**: it is blocked by the three build cards, because a guide
  that leads with a button that does not exist is worse than the one we have.

### Worth noting
- **The Chinese README's link to this guide is out of the plan** — nothing here moves or
  renames the guide, so the link keeps working; what a Chinese reader lands on is an
  English page, and translating it is its own card.
- **The group could ship without #275** — putting a specialist agent on a card is the
  rarest of the three asks, and the guide already says you rarely do it yourself. If the
  release is tight, that is the one to drop.
