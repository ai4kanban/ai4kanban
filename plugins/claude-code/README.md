# WildCrane for Claude Code

Shape goals with Claude in your own session and start them as WildCrane tasks, run on this
computer. No separate Runner to install: the plugin's local component runs the jobs while Claude
Code is open.

- **看板与技能**：通过插件连接云端项目；插件自带 kanban 技能，无需手动安装。Runner 为其他 Agent 准备项目技能并维护提交保护，保留用户文件和已有钩子。

- **Needs**: Claude Code 2.1.287 or later with plugin mods on, and Node 22 or later on the PATH.
- **Panel**: `/wildcrane` — Projects, Tasks and Agents, with your account and Sign out on
  top. Cards, boards and tasks open on the web.
- **Clarifying**: tell Claude what needs doing in the conversation; it shapes the goals and returns their web links. Review and start goals on the web.
- **`akb`**: sessions you start yourself run the plugin's own `akb` ahead of any installed one, and
  find the board of a folder added to a project. Not on Windows.

## Install

```sh
claude plugin marketplace add wildcrane-ai/wildcrane
claude plugin install wildcrane@wildcrane
```

## Update

The panel shows the installed version and offers these commands when a newer one is released. The
plugin carries its own Runner, so an outdated plugin stops running tasks until it is updated:

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

## 运行电脑设置

在 `/wildcrane` 面板点击“运行电脑设置”，打开与 Codex、终端共用的本机页面。登录、目录和工具检测集中在这里，项目网页入口与任务操作仍保留在面板。设置页随 Runner 更新，无需另装后台程序。
