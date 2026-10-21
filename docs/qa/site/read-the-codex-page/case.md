# 读 Codex 介绍页，看 AI4Kanban 在 Codex 之上多了什么

## Setup

- **站点**：官网（`web/`）拷到 `/tmp` 做静态构建，用 `wrangler pages dev out` 跑在本机（地址给 `SITE`），无头 Chrome 开远程调试（`CDP_PORT`，带 `--proxy-server`），窗口 1280×900；脚本是 [codex.mjs](codex.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器），跑时带 `NODE_USE_ENV_PROXY=1`。正文段落滚进视口才淡入，脚本先把整页滚一遍再截图。截图来自线上 `cdn.ai4kanban.dev`。
- **读者**：已经在用 Codex 桌面端、想知道看板能帮上什么的开发者。

## Steps

1. 打开 `/agents/kanban-for-codex`。
   标签页标题「Kanban for Codex: Drafts, Workflows & Tasks | AI4Kanban」；大标题上方小字「WORKING WITH CODEX · 5 MIN READ」，大标题「How do you keep Codex work moving?」，导语「A task board with specialist workflows. Review what needs your judgment, then let Codex carry the work forward.」。左侧「ON THIS PAGE」列出六个小节，页末是 FAQ。
   ![首屏](01-top.png) · [codex.log](codex.log)

2. 读「How does an idea become work Codex can carry out?」。
   一个任务可以跨好几次对话，一次讨论也能拆出几个任务，卡片把目标、要求、草稿和进展放在一起；优先级定先做什么，依赖让被挡的任务等着、独立的并行。下面一张示意图：左边一个想法没人说清「完成」是什么，右边拆成 #1–#4 四张有依赖的卡。
   ![任务一节](02-idea-to-work.png) · [codex.log](codex.log)

3. 读「What should I review before Codex starts?」。
   分阶段规划，在花更多 token 和时间前先看 UI 原型、prompt diff 或文案改动，可以改、也可以决定不做；小修可以直接实现。配图是编码工作流页那张界面草稿（Teamly 的「Invite members」页），图注「Review the key layout, interactions and wording before implementation.」；后面还有一张卡片上待答问题的截图。
   ![界面草稿配图](03-review-draft.png) · [codex.log](codex.log)

4. 读「Can the same board handle development and marketing?」。
   回答「Yes」，一张表列六个工作流和各自产出：Coding、Blog post、Product video、Slide deck、Social post、Video clone；表下小字「All built-in and custom workflows are free. Slide elements in the image-based decks are not editable.」，没有链接；下一行「Explore workflows and the specialist agents.」链到工作流和 agent 文档。
   ![开发和营销一节](04-dev-and-marketing.png) · [codex.log](codex.log)

5. 读「Can I use Codex alongside Claude Code?」。
   每个 agent 可以选自己的运行时，比如 Codex 写文案、Claude Code 实现，在「Configuration → Workflows」里选；节末一张截图正常显示：配置页 Coding 工作流里的「Copy & docs」agent，Runtime 一栏是「Codex · gpt-6.1-sol」，被一道橙色椭圆圈出；替代文字「An AI4Kanban agent set to run on Codex with its own model」，图注「Choose a runtime and model for each agent's work.」。图片地址 `/shots/configuration-agents-codex-v1.webp` 返回 200。
   ![运行时一节的截图](04b-runtimes.png) · [codex.log](codex.log)

6. 读「How does parallel Codex work reach my project?」。
   开着「Automatic Git commits」时，独立任务各在自己的分支和 worktree 里并行，完成的交付排队、逐个以 squash 提交合入，AI4Kanban 从不 push。配图是配置页的 Delivery 和 Runs 两组：「Automatic Git commits」开关，和「End a silent run after」10 minutes；图注「Enable automatic commits for isolated deliveries. Set how long a silent run can wait before it stops.」。
   ![设置截图](05-settings-shot.png) · [codex.log](codex.log)

7. 在页末「Frequently asked questions」点开「How do workflows fit with my Codex skills?」。
   共 11 个问题，第一问是「I use the Codex desktop app. Can I use AI4Kanban?」。点开的这问回答：工作流定哪些地方要人看、何时看、看什么草稿，skills 提供执行步骤和领域知识，两者互补；AI4Kanban 不管理你的 skills 或插件，在 Codex 里装的技能（如 Blender skill）跑看板任务时照样能用。
   ![FAQ，点开 skills 一问](06-faq-skills.png) · [codex.log](codex.log)

8. 逐个打开正文里的站内链接。
   `/builder`、`/docs/drafts`、`/docs/workflows`、`/docs/agents`、`/docs/connectors`、`/docs/memory`、`/download` 都返回 200；正文不再链到 `/pricing`。
   [codex.log](codex.log)

9. 读 `/llms.txt` 里这一页的条目。
   「Kanban for Codex」一条以「Manage tasks above individual Codex conversations.」开头，讲先出 UI 原型、prompt diff、文案等草稿，按 agent 选运行时、按角色记住偏好，结尾「Codex keeps using your installed skills.」，和页面口径一致。这一页没有 `.md` 镜像（404）。
   [codex.log](codex.log)

## Feedback

- **六个工作流都能直接试**：表下一句「全部免费」，读完表就能去下载，不用再想营销那五个要不要付费。
- **小字里两件事挤一行**：「全部免费」和「幻灯片文字不能改」放在同一行灰色小字里，前者是卖点，后者是限制，都容易被跳过。
- **Pro 从页面上消失了**：正文不再提 Pro，也不链定价页；想知道生图、配音要不要钱的 Codex 用户在这页找不到答案。
- **运行时那张图有用**：橙圈直接指到 Runtime 一栏的「Codex · gpt-6.1-sol」，一眼看到按 agent 换成 Codex 在哪设。
- **定位清楚**：开头就说「把 Codex 的活放上看板」，任务跨对话、先审草稿、工作流和 skills 互补，原来的设置不用动。
- **FAQ 正中要害但偏多**：桌面端能不能用、skills 还在不在、会不会自己 push 正是先问的；11 问里后几问（成本上限、当前检出）更像文档。
- **首图是旧界面，还露了本机路径**：顶部看板截图仍带「No release」下拉和「RECURRING」列，左上角是维护者电脑上的项目路径；截图特意停在这张图之上。
- **没有 `.md` 镜像**：`/agents/kanban-for-codex.md` 仍是 404，AI 要自己剥掉导航和样式。
