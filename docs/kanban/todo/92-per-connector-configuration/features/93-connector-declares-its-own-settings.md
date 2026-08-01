---
title: Let each connector declare its own settings
track: features
priority: med
roi: high
status: ready
release: next
blocked_by: []
related: [92]
modules: [local-ui]
questions: []
---

The Configuration dialog shows one Model box, written for Claude Code. Let each connector
say which settings it takes, and draw the dialog from that list, so the next connector is
one entry instead of a UI change.

## Today
- One field, Model, the same for whatever connector is picked.
- A provider, an endpoint, a reasoning level have nowhere to live.

## Scope
- A connector declares its own settings: what each is called, what it looks like, and one
  plain line of help under it. The dialog draws what the connector declares and nothing
  else.
- Two shapes of setting ship here: a box to type in, and a list to pick one from. That is
  what the next cards build on — #95's provider list, #97's reasoning list. A card that
  needs more than these two brings it itself.
- The model becomes one declared setting like the rest, not a special case. Claude Code
  looks the same on screen: the same Model box, the same line of help, and the same notice
  when a hand-written `command` already names a model.
- `docs/kanban/ui.config.json` keeps the shape it has today. The picked connector's name
  and its settings sit in one block:

  ```json
  { "harness": { "name": "claude-code", "model": "claude-opus-5" } }
  ```

  Nothing is migrated, nothing written before this card stops being read, and no key moves.
- `name` and `command` are the block's own keys, so a connector can't name a setting either
  of those.
- A key the connector doesn't declare is left alone when the dialog saves. It is the user's
  file.
- Switching connector clears the block, the same as today: those settings were typed for
  the old agent, and one agent's endpoint or reasoning level means nothing under another's
  name.
- The hand-written `command` override keeps working and still wins over a setting it
  already names.
- Adding the next connector is one entry: its settings, and how each one reaches its CLI.
  Nothing else in the UI learns its name.

## Todo
- [ ] Let a connector declare its settings — each with a label, one line of help, and
      either a text box or a pick-one list — and draw the Configuration dialog from that
      list instead of the fixed Model box.
- [ ] Move Claude Code's model onto the declared list, so nothing changes on screen or in
      the file for a user who only sets a model.
- [ ] Read the picked connector's settings when a run starts, and keep a `command` override
      winning over a model it already names.
- [ ] Leave every key the connector doesn't declare untouched when the dialog saves.
- [ ] Update `kanban-ui/README.md`: what a connector's settings are, that each connector
      brings its own list, and where they sit in the file.
- [ ] Check it by hand: set a model and see it run; add a key of your own to the block and
      see saving keep it. (With #69 on the board, pick the second connector and check its
      own settings show.)

## Decided by the agent
- **One settings block, not one per connector.** A map keyed by connector name would keep
  each agent's settings across a switch, but it buys that with a new file shape, a
  migration story, and a "no longer in effect" notice on every file written so far — on a
  board with one connector, where nobody has a switch to lose anything to. When a second
  connector makes that loss real, keeping both is its own card.
- **Where do the settings live?** Beside `name`, in the `harness` block that already holds
  `model` and `command`. It is the fewest keys and the only shape that needs no migration
  at all. The cost is two reserved words, which the card states.
- **Is `harness` renamed to `connector` in the file?** No. The word on the board is
  planning vocabulary; the file key and the dialog's "Agent" label stay as they are. A
  rename would break every existing file for nothing.
- **Which kinds of setting ship here?** A text box and a pick-one list, and no more. A
  setting that only shows when another one has a certain value (#95's base URL) and a
  setting the dialog refuses to save empty (#95 again) belong to the card that needs them —
  building them now would be guessing at their rules.
