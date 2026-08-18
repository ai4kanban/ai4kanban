---
title: Install the akb command from the desktop app
track: features
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: []
modules: [local-ui, skill]
questions: []
---

A desktop user has no `akb` on their PATH, so their coding agent falls back to a longer
command every time. Let the app put the real one there, from a button.

## Scope
- The app carries the command already (`desktop/resources/cli/`, from
  `desktop/scripts/bundle-cli.mjs`) and runs it under Electron's own Node. The machine may
  have no Node at all, so the shim has to call the app's copy, not `node`.
- Add a button in Configuration, next to the Skill one: **Install the `akb` command**. It
  writes a small executable shim that runs the bundled command, and says where it wrote it.
- Say what the user has now: not installed / installed at `<path>` / installed but pointing
  at an older app. Re-pressing the button repairs it.
- Where the shim goes is the user's to see before it is written. `/usr/local/bin` needs a
  password on most Macs; `~/.local/bin` and `~/bin` need no password but are not always on
  the PATH — when the chosen folder isn't on the PATH, say the one line that adds it.
- Windows and Linux: name what each one writes, or say plainly that the button is macOS
  only for now.
- Removing the app should not leave a shim that points at nothing. Say what happens.
- After the shim is in, a skill note written earlier still names the old fallback. Re-write
  it: pressing this button should leave `akb` as the command in
  `.claude/skills/kanban/SKILL.md` (see `installSkill`, which stamps that line).

## Todo
- [ ] Decide the folder the shim goes in, per platform, and how the user is told about it.
- [ ] Write the shim from the app: an executable that runs the bundled command with the
      app's own Node, and passes its arguments through.
- [ ] Add the button and its state to Configuration, beside the Skill button.
- [ ] Re-stamp the skill note after a successful install, so it names `akb` again.
- [ ] Say in `kanban-ui/README.md` and on the download page that the app can install the
      command.

## Pushback
Only worth it if the shim is genuinely one press. If it turns into a password prompt plus a
PATH edit the user has to make by hand, the fallback the skill note already carries is the
better deal, and this card should be rejected rather than half-built.
