# 同一个 Agent 装了多份时，看板自动用最新能启动的一份

## Setup

- 按 README 的 akb 取证方式建临时项目并 `akb install`，`HOME` 也指向临时目录，再 unset `NVM_DIR`、`PNPM_HOME`，免得找到本机真实的副本。
- 用假的 `claude`：`--version` 打印版本，正常启动时把自己的版本记进日志。`akb` 是真的，Agent 不是：真实版本的响应不在本用例内。
- PATH 上放 2.0.0，`~/.local/share/claude/versions/` 下放 2.4.0、2.5.0；建一张卡 #5。

## Steps

1. 执行 `akb agent` 和 `akb --json agent list`。
   预期：Global default 的 `command` 指向 2.5.0，`version` 是 `2.5.0`，不是 PATH 上的 2.0.0。
   证据：[01-shows-newest.log](01-shows-newest.log)
2. 执行 `akb agent test`。
   预期：`The board can run it.`，实际启动的是 2.5.0。
   证据：[02-test-uses-newest.log](02-test-uses-newest.log)
3. 执行 `akb card implement 5`。
   预期：看板运行启动的同样是 2.5.0。
   证据：[03-board-run-uses-newest.log](03-board-run-uses-newest.log)
4. 再装一份 2.6.0，执行 `akb agent`。
   预期：不用等缓存过期，立刻改用 2.6.0。
   证据：[04-new-copy-counts-at-once.log](04-new-copy-counts-at-once.log)
5. 把 2.6.0 换成启动不了的文件，执行 `akb agent` 和 `akb agent test`。
   预期：退回 2.5.0，测试通过。
   证据：[05-newest-broken-falls-back.log](05-newest-broken-falls-back.log)
6. 让 PATH 上的 `claude` 启动不了，执行 `akb card implement 5` 再看 `akb run log`。
   预期：运行照常启动，日志开头说明 `The claude on your PATH can't start`，并写明改用哪一份。
   证据：[06-path-entry-broken.log](06-path-entry-broken.log)
7. 恢复 PATH 上的 2.0.0，再装一份 `--version` 读不出版本的副本，执行 `akb agent` 和 `akb agent test`。
   预期：不靠猜测切换，用 PATH 上的 2.0.0。
   证据：[07-unreadable-keeps-path.log](07-unreadable-keeps-path.log)
8. 去掉 PATH 上的 `claude`，只在 `~/.nvm/versions/node/v22.0.0/bin/` 留一份 2.3.0，看 `akb --json agent list` 并执行 `akb agent test`。
   预期：显示已安装，测试通过，启动的是 2.3.0。
   证据：[08-only-off-path.log](08-only-off-path.log)
9. `akb agent use grok`（本机哪里都没有），看 `akb --json agent list` 并执行 `akb agent test`。
   预期：`installed` 为 false；测试说明没安装、给出安装命令，以退出码 1 结束，没有启动报错。
   证据：[09-not-installed.log](09-not-installed.log)

## Feedback

- **省心**：升级后不用改任何配置，新版本下一条命令就生效；PATH 上的入口坏了，运行也不中断。
- **`akb` 看不到版本号**：`akb agent` 只在选中的不是 PATH 入口时显示一条路径，版本号只有 `--json` 才有，普通用户要从路径猜。
- **没选中最新时没有解释**：步骤 7 里 `akb agent` 什么也不说，用户不知道为什么没用已装的新版。
- **未安装的提示已不够准**：步骤 9 仍说 `or isn't on this terminal's PATH`，而现在已经查过了 PATH 以外的常见位置。
- **入口坏了只有运行日志说**：`akb agent test` 通过时不提，用户只有翻运行日志才知道入口要修。
- **探测有缓存**：`chmod -x` 不改文件时间，几分钟内 `akb agent` 仍选那一份，`agent test` 失败；换掉文件内容则立刻改用下一份。另外探索时，真实 ChatGPT 内置的 codex 首次探测被记成读不出版本，比它旧的 PATH 副本因此被选中；清掉 `agent-copies.json` 后重探即读到 0.159.0。未能确认原因，也未重现；该现象不在本用例的证据里。
