---
title: Say when a connector can't run, before a button is pressed
track: features
priority: med
roi: med
status: todo
blocked_by: [95]
related: [92]
modules: [local-ui]
questions: []
---

The Claude subscription is the default, but it only works if the user installed the
`claude` CLI and logged in themselves. Today nothing says so — you press a button and the
run fails. Let each choice in the Configuration dialog say whether it can run.

## Scope
- A connector answers one question: can it run right now? Two things are checked — its CLI
  is installed, and, for a subscription, that CLI is logged in. `claude auth status` says
  the second and needs no key.
- A provider that needs a key is ready when that key is in `docs/kanban/.env` (#94), and
  not ready when it isn't.
- A choice that isn't ready is still shown. It is never hidden, and the board never quietly
  picks another one.
- Beside it goes one plain line: what is missing, and the one thing that fixes it — install
  `claude`, or run `claude auth login` in a terminal, or add the key.
- The check runs when the dialog opens. It never blocks the board, and a check that is slow
  or errors reads as "can't tell", not as "not ready".
- The board never logs anyone in, never runs a login for them, and never reads their
  credentials. It reports and nothing else.
- A run that fails anyway is still a failed run, with its reason in the log (#67). This
  card only moves the news earlier.
- Being *allowed* to write files and run commands is #80, not this card. That run starts
  and gets stuck; this one can't start at all.

## Todo
- [ ] Let a connector report whether it can run: its CLI installed, and logged in for a
      subscription provider.
- [ ] Let a provider report whether its key variable is set.
- [ ] Show the answer in the Configuration dialog next to each choice, with one line naming
      what's missing and the command that fixes it.
- [ ] Run the checks when the dialog opens, off the board's own loading, and show "can't
      tell" when a check fails or times out.
- [ ] Say in `kanban-ui/README.md` that the subscription needs the `claude` CLI installed
      and logged in, and how the dialog reports it.
- [ ] Log out of the `claude` CLI, open the dialog, and check the subscription reads as not
      ready with the login command shown — then log back in and check it clears.
