# 网页上改了卡片，本机看板几秒内跟着变

## Setup

- Runner 已登录并在运行（见 [第一次启动 Runner 并登录](../sign-in-and-connect/case.md)），项目
  `demo-app` 已放到这台电脑上，任务 DA-4、DA-5、DA-6 都已规划完。
- 本地云端栈取证。替身没有 Realtime，云端发出的提示靠 `WILDCRANE_POLL_MS=2000` 的轮询收到；网页的
  操作用它发出的同一请求代替，本机看板看 `demo-app/.akb/kanban/todo/`。

## Steps

1. Runner 空闲时，在网页改 DA-5 的卡片。
   预期：几秒内本机卡片变成新内容，不需要开始任务，终端没有多余输出。
   证据：[01-web-edit.log](01-web-edit.log)
2. 本机改 DA-5 的「Worth noting」，几乎同时在网页改第一句。
   预期：两处改动都留下，本机和网页读到的内容一致。
   证据：[02-both-sides.log](02-both-sides.log)
3. 让 DA-4 开始构建，这期间在网页改 DA-5。
   预期：12 秒后本机还是旧内容，不打断正在跑的任务。
   证据：[04-during-job.log](04-during-job.log)
4. 等 DA-4 结束。
   预期：网页的改动到了本机；已完成的 DA-4 离开 `todo/`。
   证据：[05-after-job.log](05-after-job.log)
5. 在网页移除 DA-6。
   预期：本机 `todo/` 里的卡片几秒内消失。
   证据：[03-removed.log](03-removed.log)（未通过：见 Feedback）

## Feedback

步骤 1–4 的体验几乎是隐形的：1.8 秒就到了本机，终端一行不多，两边同时改也没丢内容。不足：任务运行中
网页的改动要等任务结束才到本机，本机没有任何提示说还有内容没拉下来。

步骤 5 没有通过：网页「移除」只改任务状态，不提交看板，DA-6 的卡片在云端看板和本机都还在；后来 DA-4 跑完
一整次任务，它也没有消失。本机命令和想法助手因此还会读到一张已移除的卡。
