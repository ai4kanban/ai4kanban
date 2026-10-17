# 在官网比较 AI4Kanban 和别的工具

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本机（地址给 `SITE`，默认 `127.0.0.1:4330`），无头 Chrome 开远程调试（`CDP_PORT`）；脚本是 [compare.mjs](compare.mjs)、[orca.mjs](orca.mjs)、[plannotator.mjs](plannotator.mjs)（都用 [cdp.mjs](cdp.mjs) 驱动浏览器）和 [retired.sh](retired.sh)，窗口 1280×900。
- **读者**：已经在看 Multica、Taskmaster、Hermes Agent Kanban、Orca 或 Plannotator，想知道该选哪个的人。

## Steps

1. 在首页滚到页脚。
   「COMPARE」一栏有五项：Taskmaster、Hermes Agent Kanban、Multica、Orca、Plannotator。页头没有对比入口。
   ![页脚的对比栏](01-footer-compare.png) · [compare.log](compare.log)

2. 点「Multica」。
   到 `/vs-multica`，标题「AI4Kanban vs. Multica」，导语只交代比较什么：「Compare AI4Kanban and Multica on specialist agents, workflow setup, draft review, preference memory and team collaboration.」；往下三个主题：「Start working without designing the team first」「Review key drafts before agents continue」「Will you need to explain it again?」，每个主题左右各一格，赢的一侧打勾。
   ![Multica 对比页首屏](02-multica-top.png)

3. 滚到「Compare the details」。
   逐行比较：内置智能体和工作流、执行前审阅草稿、记住修改和决定、交付之后、许可、执行管理、团队协作；每行赢的一侧打勾，执行管理一行是 Multica 赢。
   ![逐项比较表](03-multica-details.png) · [compare.log](compare.log)

4. 看最后的「Which should you choose?」。
   两列清单：什么情况选 AI4Kanban（现成的专业智能体和工作流、需要你判断的地方先审草稿、之后的任务沿用项目背景和偏好、独立任务并行和交付后的跟进建议），什么情况选 Multica（多人工作区和权限、队列重试等执行管理、Autopilot 定时）。
   [compare.log](compare.log)

5. 打开 `/vs-task-master`、`/vs-hermes-kanban` 和 `/zh/vs-multica`。
   前两页是同样的结构：三个主题（前两个都是「Specialist agents and workflows, ready to use」「Review key drafts before implementation」）、「Compare the details」、「Which should you choose?」；中文页的小标题都已翻译（「先审关键草稿再让 agent 继续」「逐项比较」「如何选择？」）。
   [compare.log](compare.log)

6. 访问已下线的旧对比页地址。
   `/vs-linear`、`/vs-github-issues`、`/vs-vibe-kanban` 以及它们的语言版和 `.md` 版都返回 301，跳回同语言的首页。
   [05-retired-pages.log](05-retired-pages.log)

7. 回到首页，在页脚点「Orca」。
   到 `/vs-orca`，标签页标题「AI4Kanban vs. Orca: review drafts, hand off the details」；首屏是标题、一句导语「Compare AI4Kanban and Orca on session control, specialist workflows, draft review and the work needed to coordinate execution.」，下面一条「What both support」列四项：多个编码智能体、并行会话、隔离的 Git worktree、代码 diff 审阅。
   ![Orca 对比页首屏](06-orca-top.png) · [orca.log](orca.log)

8. 往下读「01 Orca: a thin layer around coding agents」。
   三段介绍 Orca 适合想自己管每个会话、参与执行细节的人；下面一个「Already in the Codex desktop app」小框，右侧勾出 Codex 已有的四项（并行会话和 worktree、diff 与 PR 审阅、浏览器、手机控制和 SSH），底部的来源链接指向 Orca 官网、GitHub 和 OpenAI 文档。
   ![Orca 介绍和 Codex 小框](07-orca-codex.png) · [orca.log](orca.log)

9. 读「02 AI4Kanban: review the drafts, hand off the details」的对比表，再把鼠标移到「You can also create your own agents and workflows.」后面的 ⓘ。
   表只有 AI4Kanban 和 Orca 两列：规划并只问关键决定、现成的专业智能体和工作流、执行前审草稿、共享记忆四行 AI4Kanban 打勾、Orca 一道短横；内置浏览器/SSH/手机控制一行反过来。ⓘ 平时不显示内容，悬停后弹出黑底提示：软件开发工作流免费，博客、轮播图、幻灯片和产品视频工作流需要 Pro。
   ![两列对比表](08-ours-table.png) · ![悬停 ⓘ 出现的 Pro 提示](08b-pro-tip.png) · [orca.log](orca.log)

10. 读「03 Which way do you want to work?」。
    左边「Choose Orca」：自己管每个会话、紧跟执行细节，附「Only in Orca」四个标签和「See Orca's features」链接；右边「Choose AI4Kanban」加粗描边：现成的编码、博客和视频专业智能体与工作流，在草稿里改关键细节，智能体沿用你的偏好、之后少纠正；下面「The goal」写着「Move development and marketing forward together, with less rework」。
    ![选择哪种工作方式](09-which-way.png) · [orca.log](orca.log)

11. 打开 `/zh/vs-orca`、`/vs-orca.md` 和 `/llms.txt`。
    中文页标题「AI4Kanban vs. Orca：先审草稿，执行细节交给 agent」，各节小标题都已翻译；`.md` 版是同一篇正文的纯文本，开头引言就是那句导语；`llms.txt` 的「AI4Kanban vs. Orca」条目也是这句话。
    ![中文版首屏](10-orca-zh-top.png) · [orca.log](orca.log)

12. 回到首页，在页脚点「Plannotator」。
    到 `/vs-plannotator`，标签页标题「AI4Kanban vs. Plannotator: from key drafts to delivery」；导语一句「Compare AI4Kanban and Plannotator on draft and code review, specialist workflows, parallel tasks and how work continues after approval.」；「What both support」列五项：执行前审计划、批注回传智能体、多种编码智能体、查看代码 diff、免费开源。
    ![Plannotator 对比页首屏](11-plannotator-top.png) · [plannotator.log](plannotator.log)

13. 往下读「01 Plannotator: review within your agent session」。
    先说它经钩子在本地浏览器打开审阅页、审完回原会话继续；两个小节「Review more than plans」（批注文档/URL/HTML、审 PR 和 MR、AI 代码审阅）和「Share a review」（链接分享，开源版已进入弃用支持）；底部链接指向 plannotator.ai 和 GitHub README。
    ![Plannotator 一节](12-plannotator-theirs.png) · [plannotator.log](plannotator.log)

14. 读「02 AI4Kanban: from key drafts to finished work」的三张卡片，再把鼠标移到「You can also create custom agents and workflows.」后面的 ⓘ。
    三张卡：「Review what you would want to change」（草稿→确认→执行）、「Move several tasks forward together」（Login page / Pricing copy / API fix 并行）、「Explain less next time」（两个智能体共享项目背景），每张配像素小人。ⓘ 悬停前隐藏，悬停后弹出：软件开发工作流免费，博客、轮播图、幻灯片和产品视频工作流需要 Pro。
    ![AI4Kanban 一节](13-plannotator-ours.png) · ![悬停 ⓘ 出现的 Pro 提示](13b-plannotator-pro-tip.png) · [plannotator.log](plannotator.log)

15. 读「03 What comes built in」。
    Plannotator 和 AI4Kanban 两列，首行用文字说工作方式，其余 13 行打勾或画短横：计划修订差异、AI 代码审阅、PR/MR 审阅、分享链接是 Plannotator 有、AI4Kanban 没有；图片和分镜草稿、任务看板、专业智能体、共享记忆、跟进建议反过来；分享链接旁注「Deprecated OSS support」。表下一行小字说明 Plannotator 的历史导出不算智能体记忆。
    ![内置能力对比表](14-plannotator-table.png) · [plannotator.log](plannotator.log)

16. 读「04 Which fits your work?」和结尾。
    「Choose Plannotator」：围绕手头的智能体审计划、文档和代码，还要 PR 审阅或共享批注；「Choose AI4Kanban」加粗描边：在任务卡上审关键草稿再让智能体做完，内置工作流覆盖编码和营销、独立任务并行，智能体沿用你的偏好、少重复纠正。最后是「Download AI4Kanban」按钮。
    ![选哪个](15-plannotator-which.png) · [plannotator.log](plannotator.log)

17. 打开 `/zh/vs-plannotator`、`/ja`、`/es`、`/fr` 版、`/vs-plannotator.md` 和 `/llms.txt`。
    中文页标题「AI4Kanban vs. Plannotator：从关键草稿到任务交付」，各节小标题都已翻译；日、西、法三版都返回 200 并有各自语言的标题（如「del borrador a la entrega」）；`.md` 版是同一篇正文的纯文本；`llms.txt` 的「AI4Kanban vs. Plannotator」条目就是那句导语。
    ![中文版首屏](16-plannotator-zh-top.png) · [plannotator.log](plannotator.log)

## Feedback

- **导语变成了目录**：五页首屏都只说「比较 X 和 Y 的哪几方面」，客观但没有立场，读者要往下滚才知道 AI4Kanban 到底强在哪；搜索结果里看到的也是这句，点进来的理由变弱了。
- **结尾讲清了价值**：「Which way / Which fits」里换成了具体收益（草稿里改关键细节、偏好沿用、开发和营销一起推进），比原来抽象的「定方向、让智能体主导细节」好懂；Orca 页去掉了「10 倍」，不再像承诺。
- **敢说谁赢**：每行都标出赢的一方，也老实承认对手赢的地方（Multica 的执行管理、Orca 的浏览器/SSH/手机控制、Plannotator 的计划差异、PR 审阅和分享）。
- **Multica 清单四行都以「Want」开头**：读起来像重复；Orca 页同类清单已改为动词开头，两页口吻不一。
- **五页三种版式**：Multica 等三页是主题+逐项表，Orca 和 Plannotator 是共同点+介绍+表+选择，在页面间来回比较时要重新找位置。
- **Pro 限制藏在 ⓘ 里**：哪些工作流要付费只在悬停时出现，手机上或不习惯悬停的人容易错过。
- **入口太深**：对比页只在页脚，正在比较工具的访客很难从页头找到。
- **旧链接没说明就回首页**：从别处点进旧的 vs Linear 链接，直接落到首页，不知道那页去哪了。
