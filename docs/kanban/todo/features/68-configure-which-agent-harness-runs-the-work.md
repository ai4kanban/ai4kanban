---
title: Configure which agent harness runs the work
track: features
priority: med
roi: med
status: ready
blocked_by: []
related: []
modules: [local-ui]
questions: []
---

Make the agent harness a real setting. Today `ui.config.json` holds a raw `command`
string, but the rest of the UI assumes that command is Claude Code — the streaming
flags, the pinned session id, the resume handoff, the retry env var. A different
harness half-works. One harness setting should carry all of that.

## Scope
- Replace `command` in `docs/kanban/ui.config.json` with one `harness` setting:
  `"harness": { "name": "claude-code", "command": "claude -p" }`. `name` picks the
  harness; `command` is an optional override for a custom binary or extra flags, and
  stays hand-edited in the file. Clean break — nothing reads the old `command` key.
- Put everything harness-specific in `kanban-ui/lib/agent.ts` behind one interface per
  harness: the default command, the streaming flags, the output parser, the env vars,
  the display name, the icon, and how a finished session is resumed.
- Record the harness name on each session and build the resume handoff from that
  harness's template. Today the "resume in claude code" button hardcodes
  `claude --resume <id>`, so a session started under one harness would show the wrong
  command after the setting changes.
- Let the user pick the harness in the UI's Configuration dialog, in place of the "More
  agents are coming" placeholder. Claude Code stays the default and is the only entry
  until #69 lands.
- When the setting names no harness we know — an unrecognized name, or a file that still
  holds the old `command` key — run the default and say so in the dialog. Never move a
  user to a different agent silently.

## Todo
- [ ] Replace `command` with the `harness` setting in `kanban-ui/lib/agent.ts` and `kanban-ui/lib/config.ts`.
- [ ] Define one harness interface in `kanban-ui/lib/agent.ts` and move the Claude pieces behind it: stream flags, pinned session id, `CLAUDE_CODE_MAX_RETRIES`, resume command, display name, icon.
- [ ] Store the harness name on each session and build the resume handoff from it, replacing the hardcoded `claude --resume <id>`.
- [ ] Add the harness picker to the Configuration dialog, in place of the "More agents are coming" placeholder.
- [ ] Show a one-line notice in the dialog when the config names no harness we know, or still holds `command`.
- [ ] Update the `//` note in `docs/kanban/ui.config.json` and `CONFIG_NOTE` in `kanban-ui/lib/config.ts`, and move this repo's own config file to the new setting.
- [ ] Update `kanban-ui/README.md` for the new setting.

## Decided by the agent
- What shape is the setting? — one key holding a name and an optional command. The
  override means nothing without the name, and the dialog only ever writes the name.
- What happens to a user's old `command` key? — nothing reads it, and the dialog says so.
  The repo takes clean breaks, but silently moving a user who pointed `command` at their
  own binary back to Claude Code is the worse failure.
- Ship the picker here, with one harness in it? — yes. The card's promise is picking the
  harness in the UI; without it the user hand-edits JSON. #69 then only adds an entry.
- Should the resume command follow the session or the current setting? — the session. The
  harness name has to be saved with the run, or #69's `codex resume <thread-id>` can never
  render on a run that already finished.
- Make this and #69 one group? — no. `blocked_by` already orders them, and neither card
  needs splitting again, which is the test for a group.
