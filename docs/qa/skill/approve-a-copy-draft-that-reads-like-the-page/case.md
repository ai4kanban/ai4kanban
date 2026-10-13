# 在卡片上读文案草稿，像读页面本身一样

## Setup

- **项目**：一次性 git 项目，有英文首页 `app/page.tsx` 和中文首页 `app/zh/page.tsx`：`metadata` 里有标题和描述，正文是一封用 `<p className=…>`、`&apos;`、`&mdash;` 写成、逐段罗列功能和价格、以「Ledgerly 团队」落款的欢迎信（约 8 段）；`akb install` 新装，删掉 `setup-checklist.md` 和自带的 #1 后提交。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`），看板默认的 Coding 工作流，界面语言中文。
- **界面**：看板 UI（`kanban-ui`）指向这个项目，浏览器窗口 1440×900。
- **终端**：在项目目录里；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb create "Rewrite the welcome letter on the home page (app/page.tsx, and its Chinese version app/zh/page.tsx) so it reads like one freelancer writing to another, not a feature list. Update the page titles and descriptions to match."`。
   立即返回一次 `create` 运行；结束后新卡 #2 问两件事：信里还提不提价格和试用、信由谁落款。
   [01-create.log](01-create.log)

2. 执行 `akb card resolve 2 "价格：选 1，只轻提一句免费试用。落款：选 1，署名 Mia Chen，自由设计师，做了八年。"`。
   返回一次 `resolve` 运行。
   [02-resolve.log](02-resolve.log)

3. 运行结束后执行 `akb run list`。
   `resolve #2` 里自己请了文案 Agent（`akb spec copywriting 2`），不必再开口要草稿；已没有在跑的运行。
   [03-runs.log](03-runs.log)

4. 看卡片 #2 的 `## By \`copywriting\` agent` 一节和资产文件夹。
   这一节只有一句说明、一个 `<Asset src=".assets/2/copy.en.md" label="首页文案" variants='{"English": …, "中文": …}' />` 和两条 Notes；信本身不在卡片上，而在 `copy.en.md`、`copy.zh.md`（各 24 行）里：纯文本、没有标签和转义，按页面分节，`Title:` / `Description:`（中文为「标题：」「描述：」）各占一行，署名 Mia Chen；唯一的问题请你批准或退回这份文案。
   [04-card.log](04-card.log)

5. 把 `<Asset>` 的 `src` 改成不在 `variants` 里的 `.assets/2/copy.fr.md`，执行 `akb raw validate 2`；再改回原样重跑。
   报 `[mockup-variants] src=".assets/2/copy.fr.md" is not one of the variants.`，退出码 1；改回后 `Spec format valid`。
   [05-validate.log](05-validate.log)

6. 在看板 UI 打开 `/2`，滚到「文案与文档」一节。
   草稿按文章排版、折叠，下方是「展开全文」；标题行左侧是「首页文案」和带边框的版本按钮「English 2 ⌄」，右侧是「原文」、复制绝对路径、查看原尺寸和下载图标。
   ![英文版](06-asset.png)
   [标题行和文章开头](06-asset.log)
   **未通过**：`Title:` 和 `Description:` 两行在文章里连成了一段（Markdown 把相邻两行并成一行），读起来像一句话；原文件里是分开的两行。

7. 点版本按钮。
   菜单按书写顺序列出 English、中文，English 后面打勾；数字徽标提示「共 2 个版本」。
   ![版本菜单](07-menu.png)
   [菜单项](07-menu.log)

8. 选「中文」。
   按钮变成「中文 2」，文章换成中文首页的信，下载的文件名随之变成 `copy.zh.md`。
   ![中文版](08-zh.png)
   [切换后的状态](08-zh.log)

## Feedback

- **卡片短了，信更好读**：整封信不再塞在卡片里，卡片上只剩说明和 Notes；点开就是排好版的一封信，判断「像不像同行写的」读一遍就够。
- **一个标签装下两种语言**：中英两版收进一个版本按钮，切换后对照着读很顺手，不用在卡片上上下翻两份。
- **这次不用自己开口要草稿**：回答两个问题后，规划直接请了文案 Agent，草稿当场就在卡片上。
- **元数据读着别扭**：标题和描述在原文件里各占一行，排版后却连成一段，得点「原文」才分得清两行；文案 Agent 若用列表或空行分开就不会这样。
- **草稿默认折叠**：信只露出前四五段，读到署名要先点「展开全文」。
- **没有跑到的**：零星改几个词时的 ~~旧句~~ → 新句 写法；20 行以内仍放代码块的短草稿；新页面；「原文」、复制路径、查看原尺寸、下载这几个图标的实际效果；批准后构建把文案写回两个 `page.tsx`。
