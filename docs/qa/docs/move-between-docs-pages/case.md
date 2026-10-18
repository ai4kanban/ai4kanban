# 在文档页之间跳转

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/daily-loop`；第 1–4、8 步窗口 1280×1000，第 5–7 步模拟手机 390×844（触屏）。

## Steps

1. 点左栏的「Runs and runtimes」。
   进入 `/docs/runs`，标题「Manage runs and runtimes」，从页顶开始；左栏高亮移到「Runs and runtimes」。
   ![左栏跳到 Runs and runtimes](01-rail-runs.png)

2. 滚到正文最后一段，点链接「Multi-runtime support」。
   链接在新标签页打开 `/docs/connectors`，当前标签页仍停在 `/docs/runs`。
   ![正文里的站内链接](02-inline-link.png)
   [标签页前后对比](02-new-tab.log)

3. 关掉新标签页，在 `/docs/runs` 滚到底。
   两张翻页卡：左「Previous / Agents」，右「Next / Triage」，下面各写所属分组「Using the board」。
   ![Runs 页底的翻页](03-pager.png)

4. 点「Previous / Agents」。
   进入 `/docs/agents`，从页顶开始，左栏高亮移到「Agents」。
   ![上一页 Agents](04-previous-agents.png)

5. 换到手机宽度，打开 `/docs/runs`。
   左栏不见了，页头下方是一条折叠栏「Using the board / Runs and runtimes」，右端一个向下箭头；正文前还有一条折叠的「On this page」。
   ![手机上的折叠栏](05-phone-closed.png)

6. 点折叠栏。
   展开完整的文档目录，「Runs and runtimes」高亮，箭头朝上；「How it works」下是 Draft review、Memory、Follow-ups、Workflows，「Using the board」下是 The daily loop、Chat、Agents、Runs and runtimes、Triage、Local and Cloud、Multi-runtime 七项，没有「Releases」和「Triage endpoint」。
   ![展开的目录](06-phone-open.png)

7. 点「Triage」。
   进入 `/docs/triage`，目录自动收起，折叠栏变成「Using the board / Triage」；正文第一句说 Triage 是顶栏铃铛左边的收件箱按钮，有条目等着时变红并带数字。
   ![跳到 Triage 后](07-phone-triage.png)

8. 换回桌面宽度，打开旧地址 `/docs/releases`。
   显示「404 / This page could not be found.」，没有页头、左栏，也没有跳转到别的文档页。
   ![旧的 Releases 地址](08-old-releases-link.png)

## Feedback

- **左栏、翻页、手机目录都顺手**：高亮总在当前页，跳页后从页顶开始，手机上选完目录自己收起，不用再点一下。
- **目录一屏看完**：「How it works」多了 Follow-ups，三组十三项在手机上展开仍在一屏内；「Runs and runtimes」比「Runs and agents」更贴近页里讲的事，但和页标题「Manage runs and runtimes」仍不完全一样。
- **旧链接是死路**：书签或外部文章里的 `/docs/releases` 只给一行 Next 默认的 404，没有页头、没有回文档的链接，也没有一句说明版本功能已去掉；`_redirects` 里也没有转到别处（本地静态构建加 `pages dev` 上看到，线上没核对）。
- **正文链接开新标签页**：文档内部互相引用（如「Multi-runtime support」）也用 `target="_blank"`，读几页就攒一排标签页；左栏和翻页都是原页打开，行为不一致。
- **翻页卡的分组名重复**：前后两张都写「Using the board」，占地方却不提供信息。
- **图标有重复**：「Agents」和「Local and Cloud」用同一个叠层图标，新加的「Follow-ups」和「The daily loop」也用同一个循环箭头，扫一眼分不开。
- **手机上两条折叠栏挨得近**：「Using the board / Runs and runtimes」和「On this page」样式相同，第一次看分不清哪条是换页、哪条是本页小节。
- **没有跑到的**：手机上的「On this page」折叠栏、站内搜索、左栏底部的「Open an issue」。
