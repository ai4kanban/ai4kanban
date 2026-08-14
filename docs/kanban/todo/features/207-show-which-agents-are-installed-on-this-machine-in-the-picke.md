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
  That list is drawn on every board page, not only when the dialog opens, so the check has
  to be cheap enough to sit inside a page draw, and is done once per draw however many
  times the page asks.
- Every draw asks again, so a user who installs a CLI and reopens the dialog sees that
  agent come alive. Nothing is remembered between opens — no cache, so nothing to go stale.
- The agent running the board today is never dimmed away — if the check is wrong, nobody
  is locked out of a setup that already works.
- Nothing is started and no provider is called. The check asks whether the binary is on
  the PATH; it does not run the agent, so there is no CLI to start, no tokens, and nothing
  to wait for.
- The cost does not grow with the list. Read the PATH once, then look each agent's binary
  up in what that read found — a list of thirty agents costs what a list of four costs. A
  design that needs one process per agent is the wrong design.
- Test stays what it is: one real run through the one picked agent, tokens and all, on the
  user's press. Opening the picker never triggers it, for any agent.
- The picker keeps the order it has. An agent sits where it always sat, dimmed or not, so
  a user still finds the one they came for.

## Decided by the agent
- **Dim or hide?** Dim. A hidden agent reads as "we don't support it", which is the
  opposite of what #160 just shipped, and the install line has nowhere to live once the
  card is gone.
- **Can a dimmed agent still be picked?** Yes. The check reads the PATH this board runs
  with, and someone whose CLI sits outside it would otherwise be shut out of the agent
  they use every day.
- **Where does the setup flow get this?** For free. The guided first run asks for the
  agent with this same picker, so it marks the installed agents without its own work.
- **Do we test every connector each time the dialog opens?** No, and we never test one
  here. A test is a real chat through a provider — it costs tokens and can take up to a
  minute — so it stays where it is: `akb agent test`, one agent, on the user's press.
  The picker only asks the PATH whether a binary is there.
- **Does that still hold with thirty agents?** Yes, as long as the check reads the PATH
  and not the agents. One read answers for the whole list at once, so the work is the same
  whether the board ships four connectors or forty.

## Todo
- [ ] Look each agent's binary up on the same PATH a run uses, honouring a `command`
      override when there is one, and starting nothing.
- [ ] Keep the cost flat as the list grows: one PATH read per draw, whatever the agent
      count, and one draw's answer reused for that draw.
- [ ] Dim the agents that can't run, and show what installs the one the user picks.
- [ ] Ask again on each draw, so a freshly installed CLI shows up on the next open.
- [ ] Check it by hand on a machine missing one of the four: the dialog opens with that
      one dimmed and with no delay you can feel, picking it names the install command, and
      the running agent stays live.
- [ ] Say in `kanban-ui/README.md` that the picker marks the agents this machine can run
      and names what installs the rest.

## Source
- Multica marks a connector it can't run instead of offering it. Four agents ship on our
  side (#160) and almost nobody has all four installed.
