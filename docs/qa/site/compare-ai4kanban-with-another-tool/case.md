# 在官网比较 AI4Kanban 和别的工具

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本机（地址给 `SITE`，默认 `127.0.0.1:4330`），无头 Chrome 开远程调试（`CDP_PORT`）；脚本是 [compare.mjs](compare.mjs)、[orca.mjs](orca.mjs)（都用 [cdp.mjs](cdp.mjs) 驱动浏览器）和 [retired.sh](retired.sh)，窗口 1280×900。
- **读者**：已经在看 Multica、Taskmaster、Hermes Agent Kanban 或 Orca，想知道该选哪个的人。

## Steps

1. 在首页滚到页脚。
   「COMPARE」一栏有四项：Taskmaster、Hermes Agent Kanban、Multica、Orca。页头没有对比入口。
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

7. 回到首页，在页脚点「Orca」。
   到 `/vs-orca`，标签页标题「AI4Kanban vs. Orca: delegate the details, keep control」；首屏是标题、一句导语（已经在并行跑多个编码智能体？AI4Kanban 让智能体主导执行细节，你定方向），下面一条「What both support」列四项：多个编码智能体、并行会话、隔离的 Git worktree、代码 diff 审阅。
   ![Orca 对比页首屏](06-orca-top.png) · [orca.log](orca.log)

8. 往下读「01 Orca: a thin layer around coding agents」。
   三段介绍 Orca 适合想自己管每个会话、参与执行细节的人；下面一个「Already in the Codex desktop app」小框，右侧勾出 Codex 已有的四项（并行会话和 worktree、diff 与 PR 审阅、浏览器、手机控制和 SSH），底部的来源链接指向 Orca 官网、GitHub 和 OpenAI 文档。
   ![Orca 介绍和 Codex 小框](07-orca-codex.png) · [orca.log](orca.log)

9. 读「02 AI4Kanban」的对比表，再把鼠标移到「You can also create your own agents and workflows.」后面的 ⓘ。
   表只有 AI4Kanban 和 Orca 两列：规划并只问关键决定、现成的专业智能体和工作流、执行前审草稿、共享记忆四行 AI4Kanban 打勾、Orca 一道短横；内置浏览器/SSH/手机控制一行反过来。ⓘ 平时不显示内容，悬停后弹出黑底提示：软件开发工作流免费，博客、轮播图、幻灯片和产品视频工作流需要 Pro。
   ![两列对比表](08-ours-table.png) · ![悬停 ⓘ 出现的 Pro 提示](08b-pro-tip.png) · [orca.log](orca.log)

10. 读「03 Which way do you want to work?」。
    左边「Choose Orca」：自己管每个会话、紧跟执行细节，附「Only in Orca」四个标签和「See Orca's features」链接；右边「Choose AI4Kanban」加粗描边：定方向、审重要草稿、让智能体主导细节，下面「The goal」写着在并行编码之上效率再提升 10 倍。
    ![选择哪种工作方式](09-which-way.png) · [orca.log](orca.log)

11. 打开 `/zh/vs-orca`、`/vs-orca.md` 和 `/llms.txt`。
    中文页标题「AI4Kanban vs. Orca：细节放权，主导权仍在你手中」，各节小标题都已翻译；`.md` 版是同一篇正文的纯文本；`llms.txt` 多了一条「AI4Kanban vs. Orca」。
    ![中文版首屏](10-orca-zh-top.png) · [orca.log](orca.log)

## Feedback

- **敢说谁赢**：每行都标出赢的一方，也老实承认对手赢的地方（Multica 的执行管理、Orca 的浏览器/SSH/手机控制），结尾直接告诉你什么情况选谁，比「各有千秋」有用得多。
- **Orca 页换了思路，读起来更短**：先摆共同点，再说 Orca 和 Codex 的重叠，最后按「你愿意放多少权」给建议，正在并行跑智能体的人一眼能看到自己在哪一边；但它和另外三页版式不同，从 Multica 页过来要重新找「Compare the details」。
- **Pro 限制藏在 ⓘ 里**：哪些工作流要付费只在悬停时出现，手机上或不习惯悬停的人容易错过。
- **「10 倍」很显眼**：写成目标而非实测，但放在加粗卡片里，读者容易当成承诺。
- **入口太深**：对比页只在页脚，正在比较工具的访客很难从页头找到。
- **旧链接没说明就回首页**：从别处点进旧的 vs Linear 链接，直接落到首页，不知道那页去哪了。
