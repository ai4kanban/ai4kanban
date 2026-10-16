# 在文档里查怎么接入编码工具、给每个 Agent 选运行时

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs`，窗口 1280×1000。
- **命令**：一个刚 `akb install` 的临时项目，用来对照第 7 步。
- **读者**：想把看板接到自己在用的编码工具上，或想让规划和构建用不同模型的人。

## Steps

1. 打开 `/docs`，往下看到「Then pick your tooling」。
   这一节只有一张卡片「Multi-runtime support」，说明是「Connect your coding tool, choose a runtime for each agent, and set what a run may touch.」，不再叫「What each coding agent can do」。
   ![文档首页的工具卡片](01-docs-home-card.png)

2. 看 `/docs` 和 `/docs/connectors` 在搜索结果、链接预览里的标题和描述。
   `/docs` 的描述是「How to run AI4Kanban, the kanban board for AI agents: install it, drive the daily loop, and pick the coding agent your work runs on.」；`/docs/connectors` 的标题是「AI4Kanban multi-runtime support — run Claude Code, Codex, Cursor and more」，描述与首页卡片同义。
   [页面标题与描述](02-page-description.log)

3. 点「Multi-runtime support」卡片。
   进入 `/docs/connectors`，从页顶开始；标题「Multi-runtime support」，导语列出八个工具；左栏「Using the board」最后一项「Multi-runtime」高亮；第一节「Set up a runtime」四步：按官方文档安装登录（只给八个链接，不写安装命令）、在 Configuration → Runtimes 或 `akb agent runtime add` 添加、填设置、按 Test 或 `akb agent test`。
   ![Multi-runtime support 页顶部](03-connectors-top.png)

4. 点右侧目录里的「Settings」。
   页面滚到「Settings」，地址栏带 `#settings`；一张两列表，八行各写该工具要填什么（Provider、模型、推理强度、key）；表下一段说模型留空用工具默认值，以及网关该选哪个运行时。
   ![Settings 一节](04-settings.png)

5. 点目录里的「Decide what a run may touch」。
   三条：OpenCode、DeepSeek Harness、Grok Build 默认只写项目内（Codex 选 workspace-write 时同样）；Claude Code、Cursor、Kimi Code、ZCode 不弹确认、能写项目外；所有运行时都能联网。最后一句：要硬边界就把看板放进容器。
   ![能碰到什么](05-what-a-run-may-touch.png)

6. 点目录里的「What each runtime reports」。
   一张八个工具 × 七项能力的勾选表，八列在 1280 宽的窗口里都看得到；表下逐条解释每项能力，最后一段讲没有输出的运行多久后自动结束。
   ![能力表](06-what-each-runtime-reports.png)

7. 在临时项目里跑 `akb agent list`，和第 6 步的表对照。
   列出同样八个运行时，每个写着启动命令和 `lacks:` 缺的能力；表里每个「—」都能在对应的 `lacks:` 里找到。命令行多列了两项表上没有的（context window、pasted pictures），DeepSeek Harness 在这里叫「DSH」。
   [akb agent list 的输出](07-akb-agent-list.log)

8. 打开 `/docs/runs`，滚到页底。
   最后一句「To set up the tools behind an agent, see Multi-runtime support.」，链接指向 `/docs/connectors`。
   ![Runs 页底的链接](08-runs-link.png)

## Feedback

- **入口和名字对上了**：首页卡片、左栏、页标题、Runs 页底的链接都叫 Multi-runtime（support），点进去就是操作指南，不再像工具对比。
- **顺序是照着做的顺序**：装好 → 添加 → 填设置 → Test，再讲每个 Agent 怎么绑定，四步读完就知道下一步按哪里。
- **安装要跳出去**：八个工具只给官方文档链接，没有一行安装命令；省了维护，但第一次接 ZCode、Grok Build 这类小众工具的人得在别人的站上找。
- **能力表在桌面宽度被截断**：第 6 步的表有九列，表格框只有 624px 宽、内容 677px，最右的 Grok Build 一列要在表内横向滚动才看得到，截图里只到 ZCode；而前一句刚说「All eight」。
- **和命令行对得上，但不完全一样**：「—」与 `lacks:` 一一对应；可命令行把 DeepSeek Harness 叫 DSH，还多两项能力，「shows the same table」说得过满。
- **权限一节有用**：直接点名哪些工具会写项目外，比以前的对比表更像该决定的事。
- **描述的说法变了**：`/docs` 的描述改成「the kanban board for AI agents」，和首页导语「AI leads the team」两种口径并存，但只在搜索结果里看得到。
- **没有跑到的**：真的接一个工具并按 Test、在界面里给 Agent 绑定运行时（要真实工具和账号）；窄屏。
