# 读 Claude Code 介绍页，看先审草稿再交给 Claude Code 是怎么回事

## Setup

- **站点**：官网（`web/`）拷到 `/tmp` 做静态构建，用 `wrangler pages dev out` 跑在本机（地址给 `SITE`），无头 Chrome 开远程调试（`CDP_PORT`），窗口 1280×900；脚本是 [claude-code.mjs](claude-code.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器）。正文段落滚进视口才淡入，脚本先把整页滚一遍再截图。
- **读者**：已经在用 Claude Code、搜「kanban for Claude Code」进来的独立开发者。

## Steps

1. 打开 `/agents/kanban-for-claude-code`。
   标签页标题「Kanban for Claude Code: See Drafts First | AI4Kanban」；标题上方小字「AN AGENT WORKSPACE FOR INDIE HACKERS · 8 MIN READ」，大标题「Kanban for Claude Code: see key drafts before building」，导语「Review key drafts for coding and marketing, then let Claude Code handle the details.」；开头两段说编码和营销工作流在同一个 Agent 工作台里，先在草稿阶段发现错的布局或文案，再让 Claude Code 完成。左侧「ON THIS PAGE」列出 12 个小节。
   ![首屏](01-top.png) · [claude-code.log](claude-code.log)

2. 读第一节「What can I review before Claude Code builds?」。
   四种草稿：Interface、Prompts、Copy、Emails，各一行说明；接着说界面草稿在卡片上预览、不用构建整个项目，确认后的草稿给 Claude Code 具体要求；小修可以直接实现。段尾链到 coding workflow 和 SaaS 方案页。
   ![草稿一节](02-drafts.png) · [claude-code.log](claude-code.log)

3. 读「How is AI4Kanban different from Claude Code's task lists?」。
   先承认 Claude Code 的任务列表能跨会话共享、Agent teams 也能分派和跟踪依赖（都链到官方文档），再说 AI4Kanban 补的是每个任务外面的流程：讨论、审草稿、回答问题、构建、看交付，以及交付后的跟进建议和定期 QA。
   ![和任务列表的区别](03-task-lists.png) · [claude-code.log](claude-code.log)

4. 读「Can I use Codex for writing and Claude Code for coding?」。
   回答「Yes」：Codex 写文案、Claude Code 实现，两者用同一块看板和项目背景，确认的文案留在卡片上给 Claude Code 照着做；也可以选 Cursor、OpenCode 等。
   ![Codex 和 Claude Code 分工](04-codex.png) · [claude-code.log](claude-code.log)

5. 读最后两节「Find follow-up work after delivery」和「Catch regressions with scheduled QA」。
   前者说交付后按完成的卡片和实际交付提出跟进建议，进 Triage；后者说 Coding 工作流带一个定期运行的 QA manager，更新受影响的测试用例、实跑并留截图/GIF/日志，失败进 Triage，链到 `/docs/daily-loop#test-cases`。
   ![跟进建议](05-follow-up.png) · ![定期 QA](05b-qa.png) · [claude-code.log](claude-code.log)

6. 逐个打开正文里的站内链接。
   `/builder`、`/workflows/coding`、`/solutions/saas`、`/docs/memory`、`/docs/triage`、`/docs/daily-loop`（页内有 `#test-cases`）、`/docs/connectors`、`/download` 都返回 200。
   [claude-code.log](claude-code.log)

7. 读 `/llms.txt` 里这一页的条目，再请求 `/agents/kanban-for-claude-code.md`。
   条目以「An agent workspace for indie hackers.」开头，讲先审草稿、Codex 写作 + Claude Code 编码、偏好带到之后的任务、跟进建议和定期 QA；这一页没有 `.md` 镜像（404），AI 只能读 HTML。
   [claude-code.log](claude-code.log)

## Feedback

- **开门见山**：首屏一句「先审关键草稿，再让 Claude Code 做细节」，和首页口径一致，Claude Code 用户一眼知道这东西加在哪一层。
- **比较很克制**：先讲清 Claude Code 自己已有的任务列表和 Agent teams，再说多出来的流程，不贬低对方，读者容易信。
- **页面很长**：12 个小节加 FAQ，「8 MIN READ」名副其实；交付后的跟进建议和定期 QA 是新卖点，却排在最后两节，只看前半页的人看不到。
- **偏技术细节混在一起**：会话续跑、限流立即停止、rebase 落地这些段落对评估「要不要用」的人太深，夹在定位和价值之间，拖慢阅读。
- **缺 `.md` 镜像**：其他对比页和首页都有纯文本版，这一页 `llms.txt` 指向 HTML，AI 读起来要多剥一层导航和样式。
