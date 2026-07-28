---
title: Set the model each harness runs with
track: features
priority: med
roi: med
status: todo
blocked_by: [68]
related: [69]
modules: [local-ui]
questions: []
---

Let the user pick which model a harness runs with. Today the only way is to hand-edit
a raw command string. Give each harness its own settings block, and put the model in
it — one model for every run, passed as `--model`.

## Scope
- Give the `harness` setting from #68 a per-harness settings block in
  `ui.config.json`. Each harness keeps its own block, so switching harness keeps the
  settings you had for it.
- Add `model` as the first setting. Claude Code and Codex both take `--model <id>`,
  so the harness appends that flag when the setting is filled in.
- One model for everything. There is no per-action or per-role model.
- Empty means "use the harness default". The board never invents a model id.
- Let the user type the model in the Configuration dialog, next to the harness
  picker. Free text, not a dropdown — model ids change faster than we ship.

## Out of scope
API endpoint, base URL, and API keys, so a vendor that speaks the Anthropic or OpenAI
API can be used. The settings block is built so those can be added later, but this
card ships only the model.

## Todo
- [ ] Add a per-harness settings block to `ui.config.json` and read it in `kanban-ui/lib/agent.ts`.
- [ ] Add `model` to the block; each harness appends `--model <id>` when it is filled in.
- [ ] Skip the flag when the user's command override already sets `--model`, so the override still wins.
- [ ] Add a model text field to the Configuration dialog, next to the harness picker.
- [ ] Show the model on the agent badge so the user can see what is running without opening the dialog.
- [ ] Update `kanban-ui/README.md`: the new settings block, the model field, and that empty means the harness default.

## Decided by the agent
- Free text or a dropdown of known models? — free text. Model ids change between
  releases, and a stale dropdown would block a model the harness already supports.
- What if the command override from #68 already has `--model`? — the override wins
  and the setting is not appended. One flag, one source.
- Per-harness or one global model? — per-harness. `claude-opus-5` means nothing to
  Codex, so a shared field would break on every switch.
