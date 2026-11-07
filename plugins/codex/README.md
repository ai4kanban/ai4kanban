# WildCrane for Codex

Shape goals with Codex in your own session and start them as WildCrane tasks, run on this
computer. No separate Runner to install: the plugin's local component runs the jobs while Codex is
open.

- **看板与技能**：通过插件连接云端项目；插件自带 kanban 技能，无需手动安装。Runner 为其他 Agent 准备项目技能并维护提交保护，保留用户文件和已有钩子。

- **Needs**: Codex 0.159 or later, and Node 22 or later (found on the PATH or in the usual nvm,
  Volta, Homebrew, fnm, asdf and mise places).
- **Goals**: tell Codex what you want to build; it asks in the conversation and saves the goals,
  replying with one line and a link per goal. Review, change the workflow, discard and **Start** on
  the web: Codex never starts a task.
- **Ask Codex**: to sign in, to add this folder as a new or existing project, or for your projects, recent
  discussions and agent connections.
- **Updates**: when a newer plugin is released, Codex mentions it with the update steps the
  first time you ask for your WildCrane status in a conversation.
- **`akb`**: when none is installed, Codex is told the full path of the plugin's own, which finds the
  board of a folder added to a project. Not on Windows.
- **Approvals**: Codex asks before each WildCrane tool call unless you approve it for the session.

## Install

Download `wildcrane-codex.zip` from the latest `plugin-v*` release and unzip it, then:

```sh
codex plugin marketplace add ~/Downloads/wildcrane-codex
codex plugin add wildcrane@wildcrane
```

## Develop

```sh
cd runner && npm install && npm run build      # writes plugins/codex/server/dist/
codex plugin marketplace add ./plugins
codex plugin add wildcrane@wildcrane
```

After a rebuild, `codex plugin remove wildcrane@wildcrane` and add it again: Codex runs a copy.

## Check it

```sh
cd runner && npm test                          # the component's tools, lock and lifecycle
plugins/codex/server/bin/wildcrane codex </dev/null && echo started
```

## 运行电脑设置

要求 Codex“打开 WildCrane 设置”，通过 `wildcrane_open_settings({ path?, project? })` 打开共用页面。参数仅预填上下文，不授予目录权限。原有 `wildcrane_sign_in` 和 `wildcrane_add_folder` 保持兼容；新配置优先在设置页完成。
