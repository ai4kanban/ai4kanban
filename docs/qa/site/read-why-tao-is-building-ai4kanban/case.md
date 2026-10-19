# 读创始人讲为什么做 AI4Kanban

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本机（地址给 `SITE`，默认 `127.0.0.1:4330`），无头 Chrome 开远程调试（`CDP_PORT`）；脚本是 [builder.mjs](builder.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器），窗口 1280×900，手机 390×844。头像来自线上 `cdn.dist0.com`。
- **读者**：读完一篇博客，想知道作者是谁、为什么做这个产品的人；也包括替用户读网站的 AI。

## Steps

1. 在 `/blog/spec-to-code` 点作者行「Tao Wu · Founder of AI4Kanban」。
   到 `/builder`，标签页标题「Why I'm building AI4Kanban — Tao Wu」。大标题「Why I'm building AI4Kanban」下没有橙色横条，头像旁写「Tao Wu / Founder of AI4Kanban」。正文 7 段：先是加粗编号「1.」到「4.」的四段想法（人和 agent 的边界、planning smart、skill 很薄、AI4Kanban 是中间层），再三段收尾；没有列表，没有 `h2`/`h3`。
   ![页面开头](01-builder-top.png) · [builder.log](builder.log)

2. 读到第 1 段后的动画。
   页面上唯一一张 figure：「You」把想法「Launch a Pro plan」交给「AI4Kanban」，出两张草稿，「You review」批准后交给「Agent」（「Agents take over」）。无障碍标签是一整句「You hand an idea to AI4Kanban, which turns it into drafts for you to review. …」，下面没有图注。截图是循环中两张草稿刚出、还没批准的那一帧。
   ![第 1 段后的动画](02-bridge-scene.png) · [builder.log](builder.log)

3. 读到信的结尾。
   最后一段讲模板；正文里没有链接。落款「Tao」，下面一排四个图标：LinkedIn、GitHub、X、个人网站，都在新标签页打开。
   ![结尾和落款](03-signature.png) · [builder.log](builder.log)

4. 用 390px 宽的手机打开 `/builder`，滚到动画。
   动画缩到正文宽 342px，文字和草稿同比缩小，页面不横向滚动。
   ![手机上的动画](04-phone-scene.png) · [builder.log](builder.log)

5. 以 AI 的身份读 `/llms.txt`，再打开它指向的 `/builder.md`。
   `llms.txt` 的 Builder 条目概括四段想法：人和 agent 的边界、planning smart、skill 很薄、写代码和做营销的同一个工作台。`/builder.md` 返回 Markdown，正文与页面一致，编号 `**1.**` 到 `**4.**`，动画换成一句斜体，与无障碍标签同文；没有要点清单和 FAQ。
   [builder.log](builder.log)

## Feedback

- **观点鲜明**：四段编号想法短而直接，第 1 段一讲「人管关键部分、agent 管细节」，紧跟的动画就把这句话演出来了。
- **读完无处可去**：结尾除了四个社交图标没有下一步，想试的人得自己找页头的「Download」。
- **入口难发现**：博客作者行是灰色小字、没有下划线，看不出能点；英文页脚叫「Builder」，页面上的头衔却是「Founder」。
- **只有英文**：中文页脚的「创始人」也链到这一页，`/zh/builder` 是 404。
