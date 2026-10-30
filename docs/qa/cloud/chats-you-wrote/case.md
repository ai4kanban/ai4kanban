# 对话列表只放你亲自聊过的任务

## Setup

- 已登录的账号，Runner 已连接并放了一个项目。
- 用本地云端栈取证（见 `docs/qa/README.md`「如何运行取证」的 web 一条），Runner 用替身领取作业。
- 列表用 `GET /v1/chats?workspace=<id>` 看，网页左侧「任务」栏读的就是它。

## Steps

1. 建一个要运行的任务，等写卡的一步跑完、Agent 在对话里回了一句。
   预期：对话里已有两条消息，`/v1/chats` 里始终没有这个任务。
   证据：[01-new-task.log](01-new-task.log)
2. 在这个任务的对话里发一条消息。
   预期：它出现在 `/v1/chats` 里。
   证据：[02-first-message.log](02-first-message.log)
3. 关闭对话（`DELETE /v1/tasks/{id}/chat`），再发一条。
   预期：关闭后消息清空，它离开列表；再发后重新出现。
   证据：[03-close-and-reopen.log](03-close-and-reopen.log)
4. 从想法对话开始一个任务。
   预期：对话里有带过来的消息，但它不在列表里。
   证据：[04-from-idea.log](04-from-idea.log)

## Feedback

列表终于只剩自己在聊的东西，不会被每张新卡撑满。摩擦点：调用方拿不到「这个任务有对话但不在列表里」的
信号，想回到一个刚建的任务只能走看板。已有任务的迁移回填和网页点开不跳回看板，本用例未覆盖。
