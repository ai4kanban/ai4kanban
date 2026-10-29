# 在任务对话里看每条回复花了多少钱

## Setup

- 已登录的账号，Runner 已连接，有一个 Claude Code 运行时。
- 未部署前用本地云端栈取证（见 `docs/qa/README.md`「如何运行取证」的 review 一条）；
  Runner 用替身：领取作业后按真实 Runner 的格式上报 `session`、会话累计 `costUsd` 和 token。

## Steps

1. 在任务对话里连发两条消息，同一会话两轮的累计费用依次是 $2.10、$2.85；然后
   `GET /v1/tasks/{id}/chat`。
   预期：第一条回复 `cost_usd` 2.1，第二条 0.75（只算这一轮），不是累计的 2.85。
   证据：[01-two-turns.log](01-two-turns.log)
2. 另一个任务里，第一轮没有上报费用，第二轮上报累计 $1.40。
   预期：两条回复的 `cost_usd` 都是 null——拿不到上一轮的累计额，宁可不显示。
   证据：[02-no-earlier-total.log](02-no-earlier-total.log)

## Feedback

数字终于是「这一轮花了多少」，长对话里不会越聊越吓人。但第 2 步的 null 对用户没有任何
解释，看起来像费用丢了；从想法对话复制出来的会话、紧接规划或构建步骤后的回复也不显示费用，
这两种情况本用例未覆盖。线上 Cloud 还没部署这次改动，以上全部来自本地栈。
