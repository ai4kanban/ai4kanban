# 看排队中的任务为什么还没开始

## Setup

- 本地云端栈（见 README「如何运行取证」），项目 `mall-app` 放在假 Runner「QA Mac」上，账户的运行上限是 3 个。
- `#1`–`#7` 都跳过方案直接排队，还没有被领走。`#5` 的卡片写 `blocked_by: [4]`，`#6` 写 `blocked_by: [4, 7]`。
- 领走、完成和断开都由脚本触发：领作业用 `/claim`，完成用 `/finish`，断开把 `cloud.runners.live_until` 改到过去，
  连回发一次 `POST /v1/runner`。移除用 `POST /v1/tasks/{id}/cancel`。

## Steps

1. 打开 `mall-app` 的看板。
   预期：七张卡都在「排队中」，状态都写「排队中」；列头写「7 个 · 2 个等待其他任务」；`#5`、`#6` 带锁形标记，排在列尾。
   证据：[01-board.png](01-board.png)、[tips.log](tips.log)
2. 鼠标移到 `#5` 的「排队中」上。
   预期：提示「等待 #4 完成」，不被卡片边缘裁掉。
   证据：[02-tip-one.png](02-tip-one.png)
3. 鼠标移到 `#6` 的「排队中」上。
   预期：提示「等待 #4、#7 完成」。
   证据：[03-tip-two.png](03-tip-two.png)
4. 鼠标移到 `#1` 的「排队中」上。
   预期：没有深色提示，这张卡没有要说明的原因。
   证据：[04-no-reason.png](04-no-reason.png)
5. 点开 `#6`，鼠标移到状态上。
   预期：任务页也写「排队中」，提示「等待 #4、#7 完成」；信息栏的标题是「等待」，列出 `#4`、`#7`。
   证据：[05-task-page.png](05-task-page.png)
6. 回到看板，Runner 领走 `#1`、`#2`、`#3`，不刷新，鼠标移到 `#4` 的状态上。
   预期：三张卡进「进行中」；`#4`、`#7` 提示「已达同时运行的任务上限」。
   证据：[06-limit.png](06-limit.png)
7. 鼠标移到 `#5` 的状态上。
   预期：仍是「等待 #4 完成」，等其他任务排在运行上限之前。
   证据：[07-blocked-first.png](07-blocked-first.png)
8. 电脑断开，刷新，鼠标移到 `#4` 的状态上。
   预期：仍是「已达同时运行的任务上限」，运行上限排在电脑连接之前。
   证据：[08-limit-first.png](08-limit-first.png)
9. `#1` 完成，不刷新，鼠标移到 `#4` 的状态上。
   预期：提示变成「等待运行电脑连接」。
   证据：[09-runner.png](09-runner.png)
10. 鼠标移到 `#5` 的状态上。
    预期：仍是「等待 #4 完成」。
    证据：[10-blocked-before-runner.png](10-blocked-before-runner.png)
11. 把界面切成英文，刷新，鼠标移到 `#4` 的状态上。
    预期：列名和状态都是 Queued，列头写「4 · 2 waiting on other tasks」，提示「Waiting for the Runner to connect」；
    `#5` 的提示是「Waiting for #4 to finish」。
    证据：[11-english.png](11-english.png)、[tips.log](tips.log)
12. 切回中文，电脑连回，刷新，鼠标移到 `#4` 的状态上。
    预期：没有提示；页面上没有「等待运行」和「阻塞」。
    证据：[12-runner-back.png](12-runner-back.png)、[tips.log](tips.log)
13. 看板开着不刷新，电脑断开，等顶栏出现「QA Mac 未连接」，鼠标移到 `#4` 的状态上。
    预期：提示「等待运行电脑连接」。
    证据：[13-offline-board-open.png](13-offline-board-open.png)、[tips.log](tips.log)
    **未通过**：顶栏 33 秒内已写「QA Mac 未连接」，`#4` 仍然没有提示，要刷新才出现。已发 triage。
14. 电脑连回，在手机宽度（390px）打开看板，翻到「排队中」。
    预期：一屏一列，列头写「4 个 · 2 个等待其他任务」，`#5`、`#6` 带锁形标记。
    证据：[14-phone-board.png](14-phone-board.png)
15. 在手机上点 `#5` 的「排队中」。
    预期：打开任务页，信息栏「等待」列出 `#4`。
    证据：[15-phone-tap.png](15-phone-tap.png)、[tips.log](tips.log)
16. 回到桌面宽度的看板，不刷新，移除 `#4`，鼠标移到 `#6` 的状态上。
    预期：`#5` 的锁形标记和提示都消失；`#6` 只提示「等待 #7 完成」；列头写「3 个 · 1 个等待其他任务」。
    证据：[16-blocker-removed.png](16-blocker-removed.png)、[tips.log](tips.log)
17. 打开 `#6`，不刷新，等 `#7` 完成。
    预期：状态的提示消失，信息栏不再有「等待」。
    证据：[17-task-page-clear.png](17-task-page-clear.png)、[tips.log](tips.log)
18. 点左栏「看板」。
    预期：`#5`、`#6` 都没有锁形标记，列头写「2 个」。
    证据：[18-board-clear.png](18-board-clear.png)
19. 刷新。
    预期：锁形标记没有回来，列头仍是「2 个」。
    证据：[tips.log](tips.log)

## Feedback

「排队中」只有一个词之后，看板清爽多了，要知道为什么停着，移过去就有一句人话；`#4`、`#7` 这种写法比原来的
「阻塞」好懂。所等任务一结束，锁形标记当场消失，不用刷新，这一点很踏实。摩擦点：原因藏在悬停里，平时
看不出 `#4` 是卡在上限还是卡在电脑；手机上没有悬停，点状态直接进任务页，等其他任务还能在信息栏看到，
上限和电脑连接两种原因就看不到；提示盖住卡片标题；电脑断开时顶栏已经在说未连接，卡片的提示却要刷新才跟上
（第 13 步）；没有原因的卡片连一句「马上开始」也没有，看起来像卡住了。
