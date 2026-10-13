# 批准博客大纲后，卡片上只留一个正文链接；回到大纲重来时，交付待办改回未勾选

## Setup

- **项目**：一次性 git 项目，`akb install` 新装，删掉 `setup-checklist.md`；没有博客目录。
- **账号**：博客工作流要 Pro，用一份手写的 Pro 登录状态（`AI4KANBAN_HOME` 指向临时目录，Cloud 地址指向不存在的本机端口）。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`）；PATH 最前面放一个 `akb`，转到这次构建出的命令，运行里的 agent 也用它。
- **终端**：在项目目录里；日志里的 `akb` 都是这次构建出的命令。

## Steps

1. 执行 `akb create --workflow blog-post "Blog post on why small pull requests make AI coding agents easier to review. No keywords. …"`。
   立即返回一次 `create` 运行和跟踪、停止的两条命令。
   [01-create.log](01-create.log)

2. 等运行结束，打开卡片 #2，看资产文件夹。
   `## By \`blog-planner\` agent` 里是一句概述和 `<Asset … label="Outline" />`，大纲全文在资产文件夹的 `outline.md` 里；唯一的问题请你批准或修改大纲；两条待办（大纲批准、文章交付）都未勾。
   [02-outline.log](02-outline.log)

3. 执行 `akb card resolve 2 "Approve it."`。
   返回一次 `resolve` 运行。
   [03-approve.log](03-approve.log)

4. 等运行结束，再打开卡片 #2，看资产文件夹。
   卡片上只有一个 `<Asset … label="Article" />`，没有 `### Article` 全文副本，也没有大纲；`blog-illustrator` 一节列出封面；两条待办都已勾，交付待办写着正文和图片的路径；资产文件夹里只有正文、封面和它的 HTML 源文件，`outline.md` 已删；`akb raw validate 2` 通过。
   [04-article.log](04-article.log)

5. 执行 `akb card revise 2 "Go back to the outline and start over: make the post about stacked pull requests instead."`。
   返回一次 `edit` 运行。
   [05-go-back.log](05-go-back.log)

6. 等运行结束，再打开卡片 #2，看资产文件夹。
   卡片回到新主题的 Outline 链接和批准问题；Article 链接和 `blog-illustrator` 一节都没了，资产文件夹只剩新的 `outline.md`；两条待办改回未勾，交付待办不再指向已删的文件，也没有追加「Removed …」之类的清理待办。
   [06-outline-again.log](06-outline-again.log)

7. 再执行 `akb card resolve 2 "Approve it."`。
   返回一次 `resolve` 运行。
   [07-approve-again.log](07-approve-again.log)

8. 等运行结束，再打开卡片 #2。
   仍是两条待办，都重新勾上，交付待办写着新正文 `stacked-prs-ai-agent-review.md` 和新图的路径；卡片上仍只有一个 Article 链接，没有全文副本；`akb raw validate 2` 通过。
   [08-article-again.log](08-article-again.log)

## Feedback

- **卡片读起来轻了**：大纲和正文都放进资产文件，卡片上只剩一句概述和一个链接，不再有两份正文要对照。
- **回退干净**：换主题后旧正文、封面、HTML 源文件和配图师那一节一起删掉，两条待办改回未勾，卡片不再显示「已交付」。
- **重做后待办复用**：再次批准后还是那两条待办，路径换成新文章，没有越积越长的变更记录。
- **一处小残留**：回退时 agent 把旧的「Cover only, no links」移进了 `### Overruled by the user`，可用户只说了换主题，并没否决这条，读起来像用户反对过只配一张图。
- **没有跑到的**：同一阶段内修改大纲（替换部分是否删掉）；看板界面里 Outline / Article 链接的显示；其他多阶段工作流（轮播、幻灯片、视频）。
