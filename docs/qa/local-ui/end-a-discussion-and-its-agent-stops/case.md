# 结束一段讨论，它的 Agent 和 Agent 起的进程一起停下

## Setup

- **看板**：用本目录的 `seed.sh` 建一个一次性 git 项目：新装看板，看板的 Agent 是 Claude Code。
- **Agent**：`claude` 换成本目录的 `stand-in.mjs`（替身，不连模型、不要账号），按真实 Claude Code 的 stream-json 协议说话。每条消息它都用脱离父进程的方式（等同 `nohup … &`）起一个小 HTTP 服务当作 dev server，并在回复里给出地址；消息里有「后台」时，它还报告一个不会自己结束的后台任务，回复结束后 Agent 不退出。dev server 带 `STAND_IN_LOG=<文件>` 时，替身把自己的 pid、dev server 的 pid 和端口、怎么退出的都记进日志。
- **和真实 Claude Code 的差别**：dev server 是替身起的 node 进程，不是 Agent 真的跑了 `npm run dev`；macOS 上看板按环境变量标记找进程，系统自带程序（如 `sleep`）起的脱离进程按标记找不到（#1302 已知限制），node/python 进程可以。
- **界面**：浏览器打开看板 UI（`kanban-ui`），窗口 1440×900，界面语言中文；先在欢迎导览上点「跳过」。

## Steps

1. 点右上角「新想法」，写「帮我把 dev server 跑起来，一直开着」，点发送。
   Agent 回复「dev server 已启动：http://localhost:<端口>」。回复一结束，Agent 进程退出，它起的 dev server 也已经不在：访问那个地址被拒绝。
   ![回复里的 dev server 地址](01-server-in-reply.png)
   [回复结束后的进程](01-after-the-reply.log)

2. 再发「在后台起一个 dev server，一直开着」。
   回复「dev server 已在后台启动：http://localhost:<端口>」；因为还有后台任务，Agent 进程留着，新 dev server 能访问（返回 `dev server up`）。
   ![后台任务在跑](02-background-running.png)
   [后台任务在跑时的进程](02-while-it-runs.log)

3. 鼠标移到左栏「讨论」下的这段讨论上，点它右端的「⋯」。
   弹出只有一项的菜单「结束讨论」。
   ![结束讨论菜单](03-end-discussion-menu.png)

4. 点「结束讨论」。
   左栏的「讨论」一组消失；约 1 秒内 Agent 收到 SIGTERM 退出，第 2 步的 dev server 也已不在，地址访问被拒绝。
   ![讨论结束后](04-discussion-ended.png)
   [结束讨论之后的进程](04-after-ending.log)

## Feedback

- **结束就是真的结束**：点「结束讨论」后 Agent 和它在后台开着的服务一起没了，不会再有看不见的进程在这台电脑上跑两个小时，这是对的。
- **「一直开着」被悄悄关掉**：第 1 步用户明说要一直开着，回复里给了地址，可回复一结束服务就没了；界面上不说一句，用户点那个链接只会打不开，得自己猜是看板关的。需要常驻的服务只能自己去终端起，这一点界面里没有任何提示。
- **讨论里看不到后台任务**：第 2 步 Agent 报告了后台任务，但讨论页没有卡片对话里那行「1 个后台任务进行中 · 中止」，用户不知道 Agent 还开着、结束讨论会顺带停掉什么。
- **结束前没有提醒**：「结束讨论」直接生效，不提示「还有后台任务在跑，会被停止」；也没有撤销。
- **第 1 步时左栏还没有这段讨论**：第一条回复结束时左栏仍是空的，到第 2 步才出现，想马上结束它的人一时找不到「⋯」。
- **「⋯」只在悬停时出现**：触屏上不好找。
- **没有跑到的**：真实 Claude Code；卡片对话里的「中止」与清空；开启「结束时分享给团队」时被截断的回复是否照截断时提交；终端里的 `akb raw discussion archive`（按卡片说明不会停服务里的 Agent）；Windows 的按进程树清理。
