# 读 Grill Me 介绍页，看一个大想法怎么拆卡、逐卡规划、按依赖交付

## Setup

- **站点**：官网（`web/`）拷到 `/tmp` 做静态构建，用 `wrangler pages dev out` 跑在本机（地址给 `SITE`），无头 Chrome 带 `--proxy-server`、开远程调试（`CDP_PORT`），窗口 1280×900；脚本是 [grill-me.mjs](grill-me.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器），要带 `NODE_USE_ENV_PROXY=1`。正文段落滚进视口才淡入，脚本先把整页滚一遍再截图。三张界面截图来自线上 `cdn.ai4kanban.dev`（改名后图片仍走旧域名的 CDN）。
- **读者**：用过 Matt Pocock 的 `grill-me` / `grill-with-docs`、搜「kanban for Grill Me」进来的开发者。

## Steps

1. 打开 `/agents/kanban-for-grill-me`。
   页头是鹤形图标加「WildCrane」字标，作者行「Tao Wu · Founder of WildCrane」。标签页标题「Kanban for Grill Me: Scale Planning | WildCrane」；标题上方小字「GRILL ME WORKFLOW GUIDE · 7 MIN READ」，大标题「Kanban for Grill Me: scale planning across agents」，导语「Break a complex idea into clear tasks. Plan each in its own session, then deliver them in dependency order.」。开头四段：先介绍 grill me；再说复杂想法先在一个会话里拆成卡，每张卡由规划 Agent 在自己的会话里调查和提问；紧密相关的卡可以组成 group task，不相关的保持独立；想精确把控的部分（UI、文案、视频脚本等）由 specialist agents 先出草稿，审定后 Agent 必须照做。左侧「ON THIS PAGE」列七个小节。
   ![首屏](01-top.png) · [grill-me.log](grill-me.log)

2. 往下滚到开头四段下面的截图。
   截图正常加载（`shots/grill-group-v2`），是演示看板里的父卡「#2 Team workspaces」：SUBTASKS 一栏画着 #3 → #4 → #5 的依赖箭头和独立的 #6，下面列四张子卡。图注「One idea, split into cards. The parent holds the shared goal; the arrows set the delivery order.」。
   ![拆卡截图](02-group.png) · [grill-me.log](grill-me.log)

3. 读「What are grill-me and grill-with-docs?」。
   分别介绍两个技能，再用一张三行表对比：`grill-me` 解决一个计划，`grill-with-docs` 顺带维护领域文档和决策记录，第三行「An WildCrane card」（冠词没随改名改成「A」，已报待筛选）给一个任务自己的规划会话和持久计划，再加上草稿、依赖、优先级、模块、待办等。表后说首个会话定任务边界和依赖，各卡的规划会话补细节。
   ![两个技能和卡片的对比](03-layers.png) · [grill-me.log](grill-me.log)

4. 读「Why put Grill Me on a Kanban?」。
   先说在一个 Claude Code 对话里把大想法和所有问题塞进一个计划，任务一多就分不清哪些细节属于哪个任务；WildCrane 把拆卡和逐卡规划分开。卡片字段表四行：Dependencies（哪些前置先交付、哪些能并行）、Priority（未被阻塞的卡里先做哪张）、Modules、Todo；表下是一张卡片依赖关系的示意动画。
   ![为什么放上看板](04-why-kanban.png) · [grill-me.log](grill-me.log)

5. 往下滚到「Does every card investigate before asking questions?」的截图。
   截图正常加载（`shots/grill-questions-v2`），是子卡「#6 Choose a member's role」：标着「Part of #2 Team workspaces」，OPEN QUESTIONS 里只剩一个产品问题，四个选项、第一个标 RECOMMENDED。图注「Each subtask is planned in its own session. Only the remaining product choice reaches the human.」。
   ![子卡的待答问题](05-questions.png) · [grill-me.log](grill-me.log)

6. 读「How do multiple agents work without repeating each other?」。
   说 group task 的父卡把共同目标和要求交给子卡，子卡规划时同时用父卡上下文和相关项目记忆；独立的卡不用分组；依赖挡住前置未交付的卡，独立的编码任务在各自的 Git worktree 里跑。节末是项目记忆页的界面图。
   ![多个 Agent 怎么不重复](06-multi-agents.png) · [grill-me.log](grill-me.log)

7. 读「What does the human actually read?」和它下面的截图。
   表格把卡分成人读的一半（摘要、待审草稿、真正的开放问题、Worth noting）和折叠的 Agent 一半；正文说草稿审定后就是这部分必须照做的要求，其余细节由 Agent 在范围内决定，审完就让 Agent 交付，没有额外的人工交付审阅。截图正常加载（`shots/grill-draft-v3`），是子卡「#4 Invite members by email」：BLOCKED BY #3，UI designer 一栏有未勾选的「The user approved the page design.」和一张邀请成员页的设计稿。
   ![人读部分和待审草稿](07-draft.png) · [grill-me.log](grill-me.log)

8. 在页末「Frequently asked questions」点开「Does WildCrane replace Grill Me?」。
   五个问题，点开这一问后答案以「Yes.」开头：先拆卡、每张卡有自己的规划会话，看板再加上 GUI、自主调研、依赖、项目记忆、多 Agent 交付等，覆盖编码和营销工作，不再有「仅限软件项目」的说法。页尾 CTA「Scale Grill Me from one plan to the whole project.」带 Download 和 GitHub 两个按钮，GitHub 仍指向 `github.com/ai4kanban/ai4kanban`。
   ![FAQ 点开「是否取代 Grill Me」](08-faq-replace.png) · [grill-me.log](grill-me.log)

9. 逐个打开正文里的站内链接。
   `/builder`、`/docs/memory`、`/cloud`、`/download` 都返回 200；页面里已不再引用旧截图 `board-v2`、`card-questions-v1`、`card-plan-v1`。
   [grill-me.log](grill-me.log)

10. 读 `/llms.txt` 里这一页的条目，再请求 `/agents/kanban-for-grill-me.md`。
    有一条「Kanban for Grill Me」，链到 `https://wildcrane.ai/agents/kanban-for-grill-me`，讲一个会话拆卡、逐卡分会话规划、相关卡可组 group task、依赖先于优先级、草稿是 Agent 必须照做的部分；这一页没有 `.md` 镜像（404），AI 只能读 HTML。
    [grill-me.log](grill-me.log)

## Feedback

- **主线讲清了**：导语一句「拆卡 → 逐卡规划 → 按依赖交付」，开头四段就把 group task 可选、草稿必须照做讲完；「一张卡就是一次 Grill Me」的类比对 `grill-me` 用户很好懂。
- **改名留了几处毛边**：对比表写着「An WildCrane card」，页尾 GitHub 按钮仍去 `ai4kanban/ai4kanban`，截图里的演示项目叫「akb-grill-demo」，读者会怀疑是不是同一个产品。
- **三张截图来自同一块看板**：父卡、子卡问题、被阻塞的子卡草稿一路讲下来，但截图缩在正文宽度里，箭头、「BLOCKED BY #3」、RECOMMENDED 要放大才看得清。
- **依赖先于优先级只藏在表里**：字段表里「unblocked」一词承担了这层意思，快速扫读的人未必意识到这是一条规则。
- **FAQ 回答干脆**：「是否取代 Grill Me」直接答 Yes，说覆盖编码和营销。
- **AI 入口**：`llms.txt` 条目已指向 `wildcrane.ai`，描述和页面口径一致；但和其他 Agent 页一样没有 `.md` 镜像。
