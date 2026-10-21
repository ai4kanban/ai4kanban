# 批准博客大纲后，卡片上只留一个正文链接；回到大纲重来时，交付待办改回未勾选

## Setup

- **项目**：一次性 git 项目，`akb install` 新装，删掉 `setup-checklist.md`；没有博客目录。
- **账号**：录证据时用一份手写的 Pro 登录状态（`AI4KANBAN_HOME` 指向临时目录，Cloud 地址指向本机替身 [stand-in-cloud.mjs](stand-in-cloud.mjs)：`/v1/billing` 答 Pro，`/v1/image` 一律失败）。#1930 起博客工作流免费，不登录也能跑（见[在命令行把一张已有的卡换到另一个工作流](../switch-a-card-to-another-workflow/case.md)第 4 步）；本用例的真实运行未重跑。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`）；PATH 最前面放一个 `akb`，转到这次构建出的命令，运行里的 agent 也用它（见 [rb.sh](rb.sh)）。
- **终端**：在项目目录里；日志里的 `akb` 都是这次构建出的命令。

## Steps

1. 执行 `akb create --workflow blog-post "Blog post on why small pull requests make AI coding agents easier to review. No keywords. Keep it short, about 600 words, with one cover image and no links."`。
   立即返回一次 `create` 运行和跟踪、停止的两条命令。
   [01-create.log](01-create.log)

2. 等运行结束，看它的回话。
   卡片 #2 建好，还没有大纲；唯一的问题问博客在哪里（推荐「先交付资产文件夹里的 Markdown」）。
   [02-question.log](02-question.log)

3. 执行 `akb card resolve 2 "No blog yet: deliver a plain Markdown file in the asset folder."`，等运行结束。
   起一次 `resolve`；回话说答案已写进卡片、阶段是 Outline → Article、当前在 Outline。
   [03-resolve.log](03-resolve.log)

4. 打开卡片 #2，再执行 `akb card refine 2`。
   frontmatter 有 `phases: [Outline, Article]`、`phase: 1`，没有问题；`## By \`blog-planner\` agent` 里是 Brief、标题和元数据、六节大纲；大纲待办已勾，封面和正文两条未勾。`refine` 回 `a refine would not move #2`：草稿在等批准。
   [04-outline.log](04-outline.log)

5. 执行 `akb card approve 2`，等运行结束。
   起一次 `approve` 运行并完成。打印的运行 id 因网络 `ECONNRESET` 重试被换掉，`akb run log <打印的 id>` 回 `no run here answers to …`；`akb run list` 里完成的是另一个 id。
   [05-approve.log](05-approve.log)

6. 再打开卡片 #2，看资产文件夹，再执行 `akb card approve 2`。
   `phase: 2`；卡片上只有一个 `<Asset … label="Article" />`，没有全文副本，也没有大纲；`blog-illustrator` 一节列出封面；四条待办都已勾，最后一条写着正文、封面和 SVG 的路径；资产文件夹里只有这三个文件；`akb raw validate 2` 通过。`approve` 被拒：`#2 is on its last stage — archive it once it is delivered.`
   [06-article.log](06-article.log)

7. 执行 `akb card revise 2 "Go back to the outline and start over: make the post about stacked pull requests instead."`。
   返回一次 `edit` 运行。
   [07-go-back.log](07-go-back.log)

8. 等运行结束，再打开卡片 #2，看资产文件夹，再执行 `akb card approve 2`。
   `phase` 退回 1；卡片回到新主题的 Brief 和大纲，Article 链接和 `blog-illustrator` 一节都没了，资产文件夹清空；封面和正文两条待办改回未勾，路径那条删掉，没有追加清理待办。另有一道内容问题「这篇讲 stacked PR 的文章是否仍面向审查 AI agent 的人」，`approve` 因此被拒：`#2 has open questions`。
   [08-outline-again.log](08-outline-again.log)

9. 执行 `akb card resolve 2 "Yes: keep it about reviewing an agent's large change in small pieces."`，等运行结束。
   `resolve` 16 秒完成，问题清空，仍是 `phase: 1`。
   [09-answer.log](09-answer.log)

10. 再执行 `akb card approve 2`，等运行结束。
    起一次 `approve` 并完成。
    [10-approve-again.log](10-approve-again.log)

11. 再打开卡片 #2，看资产文件夹。
    `phase: 2`；仍只有一个 Article 链接，指向新正文 `stacked-pull-requests-ai-coding-agents.md`；四条待办重新勾上，路径换成新文件；资产文件夹只有新正文、封面和 SVG；`akb raw validate 2` 通过。
    [11-article-again.log](11-article-again.log)

## Feedback

- **批准一条命令就够**：`akb card approve 2` 不用再措辞回答「Approve it.」；到了最后阶段它直接说该归档了，不会误推。
- **卡片读起来轻**：成品只剩一个正文链接和一行封面说明，大纲在批准后整段删掉。
- **回退干净**：换主题后阶段退回 Outline，旧正文、封面、SVG 和配图师那一节一起删掉，待办复原，重做后还是那几条待办。
- **回退时多问一句是合理的**：它问新主题是否仍面向审查 agent 的人，这是真正的内容选择；但问题挡住了「批准」，得先答再批，多一轮。
- **打印的运行 id 会失效**：网络重试后看板换了一个新 id，`resolve`、`approve` 打印的跟踪、停止命令都找不到运行，只能去 `akb run list` 里认。
- **大纲直接写在卡上**：这次大纲写进 ``## By `blog-planner` agent`` 正文，而不是 `outline.md` 资产；可读，但卡片在 Outline 阶段会长很多。
- **没有跑到的**：看板界面里的阶段条和批准栏（替身跑在视频克隆那个场景里）；同一阶段内修改大纲；归档。
