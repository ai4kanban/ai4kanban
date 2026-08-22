---
title: Set each action's harness in the UI, with one global harness that resets them all
track: 287-per-action-harness/features
priority: med
roi: med
status: todo
release: ""
blocked_by: [288]
related: [287, 247]
modules: [local-ui]
questions: []
---

Configuration → Harness sets one coding tool for every board run. Once each action can
carry its own harness (#288), that pane is where each one is set — and where one global
pick resets them all.

## Today
- `kanban-ui/components/Configuration.tsx` draws the Harness pane: one square card per
  harness, the active one framed, and the settings that harness declares under them. Its
  heading already reads "Default harness".
- Nothing on screen can set a harness for one action.

## Scope
- **The global harness stays where it is**, and keeps its picker and settings.
- **Picking a global harness resets every action to it**, and the pane says so before it
  does — one line, no dialog.
- **Each action has a row under the global pick**: its name, what it runs on, and whether
  that is the global harness or its own.
- **The user sets and clears an action's harness and model from its row**; cleared means
  back to the global one.
- **The pane keeps no list of its own**: the actions, the harnesses, each harness's settings
  and each action's values all come from the command.
- **The empty value is a sentence, not a blank**: an inherited row reads *Same as the board
  — Claude Code*.
- **A save that fails puts the row back** and shows the error across the top of the dialog,
  as the pane does today.
- **A board whose command is too old to answer** draws the global pane alone, as today, and
  no rows.
- **The desktop app draws it the same as the browser.**
- Out: a harness per card or per run.
- Out: the spec agents' rows — that is #247; the two should share one row design.

## Todo
- [ ] Read each action's harness, model and what it inherits from the command's agent info
      (#288 puts them there).
- [ ] Draw the action rows under the global picker, reusing the row shape #247 settles on.
- [ ] Set and clear an action's harness and model from its row through a server action in
      `kanban-ui/app/actions.ts`.
- [ ] Make the global picker reset every action, and say so on the pane.
- [ ] Put the row back and surface the error when a save fails.
- [ ] Keep the pane as it is today when the command is too old.
- [ ] Update `kanban-ui/README.md` where it describes the Harness section.
- [ ] Check the desktop app draws it the same as the browser one.

## Open questions
- Does a row for every action fit in the pane, or should the rows be grouped — build
  (implement, run), plan (refine, resolve, edit, create, propose, plan-release), file
  (archive, reject) — with one harness per group and a way to open a group up?
- Does the global reset need a confirm step when any action has its own harness, or is
  the one-line warning enough?
- Should this pane and #247's Agents pane become one "what runs on what" screen?
