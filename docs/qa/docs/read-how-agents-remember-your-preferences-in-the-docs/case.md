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
   「Memory」排在「Draft review」之后、「The daily loop」之前，带一句描述。
   [llms.txt 的文档条目](05-llms-txt.log)

6. 回到 `/docs/memory`，滚到页底。
   两张翻页卡：左「Previous / Draft review」（How it works），右「Next / The daily loop」（Using the board）。
   ![页底翻页](06-end-of-page.png)

## Feedback

- **一页回答「下次还要不要再说」**：三种记忆一张表，每种一两句说在哪看、怎么改，最后一节说不用自己维护，几分钟读完。
- **「不用你管」讲得干脆**：两个 Agent 的周期、按钮名和配置页一致，想停用或改周期知道去哪。
- **和 Agents 页打架**：Agents 页还留着三节讲记忆的旧文字，Roles 里叫「Memory pruner」而这里叫「Tidy memory」，Review chats 那边写「卡片归档后」、这里写「每天」；两页都读的人会疑惑哪个对。
- **项目记忆一节太省**：只说「edits by hand do not last」，没说项目描述在哪个文件、想纠正它该怎么做（Agents 页倒写了 `docs/kanban/memory/project.md`）。
- **全局记忆的「Connect」要改 `AGENT.md`**：界面里能建、能删，连接却要手写 YAML，对不写代码的人是个坎。
- **没有跑到的**：在看板上真的建全局记忆、按 Review now（见 local-ui、skill 模块的场景）；窄屏。
