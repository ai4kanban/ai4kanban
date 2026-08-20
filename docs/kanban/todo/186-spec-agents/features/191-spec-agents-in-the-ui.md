---
title: See the spec agents in the board UI and switch them on or off
track: features
priority: med
roi: med
status: ready
release: 0.7.0
blocked_by: [187]
related: [186]
modules: [local-ui]
questions: []
---

Spec agents that only ever run on their own are invisible: the user cannot see what exists,
what each one is for, or turn off one they do not want. Give them a place in the
Configuration dialog, with a switch each.

## Where the entry goes

A **Spec agents** section in the Configuration dialog, beside Agent and Skill.

```
+------------------------ Configuration -----------------------+
| Agent       | ui-design                                 [on]  |
| Skill       |   draws the screen a card needs                 |
| Spec agents |   called on a card that changes a screen        |
|             |                                                 |
|             | recommend-tech-stack                      [on]  |
|             |   picks the library or service                  |
|             |   called when a card needs an outside library,  |
|             |   tool or service                               |
+--------------------------------------------------------------+
```

## Scope
- The Configuration dialog gets a **Spec agents** section, opened from the header's gear
  like its other sections.
- The section lists every spec agent: its name, the part of a spec it fills, and when the
  board calls it — while a card is being planned, never while it is being built.
- Every spec agent is on from the day the board is installed. The user never picks an agent
  for a card — the planning flow working on the card decides which one it needs.
- Each agent has one switch, on or off. Off means no flow calls that agent, on any card,
  until it is switched back on.
- The switch is saved with the board, so it holds across restarts and reads the same for
  everyone working on that board.
- An agent that is off stays in the list, greyed, and reads "off" in text beside the switch.
- On a card page, a section a spec agent wrote is marked as that agent's, so the user can
  see which part of the spec came from where.

## Todo
- [ ] Add the Spec agents section to the Configuration dialog.
- [ ] List each spec agent with the part it fills and when the board calls it.
- [ ] Give each agent an on/off switch, on by default, saved with the board.
- [ ] Keep a switched-off agent in the list, greyed and labelled off.
- [ ] Make a flow skip a spec agent that is switched off.
- [ ] Mark a spec agent's section on the card page as that agent's.
- [ ] Switch an agent off, run the flow that would have called it, and check it stays out.
- [ ] Document the section and what switching an agent off changes.

## Decided by the agent
- **Which flow calls one** — the planning flows: add-task, refine and edit. That is what
  #186 and #188 are built on, and a part of the spec written after the build starts is too
  late to plan from.
- **Read and switch, not edit** — the section shows what a spec agent is and whether it is
  on. Writing an agent's prompt is not something the UI does yet.
- **It is called "Spec agents"** — the dialog already has an Agent section for the coding
  agent the board runs on, and two entries named "Agent" would be read as one thing.
- **On from the start** — an agent the user has to switch on first is an agent nobody uses.
  A flow deciding a card does not need one costs the user nothing; deciding it themselves,
  card after card, costs them the feature.
- **Off is a setting the user can see** — a greyed entry that still reads "off" keeps the
  user's own choice in front of them, so a card that came back with no screen design has
  its explanation in the same place.
