---
title: Pick a model from a list in the Harness pane
track: features
priority: med
roi: med
status: todo
release: ""
blocked_by: [290]
related: [289, 247]
modules: [local-ui]
questions: []
---

The Model field in Configuration → Harness is an empty box you type an id into, from memory.
Once the command can say which models a harness runs (#290), that field should offer them.

## Today
- `kanban-ui/components/Configuration.tsx` draws each harness setting from what the command
  declares: a `select` becomes a dropdown, anything else a text box. Model is a text box.
- A dropdown already keeps a value that isn't on its list, labelling it
  "(from your ui.config.json)".
- `kanban-ui/app/actions.ts` refuses a `select` value that isn't one of the declared choices.

## Scope
- **Model becomes a list where there is one.** The user opens it, sees what the harness will
  run, and picks. The first entry is the harness's default, as the effort list does.
- **The list can be long** — opencode alone answers with about 70 — so it can be typed into
  to narrow it.
- **A model that isn't on the list can still be entered**, and saves. The list is an offer;
  a model released this morning must still be reachable today.
- **Where there is no list, nothing changes**: a harness pointed at a custom endpoint, or one
  the command can't ask, keeps the box and the help line it has today.
- **The models are read after the pane is drawn, not before it.** The pane opens at once with
  the current value in place; the list fills in when it arrives, and the field is usable the
  whole time.
- **A read that fails leaves a working box** and one quiet line saying the models couldn't be
  read — never a blocking error, and never a field the user can't use.
- **There is a way to ask again** for a user who just installed a model, without restarting
  anything.
- **Switching harness or provider re-reads**, so the list on screen belongs to what is picked.
- **The desktop app draws it the same as the browser.**
- Out: the model per action (#289) or per chat (#272).
- Out: any list of model ids kept in the UI — the command is the only source (#290).

## Todo
- [ ] Read each harness's model list, and whether it could be read, from the command's agent
      info.
- [ ] Draw the model setting as a searchable dropdown when a list is there, and as today's
      box when it is not.
- [ ] Let a value not on the list be entered and saved, and stop `actions.ts` refusing it.
- [ ] Fill the list after the pane is drawn; keep the field usable while it loads.
- [ ] Show the "couldn't read the models" line, and a way to try again.
- [ ] Re-read when the harness or the provider changes.
- [ ] Update `kanban-ui/README.md` where it says the model is typed in.
- [ ] Check the desktop app draws it the same as the browser one.

## Open questions
- Is the field one control that both filters and accepts a new id, or a dropdown with a
  "type an id" escape next to it? Worth drawing both before building.
- Does the list show the ids only, or the readable name beside each id where the harness
  gives one?
- Should a saved model that the list no longer has be flagged on the pane, or left silent
  the way a hand-written value is today?
