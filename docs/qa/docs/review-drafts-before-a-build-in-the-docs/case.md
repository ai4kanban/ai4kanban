# 在文档里查规划时会出哪些草稿、怎么改、怎么批准

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/first-card`，窗口 1280×1000。
- **读者**：想知道构建前会先看到什么、看完该按哪里的人。

## Steps

1. 点页底的「Next / Draft review」。
   进入 `/docs/drafts`，从页顶开始；分组「How it works」，标题「Review drafts before execution」；左栏「How it works」下的「Draft review」高亮；导语说构建前 Agent 先做出你最在意部分的最终版本，你可以批准、修改或放弃这张卡；右侧目录四节：What gets drafted、Open the draft、Request changes、Approve and build。
   ![Draft review 页顶部](01-drafts-top.png)

2. 读「What gets drafted」。
   一句「You don't have to ask」，下面一张表列出 8 个会出草稿的 Agent 和你要审的东西：ui-designer、copywriting、email-planner、prompt-writer、illustrator、competitor-research、tech-stack-advisor、hyperframes-editor。表下一句说视频、幻灯片、轮播图、博客工作流各有自己的 Agent，链到 Agents。
   ![会出草稿的 Agent](02-what-gets-drafted.png)

3. 点表下那句里的「Agents」。
   `/docs/agents#specialists` 在新标签页打开；草稿页留在原标签页。
   [标签页前后](03-agents-link.log)

4. 关掉新标签页，点右侧目录里的「Approve and build」。
   滚到这一节：批准草稿是卡上的一个问题，打开「Resolve」选批准或写自己的回答，再按「Resolve」提交；分阶段的（先文案后界面）每阶段都要审；批准只更新计划，要按「Build」才开始构建；最后一句链到「Your first card」作例子。
   ![Approve and build 一节](04-approve-and-build.png)

5. 打开 `/llms.txt`，看文档列表。
   「Your first card」「Draft review」依次排在「Documentation overview」之后、「The daily loop」之前，各带一句描述。
   [llms.txt 的文档条目](05-llms-txt.log)

6. 回到 `/docs/drafts`，滚到页底。
   两张翻页卡：左「Previous / Your first card」（Start here），右「Next / The daily loop」（Using the board）。
   ![页底翻页](06-end-of-page.png)

## Feedback

- **一页讲清「构建前先看草稿」**：哪些 Agent 会出草稿、去哪看、怎么改、批准后还要按 Build，四节各几句，几分钟读完。
- **名字有三套**：左栏和翻页叫「Draft review」，页标题叫「Review drafts before execution」，搜索标题又叫「AI4Kanban drafts」；从左栏点进来第一眼会怀疑点错。
- **「放弃这张卡」只给了一句**：导语说可以 drop the card，正文只有「revise the card or reject it」，没说按哪里；要去 The daily loop 的「Reject an idea」找。
- **表和 Agents 页对不齐**：草稿页列 8 个，Agents 页的专员是 11 个；差的那几个是视频、博客专用的，表下一句交代了，但读的人得自己数。
- **llms.txt 带着旧说法**：同一列表里「The daily loop」的描述还写着「plan and close a release」，版本功能早已去掉（不是这两张卡带来的）。
- **没有跑到的**：在看板上真的审一份草稿、在 Resolve 里批准（见 skill、local-ui 模块的场景）；窄屏。
