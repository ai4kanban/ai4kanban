# 移除任务，再恢复它

## Setup

- 本地云端栈（见 README「如何运行取证」），项目 `demo-app`，假 Runner「QA Mac」。任务：`#1` 待审核、
  `#2` 已停止、`#3` 执行中、`#4` 未能完成。

## Steps

1. 打开 `#1`，点标题行的移除图标。
   预期：弹窗「移除这个任务？」，有原因输入框，说明「可以写下原因，以后规划时会避开这类任务。」，按钮
   「不移除」「移除」，全程不出现「丢弃」。
   证据：[01-remove-ask.png](01-remove-ask.png)
2. 写原因「和本季度重点无关」，点「移除」。
   预期：状态「已移除」，横条写「alice 于 10 月 30 日 移除：和本季度重点无关」，右上换成「恢复」，移除和
   执行都不见。
   证据：[02-remove-reason.png](02-remove-reason.png)、[03-removed.png](03-removed.png)
3. 打开归档。
   预期：这一行带「已移除」标记和行末「恢复」。
   证据：[04-archive.png](04-archive.png)
4. 点行末「恢复」。
   预期：弹窗「恢复这个任务？卡片回到看板，任务回到「待审核」。」。
   证据：[05-restore-ask.png](05-restore-ask.png)
5. 确认。
   预期：跳到任务页，「待审核」，「执行」回来，编号不变；看板上它回到「等你处理」。
   证据：[06-restored.png](06-restored.png)、[07-back-on-board.png](07-back-on-board.png)
6. 打开已停止的 `#2`，移除，再按任务页的「恢复」并确认。
   预期：移除成功；弹窗写明回到「已停止」、可按「续跑」继续；恢复后「续跑」还在。
   证据：[08-stopped-removed.png](08-stopped-removed.png)、[09-restore-ask-stopped.png](09-restore-ask-stopped.png)、[10-stopped-back.png](10-stopped-back.png)
7. 打开执行中的 `#3`，移除。
   预期：移除图标在；确认后立即「已移除」，按钮是「恢复」和灰的「正在停止…」，不用先点「停止」。
   证据：[11-running.png](11-running.png)、[12-running-removed.png](12-running-removed.png)
8. 打开未能完成的 `#4`，移除，再恢复。
   预期：弹窗写明回到「未能完成」、可按「重新发起」；恢复后「重新发起」「续跑」都在。
   证据：[13-restore-ask-failed.png](13-restore-ask-failed.png)、[14-failed-back.png](14-failed-back.png)

未取证：恢复失败时的提示；「等待 Runner 停止」的任务在电脑离线时移除、上线后停下（假 Runner 不会真的
停）；恢复后任务不再进被拒记录（`/v1/rejections` 属于 cloud）。

## Feedback

误删不再要命：归档和任务页都能找回，弹窗还写清回到哪个状态，心里很踏实。所有没结束的任务都能清掉，看板
上不再有赖着不走的卡。摩擦点：移除图标是个没字的小圆叉，要悬停才知道；运行中移除时页面同时写「已移除」
和「执行中 · 7:57」「正在停止…」，一时分不清到底停没停；已移除任务也还留着「分享」和对话，不知道能
不能继续用。本地开发服务器上第 2 步确认后等了约 50 秒才变状态，线上未确认。
