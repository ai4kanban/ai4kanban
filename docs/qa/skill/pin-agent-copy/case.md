# 指定 Agent 的版本，不被更新的副本替换

## Setup

- 同[自动用最新一份](../use-newest-agent-copy/case.md)的临时项目和假 Agent；Claude 的副本是 PATH 上 2.0.0、`versions/` 下 2.4.0、2.5.0。
- Codex：PATH 上 0.200.0，另一个文件夹里放 0.100.0。`akb agent use codex` 后走步骤 1–3，`akb agent use claude-code` 后走步骤 4–6。
- 步骤 4–6 手改 `.akb/boards/docs/kanban/ui.config.json` 里 Global default 的 `settings.command`，这是该设置唯一的入口：`akb agent set` 不接受 `command`。

## Steps

1. `CODEX_CLI_PATH` 指向 0.100.0，执行 `akb agent` 和 `akb agent test`。
   预期：`command` 是指定的文件；启动的是 0.100.0，不是更新的 0.200.0。
   证据：[01-codex-cli-path.log](01-codex-cli-path.log)
2. 保持该变量，执行 `akb card implement 5`。
   预期：看板运行启动的也是 0.100.0。
   证据：[02-codex-cli-path-run.log](02-codex-cli-path-run.log)
3. 把 `CODEX_CLI_PATH` 指向不存在的文件，执行 `akb agent test`。
   预期：不报错，退回自动挑选，启动 0.200.0。
   证据：[03-codex-cli-path-gone.log](03-codex-cli-path-gone.log)
4. 把 `command` 写成 2.4.0 的路径加 `-p`，执行 `akb agent test`。
   预期：只用 2.4.0，不被 2.5.0 替换。
   证据：[04-command-path.log](04-command-path.log)
5. 把 `command` 写成 `claude -p --mine`，执行 `akb agent test`。
   预期：只改参数不算指定版本：启动 2.5.0，保留 `--mine`。
   证据：[05-command-args-only.log](05-command-args-only.log)
6. 把 `command` 写成本机没有的 `myclaude -p`，执行 `akb agent test`。
   预期：按写的命令启动，不换成任何一份 `claude`；报 `myclaude` 没安装，退出码 1。
   证据：[06-command-other-name.log](06-command-other-name.log)

## Feedback

- **规则好记**：写路径或别的命令名就固定，只改参数不固定；`akb agent` 的 `command` 行能当场确认。
- **变量失效时无声**：步骤 3 路径写错时没有任何提示，用户以为固定在旧版，实际跑的是另一份。
- **看不出是谁指定的**：步骤 1 只显示路径，不说来自 `CODEX_CLI_PATH`；几个月后再看，很难想起这个变量还设着。
- **`command` 只能手改文件**：`akb agent set` 不接受它，帮助里也只提了一句。
- **安装提示可能跑偏**：步骤 6 让用户装 Claude Code，而用户缺的是自己写的 `myclaude`。
