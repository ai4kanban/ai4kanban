# 丢弃一次执行，保留任务

## Setup

- 已登录的账号，Runner 已连接并放了一个项目。
- 用本地云端栈取证（见 `docs/qa/README.md`「如何运行取证」的 web 一条），Runner 用替身领取作业。

## Steps

1. 任务还在等审核、没开始执行时，`POST /v1/tasks/{id}/discard`。
   预期：`discardable` 为 false，409 `conflict`「Only a build that has not landed can be discarded.」。
   证据：[01-before-build.log](01-before-build.log)
2. 批准后 Runner 跑起来，运行中丢弃。
   预期：不用先停止，任务立即回到 `waiting_review`；Runner 随后上报 stopped，状态不变；那台电脑上多一个
   `discard` 作业。
   证据：[02-discard-running.log](02-discard-running.log)
3. Runner 做完 `discard` 作业，再批准，新的执行跑完合入，然后再丢弃。
   预期：批准后新一步是 `implement`；合入后任务 `done`、`discardable` 为 false，丢弃被拒。
   证据：[03-build-again.log](03-build-again.log)
4. 丢弃一次已停止的执行。
   预期：任务回到 `waiting_review`。
   证据：[04-discard-stopped.log](04-discard-stopped.log)
5. 丢弃一次未能完成的执行。
   预期：任务回到 `waiting_review`。
   证据：[05-discard-failed.log](05-discard-failed.log)
6. 丢弃一次还在排队、没有电脑领过的执行。
   预期：任务回到 `waiting_review`，不产生 `discard` 作业。
   证据：[06-discard-queued.log](06-discard-queued.log)

## Feedback

做偏了的执行能一键扔掉重来，方案还在，也不用先停止，比只能续跑强得多。摩擦点：丢弃的结果是任务回到
`waiting_review`，回复里看不出清理作业排上了没有，只能去 Runner 的作业列表看；电脑离线时清理要等它连上，
用户无从得知工作区到底清没清。工作区和分支真的被删掉属于 runner 模块，这里的替身只上报作业完成，
未覆盖；电脑不再共享给任务、旧版 Runner 两种不清理的情况，本用例也未覆盖。
