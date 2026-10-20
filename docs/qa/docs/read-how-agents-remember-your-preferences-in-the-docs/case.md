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

3. 往下看表格后面的动画。
   表格和下一段之间是一段 3D 小看板动画：一张「Blog post: launch」草稿带着「Shorter titles」批注，批注记进右边的「Memory」便签（标「Remembered」），下一张「Blog post: pricing」草稿的标题变短，标着「Applied from memory」；图的无障碍标签是「You give a note once; the agent remembers it and every later draft follows it.」。
   ![记忆动画](03-memory-animation.gif)

4. 滚到页底再滚回来。
   动画离开视口时暂停，回到视口接着播。
   [动画的暂停与播放](03-animation.log)

5. 系统设置里打开「减少动态效果」，重新打开 `/docs/memory`。
   动画停在最后一帧（pricing 草稿已标「Applied from memory」、便签已「Remembered」），不再动。
   ![减少动态时的定格](04-reduced-motion.png)

6. 把窗口换成 390px 宽的手机，重新打开 `/docs/memory`。
   动画缩到正文栏宽（342px）照常显示，页面没有横向滚动。
   见 [动画的暂停与播放](03-animation.log) 末尾的「390 宽」。

7. 点表格下那句里的「add an agent of your own」。
   `/docs/agents#add-one-of-your-own` 在新标签页打开；Memory 页留在原标签页。
   [标签页前后](05-agent-link.log)

8. 关掉新标签页，点右侧目录里的「Memory keeps itself current」。
   滚到这一节：两个看板 Agent 按周期运行——Review chats 每天读已归档卡片的对话、存下长期有效的决定（说「don't record this」就不记），Tidy memory 每 7 天把记忆删回对规划有用的部分；想早点跑，在 Configuration → Board 里按 Review now 或 Run now，周期也在那里改。
   ![记忆自己保持最新](06-keeps-itself-current.png)

9. 打开 `/llms.txt`，看文档列表。
   「Memory」排在「Draft review」之后，带一句描述；后面接着「Follow-ups」「Workflows」，和左栏顺序一致。
   [llms.txt 的文档条目](07-llms-txt.log)

10. 回到 `/docs/memory`，滚到页底。
    两张翻页卡：左「Previous / Draft review」，右「Next / Follow-ups」，两张都属「How it works」。
    ![页底翻页](08-end-of-page.png)

## Feedback

- **一页回答「下次还要不要再说」**：三种记忆一张表，每种一两句说在哪看、怎么改，最后一节说不用自己维护，几分钟读完。
- **动画把「说一次就记住」演出来了**：批注飞进记忆、下一稿自动带上，比表格更快让人明白 Agent 记忆是干什么的；离屏暂停、减少动态时定格，都照顾到了。
- **动画下面空一大块**：4:3 的画布里看板只占中间，表格和下一段之间留出约 100px 空白，像图没加载完。
- **动画只演了 Agent 记忆**：放在「三种记忆」表格后面，却只讲一种，项目记忆和全局记忆没有对应画面。
- **「不用你管」讲得干脆**：两个 Agent 的周期、按钮名和配置页一致，想改周期知道去哪。
- **项目记忆一节已说去哪找**：写了在 Configuration → Board，但仍没说想纠正项目描述该怎么做。
- **全局记忆的「Connect」要改 `AGENT.md`**：界面里能建、能删，连接却要手写 YAML，对不写代码的人是个坎。
- **站内链接仍开新标签页**：第 7 步跳到 Agents 页多出一个标签页。
- **没有跑到的**：在看板上真的建全局记忆、按 Review now（见 local-ui、skill 模块的场景）；真实部署后的页面。
