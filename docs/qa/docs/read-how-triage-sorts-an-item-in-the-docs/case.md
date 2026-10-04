# 在文档里查待筛选条目从哪来、自动分拣怎么处理它

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/triage`，窗口宽 1280px。
- **读者**：看到看板顶栏的收件箱按钮变红、或发现 Proposer 提的条目直接成了卡，想知道这些条目从哪来、分拣凭什么留下或忽略的人。

## Steps

1. 打开文档的「Triage」页。
   页首导语：Triage 放的是可能成为工作的东西——看板发现的后续事项、Proposer 的想法、你的脚本加的条目——不再说从外部平台拉取。正文第一句：**Triage** 是顶栏铃铛左边的收件箱按钮，有条目等着时变红并带数字。左栏「Triage」下面直接是「Local and Cloud」，没有「Triage endpoint」。
   ![Triage 页顶部](01-triage-page.png)

2. 点右侧目录里的「A triage item is not a card」。
   页面滚到这一节。第二段说条目自己进来：来自 **Proposer**、`akb triage add`，以及构建或规划途中发现的后续工作——不再提接口；自己要做的事用 **New task**，那张卡照你说的原样写。右侧目录里没有「Connect a source」「What the endpoint returns」「Pull」。
   ![A triage item is not a card](02-not-a-card.png)

3. 点目录里的「Sort it」，往下滚到讲 Proposer 条目的一段。
   「Sort it」一节先说分拣逐条问：以前否决过没有、有没有打开的卡已经在做、需不需要你、值不值得做——不再问「是否已经支持」。接着单独一段：**Proposer** 写的条目已对照过产品、看板和你否决过的东西，分拣只问需不需要你、把卡定下来，从不因这些理由被忽略；不该成卡的，在看板上否决那张卡。再往下一段：分拣不读代码，所以卡片的第一次细化（跳过规划时是构建）先查一遍，产品已经做到、或针对的东西已不存在的卡，带着证据直接进归档。
   ![Proposer 条目与第一次细化](03-proposer-and-first-refine.png)

4. 滚到页底。
   翻页卡：左「Previous / Runs and agents」，右「Next / Local and Cloud」——不再翻到接口契约页。
   ![页底的翻页](04-end-of-page.png)

5. 打开旧地址 `/docs/triage-endpoint`。
   永久跳转（301）到 `/docs/triage`。本地 `next dev` 不执行 `_redirects`，这一步用 `wrangler pages dev` 托管跳转规则验证。
   [旧地址的跳转](05-old-address.log)

## Feedback

- **入口一句话讲清**：「收件箱按钮、变红、带数字」和看板顶栏对得上，读者不用再去左栏找。
- **不再承诺接口**：条目从哪来只剩三条真实的路（Proposer、`akb triage add`、构建或规划里发现的后续），和产品对得上；旧书签也跳回本页，不会撞上 404。
- **按旧文档接过接口的人没有交代**：`akb triage fetch` 和 `config.md` 里的接口设置照常能用，但文档里一个字都没有了；这些用户读完本页会以为接口被拿掉了，又找不到契约。
- **「a source such as Reddit or 小红书」还留在第一段**：讲 **Waiting** 列表怎么排序时仍举外部平台当来源，可页上已没有任何从这些平台进条目的办法，读的人会问「它们怎么进来的」。
- **Proposer 的条目为什么不被忽略，说得有理由**：先说它已经查过什么，再说想拒绝该去哪拒绝；只是「turn down a card it should not have become on the board」句子绕，读两遍才懂。
- **「产品已经做到」的检查挪到了细化，要自己串起来**：分拣那段不提它，往下两段才说第一次细化先查；被直接归档的卡已经花掉一次细化，这里没有提醒。
- **没有跑到的**：线上站点的跳转（只在本地 `wrangler pages dev` 验证了规则）、窄屏、站内搜索还会不会搜出旧页。
