---
title: See and run the spec agents from the board UI
track: features
priority: med
roi: med
status: todo
release: 0.7.0
blocked_by: [187]
related: [186]
modules: [local-ui]
questions:
  - question: "[user] Where does the Agents entry live? See the two sketches on the card."
    mode: single
    options:
      - A — its own button in the tool cluster, opening an Agents panel
      - B — a tab inside the Configuration dialog
    recommend: [1]
---

Agents that only ever run on their own are invisible: the user cannot see what exists, what
each one is for, or put one on a card themselves. Give them a way in from the header and a
panel of their own.

## Where the entry goes

Two shapes. `A` is the one to build unless the user says otherwise.

```
A — its own button in the tool cluster, opening a panel

  [logo] ~/my-project              [Goal] [0.6.0 v] | (~) (::) (=) (@) | [+ Task]
                                                       ^^^^^^^^^^^^^^^^^^^^^ @ = Agents
  +-------------------------- Agents ---------------------------+
  | ui-design              draws the screen a card needs         |
  |                        called on a card that changes a screen|
  |                                              [Run on a card] |
  | recommend-tech-stack   picks the library or service          |
  |                        called when a card needs an outside   |
  |                        library, tool, or service             |
  |                                              [Run on a card] |
  +--------------------------------------------------------------+

B — a tab inside the Configuration dialog

  +---------------------- Configuration ------------------------+
  | [ Agent ] [ Auto-refine ] [ Spec agents ]                    |
  |                                                              |
  | ui-design              draws the screen a card needs   [Run] |
  | recommend-tech-stack   picks the library or service    [Run] |
  +--------------------------------------------------------------+
```

## Scope
- An entry in the board UI's header opens the Agents panel.
- The panel lists every agent: its name, the part of a spec it fills, and when the board
  calls it by itself.
- From the panel or from a card, run an agent on a card by hand, with an optional note
  saying what to look at.
- A running agent looks like any other run — it shows in the runs panel, can be stopped,
  and its log can be read.
- On a card page, the section an agent wrote is marked as that agent's, with the run that
  produced it reachable from there.
- Rerunning an agent on a card replaces its section, and the page says so before it does.

## Todo
- [ ] Add the header entry that opens the Agents panel.
- [ ] List each agent in the panel with what it fills and when it is called on its own.
- [ ] Run an agent on a card by hand, with an optional note.
- [ ] Show the run beside the other runs, stoppable, with its log.
- [ ] Mark an agent's section on the card page and link it to the run that wrote it.
- [ ] Warn before a rerun replaces a section the user has already read.
- [ ] Open the panel, run an agent on a card, and check the section lands on the page.
- [ ] Document the panel and running an agent by hand.

## Decided by the agent
- **Read and run, not edit** — the panel shows what an agent is and starts one. Writing an
  agent's prompt is not something the UI does yet.
- **An agent run is a normal run** — reusing the runs panel means stopping, logs, and
  failures already work the way the user expects.
