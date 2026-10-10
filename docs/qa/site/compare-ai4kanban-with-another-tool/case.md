# 在官网比较 AI4Kanban 和别的工具

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在 `127.0.0.1:4330`，无头 Chrome 开远程调试（`CDP_PORT`）；脚本是 [compare.mjs](compare.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器）和 [retired.sh](retired.sh)，窗口 1280×900。
- **读者**：已经在看 Multica、Taskmaster 或 Hermes Agent Kanban，想知道该选哪个的人。

## Steps

1. 在首页滚到页脚。
   「COMPARE」一栏只有三项：Taskmaster、Hermes Agent Kanban、Multica。页头没有对比入口。
   ![页脚的对比栏](01-footer-compare.png) · [compare.log](compare.log)

2. 点「Multica」。
   到 `/vs-multica`，标题「AI4Kanban vs. Multica」，导语说内置专业智能体和工作流、10 分钟交付第一项工作；往下三个主题：「Start working without designing the team first」「…Review a draft before approving execution」「Will you need to explain it again?」，每个主题左右各一格，赢的一侧打勾。
   ![Multica 对比页首屏](02-multica-top.png)

3. 滚到「Compare the details」。
   逐行比较：内置智能体和工作流、执行前审阅草稿、记住修改和决定、交付之后、许可、执行管理、团队协作；每行赢的一侧打勾，执行管理一行是 Multica 赢。
   ![逐项比较表](03-multica-details.png) · [compare.log](compare.log)

4. 看最后的「Which should you choose?」。
   两列清单：什么情况选 AI4Kanban（内置智能体、执行前审草稿、跨工具记忆……），什么情况选 Multica（多人工作区和权限、队列重试等执行管理、Autopilot 定时）。
   [compare.log](compare.log)

5. 打开 `/vs-task-master`、`/vs-hermes-kanban` 和 `/zh/vs-multica`。
   前两页是同样的结构：三个主题、「Compare the details」、「Which should you choose?」；中文页的小标题都已翻译（「逐项比较」「如何选择？」）。
   [compare.log](compare.log)

6. 访问已下线的旧对比页地址。
   `/vs-linear`、`/vs-github-issues`、`/vs-vibe-kanban` 以及它们的语言版和 `.md` 版都返回 301，跳回同语言的首页。
   [05-retired-pages.log](05-retired-pages.log)

## Feedback

- **敢说谁赢**：每行都标出赢的一方，也老实承认 Multica 赢的地方，结尾直接告诉你什么情况选谁，比「各有千秋」有用得多。
- **三页结构一致**：看过一页，另外两页知道去哪找结论。
- **入口太深**：对比页只在页脚，正在比较工具的访客很难从页头找到。
- **旧链接没说明就回首页**：从别处点进旧的 vs Linear 链接，直接落到首页，不知道那页去哪了。
