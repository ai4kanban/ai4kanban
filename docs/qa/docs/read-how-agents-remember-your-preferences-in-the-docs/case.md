# 在文档里查 Agent 记住了什么、记忆怎么保持最新

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/drafts`，窗口 1280×1000。
- **读者**：想知道纠正过 Agent 一次、下次还要不要再说，以及记忆要不要自己维护的人。

## Steps

1. 点 `/docs/drafts` 页底的「Next / Memory」。
   进入 `/docs/memory`，从页顶开始；分组「How it works」，标题「Carry preferences into the next task」；左栏「How it works」下「Draft review」之后的「Memory」高亮；右侧目录五节：Three kinds of memory、Project memory、Agent memory、Global memory、Memory keeps itself current。
   ![Memory 页顶部](01-memory-top.png)

2. 读「Three kinds of memory」。
   一张三行的表：Project memory、Agent memory、Global memory，各写装什么、谁读；表下一句说内置工作流都已定好记什么，自己加的 Agent 要在说明里写明记什么、记在哪。
   ![三种记忆](02-three-kinds.png)

3. 点那句里的「add an agent of your own」。
   `/docs/agents#add-one-of-your-own` 在新标签页打开；Memory 页留在原标签页。
   [标签页前后](03-agent-link.log)

4. 关掉新标签页，点右侧目录里的「Memory keeps itself current」。
   滚到这一节：两个看板 Agent 按周期运行——Review chats 每天读已归档卡片的对话、存下长期有效的决定（说「don't record this」就不记），Tidy memory 每 7 天把记忆删回对规划有用的部分；想早点跑，在 Configuration → Board 里按 Review now 或 Run now，周期也在那里改。
   ![记忆自己保持最新](04-keeps-itself-current.png)

5. 打开 `/llms.txt`，看文档列表。
   「Memory」排在「Draft review」之后，带一句描述；后面接着「Follow-ups」「Workflows」，和左栏顺序一致。
   [llms.txt 的文档条目](05-llms-txt.log)

6. 回到 `/docs/memory`，滚到页底。
   两张翻页卡：左「Previous / Draft review」，右「Next / Follow-ups」，两张都属「How it works」。
   ![页底翻页](06-end-of-page.png)

> **证据环境**：main（01ddb6ac）上本地站点所有 `/docs` 页都是 500（见 [`read-the-agents-the-board-ships-in-the-docs`](../read-the-agents-the-board-ships-in-the-docs/case.md)，已报待筛选）。以上证据取自 `web/` 的临时副本，只把 `public/llms.txt` 里 Agents 那一行换成新描述，所以第 5 步日志里 Agents 一行是新描述。

## Feedback

- **一页回答「下次还要不要再说」**：三种记忆一张表，每种一两句说在哪看、怎么改，最后一节说不用自己维护，几分钟读完。
- **「不用你管」讲得干脆**：两个 Agent 的周期、按钮名和配置页一致，想停用或改周期知道去哪。
- **和 Agents 页不再打架**：Agents 页删掉了三节旧的记忆文字，只留一句链到这里；两边都叫 Tidy memory，Review chats 只在这页写「每天」。
- **项目记忆一节太省**：只说「edits by hand do not last」，没说项目描述在哪个文件、想纠正它该怎么做；Agents 页的 Roles 里写了 `memory/project.md`，这里反而没有。
- **读完接到跟进建议**：页底下一页是同组的 Follow-ups，再往后才是 Workflows；从「记住你说过的」到「交付后替你找漏」顺得上。
- **全局记忆的「Connect」要改 `AGENT.md`**：界面里能建、能删，连接却要手写 YAML，对不写代码的人是个坎。
- **站内链接仍开新标签页**：第 3 步跳到 Agents 页多出一个标签页。
- **没有跑到的**：在看板上真的建全局记忆、按 Review now（见 local-ui、skill 模块的场景）；窄屏；真实部署后的页面。
