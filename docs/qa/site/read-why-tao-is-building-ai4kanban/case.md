# 读创始人讲为什么做 AI4Kanban

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本机（地址给 `SITE`，默认 `127.0.0.1:4330`），无头 Chrome 开远程调试（`CDP_PORT`）；脚本是 [builder.mjs](builder.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器），窗口 1280×900，手机 390×844。头像来自线上 `cdn.dist0.com`。
- **读者**：读完一篇博客，想知道作者是谁、为什么做这个产品的人；也包括替用户读网站的 AI。

## Steps

1. 在 `/blog/spec-to-code` 点作者行「Tao Wu · Founder of AI4Kanban」。
   到 `/builder`，标签页标题「Why I'm building AI4Kanban — Tao Wu」。一封书信式的页面：大标题「Why I'm building AI4Kanban」（「AI4Kanban」下一道橙色粗线），头像旁写「Tao Wu / Founder of AI4Kanban」，下面是十几段第一人称正文，没有要点清单，也没有 FAQ。正文讲先让 agent 自己规划、早期用户觉得「it didn't feel faster」、再改成先看关键草稿，几处关键句加粗。
   ![页面开头](01-builder-top.png) · [builder.log](builder.log)

2. 往下读到第一张插图。
   手绘风插图：一张想法卡片、agent 自己勾掉了几个问题，只把一道选择题递给人；下面斜体图注「The agent asks first, settles what it can, and hands you the few real choices.」。
   ![第一张插图](02-asking-first.png) · [builder.log](builder.log)

3. 继续读到第二张插图。
   人勾选了一张草稿、划掉另一张，agent 接着做出一叠卡片；图注「You settle the key drafts. The agent builds the rest.」。
   ![第二张插图](03-drafts-first.png) · [builder.log](builder.log)

4. 读到信的结尾。
   最后一段链到「home page」（`/`）和「GitHub」（项目仓库，新标签页打开），落款「Tao」，下面一排四个图标：LinkedIn、GitHub、X、个人网站，都在新标签页打开。
   ![结尾和落款](04-signature.png) · [builder.log](builder.log)

5. 用 390px 宽的手机打开 `/builder`，滚到第一张插图。
   插图缩到 342px，图注换成两行，页面不横向滚动。
   ![手机上的插图](05-phone-picture.png) · [builder.log](builder.log)

6. 以 AI 的身份读 `/llms.txt`，再打开它指向的 `/builder.md`。
   `llms.txt` 里的 Builder 条目概括同一个故事：从让 agent 自己规划，到早期用户觉得不够快，到先确认关键草稿。`/builder.md` 返回 Markdown，正文与页面一致，作者写「Founder of AI4Kanban」，两张插图换成图注一句，没有旧的要点清单和 FAQ。
   [builder.log](builder.log)

## Feedback

- **像真人在讲话**：先失败、再听用户反馈、再改方向，比一份履历更让人相信这个产品是被打磨出来的；两张插图把「先问」和「先看草稿」的差别画得一目了然。
- **读完无处可去**：结尾只有「home page」和 GitHub，想试的人得自己找页头的「Download」。
- **入口难发现**：博客作者行是灰色小字、没有下划线，看不出能点；页脚叫「Builder」，页面上的头衔却是「Founder」。
- **只有英文**：中文页脚也链到这一页，`/zh/builder` 是 404。
- **图注读两遍**：插图的无障碍标签和下面的图注是同一句，读屏会念两次。
