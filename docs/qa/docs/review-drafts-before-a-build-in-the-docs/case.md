# 在文档里查规划时会出哪些草稿、怎么改、怎么批准

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/first-card`，窗口 1280×1000。
- **读者**：想知道构建前会先看到什么、看完该按哪里的人。

## Steps

1. 点页底的「Next / Draft review」。
   进入 `/docs/drafts`，从页顶开始；分组「How it works」，标题「Review drafts before execution」；左栏「How it works」下的「Draft review」高亮；导语说构建前 Agent 先做出你最在意部分的最终版本，你可以批准、修改或放弃这张卡；右侧目录四节：What gets drafted、Open the draft、Request changes、Approve and build。
   ![Draft review 页顶部](01-drafts-top.png)

2. 读「What gets drafted」。
   一句「You don't have to ask」，下面一张表列出 8 个会出草稿的 Agent 和你要审的东西：ui-designer、copywriting、email-planner、prompt-writer、illustrator、competitor-research、tech-stack-advisor、hyperframes-editor。表下一句「Video, slide, social post and blog workflows bring in their own agents.」，链到 Agents。
   ![会出草稿的 Agent](02-what-gets-drafted.png)

3. 点表下那句里的「Agents」。
   `/docs/agents#specialists` 在新标签页打开；草稿页留在原标签页。
   [标签页前后](03-agents-link.log)

4. 关掉新标签页，点右侧目录里的「Approve and build」。
   滚到这一节：批准草稿是卡上的一个问题，打开「Resolve」选批准或写自己的回答，再按「Resolve」提交；分阶段的（先文案后界面）每阶段都要审；批准只更新计划，要按「Build」才开始构建；最后一句链到「Your first card」作例子。
   ![Approve and build 一节](04-approve-and-build.png)

5. 打开 `/llms.txt`，看文档列表。
   「Your first card」「Draft review」依次排在「Documentation overview」之后，后面接「Memory」「Follow-ups」，各带一句描述；链接都指向 `https://wildcrane.ai/docs/...`。
   [llms.txt 的文档条目](05-llms-txt.log)

6. 回到 `/docs/drafts`，滚到页底。
   两张翻页卡：左「Previous / Your first card」（Start here），右「Next / Memory」（How it works）。
   ![页底翻页](06-end-of-page.png)

## Feedback

- **一页讲清「构建前先看草稿」**：哪些 Agent 会出草稿、去哪看、怎么改、批准后还要按 Build，四节各几句，几分钟读完。
- **名字有三套**：左栏和翻页叫「Draft review」，页标题叫「Review drafts before execution」，搜索标题又叫「WildCrane drafts」；从左栏点进来第一眼会怀疑点错。
- **「放弃这张卡」只给了一句**：导语说可以 drop the card，正文没说按哪里；要去 The daily loop 找。
- **表和 Agents 页对不齐**：草稿页列 8 个，Agents 页的专员更多；差的是视频、博客、社媒帖专用的，读的人得自己数，社媒帖会出配图草稿也要点进 Agents 页才知道。
- **翻页和 llms.txt 一致**：下一页是 Memory，llms.txt 的顺序相同，链接也都换成了 wildcrane.ai。
- **没有跑到的**：在看板上真的审一份草稿、在 Resolve 里批准（见 skill、local-ui 模块的场景）；窄屏。
