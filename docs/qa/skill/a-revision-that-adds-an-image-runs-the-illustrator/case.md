# 改版时给一张已规划好的卡加一张图，改版当场请配图画出来

## Setup

- **项目**：一次性 git 项目，一个静态首页 `index.html`（Ledgerly，发票工具，藏青配橙色）和 `style.css`；`akb install` 新装，删掉 `setup-checklist.md`、自带的 #1 和索引里它那一行后提交。
- **卡片**：#2「Add an FAQ to the home page」已规划好、状态 **ready**：三条 FAQ 问答写在 `## Scope` 里，两条待办，没有任何 spec agent 的一节。改版前的卡片是 [01-card-before.md](01-card-before.md)。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`），看板默认的 Coding 工作流，看板语言英文。
- **界面**：看板 UI（`kanban-ui`）指向这个项目，浏览器窗口 1440×900。
- **终端**：日志里的 `akb` 就是这次构建出的命令（Agent 的 shell 里也是它）。

## Steps

1. 执行 `akb card revise 2 'Put an illustration above the FAQ: an invoice going from created to sent to paid, in three steps.'`。
   立即返回一次 `edit` 运行，打印跟踪、停止它的两条命令。
   [02-revise.log](02-revise.log)

2. 运行结束后（1 分 36 秒，$0.72）看 `akb run log`。
   Agent 读完卡片先说「next I'll run the `illustrator` spec agent for the new image」，接着执行 `akb spec illustrator 2 …`，在本次会话里画出 SVG、渲染预览自查并修了两处重叠；回话说卡片从 ready 退回 todo，等用户认可这张图。
   [03-run-log.log](03-run-log.log)

3. 看 `akb raw list`、卡片和资产文件夹。
   #2 变成 **todo**、1 个问题：`[user]` 问这张图行不行（`agent: illustrator`，推荐「Approve it」）。卡片多了 ``## By `illustrator` agent``：一个 `<Asset src=".assets/2/illus-invoice-steps.tsx" label="Invoice in three steps" …/>` 和两条未勾选的确认项；开头一段补上了这张图；`## Scope` 多一条「Illustration」，`## Todo` 多一条「Copy the approved illustration into `#faq` as an inline SVG」，原有两条没动。资产文件夹里只有 `illus-invoice-steps.tsx`；`akb raw validate 2` 通过。
   [04-card-after.log](04-card-after.log)

4. 在看板 UI 打开 `/2`，展开「Illustrator」一节。
   图就在卡片上：三个藏青描边的图标（带笔的空白发票 → 信封 → 打了橙色勾的发票），箭头相连，下面「1. Created / 2. Sent / 3. Paid」和一行说明；下面是两个确认勾选框。
   ![卡片上的配图](05-illustration-on-card.png)

## Feedback

- **说要图，就真的有图**：一句话的改版，1 分半钟后卡片上就是一张能看的图和一个「行不行」的问题，不再是 `## Scope` 里一段「将来画一张图」的文字。
- **退回 todo 说得清楚**：回话第一句就说卡片不再是 ready、等认可这张图，没有让人误以为可以直接开发。
- **图框留白太多**：预览框远高于图本身，图下面空着一大块灰底，要往下滚才看到确认项。
- **Agent 又去翻 akb 的源码**：画图前它在 `akb` 的安装目录里 `grep` `<Asset` 的写法和 `ui-designer` 的参考文件；结果对，但运行日志里这几步用户看不懂。
- **没有跑到的**：改版改的是页面文案或界面时请 `copywriting`、`ui-designer`；回答「Approve it」之后卡片回到 ready。
