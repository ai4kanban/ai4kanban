---
title: Make the daily loop something you can do from buttons
track: features
priority: med
roi: med
status: todo
release: ""
blocked_by: []
related: [277]
modules: [local-ui, skill, docs]
questions:
  - question: "[user] The guide teaches \"review the board\" — reading cards back for plain language and missed steps. Nothing does it: `akb review` reviews a delivery against its card, not the board, and there is no flow and no button. What should it be?"
    mode: single
    options:
      - leave it as something you only say to a coding agent, and say so in the guide
      - write the flow and give the board a button for it
      - drop it from the guide
    recommend: [1]
  - question: "[user] The guide teaches an order — pick, sharpen, build, finish. Nothing in the app says that order to a new user. Add a third subtask for it?"
    mode: single
    options:
      - "no — the two columns already answer \"what can I start now?\", and a panel naming the steps is a tutorial the board would have to keep true"
      - yes — add a subtask for a panel that names the steps, shown until the user has been round the loop once
    recommend: [1]
---

`docs/guides/daily-loop.md` teaches every step of the working rhythm as a sentence you say
to a coding agent. Someone who arrived through the app has the board open in a window and is
sent back to a terminal for work that is a button in front of them.

So this is one job: rewrite the guide to lead with the button wherever one exists, and name
the terminal for the two steps that have none. This is a group task; the piece is its own
subtask in this folder.

## Worth noting
- **The Chinese README's link to this guide is out of the plan** — nothing here moves or
  renames the guide, so the link keeps working; what a Chinese reader lands on is an
  English page, and translating it is its own card.
- **Two steps of the guide will still send you to a terminal** — asking for a specialist
  agent yourself has no button and is not getting one, so the guide names `akb spec` for
  that step; the board asks for a specialist itself while it plans a card. Writing a
  hand-check down by hand is the other: hand-checks come from the spec the board clarifies,
  so the card page only crosses them off.

<!-- agent -->

## Scope
- Every step the daily-loop guide teaches can be done from the board app, apart from the
  ones it names as terminal-only: saving an API key, and asking for a specialist agent.
- The guide reads as if the app is the normal way and the sentence is the other one.
- Where `kanban-ui/README.md` already covers a screen, the guide points at it instead of
  describing the screen again.
- Out of this group: how the kanban skill handles a request in its ordinary chat session,
  and handing the board a file or your voice (#250). Those are other ways in, not missing
  buttons.

## Todo
- [ ] ~~Add a hand-check on the card page #276~~
- [ ] Rewrite the daily-loop guide so each step leads with the button #277

## Decided by the agent
- **What is already a button, and needs nothing**: proposing, creating, refining,
  resolving, scheduling, archiving, rejecting, every release move, running and stopping a
  run, the goal, the metrics, the agent settings, and installing the skill. Pruning the
  memory is the recurring card #142 with its own Run button. Changing a card's own words is
  Edit on the card page, which asks the agent for the rewrite; that stays the way to do it.
  Putting a specialist agent on a card is `akb spec` in a terminal, with Configuration →
  Agents saying which specialists may run at all; that stays the way to do it too. The audit
  that found the gap covered the whole guide.
- **Nothing blocks the rewrite**: every step it leads with has its button today.
