# 一篇博客同时发官网和 dev.to：两份稿子分开交付，dev.to 那份指回原文；下一篇照记下的去向走

## Setup

- **项目**：`/tmp` 下一次性 git 项目，`web/blog/` 里已有一篇带 `title`、`date`、`description`、`keywords` 的文章；`akb install` 新装，删掉初始卡 #1 和 `setup-checklist.md`。
- **账号**：录证据时用一份手写的 Pro 登录状态，Cloud 地址指向本机替身 [stand-in-cloud.mjs](stand-in-cloud.mjs)（`127.0.0.1:8819`，`/v1/billing` 答 Pro）。#1930 起博客工作流免费，不登录也能跑（见[在命令行把一张已有的卡换到另一个工作流](../switch-a-card-to-another-workflow/case.md)第 4 步）；本用例的真实运行未重跑。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`）；PATH 最前面的 `akb` 转到这次构建出的命令，运行里的 agent 也用它（见 [rb.sh](rb.sh)）。

## Steps

1. 看项目里的博客目录和 `blog-post` 工作流。
   `web/blog/` 只有那一篇旧文；`blog-planner` 的记忆文件夹还不存在。
   [01-setup.log](01-setup.log)

2. 执行 `akb create --workflow blog-post "… Publish it on our site blog (posts live in web/blog/, served at https://tasko.dev/blog/<slug>) and cross-post it on dev.to; the site post is the original."`。
   立即返回一次 `create` 运行。
   [02-create.log](02-create.log)

3. 运行结束后看回话和卡片 #2。
   没有待答问题，停在 Outline 阶段；Brief 多了一条 `Destinations`：官网 `web/blog/small-pull-requests-ai-coding-agents.md` 是原文，dev.to 一份 Markdown，`canonical_url` 指向官网地址。
   [03-outline.log](03-outline.log)

4. 执行 `akb card approve 2`，等运行结束。
   起一次 `approve`，49 秒完成；回话分开列出官网和 dev.to 两份稿子。
   [04-approve.log](04-approve.log)

5. 看卡片、资产文件夹、`web/blog/`，比较两份稿子。
   `phase: 2`；卡片顶部两个 `<Asset>`，标签分别是 `Site` 和 `dev.to`；`web/blog/` 只多了官网那份，dev.to 那份只在资产文件夹里。dev.to 稿带 `published: false` 和指向官网的 `canonical_url`；两份正文只差一处站内链接——dev.to 稿换成了 `https://tasko.dev/…` 全地址。
   [05-article.log](05-article.log)

6. 看 `docs/kanban/memory/agents/blog-planner/`。
   新建了 `destination.md`，每个去向一条：位置、frontmatter 格式、链接写法；`keywords.md` 记了官网地址，关键词为 `(none)`。
   [06-memory.log](06-memory.log)

7. 再建一篇不提发布去向的：`akb create --workflow blog-post "Blog post on how to write a card an AI coding agent can finish without asking. No keywords, about 300 words, no images, no external links."`，运行结束后看卡片 #3 和文件。
   没有问去向：Brief 的 `Destinations` 照 `destination.md` 写了官网原文加 dev.to 副本；官网稿写进 `web/blog/`，dev.to 稿只在资产文件夹，`canonical_url` 指回官网；`keywords.md` 追加了一行。这次它跳过了大纲审批，`create` 一次就交了成稿，卡上没有 `phase`。
   [07-second-post.log](07-second-post.log)

## Feedback

- **两份稿子分得清**：dev.to 那份不会混进 `web/blog/`，canonical 和站内链接都替 dev.to 改好了，复制粘贴即可发布。
- **记一次，下次不用再说**：第一次说清楚去向后，第二篇什么都不提也照样分两份交付，不再追问博客在哪。
- **默认交叉发布未必是你要的**：第二篇我没说要发 dev.to，它因为上一篇发过就照做了；只想发官网的话得每次说明。
- **大纲审批时有时无**：第一篇先给大纲等批准，第二篇因为要求都写死了就直接出成稿；省了一轮，但看不出何时会跳过。
- **发布仍是手工的**：dev.to 只交付了草稿文件，`keywords.md` 里也还没有 dev.to 地址，要自己去贴、自己回来补。
- **没有跑到的**：Medium、CMS 这类去向；用户改某个去向后只更新那一条记录；看板界面里两个 `<Asset>` 的样子。
