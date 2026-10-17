# 让文案 Agent 改两个页面：整页重写的给全文，只改一句的给 diff

## Setup

- **项目**：一次性 git 项目，有两个页面，各有中英文版：首页 `app/page.tsx`、`app/zh/page.tsx`（逐条罗列功能和价格、以「Ledgerly 团队」落款）和价格页 `app/pricing/page.tsx`、`app/zh/pricing/page.tsx`（两个方案，结尾一句试用说明），每页的 `metadata` 都有标题和描述，正文用 `&mdash;`；`akb install` 新装，删掉 `setup-checklist.md`、自带的 #1 和索引里它那一行后提交。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`），看板默认的 Coding 工作流，界面语言中文。
- **界面**：看板 UI（`kanban-ui`）指向这个项目，浏览器窗口 1440 宽。
- **终端**：在项目目录里；日志里的 `akb` 就是这次构建出的命令（Agent 的 shell 里也是它）。

## Steps

1. 执行 `akb create 'One card: rewrite the home page (app/page.tsx, app/zh/page.tsx) so it reads like one freelancer writing to another, not a feature list, title and description included; and on the pricing page (app/pricing/page.tsx, app/zh/pricing/page.tsx) rewrite only the closing trial line in the same voice, leaving the plans as they are. Show me the copy to approve before anything is built.'`。
   立即返回一次 `create` 运行，打印跟踪、停止它的两条命令。
   [01-create.log](01-create.log)

2. 运行结束后（2 分 6 秒，$0.84）看 `akb raw list`、卡片 #2 的 ``## By `copywriting` agent`` 一节和资产文件夹。
   #2 状态 `todo`，一个问题：文案可不可以用（`agent: copywriting`）。这一节每页一个 `<Asset>`（「首页」「价格页」，中英文作 variants），资产文件夹里四个文件：`home.en.md`、`home.zh.md` 各是一句 ``` `app/page.tsx` — full source ``` 加整份 `tsx` 源码，标题、描述、正文全在里面；`pricing.en.md`、`pricing.zh.md` 各是文件路径加一个 `diff` 代码块，只有结尾那句一删一加，上面带着专业版那一段做上下文。
   [02-card.log](02-card.log)

3. 看这次运行里 Agent 敲过的命令。
   同一个会话里建卡、`akb card refine 2 --print`，然后写稿；稿子先写进了 `docs/kanban/todo/.assets/2/`，Agent 去翻 `akb` 的源码找真正的资产目录 `.akb/boards/docs/kanban/assets/2/`，再搬过去。
   [03-run.log](03-run.log)

4. 在看板 UI 打开 `/2`，展开「文案与文档」。
   「首页」一块：路径 `app/page.tsx` — full source，下面是带语法高亮的整份源码，折叠着，底部「展开全文」。「价格页结尾试用句」一块：路径 `app/pricing/page.tsx`，下面的 diff 里删掉的一行红底、加上的一行绿底，其余是上下文。
   ![两种稿子](04-drafts.png)

5. 点价格页的版本按钮「English 2」，选「中文」。
   只有价格页换成 `app/zh/pricing/page.tsx` 的 diff（「所有方案均可免费试用 14 天，随时取消。」→「两个方案都能先免费用 14 天。不合适就取消，不用不好意思。」），首页仍是英文。
   ![价格页切到中文](05-pricing-zh.png)

6. 执行 `akb card resolve 2 'A'`（按草稿通过）。
   返回一次 `resolve` 运行。
   [06-resolve.log](06-resolve.log)

7. 33 秒后（$0.16）看回话和卡片。
   卡片 **ready**，「用户确认文案」那条待办已勾，Scope 多一条「四个文件的改动逐字照确认稿」；四份稿子原样留在卡片上，没有再请界面设计师出页面稿——回话说「确认稿本身就是完整源码，所以确认稿就是最终稿」。口吻记进了 `memory/agents/copywriting/writing.md`。
   [07-resolved.log](07-resolved.log)

## Feedback

- **改多少就给多少**：首页整页重写，给的是能直接替换的整份源码；价格页只动一句，diff 一眼就看到改了哪句、别的没动。审价格页比读一整页快得多。
- **diff 在卡片上读得清楚**：红绿底、上下文行都在，切中文也是同一个 diff 版式。
- **全文稿是源码，不是文章**：首页那块是 `tsx`，标签、`&ldquo;`、`&rsquo;` 都在，读文案要隔着代码；以前「像读页面一样」的排版没了。
- **确认后少了一轮**：因为稿子就是源码，resolve 不再请界面设计师出页面稿，卡片直接 ready，省了一次运行。
- **自作主张改了事实措辞**：首页去掉了 PayPal、把「工作室版」改成「专业版」，都写进了 `Worth noting`，看得到也改得了。
- **Agent 找资产目录又走了弯路**：先写进 `docs/kanban/todo/.assets/`，再翻 `akb` 的源码找真正的位置。
- **记忆落点奇怪**：除了 copywriting 自己的 `writing.md`，还新建了 `memory/agents/planner/site/decisions.md`。
- **没有跑到的**：真正的 `.md` / `.mdx` 页面；没有源文件的文字（如应用商店介绍）；按确认稿开发。
