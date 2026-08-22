---
title: Tell the user how to log in to the agent, not just how to install it
track: features
priority: med
roi: med
status: todo
release: 0.7.2
blocked_by: []
related: []
modules: [skill, local-ui]
questions:
  - question: "[user] The only remedial line an agent carries today is how to install it. Should it carry how to log in too?"
    mode: single
    options:
      - Yes — each agent declares a login command, and the dialog shows it under the settings.
      - Yes, but only after Test fails — the dialog stays short until something goes wrong.
      - No — the agent's own words in a failed run already tell the user to log in.
    recommend: [1]
---

A user picks an agent, the board says nothing is wrong, and the first run dies in a second
because the agent has no login. The dialog's only help is how to install the agent, which
is already done.

OpenCode is the agent this bites today: it reaches many providers, so it takes no key box,
and `opencode auth login` is the only way in. It leaves the user with a failed run and a
message telling them to type a command into a terminal app the board never shows them.

## Scope
- Each agent says how to log in, in its own words, the way each one already says how to
  install itself.
- The line appears where the install line appears, so a user reads one place to find out
  what a setup is missing.
- An agent with a key box in the dialog needs no login line — the box is the way in.
- Nothing is checked before a run starts. This is a line of help, not a gate: see the Test
  button in `docs/kanban/memory/local-ui/redesign.md`.

## Todo
- [ ] Give each agent a login line, for the agents that have one.
- [ ] Show it in the agent dialog, and in what Test says when it fails.
- [ ] Say in `kanban-ui/README.md` that the dialog tells you how to log in.
