# 在文档里查交付后的跟进建议从哪来、怎么调

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/memory`，窗口 1280×1000。
- **读者**：卡片交付后想知道看板会不会替自己找漏、找到的东西去哪、能不能少打扰一点的人。

## Steps

1. 滚到 `/docs/memory` 页底，点「Next / Follow-ups」。
   进入 `/docs/follow-ups`，从页顶开始；分组「How it works」，标题「Review follow-up suggestions」；左栏「How it works」下 Memory 之后的「Follow-ups」高亮；右侧目录三节：Find suggestions after delivery、Decide what becomes work、Set up recurring checks。
   ![Follow-ups 页顶部](01-follow-ups-top.png)

2. 读「Find suggestions after delivery」。
   三条说 **Suggest follow-up work** 怎么找：对照要的和交付的、到项目里找证据、滤掉已有的和你拒过的；剩下的进 **Triage**，什么都不值得跟进就什么都不加。下面说在 Configuration → Board → Suggest follow-up work 的 **Small fixes** 里三选一：Ask me first、Just do them、Don't suggest，并注明它只管小修小补。
   ![交付后的建议](02-find-suggestions.png)

3. 点目录里的「Decide what becomes work」。
   一段：在 Triage 里看建议和来源，决定建卡、讨论或忽略；写下忽略的原因会影响以后的建议；Pro 的自动分拣能建卡但不会开始构建。
   ![决定哪些变成工作](03-decide.png)

4. 点这一段里的「Triage」。
   `/docs/triage` 在新标签页打开；Follow-ups 页留在原标签页。
   [标签页前后](04-triage-link.log)

5. 关掉新标签页，点目录里的「Set up recurring checks」。
   两段：Coding 的 **QA manager** 每轮更新受已完成卡片影响的测试用例、跑步骤、留截图或日志，再给一块还没覆盖的地方补用例，失败的进 Triage；入口 Configuration → Workflows → Coding → Scheduled，可以调频率、**Disable**，停用时也能 **Run now**。
   ![定期检查](05-recurring-checks.png)

6. 依次点这一节里的「Test cases」和「Run an agent on a schedule」。
   各自在新标签页打开，分别落在 The daily loop 的「Test cases」小节和 Agents 页的「Run an agent on a schedule」小节，小节标题停在页头下方。
   [两个链接的落点](06-section-links.log)

7. 打开 `/llms.txt`，看文档列表。
   「Follow-ups」排在「Memory」之后、「Workflows」之前，带一句描述，和左栏顺序一致。
   [llms.txt 的文档条目](07-llms-txt.log)

8. 回到 Follow-ups 页，滚到页底。
   两张翻页卡：左「Previous / Memory」，右「Next / Workflows」，两张都属「How it works」。
   ![页底翻页](08-end-of-page.png)

## Feedback

- **回答了「交付完还要不要自己查漏」**：一页三节，先说看板会自己找、找到的进 Triage，再说怎么挑、怎么定期回归，几分钟读完。
- **设置名和界面一致**：Suggest follow-up work、Small fixes 和三个选项的叫法跟配置页一字不差，照着找不会迷路。
- **只给了名字没给代价**：配置页上三个选项各带一句取舍（重速度、平衡、专注主线），文档里没有；「Just do them」会让小修自动构建、花 token，这点只能从「build automatically」里自己读出来。
- **标题和左栏对不上**：左栏叫「Follow-ups」，进来标题是「Review follow-up suggestions」，后半页讲的 QA manager 又不算「suggestions」，第一眼会以为点进了别的页。
- **两件事放在一页**：交付后的建议和 QA 定期检查是两个 Agent、两个配置入口，合在「Follow-ups」下读得通，但想找 QA 的人未必会想到点这一页。
- **第一节的 Triage 没有链接**：第一次提到 Triage 只是加粗，链接放在下一节。
- **图标撞了**：左栏里 Follow-ups 和 The daily loop 用同一个循环箭头。
- **没有跑到的**：在看板配置页里真的切 Small fixes、真的等一次建议进 Triage、真的让 QA manager 跑一轮（见 local-ui、skill 模块的场景）；窄屏。
