# 看任务正在创建、细化还是执行

## Setup

- 已登录的账号，Runner 已连接并放了一个项目。
- 用本地云端栈取证（见 `docs/qa/README.md`「如何运行取证」的 web 一条），Runner 用替身领取作业。

## Steps

1. 建一个要运行的任务（`POST /v1/tasks`，`run: true`），再让 Runner 领走这一步，每次 `GET /v1/tasks/{id}`。
   预期：排队和运行中 `run.step` 都是 `create`，`creating` 为 true。
   证据：[01-create.log](01-create.log)
2. 卡片写好（分两阶段）、任务等审核后，批准第一阶段。
   预期：`creating` 变为 false；新的一步排队，`run.step` 是 `refine`。
   证据：[02-refine.log](02-refine.log)
3. 第二阶段写好后再批准。
   预期：新的一步排队，`run.step` 是 `implement`。
   证据：[03-implement.log](03-implement.log)
4. 另一个等审核的任务里请求修改。
   预期：`run.step` 是 `revise`。
   证据：[04-revise.log](04-revise.log)
5. 建任务时带 `skip_plan: true`。
   预期：一开始就是 `implement`，`creating` 为 false。
   证据：[05-skip-plan.log](05-skip-plan.log)
6. 再建一个任务，让写卡的一步失败。
   预期：任务 `failed`，`creating` 仍为 true，卡片不算写成。
   证据：[06-create-failed.log](06-create-failed.log)

## Feedback

`create` 和 `creating` 把「卡片还没写好」和「之后的细化」分得很清楚，调用方不用再猜卡片能不能打开。
摩擦点：`creating` 在任务 `failed` 或 `stopped` 时仍是 true，要和 `status` 合起来才读得懂。`resolve`
（解决冲突）在云端看不到单独的步骤，本用例没法触发；网页上「创建中」点不开的行为和格式校验属于
web、skill 模块，未在这里覆盖。
