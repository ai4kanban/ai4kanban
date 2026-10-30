# 看任务正在细化还是执行

## Setup

- 已登录的账号，Runner 已连接并放了一个项目。
- 未部署前用本地云端栈取证（见 `docs/qa/README.md`「如何运行取证」的 web 一条），Runner 用替身领取作业。

## Steps

1. 建一个要运行的任务（`POST /v1/tasks`，`run: true`），再让 Runner 领走这一步，每次 `GET /v1/tasks/{id}`。
   预期：排队和运行中 `run.step` 都是 `create`（卡片还在创建中）。
   证据：[01-refine.log](01-refine.log)
2. 细化结束、任务等审核时批准。
   预期：新的一步排队，`run.step` 是 `implement`。
   证据：[02-implement.log](02-implement.log)
3. 另一个等审核的任务里请求修改。
   预期：`run.step` 是 `revise`。
   证据：[03-revise.log](03-revise.log)
4. 建任务时带 `skip_plan: true`。
   预期：一开始就是 `implement`。
   证据：[04-skip-plan.log](04-skip-plan.log)

## Feedback

一个字段就能分清细化和执行，跳过细化的任务也不会被误标。`resolve`（解决冲突）在云端看不到单独的
步骤，本用例没法触发；网页上「细化中 / 执行中」的显示属于 web 模块，未在这里覆盖。线上 Cloud 还没
部署这次改动，以上全部来自本地栈。
