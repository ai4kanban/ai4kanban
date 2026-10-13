# 在卡片上读文案草稿，像读页面本身一样

## Setup

- **项目**：一次性 git 项目，有英文首页 `app/page.tsx` 和中文首页 `app/zh/page.tsx`：`metadata` 里有标题和描述，正文是一封用 `<p className=…>`、`&apos;`、`&mdash;` 写成、逐段罗列功能和价格、以「Ledgerly 团队」落款的欢迎信（约 8 段）；`akb install` 新装，删掉 `setup-checklist.md`、自带的 #1 和索引里它那一行后提交。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`），看板默认的 Coding 工作流，界面语言中文。
- **界面**：看板 UI（`kanban-ui`）指向这个项目，浏览器窗口 1440×900。
- **终端**：在项目目录里；日志里的 `akb` 就是这次构建出的命令（Agent 的 shell 里也是它）。

## Steps

1. 执行 `akb create "Rewrite the welcome letter on the home page (app/page.tsx, and its Chinese version app/zh/page.tsx) so it reads like one freelancer writing to another, not a feature list. Update the page titles and descriptions to match."`。
   立即返回一次 `create` 运行，打印跟踪、停止它的两条命令。
   [01-create.log](01-create.log)

2. 运行结束后（约一分半）看 `akb raw list`、卡片 #2 的 `## By \`copywriting\` agent` 一节和资产文件夹。
   #2 状态 `todo`，只有一个问题：信由谁署名（标着 `agent: copywriting`）。这一节只有一个 `<Asset src=".assets/2/copy.en.md" label="欢迎信文案" variants='{"English": …, "中文": …}' />` 和两条中文 Notes；信在 `copy.en.md`、`copy.zh.md`（各 24 行）里：每种语言一个文件，纯文本、没有标签和转义，`Title:`、`Description:` 各成一段，中文文件里的字段名和小标题也是中文（「标题：」「描述：」「大标题：」「信件」），署名处留着 `{signature}` / `{署名}`。
   [02-card.log](02-card.log)

3. 打开这次运行的 Claude Code 会话记录（`~/.claude/projects/<项目>/<run id>.jsonl`）看命令。
   建卡后同一个会话里依次 `akb card refine 2 --print`、`akb spec copywriting 2 … --print`，然后写文案；文案先写进了 `docs/kanban/todo/.assets/2/`，Agent 翻了打包后的 `kanban.mjs` 才找到真正的资产目录 `.akb/boards/docs/kanban/assets/2/`，再搬过去。
   [03-session-commands.log](03-session-commands.log)

4. 执行 `akb card resolve 2 "A，署名 Mia Chen，自由设计师，做了八年。"`。
   返回一次 `resolve` 运行。
   [04-resolve.log](04-resolve.log)

5. 半分钟后看这次运行的回话、`akb raw list` 和两份文案的结尾。
   问题已关闭，卡片标为 **ready**；两份文案的署名换成 Mia Chen 和她的身份，正文补了一句「做了八年自由设计师」；「署名待定」那条 Note 被删掉。没有另外再问「这份文案可以用吗」：后面没有接手的 Agent，文案就是最终稿。
   [05-resolve-result.log](05-resolve-result.log)

6. 把 `<Asset>` 的 `src` 改成不在 `variants` 里的 `.assets/2/copy.fr.md`，执行 `akb raw validate 2`；再改回原样重跑。
   报 `[mockup-variants] src=".assets/2/copy.fr.md" is not one of the variants.`，退出码 1；改回后 `Spec format valid`。
   [06-validate.log](06-validate.log)

7. 在看板 UI 打开 `/2`，展开「文案与文档」一节。
   草稿按文章排版、折叠，下方是「展开全文」；标题行左侧是「欢迎信文案」和版本按钮「English 2 ⌄」，右侧是「原文」、复制绝对路径、查看原尺寸和下载图标；`Title:` 和 `Description:` 是两段，分得清。
   ![英文版](07-asset.png)
   [标题行和文章开头](07-asset.log)

8. 点版本按钮。
   菜单按书写顺序列出 English、中文，English 后面打勾；数字徽标提示「共 2 个版本」。
   ![版本菜单](08-menu.png)
   [菜单项](08-menu.log)

9. 选「中文」。
   按钮变成「中文 2」，文章换成中文首页的信，字段名是「标题：」「描述：」，下载的文件名随之变成 `copy.zh.md`。
   ![中文版](09-zh.png)
   [切换后的状态](09-zh.log)

## Feedback

- **一句话到文案草稿只要一轮**：建卡、细化、文案在同一次 `create` 里完成，卡片上只等一个真正要我拍板的问题（署名），答完就 ready。
- **元数据终于分得清**：`Title:`、`Description:` 各成一段，排版后不再连成一句；中文版连字段名都是中文，对照读不会在两种语言之间跳。
- **一个标签装下两种语言**：中英两版收进一个版本按钮，切换后对照着读很顺手。
- **落款仍挤成一行**：「Here's to getting paid on time, / Mia Chen / Freelance designer…」三行在文章里并成一段，要点「原文」才看出是分行写的。
- **Agent 找资产目录走了弯路**：文案先写进 `docs/kanban/todo/.assets/`，再去读打包后的源码找真正的位置；结果对，但多花了时间和钱（这轮 $0.69），用户在运行日志里会看到一串看不懂的 `sed -n … kanban.mjs`。
- **草稿默认折叠**：信只露出前几段，读到署名要先点「展开全文」。
- **没有跑到的**：零星改几个词时的 ~~旧句~~ → 新句 写法；新页面；后面接 `ui-designer` 时的两阶段确认；「原文」、复制路径、查看原尺寸、下载这几个图标的实际效果；构建把文案写回两个 `page.tsx`。
