# 看任务是谁创建的

## Setup

- 已登录的账号，Runner 已连接并放了一个项目。
- 用本地云端栈取证（见 `docs/qa/README.md`「如何运行取证」的 web 一条），Runner 用替身推送看板。
- 创建者在任务的 `source_context.creator` 里，用 `GET /v1/tasks/{id}` 看。

## Steps

1. 用户自己建一个任务。
   预期：`creator` 是该账号（`{ account }`）。
   证据：[01-by-person.log](01-by-person.log)
2. Runner 里的 agent 建任务，`source_context` 带 `agent` 和来源任务。
   预期：`creator` 是 `{ agent: "qa-manager" }`，`task` 指向来源任务。
   证据：[02-by-agent.log](02-by-agent.log)
3. agent 提了一条待处理项，用户在网页上用它建卡（`POST /v1/tasks`，带 `triage`）。
   预期：`GET /v1/triage` 带 `agent`；新任务的 `creator` 是那个 agent，不是点按钮的人，`task` 是来源任务。
   证据：[03-from-triage.log](03-from-triage.log)
4. 智能体改写卡片，在 frontmatter 里写 `creator: someone-else`，Runner 推送。
   预期：任务的 `source_context` 不变。
   证据：[04-edit-card.log](04-edit-card.log)
5. 从想法对话开始一个任务，再删掉那个对话。
   预期：开始时 `creator` 是用户、`source_context.idea` 是想法 id；删除后 `discussion` 变为 null，
   `idea` 和 `creator` 都还在，所以对话面板能继续隐藏首条正文。
   证据：[05-from-idea.log](05-from-idea.log)

## Feedback

每张新卡都说得清来路，agent 自己改卡也动不了这个记录，可信。摩擦点：`creator` 只存账号 id，要靠
`created_by` 才有名字；`source_context.task` 在第 2 步是调用方传的 key、第 3 步是内部 id，同一个字段两种
形状。自动分拣建的卡（`triage-sort`）要真跑判断模型，未覆盖；旧卡不显示创建者和卡片页上的显示、对话
面板隐藏首条消息属于 web 模块。
