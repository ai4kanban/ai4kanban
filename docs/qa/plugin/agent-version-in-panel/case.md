# 在面板的 Agent 标签页看连接的是哪个版本

## Setup

- 同 [在 Claude Code 面板里看到新版本并升级](../update-from-panel/case.md) 用本地 marketplace 安装，
  另加临时 `HOME`、`DISABLE_AUTOUPDATER=1`，`PATH` 只留一个 `pathbin/` 和 Node。假 Cloud 加假
  `session.json` 表示已登录；Agent 标签页只读本机，不依赖 Cloud 数据。
- 先装 #131 之前的 0.1.4，第 2 步更新到本工作区的构建（版本号临时改成 0.1.5）。
- Claude Code 的副本都是真的：`pathbin/claude` 是 2.1.292，`~/.local/share/claude/versions/` 里有
  2.1.312 和 2.1.314。
- Codex 三份：`pathbin` 里假的 0.150.0、`~/.local/bin` 里假的 0.158.0，加本机 ChatGPT 应用内置的真 0.159.0。
  `/opt/homebrew/bin` 里的真 OpenCode 不在 `PATH` 上。
- 打开面板后按 `4` 进入 Agents；Check again 用 Tab 移过去，再按 Enter。

## Steps

1. 用 0.1.4 打开 Agents。
   预期：每行只有名称和状态，没有版本号。
   证据：[01-before-update.png](01-before-update.png)
2. 执行升级命令。
   预期：插件从 0.1.4 更新到 0.1.5。
   证据：[02-update-commands.log](02-update-commands.log)
3. 运行 `/reload-plugins`，再运行 `/wildcrane` 打开 Agents。
   预期：已安装的 Agent 名称后面出现版本号。
   证据：[03-after-reload.png](03-after-reload.png)
   **当前失败**：标题已是 `v0.1.5`，但列表仍是升级前的结果，没有版本号，OpenCode 仍显示未安装，已送 triage。
4. 按某行下的 Check again。
   预期：Claude Code 显示 `2.1.314`（命令行入口是 2.1.292），Codex 显示 `0.159.0` 和 Signed out，
   OpenCode 显示 `1.18.30` 和 Ready，未安装的 Cursor 没有版本号。
   证据：[04-after-check-again.png](04-after-check-again.png)、[05-copies.log](05-copies.log)
5. 重启 Claude Code，打开 Agents。
   预期：不用按 Check again，第 4 步的版本都在。
   证据：[05-fresh-session.png](05-fresh-session.png)
6. 把 2.1.314 换成不能执行的文件，重启后打开 Agents。
   预期：Claude Code 显示下一个能启动的 `2.1.312`。
   证据：[06-newest-broken.png](06-newest-broken.png)
   **当前失败**：显示 `2.1.292`。坏文件被记成能启动、版本未知，于是退回命令行入口，已送 triage。
7. 再把命令行入口 `pathbin/claude` 也换成不能执行的文件，重启后打开 Agents。
   预期：Claude Code 显示 `2.1.312`，状态 Ready。
   证据：[07-entry-broken.png](07-entry-broken.png)
   **当前失败**：显示 Ready 但没有版本号，选中的是启动不了的入口，已送 triage（同第 6 步）。
8. 恢复第 6、7 步的文件。设 `CODEX_CLI_PATH` 指向假的 0.100.0；放两份 Cursor，`2026.10.01-aaa1111`
   在命令行入口、`2026.10.01-bbb2222` 在 `~/.local/bin`；放一份 `--version` 没有版本号的 Kimi。重启后打开 Agents。
   预期：Codex 显示指定的 `0.100.0` 和 Ready；Cursor 比不出新旧，显示入口的 `aaa1111`；Kimi Code
   显示 Ready，没有版本号。
   证据：[08-pinned-and-unknown.png](08-pinned-and-unknown.png)
9. 面板开着时把指定的 Codex 升到 0.101.0，切换标签页再切回，然后重新运行 `/wildcrane`。
   预期：Codex 显示 `0.101.0`。
   证据：[09-agent-upgraded-same-session.png](09-agent-upgraded-same-session.png)
   **当前失败**：仍显示 `0.100.0`。所有行都 Ready 时没有 Check again，只能重启 Claude Code，已送 triage（同第 3 步）。

## Feedback

版本号灰色跟在名称后，一眼能看到，也不和状态抢位置；Signed out 的行同样有版本，知道是哪一份没登录。
入口和实际用的版本不一样时，这一行就是最直接的解释。但界面只有版本，不说它来自哪里：看到 `0.159.0`
而终端里 `codex --version` 是 0.150.0，用户无从知道是 ChatGPT 里那份。最大的问题是这个数字会过时：
升级插件或 Agent 后，同一会话里列表不变，也没有刷新入口，而这时用户正好想确认。
Agent 一行也可能写着 Ready 却没有版本，这时分不清是读不出版本还是根本启动不了。
