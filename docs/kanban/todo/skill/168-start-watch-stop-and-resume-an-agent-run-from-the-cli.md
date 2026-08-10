---
title: Start, watch, stop and resume an agent run from the CLI
track: skill
priority: high
roi: high
status: todo
release: 0.6.0
blocked_by: []
related: [160]
modules: [skill, local-ui]
questions: []
---

Only the board UI can put an agent to work today. Move that into the CLI, so a run can be started from the UI, from your coding agent, or from a terminal — and all three mean the same thing.

## Scope
- `ai4kanban` can start a run for a card — implement, refine, resolve, propose, plan a
  release, run a recurring job — and say which run it started.
- It can follow a run's log while it works, stop a run, and continue a failed one.
- It uses the settings the board already saved: which agent, how hard it thinks, who pays,
  and the key file — not whatever the shell happens to export.
- A run started from the CLI shows up in the UI's runs panel like any other, and a run
  started in the UI can be watched and stopped from the CLI.

## Todo
- [ ] List every kind of run the UI can start today, and give each one a CLI command.
- [ ] Add starting, watching, stopping and resuming a run to the CLI.
- [ ] Read the saved agent settings and keys from the CLI, the same way the UI reads them.
- [ ] Make a run recorded the same way whoever started it, so both sides see the same list.
- [ ] Start a run from a terminal, watch it in the UI, stop it from the UI, and continue it
      from the terminal.
- [ ] Update the docs that teach how to run work.
