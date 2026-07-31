---
title: Let each connector declare its own settings
track: features
priority: med
roi: high
status: todo
blocked_by: []
related: [92]
modules: [local-ui]
questions: []
---

The Configuration dialog shows one Model box, written for Claude Code. Let each connector
say which settings it takes, draw the dialog from that, and keep each connector's settings
in the file so switching agent stops throwing them away.

## Today
- One field, Model, the same for whatever connector is picked.
- `docs/kanban/ui.config.json` holds one flat block for the connector that is picked.
  Picking a different one wipes the model and any hand-written command.
- A provider, an endpoint, a reasoning level have nowhere to live.

## Scope
- A connector declares its own settings: what each is called, what it looks like (a box to
  type in, a list to pick from), and one plain line of help under it. The dialog draws what
  the connector declares and nothing else.
- The model becomes one declared setting like the rest, not a special case. What the user
  sees for Claude Code does not change.
- Settings are kept per connector in `docs/kanban/ui.config.json`, filed under that
  connector's name. Switch agent and switch back and your setup is still there.
- Only the connector that is picked is read when a run starts. The rest sit in the file.
- A key the connector doesn't declare is left alone on save, never deleted. It is the
  user's file.
- Adding the next connector is one entry: its settings, and how each one reaches its CLI.
  Nothing else in the UI learns its name.
- The hand-written `command` override keeps working, and still wins over a setting it
  already names.

## Todo
- [ ] Let a connector declare its settings, and draw the Configuration dialog from that
      list instead of the fixed Model box.
- [ ] File each connector's settings under its own name in `docs/kanban/ui.config.json`,
      and stop dropping them when the user switches connector.
- [ ] Move Claude Code's model onto the declared list, so nothing changes on screen for a
      user who only sets a model.
- [ ] Leave every key the connector doesn't declare untouched when the dialog saves.
- [ ] Update `kanban-ui/README.md` for the new file shape, with an example.
- [ ] Check it by hand: set a model, add a second connector's block to the file yourself,
      switch to it and back, and see both blocks survive. (With #69 on the board, do it
      from the dialog instead.)

## Decided by the agent
- **The file keeps a block per connector now.** #68 decided the opposite — one flat block,
  and switching drops it — because there was one setting to lose, and a per-connector shape
  would have repeated the connector's name inside its own setting. Neither holds any more:
  a connector now carries a provider, an endpoint, a key source and a reasoning level, and
  losing all of that on a switch is a real cost. The shape that answers #68's objection is
  a map keyed by connector name, with the picked one named once above it — the name is
  written once, not repeated inside its own block.
