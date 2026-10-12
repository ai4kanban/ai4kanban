# 卡片的 chat 正在回复时否决它

## Setup

- **看板**：一个刚用 `akb install` 建好的看板，`todo/` 里有 #2「深色模式跟随系统」和 #3「导出为 PDF」。
- **Agent**：看板的运行时指向一个会先说一句话、然后一直不结束的 agent，好让回复停在「进行中」。
- **终端**：zsh，在看板所在的项目目录里；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 在一个终端里执行 `akb chat 2 把范围改成按时间定时切换`。
   回复开始流出（「我先读一下这张卡，再改写范围……」），命令不返回；状态目录里出现 `card-2.answering`。
   [01-chat-replying.log](01-chat-replying.log)

2. 回复还在写时，在另一个终端执行 `akb card archive 2`，再执行 `akb card implement 2`。
   两条都被拒绝（exit 1）：`#2 is being discussed — its card chat is writing a reply, so 'archive' is refused until that turn ends.`，implement 同样。
   [02-archive-held.log](02-archive-held.log)

3. 回复还在写时执行 `akb card reject 2 --discard`。
   当场成功：`discarded #2: moved file … → docs/kanban/.archive/2-dark-mode.md, marked rejected`，并说 `forgot the conversation about #2`。
   [03-reject.log](03-reject.log)

4. 回到第一个终端。
   约一秒内 chat 命令自己结束，末行是 `— the conversation was removed.`；`chats/` 里没有 #2 的对话和 `.answering`，agent 进程已停；再 `akb chat 2` 报 `no card #2 on this board`。
   [04-chat-ended.log](04-chat-ended.log)

5. 对 #3 重复一遍：`akb chat 3 也支持导出 Markdown` 回复中，执行 `akb card reject 3 这个版本不做导出`。
   带原因的否决同样当场成功，chat 随之结束；归档文件有 `rejected_reason`、`rejected_at`、`rejected_by: user`，`chats/` 清空。
   [05-reject-with-reason.log](05-reject-with-reason.log)

## Feedback

- **不用再等回复写完**：想丢掉的卡，聊到一半就能直接否决，命令行和 agent 都不再被「讨论中」挡住，这是对的。
- **锁的边界清楚**：archive、implement 照旧被挡，报错说明了原因和何时解除；reject 放行而它们不放行，读一次报错就能理解。
- **chat 这边的收尾话不对**：回复被否决打断后，chat 打印 `What arrived is kept; send another message to carry on.`——卡已经没了，对话也删了，「接着发」只会得到 `no card #2`。应该直接说卡被否决了。
- **否决回执没提到打断了回复**：`forgot the conversation about #2` 不说正在写的回复被停掉，另一个终端里的人只能自己发现 chat 断了。
- **没有跑到的**：卡片页上回复中 Reject 按钮可用（属 local-ui 模块）；真实 Claude Code 等 agent 下回复被停掉（这里用的是假 agent）。
