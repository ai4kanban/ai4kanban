# WildCrane for Claude Code

Shape ideas with Claude in your own session and start them as WildCrane tasks, run on this
computer. No separate Runner to install: the plugin's local component runs the jobs while Claude
Code is open.

- **Needs**: Claude Code 2.1.287 or later with plugin mods on, and Node 22 or later on the PATH.
- **Panel**: `/wildcrane` — Ideas, Chats, Projects and Connections. Cards and boards open on the web.
- **Clarifying**: what you write in the panel goes to the current Claude session; Claude asks in
  the conversation and saves the ideas. Only the panel's **Start** makes a task.

## Install

```sh
claude plugin marketplace add ai4kanban/ai4kanban
claude plugin install wildcrane@wildcrane
```

## Develop

```sh
cd runner && npm install && npm run build      # writes plugins/claude-code/server/dist/
claude --plugin-dir plugins/claude-code
```

Releasing: raise `version` in `.claude-plugin/plugin.json` (and `plugins/codex/plugin.json`), push
the tag `plugin-v<version>`
(`.github/workflows/plugin-release.yml`), then point `/.claude-plugin/marketplace.json` at that
release's `wildcrane-plugin.zip` with the `sha256` the workflow prints. The zip carries its own
Runner: release the plugin before raising Cloud's `RUNNER_MIN_PROTOCOL`.

## Check it

```sh
cd plugins/claude-code && claude plugin validate . && claude plugin test .
```
