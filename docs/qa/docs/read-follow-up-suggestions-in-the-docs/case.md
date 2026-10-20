# 在文档里查交付后的跟进建议从哪来、怎么调

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/memory`，窗口 1280×1000。
- **读者**：卡片交付后想知道看板会不会替自己找漏、找到的东西去哪、能不能少打扰一点的人。

## Steps

1. 滚到 `/docs/memory` 页底，点「Next / Follow-ups」。
   进入 `/docs/follow-ups`，从页顶开始；分组「How it works」，标题「Review follow-up suggestions」；左栏「How it works」下 Memory 之后的「Follow-ups」高亮；右侧目录三节：Find suggestions after delivery、Decide what becomes work、Set up recurring checks。
   ![Follow-ups 页顶部](01-follow-ups-top.png)

2. 读「Find suggestions after delivery」。
   三条说 **Suggest follow-up work** 怎么找：对照要的和交付的、到项目里找证据、滤掉已有的和你拒过的；剩下的进 **Triage**，什么都不值得跟进就什么都不加。
   ![交付后的建议](02-find-suggestions.png)

3. 往下看「Builds and plans can also identify follow-ups along the way.」后面的动画。
   这句和讲 **Small fixes** 的那段之间是一段 3D 小看板动画：一张卡做完进「Done」，一张橙色「FOLLOW-UP」便签「Add a test for the empty state」带着 **Accept** / **Dismiss** 弹出来；图的无障碍标签是「The QA agent finds a gap and hands you a follow-up to accept or dismiss.」。动画下面说在 Configuration → Board → Suggest follow-up work 的 **Small fixes** 里三选一：Ask me first、Just do them、Don't suggest，并注明它只管小修小补。
   ![跟进建议动画](03-follow-ups-animation.gif)
   ![动画与 Small fixes](03-small-fixes.png)

4. 滚到页底再滚回来。
   动画离开视口时暂停，回到视口接着播。
   [动画的暂停与播放](03-animation.log)

5. 系统设置里打开「减少动态效果」，重新打开 `/docs/follow-ups`。
   动画停在一帧定格画面，不再动。
   ![减少动态时的定格](04-reduced-motion.png)

6. 把窗口换成 390px 宽的手机，重新打开 `/docs/follow-ups`。
   动画缩到正文栏宽（342px）照常显示，页面没有横向滚动。
   见 [动画的暂停与播放](03-animation.log) 末尾的「390 宽」。

7. 点目录里的「Decide what becomes work」。
   一段：在 Triage 里看建议和来源，决定建卡、讨论或忽略；写下忽略的原因会影响以后的建议；Pro 的自动分拣能建卡但不会开始构建。
   ![决定哪些变成工作](05-decide.png)

8. 点这一段里的「Triage」。
   `/docs/triage` 在新标签页打开；Follow-ups 页留在原标签页。
   [标签页前后](06-triage-link.log)

9. 关掉新标签页，点目录里的「Set up recurring checks」。
   两段：Coding 的 **QA manager** 每轮更新受已完成卡片影响的测试用例、跑步骤、留截图或日志，再给一块还没覆盖的地方补用例，失败的带着用例和步骤进 **Triage**；入口 Configuration → Workflows → Coding → Scheduled，可以调频率、**Disable**，停用时也能 **Run now**。
   ![定期检查](07-recurring-checks.png)

10. 依次点这一节里的「Test cases」和「Run an agent on a schedule」。
    各自在新标签页打开，分别落在 The daily loop 的「Test cases」小节和 Agents 页的「Run an agent on a schedule」小节，小节标题停在页头下方。
    [两个链接的落点](08-section-links.log)

11. 打开 `/llms.txt`，看文档列表。
    「Follow-ups」排在「Memory」之后、「Workflows」之前，带一句描述，和左栏顺序一致。
    [llms.txt 的文档条目](09-llms-txt.log)

12. 回到 Follow-ups 页，滚到页底。
    两张翻页卡：左「Previous / Memory」，右「Next / Workflows」，两张都属「How it works」。
    ![页底翻页](10-end-of-page.png)

## Feedback

- **回答了「交付完还要不要自己查漏」**：一页三节，先说看板会自己找、找到的进 Triage，再说怎么挑、怎么定期回归，几分钟读完。
- **动画把「建议从哪来」演出来了**：卡做完、便签弹出、两个按钮，一眼知道之后在 Triage 里要做的就是接受或忽略。
- **动画的说法和这一节对不上**：这一节讲的是 **Suggest follow-up work**，动画的标签却说「The QA agent finds a gap」——QA manager 在页尾才讲，读者会以为两件事是一回事。
- **动画上下空白大**：4:3 画布里看板只占中间，正文中间空出一大段，第一屏看起来像图没加载完（第 2 步截图）。
- **设置名和界面一致**：Suggest follow-up work、Small fixes 和三个选项的叫法跟配置页一字不差。
- **只给了名字没给代价**：「Just do them」会让小修自动构建、花 token，这点只能从「build automatically」里自己读出来。
- **标题和左栏对不上**：左栏叫「Follow-ups」，进来标题是「Review follow-up suggestions」，后半页讲的 QA manager 又不算「suggestions」。
- **第一节的 Triage 没有链接**：第一次提到 Triage 只是加粗，链接放在下一节。
- **图标撞了**：左栏里 Follow-ups 和 The daily loop 用同一个循环箭头。
- **没有跑到的**：在看板配置页里真的切 Small fixes、真的等一次建议进 Triage、真的让 QA manager 跑一轮（见 local-ui、skill 模块的场景）。
