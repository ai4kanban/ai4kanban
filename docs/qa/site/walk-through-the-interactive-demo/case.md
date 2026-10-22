# 在 /demo 走完一遍交互演示

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本机（地址给 `SITE`），无头 Chrome 开远程调试（`CDP_PORT`），窗口 1600×1000；脚本是 [demo.mjs](demo.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器，点的是高亮框中心的真实鼠标事件）。
- **读者**：拿到 `ai4kanban.dev/demo` 链接、想不装应用先看看看板怎么用的人；也是给首页截图、录屏的人。

## Steps

1. 打开 `/demo`。
   页面标题「AI4Kanban demo」，`robots` 为 `noindex, nofollow`。画面是桌面应用的窗口：左上角红黄绿三个按钮、项目名「notely」，左栏、顶栏和一块英文演示看板。只有右上角「New idea」带一圈橙色描边，按钮文字后跟一个小号「N」按键标记，下面一行提示「Start with an idea」；右下角写着「1 / 8」。
   ![第 1 步：看板](01-board.png) · [demo.log](demo.log)

2. 把鼠标停在「New idea」上。
   按钮下方出现提示「Share an idea, ask about progress, or move cards」，和真实看板一样；但它的右半截被第 1 步的「Start with an idea」气泡压住，只露出「Share an idea, ask about pr…」。
   ![悬停 New idea](01b-new-idea-hover.png) · [demo.log](demo.log)

3. 点看板中间空白处，再按一下 N 键。
   什么也不发生，仍是第 1 步：演示里的「N」只是标记，快捷键不生效。
   [demo.log](demo.log)

4. 点「New idea」。
   网址变成 `?step=2`，新想法面板打开，想法约 1.5 秒自动打完；之后发送按钮被描边，提示「Send it to your agent」。
   ![第 2 步：想法打完](02-idea-typed.png) · [demo.log](demo.log)

5. 点发送。
   约 3 秒的规划后，看板「Not ready」列多出「#38 Sync notes across devices」，它被描边，提示「Open the plan」。
   ![第 3 步：规划出 #38](03-planned.png) · [demo.log](demo.log)

6. 点 #38。
   打开 #38 卡片页，子任务图 #39–#44，#39 被描边，提示「Open #39 first」。
   ![第 4 步：#38 的子任务](04-group.png) · [demo.log](demo.log)

7. 点 #39。
   #39 卡片页上方是一条待决问题「丢了所有设备怎么找回笔记」，下面是要设同步密码的「Sync settings」界面草稿；「Revise」被描边，提示「Change the draft」。
   ![第 5 步：#39 的草稿](05-draft.png) · [demo.log](demo.log)

8. 点「Revise」。
   右侧打开「Discuss #39」对话栏，修改意见自动打出，进度框移到对话栏左边；发送按钮被描边，提示「Send the change」。
   ![第 6 步：修改意见打完](06-revision-typed.png) · [demo.log](demo.log)

9. 点发送。
   约 3 秒后 agent 回复，待决问题消失，草稿换成发 24 个恢复词、不再要密码的新版，标题旁变成「READY TO BUILD」；「Build」被描边，提示「Build and ship #39」。
   ![第 7 步：可以 Build](07-ready.png) · [demo.log](demo.log)

10. 点「Build」。
   约 3 秒后 #39 离开看板，窗口转到它的归档视图：左栏「Archive」选中，标题上方「ARCHIVE」，归档日期，草稿下面展开「Diff」（4 个文件改动）；右下角「8 / 8」旁出现「Replay」，提示「Watch it again」。
   ![第 8 步：归档视图](08-archive.png) · [demo.log](demo.log)

11. 点「Replay」。
    回到 `/demo` 第 1 步。
    [demo.log](demo.log)

12. 直接打开 `/demo?step=4`，再打开 `/demo?step=99`。
    前者直接到第 4 步（#38 卡片页）；越界的步号回到第 1 步，网址也改回 `/demo`。
    [demo.log](demo.log)

13. 打开系统的「减少动态效果」，打开 `/demo?step=3`。
    1.5 秒内就已是规划完成的看板，#38 已被描边，不等进行中动画。
    [demo.log](demo.log)

## Feedback

- **像在用真应用**：看板、卡片页、对话栏、归档视图都是桌面应用本身的界面，连红黄绿窗口按钮都在，截图拿去首页毫无违和。
- **只有一条路**：每步只描边一个控件，点别处毫无反应，也没有任何提示告诉你「请点橙色框」——习惯乱点的人会以为页面卡住了。
- **提示偶尔压字**：第 1 步「Start with an idea」的气泡盖住了「STALE」列标题，也压住「New idea」自己的悬停提示，想读完它说了什么得等过了这一步。
- **N 标记很醒目**：按钮上多了个「N」，一眼知道有快捷键；但演示里按 N 没反应，只能点，和标记暗示的不一样。
- **节奏刚好**：打字约 1.5 秒、agent 干活约 3 秒，看得清又不拖；减少动态效果时直接给结果。
- **只有英文和桌面宽**：没有中文界面，窄屏下也不适配；它本来只是素材源，不在导航里，从站内找不到。
