# WildCrane for Claude Code

Shape ideas with Claude in your own session and start them as WildCrane tasks, run on this
computer. No separate Runner to install: the plugin's local component runs the jobs while Claude
Code is open.

- **Needs**: Claude Code 2.1.287 or later with plugin mods on, and Node 22 or later on the PATH.
- **Panel**: `/wildcrane` — Ideas, Projects, Tasks and Agents, with your account and Sign out on
  top. Cards, boards and tasks open on the web.
- **Clarifying**: tell Claude what needs doing in the conversation; it shapes the ideas, and the
  panel shows this session's. Only the panel's **Start** makes a task.

## Install

```sh
claude plugin marketplace add ai4kanban/ai4kanban
claude plugin install wildcrane@wildcrane
```

## Update

The plugin carries its own Runner, so an outdated plugin stops running tasks until it is updated:

```sh
claude plugin marketplace update wildcrane
claude plugin update wildcrane@wildcrane
```

Then run `/reload-plugins` in Claude Code. To update automatically, turn on auto-update for
wildcrane under `/plugin` → Marketplaces.

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
