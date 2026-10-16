# 在卡片上读文案草稿，像读页面本身一样

## Setup

- **项目**：一次性 git 项目，有两个页面，各有中英文版：首页 `app/page.tsx`、`app/zh/page.tsx`（逐条罗列功能和价格、以「Ledgerly 团队」落款的欢迎信）和价格页 `app/pricing/page.tsx`、`app/zh/pricing/page.tsx`（两个方案），每页的 `metadata` 都有标题和描述，正文用 `&apos;`、`&mdash;`；`akb install` 新装，删掉 `setup-checklist.md`、自带的 #1 和索引里它那一行后提交。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`），看板默认的 Coding 工作流，界面语言中文。
- **界面**：看板 UI（`kanban-ui`）指向这个项目，浏览器窗口 1440×900。
- **终端**：在项目目录里；日志里的 `akb` 就是这次构建出的命令（Agent 的 shell 里也是它）。

## Steps

1. 执行 `akb create "Rewrite the home page (app/page.tsx) and the pricing page (app/pricing/page.tsx), and their Chinese versions under app/zh/, so they read like one freelancer writing to another, not a feature list. Update the page titles and descriptions to match."`。
   立即返回一次 `create` 运行，打印跟踪、停止它的两条命令。
   [01-create.log](01-create.log)

2. 运行结束后（约三分钟，$0.80）看 `akb raw list`、卡片 #2 的 `## By \`copywriting\` agent` 一节和资产文件夹。
   #2 状态 `todo`，只有一个问题：文案可不可以用、署名写谁（标着 `agent: copywriting`）。这一节每页一个标签：`<Asset src=".assets/2/home.en.md" label="Home" variants='{"English": …, "中文": …}' />` 和 `<Asset src=".assets/2/pricing.en.md" label="Pricing" …/>`，下面两条中文 Notes；资产文件夹里是 `home.en.md`、`home.zh.md`、`pricing.en.md`、`pricing.zh.md` 四个文件：纯文本、没有标签和转义，`Title:`、`Description:` 各成一段，中文文件里是「标题：」「描述：」。
   [02-card.log](02-card.log)

3. 看这次运行里 Agent 敲过的命令。
   同一个会话里先建卡、`akb spec copywriting 2 …`，然后写文案；文案先写进了 `docs/kanban/todo/.assets/2/`，Agent 去翻 `akb` 的源码找真正的资产目录 `.akb/boards/docs/kanban/assets/2/`，再搬过去。
   [03-session-commands.log](03-session-commands.log)

4. 把 Pricing 那个 `<Asset>` 的 `src` 改成不在 `variants` 里的 `.assets/2/pricing.fr.md`，执行 `akb raw validate 2`；再改回原样重跑。
   报 `[mockup-variants] src=".assets/2/pricing.fr.md" is not one of the variants. Set src to the version shown first.`，退出码 1；改回后 `Spec format valid (1 card).`，退出码 0。
   [04-validate.log](04-validate.log)

5. 在看板 UI 打开 `/2`，看「文案与文档」一节。
   「Stage 1 — copy」下是两块草稿，各有自己的标题行：左侧标签「HOME」「PRICING」和各自的版本按钮「English 2 ⌄」，右侧「原文」、复制路径、放大、下载；草稿按文章排版，`Title:`、`Description:` 各成一段；首页那块较长，折叠着，下方「展开全文」。
   ![两页草稿](05-two-drafts.png)

6. 点 PRICING 的版本按钮。
   菜单列出 English、中文，English 后面打勾。
   ![版本菜单](06-pricing-menu.png)

7. 选「中文」。
   只有价格页换成中文（「中文 2」，「标题：价格 — Ledgerly」「描述：…」），首页仍是英文。
   ![价格页切到中文](07-pricing-zh.png)

8. 执行 `akb card resolve 2 "A"`（按草稿通过，署名「Ledgerly 创始人」）。
   返回一次 `resolve` 运行。
   [08-resolve.log](08-resolve.log)

9. 约一分钟后（$0.35）看这次运行的回话、`akb raw list` 和卡片。
   卡片标为 **ready**，「确认文案」那条待办已打勾，`Worth noting` 多出一条「谁在说话」。同一次运行里 `ui-designer` 接着出了页面稿：卡片上多了 ``## By `ui-designer` agent``，首页、价格页各一个 `<Asset>`（`home-en.tsx`/`home-zh.tsx`、`pricing-en.tsx`/`pricing-zh.tsx`，中英文作 variants）；四个 `.md` 草稿被删掉，`copywriting` 一节只剩一句「文案已确认……都在下方 `ui-designer` 的页面稿里」和 PayPal 那条备注。
   [09-resolve-result.log](09-resolve-result.log)

10. 回看板 UI 刷新 `/2`，展开「文案与文档」和「界面设计师」。
    文案一节只剩说明；下面是「首页」「价格页」两张桌面页面稿，各带「English 2 ⌄」，正文就是刚确认的文案。
    ![确认后的页面稿](10-pages.png)

第 5～7 步的截图是在第 8 步之后补拍的：用同一项目的副本，把卡片和四个草稿文件恢复成第 2 步记下的内容（[02-card.log](02-card.log)），其余照原样。

## Feedback

- **一页一块，审起来顺手多了**：首页和价格页各占一块，各自切语言，读完一页再读下一页；不再是一整份文件里上下翻找哪段属于哪页。
- **元数据分得清**：`Title:`、`Description:` 各成一段，中文版字段名也是中文。
- **标签没跟看板语言走**：卡片其余部分都是中文，草稿标签却是「HOME」「PRICING」；到了页面稿才变成「首页」「价格页」。
- **确认后草稿就没了**：通过文案后，`.md` 草稿被页面稿取代并删除；页面稿里看不到 `Title:`、`Description:`，想回头核对标题和描述只能去翻日志。
- **Agent 找资产目录又走了弯路**：先写进 `docs/kanban/todo/.assets/`，再去读 `akb` 的源码找真正的位置；结果对，但用户在运行日志里会看到一串看不懂的 `grep`。
- **没有跑到的**：零星改几个词时的 ~~旧句~~ → 新句 写法；新页面；构建把文案写回四个 `page.tsx`。
