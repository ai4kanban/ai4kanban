# 在文档里查待筛选条目从哪来、怎么分拣

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/triage`，窗口宽 1280px。
- **读者**：看到看板顶栏的收件箱按钮变红、或发现 Proposer 提的条目直接成了卡，想知道这些条目从哪来、分拣凭什么留下或忽略的人。

## Steps

1. 打开文档的「Triage」页。
   正文第一段：**Triage** 是顶栏铃铛左边的收件箱按钮，有条目等着时变红并带数字；条目自己进来——来自 **Proposer**、`akb triage add`、构建或规划途中发现的后续；它是线索不是任务，自己要做的事用 **New task**。下面是悬停一行的四个操作（**Make card**、**Start now**、**Discuss**、**Ignore**）、两个标签页（**Waiting**、**History**），以及「自动分拣要 Pro」。右侧目录只有三项：Sort it、Let it sort by itself、Write an item from a script。
   ![Triage 页顶部](01-triage-page.png)

2. 点目录里的「Sort it」。
   一段说 **Auto-sort** 或 `akb triage run` 把每个待筛选条目对照产品描述和你以前否决过的东西判断：成卡、带原因忽略、或等你决定；新卡自己细化，分拣从不启动构建、不改已有的卡。下一段：忽略时记下原因、保持 `project.md` 和规划记忆最新，就能引导它。「Let it sort by itself」：Pro 上新条目一到就分拣，每张这样的卡花一次细化运行。
   ![Sort it 一节](02-sort-it.png)

3. 滚到页底。
   翻页卡：左「Previous / Runs and agents」，右「Next / Local and Cloud」。
   ![页底的翻页](03-end-of-page.png)

4. 打开旧地址 `/docs/triage-endpoint`。
   永久跳转（301）到 `/docs/triage`。本地 `next dev` 不执行 `_redirects`，这一步用 `wrangler pages dev` 托管跳转规则验证。
   [旧地址的跳转](04-old-address.log)

## Feedback

- **入口和操作一屏讲完**：按钮在哪、条目从哪来、四个操作、两个标签页都在第一屏，和看板对得上。
- **成本说了**：「每张卡花一次细化运行」直接写出来，开自动分拣前心里有数。
- **分拣依据只剩一句**：旧版逐条列出它问什么（否决过没有、是否已有卡在做、要不要你），现在只说「对照产品描述和否决过的东西」，想知道某条为什么被忽略的人只能看 **History** 里的原因。
- **Proposer 条目的特殊处理没了**：旧版说它的条目不会被忽略；现在读者会以为 Proposer 的条目和别的一样可能被丢掉。
- **`--source` 列了 reddit、xiaohongshu 等**：可页上没有任何从这些平台自动进条目的办法，读者会问「它们怎么进来的」——答案是你自己的脚本，这一点只能自己推。
- **没有跑到的**：线上站点的跳转（只在本地 `wrangler pages dev` 验证了规则）、窄屏、站内搜索。
