# 让博客策划写一篇博客的大纲，研究员先查资料、读排在前面的页面

## Setup

- **项目**：一次性 git 项目，`akb install` 新装，删掉 `setup-checklist.md`；没有博客目录。
- **账号**：博客工作流要 Pro，用一份手写的 Pro 登录状态（`AI4KANBAN_HOME` 指向临时目录，Cloud 地址指向本机替身，只答 `/v1/billing` 为 Pro）。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`），能用 WebSearch、WebFetch；`blog-post` 的规划辅助是 `blog-researcher` 和 `blog-illustrator`。
- **终端**：在项目目录里；`PATH` 最前是这次构建出的命令，日志里的 `akb` 就是它。

## Steps

1. 执行 `akb create --workflow blog-post "Blog post on why a kanban board works better than a chat thread for steering AI coding agents. Primary keyword: kanban for AI agents. Online-only blog (no blog folder)."`。
   立即返回一次 `create` 运行和跟踪、停止的两条命令。
   [01-create.log](01-create.log)

2. 运行结束后打开新卡 #2。
   `## By \`blog-planner\` agent` 里是 Brief，多了一条「Starting angle」：初步角度，加上可能推翻它的疑点（记忆文件和计划模式也许已补上差距、小任务用看板太重、不能只靠一个例子）。卡上一道 `[user]` 问题问博客网址。
   [02-brief.md](02-brief.md)

3. 执行 `akb card resolve 2 "There is no published blog yet; write the post standalone."`。
   返回一次 `resolve` 运行。
   [03-resolve.log](03-resolve.log)

4. 等运行结束后执行 `akb run list`。
   `create`（1 分 1 秒，约 $0.45）、`resolve #2`（3 分 12 秒，约 $0.83）都完成，已没有在跑的运行。
   [04-runs.log](04-runs.log)

5. 执行 `akb run log <resolve 的 id>`。
   答完问题后先以 `blog-researcher` 调研：`WebSearch(kanban for AI agents)` 等三次搜索、十多次 `WebFetch`（论文、Claude Code 文档、排在前面的看板工具页面），写下 `research.md`，再写大纲。结尾汇报说两条发现改了角度，列出 7 节大纲、7 个已检查的外链，以及比排在前面的页面多给的东西。
   [05-resolve-log.log](05-resolve-log.log)

6. 打开卡片链接的 `research.md`。
   约 1000 词，按问题分节：每节一句结论、带日期的原始来源和引文、反证，推断单独标明；还记下了不能用的二手数字和正在停服的工具。
   [06-research.md](06-research.md)

7. 再看卡片 #2。
   `phases: [Outline, Article]`、`phase: 1`、`questions: []`、`status: ready`；Brief 里的角度标着「revised after research」，大纲是 `<Asset>` 链接；新的 `## By \`blog-researcher\` agent` 只有研究文件链接和四条要点，没有堆报告正文。卡上没有「大纲可以写成全文了吗？」这类问题。
   [07-card.md](07-card.md)

8. 执行 `akb card approve 2 --print`。
   不再被拒：卡片进入第 2 阶段，打印的流程里是 `stage  2 of 2: Outline › **Article**`。
   [08-approve.log](08-approve.log)

## Feedback

- **研究真的改了文章**：研究员查到 Claude Code 会在压缩后重读 CLAUDE.md 和计划，于是论点从「聊天会忘、看板记得」收窄为「只在聊天里说的决定最脆弱」，还说清没有研究直接比较过两者——比只读排名页面诚实得多。
- **批准栏回来了**：大纲写完就停，不再追加「Approve / Revise」问题，`approve` 直接推进到正文。
- **卡片保持干净**：长报告放在 `research.md`，卡上只有四条要点；但大纲也变成了一个链接，要点开才能看到 7 节标题。
- **慢了也贵了**：`resolve` 从上次的约 1 分 40 秒、$0.32 变成 3 分 12 秒、$0.83，等大纲的人要多等一会儿。
- **要多答一个问题**：主题里已写「Online-only blog (no blog folder)」，策划仍先问博客网址，多了一轮 `resolve`。
- **没有跑到的**：没有主关键词时的调研；在看板界面上点「批准」后的正文阶段（这里只用了 `--print`）；写正文时按需补查；用户关掉研究员后策划照常写大纲。
