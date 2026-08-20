---
title: Set a spec agent's harness and model where its switch is
track: features
priority: med
roi: med
status: todo
release: ""
blocked_by: [246]
related: []
modules: [local-ui]
questions:
  - question: "[user] Which layout for the Agents pane? — see the `ui-design` section"
    mode: single
    options:
      - A
      - B
      - C
      - 2
    recommend: [4]
---

Configuration → Agents lists each spec agent with one on/off switch and nothing else. Once
an agent can carry its own harness and model (#246), the place the switch lives is the
place that has to set them.

## Today
- `kanban-ui/components/SpecAgents.tsx` draws one row per spec agent: its name, the two
  lines the command supplies, and a switch.
- Everything else about how a run is spawned is in the **Harness** section beside it, and it
  applies to every run on the board.
- So the board can grow a per-agent harness that no screen can see or change.

## Scope
- **Each row says what that agent will run on**: its harness and its model, and whether
  that is the board's or the agent's own.
- **The user sets and clears both from the row**: cleared means back to the board's.
- **The section keeps no list of its own**: the harnesses, the settings each takes and each
  agent's current values all come from the command, the same rule the Harness section and
  this section already follow.
- **A switched-off agent's row still shows its harness**, greyed with the rest of the row.
- **A save that fails puts the row back** and shows the error, the way the switch already
  does.
- **A board whose command is too old to answer** keeps the note the section shows today,
  and offers no harness field.
- The Harness section is unchanged: it still sets what every other run uses.
- No key is typed here. Keys stay where they are.

## Todo
- [ ] Read each agent's harness, settings and what it inherits from the command's spec
      agent list (#246 puts them there).
- [ ] Draw them on the row, to whichever layout the user picks.
- [ ] Set and clear an agent's harness from the row, saving through a server action beside
      `setSpecAgentAction` in `kanban-ui/app/actions.ts`.
- [ ] Set and clear that harness's model the same way.
- [ ] Put the row back and surface the error when a save fails.
- [ ] Keep the row readable while it is switched off.
- [ ] Update `kanban-ui/README.md` where it describes the Agents section.
- [ ] Check the desktop app draws it the same as the browser one.

## By `ui-design` agent

The Agents pane, drawn three ways. Each one is the same dialog you open with the gear —
sidebar on the left, **Agents** picked, two agent rows in it.

<Mockup src="mockups/247/a.tsx" label="A" />

The harness and the model sit on the row, always on screen: two half-width controls under
the two lines that name the agent. Nothing to open, and the pane answers "what does each
one run on" at a glance. It costs the most height — every agent is five lines whether or
not anybody ever overrides it — and the pane reads as a form rather than a list.

<Mockup src="mockups/247/b.tsx" label="B" />

The row grows one quiet line — *Runs on Claude Code · claude-opus-5 — the board's* — with
**Change** on it, and that line opens the same two controls in place. The list stays
scannable and the answer is still on every row; the cost is a click before you can type,
and one more piece of state to keep straight while a save is in flight.

<Mockup src="mockups/247/c.tsx" label="C" />

The row is a way in: it says what it runs on and opens a page of its own, drawn with the
Harness pane's own square cards, with the board's pick as the first card. It tells the
same story as Harness most literally, and has room for the rest of a harness's settings if
an agent ever gets them. The cost is a second level in a dialog that has none today, and
the list you came from is off screen while you set anything.

**B.** It puts what the card asks for on the row — what the agent runs on, set and cleared
from that row — without turning a two-line list into a form. A is the same thing with the
lid off, and gets crowded the moment a third agent ships; C is the nicest home for a
harness's full settings, but this card sets two things, and a page for two things is a
detour.

### In every layout

- **The empty value is a sentence, not a blank**: an inherited harness reads *Same as the
  board — Claude Code* and an inherited model box shows *Same as the board — claude-opus-5*
  as its placeholder, so nobody has to guess what empty means.
- **Its own pick says so**: a row that overrides reads *— its own*, and carries **Use the
  board's** beside it. That button is how both are cleared.
- **Off is still readable**: a switched-off row greys with its line, and the line keeps
  saying what that agent would run on. The switch and the controls both still work.
- **A failed save puts the control back** to what it was and the message goes where the
  page already shows errors, across its top — the same way the switch behaves today.
- **Rules too old to answer**: the pane keeps the note it shows now and draws no line and
  no controls. Nothing half-drawn.
