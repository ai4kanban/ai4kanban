---
title: Call a spec agent only when a card's spec needs it
track: skill
priority: med
roi: high
status: ready
release: 0.7.0
blocked_by: [187]
related: [186]
modules: [skill]
questions: []
---

An agent costs a run and a wait, so it is only worth it on a card that would otherwise be
planned by guess. Say when each flow calls one, and when it leaves it alone.

## Scope
- On add-task: once the plan is written, call an agent if the card needs the part that
  agent owns — a screen the user sees and clicks, or an outside library, tool, or service
  to pick. A card that needs neither calls nobody.
- On refine and edit: more careful. Call one only when the spec has to change in the part
  that agent owns. Sharper wording, a re-ordered todo, or a fixed priority calls nobody.
- A card that already carries an agent's section is not sent back to that agent unless that
  part of the spec moved.
- The call is judgment, not a keyword list — the flow decides from what the card needs, the
  same way it decides everything else.
- Calling no agent is normal, not a miss. Nothing warns about it.
- The card records which agents were called, so a later flow does not repeat the work.
- A card that already spells out the screen or names the library the user wants calls
  nobody — the choice is made.
- When an agent comes back with options and the pick is the user's, the flow turns them
  into a `[user]` question on the card, so the user picks instead of reading the section.

## Todo
- [ ] Write the rule for add-task: call an agent when the card needs the part it owns.
- [ ] Write the tighter rule for refine and edit: only when that part of the spec changes.
- [ ] Say when an agent is not called again on a card it already answered.
- [ ] Turn an agent's options into a `[user]` question when the pick is the user's.
- [ ] Take one UI card and one library-picking card through add-task, and check the right
      agent is called on each and nothing is called on a plain card.
- [ ] Document when the board calls an agent by itself.

## Decided by the agent
- **The flow decides, not the user** — the user's only choice is switching an agent off
  (#191). Asking every time would make the feature a chore.
- **Refine and edit stay quiet by default** — a card that has settled should not be
  reopened by an agent that has nothing new to add.
