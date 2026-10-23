# 读 Claude Code 介绍页，看先审草稿再交给 Claude Code 是怎么回事

## Setup

- **站点**：官网（`web/`）拷到 `/tmp` 做静态构建，用 `wrangler pages dev out` 跑在本机（地址给 `SITE`），无头 Chrome 开远程调试（`CDP_PORT`），窗口 1280×900；脚本是 [claude-code.mjs](claude-code.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器）。正文段落滚进视口才淡入，脚本先把整页滚一遍再截图。日志里的录屏地址去掉了域名，取自哪台 CDN 无法从证据确认。
- **读者**：已经在用 Claude Code、搜「kanban for Claude Code」进来的独立开发者。

## Steps

1. 打开 `/agents/kanban-for-claude-code`。
   页头是鹤形图标加「WildCrane」字标，作者行「Tao Wu · Founder of WildCrane」。标签页标题「Kanban for Claude Code: See Drafts First | WildCrane」；标题上方小字「AN AGENT WORKSPACE FOR INDIE HACKERS · 8 MIN READ」，大标题「Kanban for Claude Code: see key drafts before building」，导语「Review key drafts for coding and marketing, then let Claude Code handle the details.」；开头两段说编码和营销工作流在同一个 Agent 工作台里，先在草稿阶段发现错的布局或文案，再让 Claude Code 完成。左侧「ON THIS PAGE」列出 12 个小节。
   ![首屏](01-top.png) · [claude-code.log](claude-code.log)

2. 往下滚到开头两段下面的录屏。
   是一段真实产品录屏，不是静态截图：静音、循环、没有控制条，滚到附近自己播放，画面是演示项目里「邀请成员」卡片的待答问题、手机框里的页面原型和邀请邮件。整页正文里只有三段录屏（开头、「How does WildCrane prepare Claude Code before coding?」末尾讲卡片上的问题、「Can I use Codex …」末尾讲给界面设计师换运行时），没有静态截图；原来讲项目记忆那节的记忆页截图已去掉。
   ![开头的录屏](01b-intro-clip.png) · [claude-code.log](claude-code.log)

3. 读第一节「What can I review before Claude Code builds?」。
   四种草稿：Interface、Prompts、Copy、Emails，各一行说明；接着说界面草稿在卡片上预览、不用构建整个项目，确认后的草稿给 Claude Code 具体要求；小修可以直接实现。段尾链到 coding workflow 和 SaaS 方案页。
   ![草稿一节](02-drafts.png) · [claude-code.log](claude-code.log)

4. 读「How is WildCrane different from Claude Code's task lists?」。
   先承认 Claude Code 的任务列表能跨会话共享、Agent teams 也能分派和跟踪依赖（两处都是链接，链接目标日志没记录），再说 WildCrane 补的是每个任务外面的流程：讨论、审草稿、回答问题、构建、看交付，以及交付后的跟进建议和定期 QA。
   ![和任务列表的区别](03-task-lists.png) · [claude-code.log](claude-code.log)

5. 读「Can I use Codex for writing and Claude Code for coding?」。
   回答「Yes」：Codex 写文案、Claude Code 实现，两者用同一块看板和项目背景，确认的文案留在卡片上给 Claude Code 照着做；也可以选 Cursor、OpenCode 等。节末的录屏演示在配置里把界面设计师的运行时从 Claude Code 换成 Codex。
   ![Codex 和 Claude Code 分工](04-codex.png) · [claude-code.log](claude-code.log)

6. 读最后两节「Find follow-up work after delivery」和「Catch regressions with scheduled QA」。
   前者说交付后按完成的卡片和实际交付提出跟进建议，进 Triage；后者说 Coding 工作流带一个定期运行的 QA manager，更新受影响的测试用例、实跑并留截图/GIF/日志，失败进 Triage，链到 `/docs/daily-loop#test-cases`。
   ![跟进建议](05-follow-up.png) · ![定期 QA](05b-qa.png) · [claude-code.log](claude-code.log)

7. 读页末的「Frequently asked questions」，点开第一问。
   九个问题收起排成一列，每行前一个小圆点、后一个橙色「+」；问题字号 18px、中等粗细，比正文（17px）大一点，明显小于节标题（25.6px、半粗），读起来像附录；行距紧凑，单行问题一行约 66px。点开第一问「Does WildCrane use my Claude subscription, or do I need an Anthropic API key?」，「+」变成「–」，下面是一段灰色回答：Claude CLI 登录、Anthropic API key 或兼容网关都行，存了 key 也不会悄悄顶替订阅。
   ![FAQ 收起](08-faq.png) · ![点开第一问](08b-faq-open.png) · [claude-code.log](claude-code.log)

8. 逐个打开正文里的站内链接。
   `/builder`、`/workflows/coding`、`/solutions/saas`、`/docs/memory`、`/docs/triage`、`/docs/daily-loop`（页内有 `#test-cases`）、`/docs/connectors`、`/download` 都返回 200。
   [claude-code.log](claude-code.log)

9. 读 `/llms.txt` 里这一页的条目，再请求 `/agents/kanban-for-claude-code.md`。
   条目以「An agent workspace for indie hackers.」开头，讲先审草稿、Codex 写作 + Claude Code 编码、偏好带到之后的任务、跟进建议和定期 QA；这一页没有 `.md` 镜像（404），AI 只能读 HTML。
   [claude-code.log](claude-code.log)

## Feedback

- **新名字一眼可见**：页头鹤形图标加「WildCrane」字标，标题、作者行、目录、FAQ 都已换成 WildCrane，读下来没有漏掉的旧名。
- **开门见山**：首屏一句「先审关键草稿，再让 Claude Code 做细节」，紧接着的录屏直接放出卡片上的问题、原型和邀请邮件，比静态截图更快让人明白「草稿」指什么。
- **录屏留着旧缩写**：录屏左上角的演示项目叫「akb-grill-demo」，「akb」和新名字对不上，不过很少有人会注意到。
- **比较很克制**：先讲清 Claude Code 自己已有的任务列表和 Agent teams，再说多出来的流程，读者容易信。
- **FAQ 不抢戏**：问题字号介于正文和节标题之间，九问一屏看完；问题偏技术（.env、Docker、worktree），适合已决定要试的人。
- **页面很长**：12 个小节加 FAQ，跟进建议和定期 QA 这两个新卖点排在最后两节，会话续跑等段落对还在评估的人太深。
- **缺 `.md` 镜像**：`llms.txt` 已指向 `wildcrane.ai`，但 `.md` 仍是 404，AI 要自己剥掉导航和样式。
