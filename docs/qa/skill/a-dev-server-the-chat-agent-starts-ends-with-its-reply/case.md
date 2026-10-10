# 让对话 Agent 起一个常驻服务，回复结束后它跟着结束

## Setup

- **看板**：一个刚用 `akb install` 建好的看板，删掉 `setup-checklist.md`；自带的 #1 就是聊的那张卡。
- **Agent**：用本目录的 [stand-in.mjs](stand-in.mjs) 顶替 Claude Code（不需要账号）——在 `<project>/.akb/boards/docs/kanban/ui.config.json` 写 `{"harness":"claude-code","harnessSettings":{"claude-code":{"command":"node <路径>/stand-in.mjs"}}}`。它收到消息就像 `nohup npm run dev &` 那样起一个脱离自己、自成进程组的 `node`，把 pid 写进项目目录的 `pids.json`，回一句话，然后正常结束这一回合。
- **终端**：zsh，在项目目录里；日志里的 `akb` 就是这次构建出的命令。另起一个与对话无关的 `node` 作对照。

## Steps

1. 执行 `akb chat 1 "Start the dev server and keep it running."`。
   打印 `Started the dev server (pid …) and left it running.`，立即返回（exit 0）。
   [01-chat.log](01-chat.log)

2. 一秒后 `cat pids.json`，再用 `ps` 看 Agent、它起的服务和自己起的 `node`。
   Agent 和它起的服务都已不在，只剩自己起的那个 `node`。
   [02-ps.log](02-ps.log)

3. 对照：不经看板，直接把一条消息喂给 `stand-in.mjs`，再看同样的进程。
   替身照常回复并退出，但它起的服务还活着，自成一个进程组——第 2 步里结束它的是看板。
   [03-without-board.log](03-without-board.log)

## Feedback

- **不再留下没人管的进程**：回合一结束，Agent 放出去的服务就被收走，与对话无关的进程不受影响；之前这类进程停止或 Clear 都找不到。
- **但「让它一直跑」的请求会落空**：Agent 回复说服务「left it running」，实际回复一结束服务就没了，命令行里没有任何一句提示；用户要自己发现端口没人应答，并且得知道常驻服务应在自己的终端里起。
- **结束讨论在界面上**：点 **End discussion** 立即结束 Agent 属于 local-ui，这里没有验证；终端里的 `akb raw discussion archive` 按卡片说明不会结束看板服务里的 Agent，也没有跑。
- **没有跑到的**：真实 Claude Code（这里用替身，服务按卡片说明用 node 而非 `sleep`，因为 macOS 读不到系统自带程序的环境变量）；Windows 的进程树清理。
