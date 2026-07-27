---
title: Show a bar that prompts the user to write the goal when it is weak
track: features
priority: med
roi: med
status: todo
blocked_by: [52]
related: [52]
modules: [local-ui]
questions:
  - "[user] Does the bar ask for a roadmap and a horizon too, or only the goal? There is no roadmap file today — if we want one, is it a section inside goal.md or a new file in the memory set?"
  - "[user] Where does the bar sit and can it be dismissed — a strip above the board that stays until the goal is strong, or one the user can close for the session?"
---

When the goal is weak, show a bar in the UI asking the user to write it. A rough answer
now is worth more than a blank file — every proposal the agent makes is judged against
the goal.

## Scope

- Read `reviewed:` from `goal.md` (task #52 writes it). `strong` shows nothing.
  `weak` shows the bar.
- The bar says the goal is missing or unclear, and offers one button to write it.
- The button opens a plain text editor on `goal.md`, prefilled with what is there now.
  Saving writes the file. The user's own words go in — the agent never drafts the goal
  for them.
- Say plainly that a rough, short answer is fine and it can change later. The user should
  not feel they owe a finished plan.
- The bar is a nudge, not a setting. It does not go in the Configuration dialog and it
  does not add a control to the header.
- The board still works with a weak goal. Nothing is blocked or hidden.

## Todo

- [ ] Read `goal.md` and its `reviewed:` field in the UI's board loader.
- [ ] Build the bar: the message, the button, and the copy that says rough is fine.
- [ ] Place it and decide dismissal, once the second open question is answered.
- [ ] Add the editor dialog for `goal.md` and the save path that writes the file.
- [ ] Handle a missing `goal.md` — the editor creates it from the seeded template.
- [ ] Hide the bar as soon as the value turns `strong`, without a page reload.
- [ ] Document the bar and the goal editor in `kanban-ui/README.md`.
