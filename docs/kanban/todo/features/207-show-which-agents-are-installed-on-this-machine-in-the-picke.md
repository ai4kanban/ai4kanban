---
title: Show which agents are installed on this machine in the picker
track: features
priority: med
roi: med
status: ready
release: 0.6.0
blocked_by: []
related: [160]
modules: [local-ui]
questions: []
---

The picker shows every agent the same way, so someone who only has Claude Code can pick
Cursor and learn it isn't there when the first run dies. Check which agent CLIs this
board can actually run, and dim the ones it can't.

## Scope
- Check each agent in the picker for its CLI, with the same PATH a run gets. The picker
  then says what a run would do here, not what sits somewhere on the machine.
- An agent that isn't there is dimmed, not hidden, and the card says so in a word.
- A dimmed agent can still be picked. Picking it shows the one line that installs it —
  the line a failed run shows today, now before the run instead of after it.
- Honour a user's own `command` override: the binary the override names is the one
  checked, not the one we ship.
- The answer comes with the agent list the dialog is already given, so the cards are
  right the first time they draw — no card that dims a moment after the dialog opens.
- Every time the dialog opens it asks again, so a user who installs a CLI and reopens the
  dialog sees that agent come alive.
- The agent running the board today is never dimmed away — if the check is wrong, nobody
  is locked out of a setup that already works.
- The check costs nothing and calls no provider: it looks for the binary, it does not run
  the agent. Test stays what it is — one real run through the picked agent, tokens and all.

## Decided by the agent
- **Dim or hide?** Dim. A hidden agent reads as "we don't support it", which is the
  opposite of what #160 just shipped, and the install line has nowhere to live once the
  card is gone.
- **Can a dimmed agent still be picked?** Yes. The check reads the PATH this board runs
  with, and someone whose CLI sits outside it would otherwise be shut out of the agent
  they use every day.
- **Where does the setup flow get this?** For free. The guided first run asks for the
  agent with this same picker, so it marks the installed agents without its own work.

## Todo
- [ ] Check whether each agent's CLI can be run, on the same PATH a run uses, and honour
      a `command` override when there is one.
- [ ] Dim the agents that can't run, and show what installs the one the user picks.
- [ ] Ask again each time the Configuration dialog opens.
- [ ] Check it by hand on a machine missing one of the four: the dialog opens with that
      one dimmed, picking it names the install command, and the running agent stays live.
- [ ] Say in `kanban-ui/README.md` that the picker marks the agents this machine can run
      and names what installs the rest.

## Source
- Multica marks a connector it can't run instead of offering it. Four agents ship on our
  side (#160) and almost nobody has all four installed.
