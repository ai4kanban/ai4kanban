# 给卡片预约细化，没有阻塞就立刻开始

## Setup

- 已登录的账号，Runner 已连接并放了一个项目；任务都由 `POST /v1/tasks` 建好，卡片用
  `akb raw create --id <n>` 在本机写入，所以这些任务从未运行过，除非步骤另有说明。
- 本地云端栈取证（见 `docs/qa/README.md`「如何运行取证」的 runner 一条）。第 1–6、10、11 步是真 Runner 和
  真 `akb`（项目 `notes-cli`，任务 NC-*），第 1–2 步由本机 `claude` 真跑细化。第 7–9 步用替身 Runner
  （项目 `demo-app`，任务 DA-*）按真实格式推送和领作业。
- 网页读到的状态用 `GET /v1/tasks/<key>` 记录，作业来自数据库，本机卡片看 `.akb/kanban/todo/`。

## Steps

1. 没有阻塞的卡，执行 `akb raw schedule 2 --action refine`。
   预期：几秒内任务进入 `refine`，Runner 领走；预约从云端和本机的卡片上消失。
   证据：[01-schedule.log](01-schedule.log)
2. 等这次细化跑完。
   预期：任务变为待审核，全程只有一次 `refine`，卡片上没有预约。
   证据：[02-refine-done.log](02-refine-done.log)
3. 卡片被开着的 NC-1 阻塞（`akb raw create --blocked-by 1` 已自动预约细化），再执行一次预约。
   预期：不启动，预约留在卡上。
   证据：[03-blocked.log](03-blocked.log)
4. 阻塞卡离开（`POST /v1/tasks/NC-1/cancel`）。
   预期：这张卡从未运行过，所以不启动；`blocked_by` 清空，预约还在。
   证据：[04-blocker-left.log](04-blocker-left.log)
5. 再执行一次 `akb raw schedule 3 --action refine`。
   预期：标记本来就在，不算新预约，不启动。
   证据：[05-schedule-again.log](05-schedule-again.log)
6. 先 `akb raw schedule 3 --clear`，再预约。
   预期：这次是新预约，任务进入 `refine`，预约消失。
   证据：[06-clear-and-schedule.log](06-clear-and-schedule.log)
7. 已运行过的任务 DA-14 被 DA-13 阻塞，卡上有细化预约，DA-13 离开。
   预期：DA-14 开始细化，只启动一次，预约消失。
   证据：[07-released.log](07-released.log)
8. 任务 DA-15 正在运行时，推送带细化预约的卡片，然后这次运行结束。
   预期：不启动第二个步骤，推送成功；运行结束后预约仍在，也不启动。
   证据：[08-running.log](08-running.log)
9. 任务 DA-16 在等审核，推送带细化预约的卡片，再批准。
   预期：任务开始细化，预约消失；细化期间批准被拒绝，提示 Agent 还在处理。
   证据：[09-review.log](09-review.log)
10. 没有阻塞的卡，执行 `akb raw schedule 4 --action implement`。
    预期：Cloud 不启动，预约留在卡上，未经审批不会构建。
    证据：[10-implement.log](10-implement.log)
11. Runner 退出后，用 `PUT /v1/tasks/NC-5/card` 写入细化预约，再启动 Runner。
    预期：写入成功，返回的卡片已没有预约；任务排队，Runner 连上后领走。
    证据：[11-offline.log](11-offline.log)

## Feedback

主路径很好用：3 秒内从预约到排队，7 秒内开始运行，真跑一次细化后卡片干净地回到待审核，离线写入也不丢。
摩擦在预约没生效的时候，它什么也不说。第 4 步最难受：本机带 `--blocked-by` 建的卡会自动预约，回执写着阻塞卡
结束就细化，结果阻塞卡走了卡片一动不动。第 5 步再预约一次回执还是「queued」，只有第 6 步的先取消再预约才行，
这条路没人猜得到。第 8 步写在运行期间的预约、第 10 步的 `implement` 也是回执乐观、卡片上标记长期留着。这些
回执问题已有 #148，手动删掉最后一个阻塞关系时预约不启动已有 #149。第 1 步的 `--notes` 只到了作业里，细化
没有用它，已有 `refine-schedule-notes-dropped`。第 9 步等审核的卡被预约后会直接重新细化，审核中的内容可能被
改掉，没有提示。线上 Cloud 已部署这次改动，但本用例全部来自本地栈；网页界面没有截图，状态以 API 为准。
