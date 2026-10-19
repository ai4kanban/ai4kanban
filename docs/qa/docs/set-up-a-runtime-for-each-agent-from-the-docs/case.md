# 在文档里查怎么接入编码工具、给每个 Agent 选运行时

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs`，窗口 1280×1000。
- **命令**：一个刚 `akb install` 的临时项目，用来对照第 7 步。
- **读者**：想把看板接到自己在用的编码工具上，或想让规划和构建用不同模型的人。

## Steps

1. 打开 `/docs`，读到「Deliver your first card」。
   第一句「Connect a coding agent, then start with a small change in your project or follow the interactive demo.」，「Connect a coding agent」是链接；首页已没有「Multi-runtime support」卡片，只在「Keep independent tasks moving」一节提到「Runs and runtimes」。
   ![首页的接入链接](01-docs-home-link.png)

2. 看 `/docs` 和 `/docs/connectors` 在搜索结果、链接预览里的标题和描述。
   `/docs` 的标题「AI4Kanban docs — an agent workspace for indie hackers」，描述「Set up AI4Kanban, review key drafts before execution, and deliver development and marketing work with six built-in workflows.」；`/docs/connectors` 的标题「AI4Kanban multi-runtime support — run Claude Code, Codex, Cursor and more」，描述「Connect the coding tool you already use, choose a runtime and model for each agent, and set what a run may touch.」。
   [页面标题与描述](02-page-description.log)

3. 点「Connect a coding agent」。
   `/docs/connectors` 在新标签页打开，首页留在原标签页；新页从页顶开始，标题「Multi-runtime support」，导语列出八个工具；左栏「Using the board」最后一项「Multi-runtime」高亮；第一节「Set up a runtime」四步：按官方文档安装登录（只给八个链接，不写安装命令）、在 Configuration → Runtimes 或 `akb agent runtime add` 添加、填设置、按 Test 或 `akb agent test`。
   ![Multi-runtime support 页顶部](03-connectors-top.png)
   [点击与页面结构](connectors.log)

4. 点右侧目录里的「Settings」。
   页面滚到「Settings」，地址栏带 `#settings`；一张两列表，八行各写该工具要填什么（Provider、模型、推理强度、key）；表下一段说模型留空用工具默认值，以及网关该选哪个运行时。
   ![Settings 一节](04-settings.png)

5. 点目录里的「Decide what a run may touch」。
   三条：OpenCode、DeepSeek Harness、Grok Build 默认只写项目内（Codex 选 workspace-write 时同样）；Claude Code、Cursor、Kimi Code、ZCode 不弹确认、能写项目外；所有运行时都能联网。最后一句：要硬边界就把看板放进容器。
   ![能碰到什么](05-what-a-run-may-touch.png)

6. 点目录里的「What each runtime reports」。
   表上一句「`akb agent list` shows these too.」；一张八个工具 × 六项能力的勾选表（没有「Model name」行），表头是八个工具的 logo、不写名字，悬停时提示工具名；八列都在 1280 宽的表框里，没有横向滚动条；表下逐条解释每项能力，最后一段讲没有输出的运行多久后自动结束。
   ![能力表](06-what-each-runtime-reports.png)

7. 在临时项目里跑 `akb agent list`，和第 6 步的表对照。
   列出同样八个运行时，每个写着启动命令和 `lacks:` 缺的能力；表里每个「—」都能在对应的 `lacks:` 里找到。命令行多列了两项表上没有的（context window、pasted pictures），DeepSeek Harness 在这里叫「DSH」——和页上「shows these too」的说法对得上。
   [akb agent list 的输出](07-akb-agent-list.log)

8. 打开 `/docs/runs`，滚到页底。
   最后一段「See Multi-runtime support for supported tools, their settings and execution limits. A single chat can use a different agent or model.」，前一个链接指向 `/docs/connectors`，后一个指向 `/docs/chat#a-model-per-conversation`。
   ![Runs 页底的链接](08-runs-link.png)

## Feedback

- **首页入口变成一句话里的链接**：原来的「Multi-runtime support」卡片没了，只剩「Connect a coding agent」，点进去还是另开标签页；想换运行时、而不是第一次接入的人，从首页不容易想到点这里，左栏「Multi-runtime」更直接。
- **叫法三处不一**：首页说「coding agent」，左栏叫「Multi-runtime」，页面描述又是「coding tool」，同一件事读者要自己对上。
- **顺序是照着做的顺序**：装好 → 添加 → 填设置 → Test，再讲每个 Agent 怎么绑定，四步读完就知道下一步按哪里。
- **能力表一屏看全**：logo 表头、八列都在表框里，没有横向滚动条。
- **logo 要认得出才省事**：Claude、OpenAI、Cursor、X 一眼能认；OpenCode、DeepSeek Harness、ZCode 的小图标得悬停才知道是谁，手机上看不到悬停提示。
- **和命令行的说法对得上**：「shows these too」不说「同一张表」，命令行多两项、把 DeepSeek Harness 叫 DSH 也不算出入。
- **安装要跳出去**：八个工具只给官方文档链接，没有一行安装命令。
- **没有跑到的**：真的接一个工具并按 Test、在界面里给 Agent 绑定运行时（要真实工具和账号）；窄屏；真鼠标悬停看提示框（只核对了 logo 带 `title` 和 `alt`）。
