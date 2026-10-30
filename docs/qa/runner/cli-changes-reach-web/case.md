# 在 Runner 管理的项目里用命令行改任务，网页立刻跟着变

## Setup

- Runner 已登录（见 [第一次启动 Runner 并登录](../sign-in-and-connect/case.md)），项目 `demo-app`
  已放到这台电脑上，任务 DA-1、DA-4、DA-5 已在网页上发起、规划完，都在「待审核」。
- 终端里的 `akb` 与 Runner 共用登录（`AI4KANBAN_HOME` 指向 Runner 的目录），在项目文件夹里执行，
  看板在 `.akb/kanban`，要加 `--board .akb/kanban`。
- 本地云端栈取证；网页读到的状态用 `GET /v1/tasks/<key>` 记录。

## Steps

1. 退出 Runner，执行 `akb raw archive 5`。
   预期：本机卡片归档；网页上 DA-5 仍是「待审核」。
   证据：[01-archive-offline.log](01-archive-offline.log)
2. 重新启动 Runner。
   预期：连上后先把离线时的改动送回云端，DA-5 变为「已完成」。
   证据：[02-runner-sends.log](02-runner-sends.log)
3. 执行 `akb card reject 4 "徽章没有意义，项目还没发布"`。
   预期：几秒内 DA-4 变为「已移除」，被拒记录带上这条原因。
   证据：[03-reject.log](03-reject.log)
4. 执行 `akb card approve 1`。
   预期：输出 `approved #1 in Cloud`，本机不开跑；云端像网页「批准」一样把构建派给 Runner。
   证据：[04-approve.log](04-approve.log)
5. 构建因卡片上的问题停下、DA-1 回到「待审核」后，执行 `akb raw update-questions 1 --update 1
   "[user] 安装说明放在哪里？" --option …`。
   预期：几秒内网页审核询问的问题换成新问题和新选项。
   证据：[05-question.log](05-question.log)
6. 在网页打开 DA-1。
   预期：侧栏只剩未结束的任务（DA-4、DA-5 已不在），「和 AI 讨论」里显示新问题。
   证据：[06-web-question.png](06-web-question.png)

## Feedback

命令行和网页终于是一回事：拒绝、归档、改问题两秒内就到网页，Runner 离线时的改动重连后也补上了。
不足：终端里的 `akb` 在项目里找不到 `.akb/kanban`，每条命令都得带 `--board`；它也不会自己用 Runner
的登录。归档和拒绝会顺带触发对话复盘、reflect、review-dismissals 等后台 Agent（Runner 一度显示
`Running 4 tasks`），花的是用户自己的额度，事先没有任何提示。终端里 `approved #1 in Cloud` 之后
不说接下来发生了什么，要去网页看才知道构建已开始。
