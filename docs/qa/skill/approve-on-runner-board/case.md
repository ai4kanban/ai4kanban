# 在 Runner 管理的项目里用命令行批准任务

## Setup

- 本机以 Cloud 账号登录，一台 Runner 电脑 QA-Mac 在线，持有项目 notes-app。
- 任务 NA-1（看板上的卡 #1）已出方案、等待审核；项目文件夹里有 Runner 写下的
  `.akb/kanban/` 和 `.akb/base.json`，`AI4KANBAN_BOARD` 指向 `.akb/kanban`（Runner 的运行里即如此）。

## Steps

1. 执行 `akb raw list`，并查看网页读取的任务。
   预期：卡 #1 为 ready；任务状态 `waiting_review`，问题为 "Approve this plan?"。
   证据：[01-waiting.log](01-waiting.log)
2. 执行 `akb card approve 1`。
   预期：打印 `approved #1 in Cloud`，退出码 0；本机不开跑任何运行，项目文件不变。
   证据：[02-approve.log](02-approve.log)
3. 查看任务和 Runner 待领的作业。
   预期：与点网页「批准」一样：审核为 approved，任务进入 `queued`，下一步 `implement` 派给 QA-Mac。
   证据：[03-cloud-moves-on.log](03-cloud-moves-on.log)
4. 再执行一次 `akb card approve 1`。
   预期：报 `Cloud did not approve #1: The agent is still working on this task.`，退出码 1。
   证据：[04-approve-again.log](04-approve-again.log)
5. 退出 Cloud 后执行 `akb card approve 1`。
   预期：报 `This machine is not signed in to Cloud.`，退出码 1，本机不开跑、不改文件。
   证据：[05-signed-out.log](05-signed-out.log)

## Feedback

- **与网页一致**：批准后网页立即看到同样的结果，本机不会多跑一份，避免了两边各跑各的。
- **提示太短**：成功只说 `approved #1 in Cloud`，没说下一步交给了哪台电脑、用什么命令看进度。
- **报错措辞**：重复批准报"代理还在做"，用户更需要的是"已经批准过了"。
- **终端里找不到看板**：Runner 的看板在 `.akb/kanban/`，在项目里直接敲 `akb` 默认找 `docs/kanban/`，要自己加 `--board` 或 `AI4KANBAN_BOARD`。
- **证据来源**：本地云端栈加一台假 Runner；拒绝、归档、取消交付等经即时同步生效的部分属于 runner 模块，这里没有覆盖。
