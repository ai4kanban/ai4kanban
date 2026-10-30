# 移除一个没结束的任务，再恢复它

## Setup

- 已登录的账号，Runner 已连接并放了一个项目。
- 用本地云端栈取证（见 `docs/qa/README.md`「如何运行取证」的 web 一条），Runner 用替身领取作业和推送看板。
- 下面每一步在 `POST /v1/tasks/{id}/cancel`（移除）、`POST /v1/tasks/{id}/restore`（恢复）后看任务。

## Steps

1. 移除一个等审核的任务，并写明原因。
   预期：任务 `cancelled`，`restores_to` 是 `waiting_review`；原因出现在 `GET /v1/rejections` 里。
   证据：[01-remove-waiting.log](01-remove-waiting.log)
2. 恢复它。
   预期：回到 `waiting_review`；`GET /v1/rejections` 里没有它了。
   证据：[02-restore-waiting.log](02-restore-waiting.log)
3. 本机 `akb raw reject` 一张卡（Runner 把它推进 `.archive/`），再在 Cloud 恢复。
   预期：卡片回到 `todo/`，`archived`、`rejected`、`rejected_reason` 都去掉，任务回到 `waiting_review`。
   证据：[03-restore-archived.log](03-restore-archived.log)
4. 停下一个任务，移除，恢复，再续跑（`POST …/resume`）。
   预期：移除成功；恢复后是 `stopped`；续跑后排队。
   证据：[04-stopped.log](04-stopped.log)
5. 一个未能完成的任务：移除，恢复，再重试（`POST …/resume`）。
   预期：移除成功；恢复后是 `failed`；重试后排队。
   证据：[05-failed.log](05-failed.log)
6. 移除一个正在运行的任务，Runner 随后上报停下，再恢复。
   预期：立即 `cancelled`、`run.stopping` 为 true；Runner 停下后状态不变；恢复后是 `stopped`。
   证据：[06-running.log](06-running.log)
7. 按了停止、电脑还没回应时移除，电脑之后才上报停下。
   预期：立即 `cancelled`；电脑上报后任务仍是 `cancelled`。
   证据：[07-stopping.log](07-stopping.log)
8. 移除一个还在排队的任务，再恢复。
   预期：恢复后是 `stopped`，不会自动重新排队。
   证据：[08-queued.log](08-queued.log)
9. 恢复一个没被移除的任务；移除、恢复一个已完成的任务。
   预期：都是 409 `conflict`，分别提示「Only a removed task can be restored.」「This task has finished.」。
   证据：[09-refused.log](09-refused.log)

## Feedback

误删终于能救回来，任务带着 `restores_to` 事先告诉你会回到哪，已停止、未能完成的任务恢复后还能接着跑，
没有再清不掉的任务。摩擦点：网页上移除的卡片其实没离开 `todo/`，也没写 `rejected`，要看任务状态才知道
它被移除了；本机拒绝的才真的进 `.archive/`，同一个「移除」两条路径落点不同。排队中的任务恢复成
`stopped` 要手动续跑，创建中的还带着 `creating: true`。群组任务在根卡上那一行的恢复、已被复盘学走的
结论不回退，本用例未覆盖；网页上的「恢复」按钮和确认弹层属于 web 模块。
