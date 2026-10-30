# 一台电脑装了几份 Agent，Runner 用能启动的最新版本

## Setup

- Runner 已登录并在运行（见 [第一次启动 Runner 并登录](../sign-in-and-connect/case.md)），本地云端栈取证，
  网页端用同一栈的 vite，已切到中文。
- 取证时 Runner 用临时的 `HOME` 和干净的 `PATH`，每一份 Claude Code / Codex 都是替身脚本：`--version`
  打印自己的版本，`auth status` 答登录状态，收到任务时答 `answered by copy <版本>`，并把每次启动记进日志。
  没有用真实的多份 CLI。
- 起始状态有四份 Claude Code：命令行入口 2.0.0、`~/.claude/local/claude` 2.5.0、
  `~/.local/share/claude/versions/` 下的 3.0.0 和 3.1.0。
- 任务用 `POST /v1/runner/jobs` 派发；「日志」里的 `spawned` 是这次真正启动的那一份。

## Steps

1. 打开 设置 → 运行时 → 全局默认，看「连接器」一行。
   预期：显示 `Claude Code 3.1.0`，是四份里最新的，不是命令行入口的 2.0.0。
   证据：[01-copies.log](01-copies.log)、[01-settings-version.png](01-settings-version.png)
2. 派发一个任务。
   预期：任务完成，启动的是 3.1.0。
   证据：[02-job-newest.log](02-job-newest.log)
3. 点「测试连接」。
   预期：通过，登录检测和测试都走 3.1.0。
   证据：[03-test-connection.log](03-test-connection.log)
4. 不重启 Runner，把 3.1.0 换成启动不了的文件（解释器不存在），派发任务，等下一次报到后打开设置；再重启 Runner
   派发一次。
   预期：两次任务都由下一个能启动的 3.0.0 完成，设置显示 3.0.0。
   结果：**未通过**。第一次任务用 3.0.0，但报到 60 秒（约 30 次）后设置还是 3.1.0，已报 triage
   `refresh-connector-version-on-report`。重启后任务落到命令行入口的 2.0.0，不是 3.0.0，原因同第 6 步。
   证据：[04-newest-broken.log](04-newest-broken.log)、[04-stale-version.png](04-stale-version.png)
5. 接上一步（重启前），点「测试连接」。
   预期：通过，「连接器」一行立刻变成 `Claude Code 3.0.0`。
   证据：[05-after-test.png](05-after-test.png)
6. 恢复四份，把命令行入口换成启动不了的文件（解释器不存在），点「测试连接」并派发任务。
   预期：测试通过，任务由 3.1.0 完成，命令行入口失效不影响使用。
   结果：**未通过**。测试报 `not_installed`，任务失败 `spawn claude ENOENT`，版本消失；入口失去执行权限时同样失败
   （`EACCES`）。已报 triage `runner-probe-counts-unspawnable-copy`。入口是 `#!/usr/bin/env` 找不到解释器
   （退出码 127）时正常，用 3.1.0。
   证据：[06-entry-broken.log](06-entry-broken.log)
7. 恢复四份，让最新的 3.1.0 的 `--version` 只打印 `build unknown`，点「测试连接」并派发任务。
   预期：比不出新旧时不猜，用命令行入口：显示 2.0.0，任务由 2.0.0 完成。
   证据：[07-unknown-version.log](07-unknown-version.log)
8. 恢复四份，让 2.0.0 已登录、3.1.0 未登录，点「测试连接」。
   预期：登录状态按实际使用的 3.1.0 算：提示 Claude Code 未登录并给出登录命令，「连接器」仍显示 3.1.0。
   证据：[08-signed-out.log](08-signed-out.log)、[08-signed-out.png](08-signed-out.png)
9. 删掉命令行入口和 `versions/` 下的版本，只留 `~/.claude/local/claude` 2.5.0，点「测试连接」并派发任务。
   预期：`which claude` 找不到，但测试通过，显示 2.5.0，任务由它完成。
   证据：[09-off-path.log](09-off-path.log)
10. 再删掉这一份，点「测试连接」，打开「连接器」下拉框。
    预期：提示未安装并给出 `npm install -g @anthropic-ai/claude-code`，「连接器」一行不显示版本，下拉框里
    Claude Code 标「未安装」。
    证据：[10-not-installed.log](10-not-installed.log)、[10-not-installed.png](10-not-installed.png)、
    [10-connector-menu.png](10-connector-menu.png)
11. 命令行上放 Codex 99.0.0，设 `CODEX_CLI_PATH` 指向 0.1.0，重启 Runner，把全局默认换成 Codex 并派发任务；
    再去掉这个变量重启。
    预期：设了变量时显示 `Codex 0.1.0`，任务由它完成；去掉后回到 99.0.0。
    证据：[11-pinned-env.log](11-pinned-env.log)、[11-pinned-codex.png](11-pinned-codex.png)
12. 在本机看板（`akb`）的 `ui.config.json` 里写 `command`，依次写只加参数的 `claude -p --mine`、路径
    `/…/pin/claude -p --mine`、别的命令名 `my-claude -p`，看 `akb agent list --json` 的 `runs`，并真跑一次。
    Runner 的任务不读这个设置，这一步只对 `akb` 的运行有效。
    预期：只加参数仍用最新的 3.1.0 并保留参数；写路径或别的命令名时原样使用，真跑的是指定的 1.0.0。
    证据：[12-pinned-command.log](12-pinned-command.log)

## Feedback

正常情况下完全无感：多份共存时自动用最新的，设置里多一个灰色版本号，一眼就能确认，不用再去查 PATH。未登录和未安装
的提示都直接给命令，「重新检测」也顺手。

问题在坏掉的时候。第 6 步是这张卡片要解决的场景，却报「未安装」，提示用户去重装一份其实已经有的工具，很误导。第 4 步
版本号只在点「测试连接」或重启 Runner 时才更新，而 Claude Code 会自己升级，所以网页上的版本迟早和实际运行的对不上，
用户无从知道。任务里看不到这次用的是哪一份，排查时只能看版本号，而版本号又可能是旧的。

`CODEX_CLI_PATH` 只对 Codex 有效，其他 Agent 在 Runner 上没有指定版本的办法；`command` 在界面和
`akb agent set` 里都改不了（后者直接报没有这个设置），只能手改 `ui.config.json`。指定之后 `akb agent list --json`
的 `version` 仍是 3.1.0，和 `runs` 指向的 1.0.0 不一致。直接派发到未安装的 Agent 时任务只留下
`spawn claude ENOENT`，没有说人话。
