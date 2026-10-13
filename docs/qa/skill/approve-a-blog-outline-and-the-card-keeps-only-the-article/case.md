# 批准博客大纲后，卡片上只留正文；回到大纲重来时，正文和配图一并撤掉

## Setup

- **项目**：一次性 git 项目，`akb install` 新装，删掉 `setup-checklist.md`；没有博客目录。
- **账号**：博客工作流要 Pro，用一份手写的 Pro 登录状态（`AI4KANBAN_HOME` 指向临时目录，Cloud 地址指向不存在的本机端口）。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`）。
- **终端**：在项目目录里；日志里的 `akb` 和 `node /tmp/qa-1656/cli/bin/ai4kanban.mjs` 都是这次构建出的命令。

## Steps

1. 执行 `akb create --workflow blog-post "Blog post on why small pull requests make AI coding agents easier to review. No keywords. …"`。
   立即返回一次 `create` 运行和跟踪、停止的两条命令。
   [01-create.log](01-create.log)

2. 等运行结束，打开卡片 #2。
   `## By \`blog-planner\` agent` 里是 Brief 和带分节的 `### Outline`；唯一的问题请你批准或修改大纲；资产文件夹还没有文件。
   [02-outline.log](02-outline.log)

3. 执行 `akb card resolve 2 "Approve it."`。
   返回一次 `resolve` 运行；它又请 `blog-illustrator` 做了封面和一张示意图。
   [03-approve.log](03-approve.log)

4. 等运行结束，再打开卡片 #2，看资产文件夹。
   卡片上没有 `### Outline` 和逐节说明，只剩 Brief、元数据、顶部的 `<Asset … label="Article" />` 和 `### Article` 正文；资产文件夹里只有正文、两张图和它们的 HTML 源文件。
   [04-article.log](04-article.log)

5. 执行 `akb card revise 2 "Go back to the outline and start over: make the post about stacked pull requests instead."`。
   返回一次 `edit` 运行。
   [05-go-back.log](05-go-back.log)

6. 等运行结束，再打开卡片 #2，看资产文件夹。
   卡片回到新主题的 `### Outline` 和批准问题；正文、`<Asset>` 链接和 `blog-illustrator` 一节都没了，资产文件夹已空；卡片上也没有指向已删文件的文字。
   [06-outline-again.log](06-outline-again.log)
   **未通过**：第二阶段追加的已勾待办「Delivered `.akb/boards/docs/kanban/assets/2/small-prs-ai-coding-agents.md` …」还在，指向已删的文件，旁边又多了一条已勾的「Removed the small-pull-request article…」。已报待筛选 `blog-go-back-leaves-delivered-todo`。

## Feedback

- **进入正文后卡片干净了**：大纲的逐节说明和「封面由配图师做」这类计划性文字都撤掉了，读卡片的人直接看到正文，不用对照两份。
- **元数据留着是对的**：标题、SEO 标题、描述原样移到 `### Metadata`，正文沿用它，不算残留。
- **回退基本到位**：换主题重来时正文、配图、HTML 源文件连同配图师那一节一起删掉，只剩新大纲，不会误把旧图拿来用。
- **待办成了残留**：回退后「Delivered …」仍是已勾状态，再加一条「Removed …」，像个变更日志；新大纲还没批准，卡片却显示「已交付」，容易误导。
- **正文重复一份**：文章既在卡片 `### Article` 里，又在资产文件夹的 `.md` 里，改稿时两处都要同步——这不是本卡改的，但一样会让人困惑哪份是准的。
- **没有跑到的**：同一阶段内修改大纲（替换部分是否删掉）；其他多阶段工作流（轮播、幻灯片、视频）。
