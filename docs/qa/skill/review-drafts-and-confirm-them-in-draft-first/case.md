# 让编码 agent 先出草稿，在浏览器里删、批注、导出后确认

## Setup

- **项目**：[把 draft-first 装进项目](../install-draft-first-and-add-your-own-helper/case.md) 之后的同一个仓库：skill 已装好，`.draft-first/helpers/` 里有覆盖的 `copywriting`（只管命令行文案）和新增的 `config-key`。
- **Agent**：真实的 Claude Code（`claude -p`），项目里没有看板。
- **审阅服务**：包未发布，替身 `npx` 把 `npx draft-first@0.1.0 serve` 转到 [ai4kanban/draft-first](https://github.com/ai4kanban/draft-first) 克隆下来的 `bin/draft-first.mjs`；端口由服务自选。浏览器为无头 Chrome，界面切到中文。

## Steps

1. 对 agent 说「给 mycli 加一个 commit 命令：读暂存区 diff，用 AI 生成 commit message，确认后提交；再加一个设置页（网页）选模型和语言。生成 commit message 的 Prompt 要写完整，分小节写清角色、规则和输出格式。」
   agent 不写代码，只写 `.draft-first/commit-command.md`、三张设置页原型和一份 `.md` 资源里的 Prompt，回复审阅页地址并停下。草稿覆盖竞品对比、技术选型、配置项（用了新增的 `config-key`）、Prompt、命令行文案（用了项目自己的 `copywriting`）和设置页。
   [01-agent-drafts.log](01-agent-drafts.log)

2. 打开审阅页。
   顶栏是标题、「待确认」、中文/EN、「导出」和「确认」；正文是摘要和流程图，确认可点。
   [02-open-review-page.png](02-open-review-page.png)

3. 滚到「生成 commit message 的 Prompt」。
   `.md` 资源按 Markdown 画出来（文件名一行、diff 代码块、一句理由），下面是「备选：Conventional Commits」。主方案没有「删除」「批注」，只能删备选。
   [03-prompt-as-a-diff.png](03-prompt-as-a-diff.png)

4. 滚到「设置页」。
   三张原型（默认、保存成功、保存失败）按桌面宽度缩放画在页面里，各带说明，合为一份草稿。
   [04-mockups.png](04-mockups.png)

5. 对 agent 说「Prompt 那份草稿是 diff，不好读：直接写出 prompt 正文，让我看到渲染后的样子，小节用 ### 标题。Conventional Commits 那个备选现在删不掉主方案，改成两份都能删的草稿。」
   agent 把 Prompt 拆成两份草稿「方案 A」「方案 B」，各自的正文放进 `.draft-first/.assets/commit-command/` 下的 `.md`，每份里有 4 个 `###` 小节。
   [05-agent-rewrites-prompt.log](05-agent-rewrites-prompt.log)

6. 回到审阅页（不用刷新）。
   顶部提示「『生成 commit message 的 Prompt』还留着 2 份草稿，删到只剩 1 份再确认」，确认按钮灰掉——只数两份草稿，资源里的 8 个 `###` 不算备选。
   [06-two-prompt-drafts.png](06-two-prompt-drafts.png)

7. 看「生成 commit message 的 Prompt」。
   两份草稿各是一整段渲染好的 Markdown：Role、Input、Rules、Output format 是小标题，规则是列表；每份草稿只有一组「批注」「删除」。
   [07-prompt-in-md-assets.png](07-prompt-in-md-assets.png)

8. 删掉「方案 B」。
   变成删除线的「已删除『方案 B：Conventional Commits』」，带「撤销」；提示条消失，确认按钮可点。
   [08-delete-plan-b.png](08-delete-plan-b.png)

9. 在「设置页」点「批注」，写「语言下拉框再加上日本語；保存成功的提示 3 秒后自动消失。」，点到别处。
   批注收起成草稿下方的一条灰底注释。
   [09-note-on-a-draft.png](09-note-on-a-draft.png)

10. 展开折叠的「agent 自己定的事 · 8 项」，在「被排除的 lockfile……diff 不截断」那行批注「diff 超过 2000 行时截断，并在终端提示截断了。」
    批注挂在这一行下面。
    [10-note-in-agent-half.png](10-note-in-agent-half.png)

11. 点「导出」。
    菜单有「导出图片（整页存成一张长图）」和「导出 HTML 文件（单个文件，发给谁都能直接打开）」。
    [11-export-menu.png](11-export-menu.png)

12. 选「导出 HTML 文件」，把下载的 `commit-command.html` 放到别的文件夹、断网后打开。
    页面完整显示：顶栏只剩「导出于 2026-10-13」，没有按钮；方案 A 的 Prompt 照样是渲染好的 Markdown，原型和两条批注都在，方案 B 不在。
    [12-exported-html.png](12-exported-html.png)

13. 选「导出图片」。
    下载 `commit-command.png`，一张长图包含整页内容、渲染好的 Prompt 和两条批注，不带「批注」「删除」按钮。
    [13-exported-image.png](13-exported-image.png)

14. 点「确认」。
    顶栏变成「已确认」，绿色横幅「已确认，agent 还没有开始构建」，写明删除了 1 份草稿、写入了 2 条批注，以及合约文件 `.draft-first/commit-command.md`。
    [14-confirmed.png](14-confirmed.png)

15. 看合约文件。
    `status: confirmed`；Prompt 一节只剩「方案 A」和它的 `<Asset>`；两条批注以 `> Note:` 写在设置页原型和那一行下面。
    [15-contract-after-confirm.log](15-contract-after-confirm.log)

16. 对 agent 说「确认好了，继续。」
    agent 按合约写代码：`src/prompts/commit-message.md` 用的是方案 A 的规则，保存提示 3 秒消失，`日本語` 本来就在语言列表里；「diff 截断」要加终端提示和 Prompt 规则，它另写了 `diff-truncation` 草稿并给出新的审阅地址。
    [16-agent-builds.log](16-agent-builds.log)

## Feedback

- **`.md` 资源里的长 Prompt 好读了**：小标题、列表都渲染出来，导出后也一样；里面的 `###` 不再被当成备选，确认不会被卡住。
- **备选写法容易写歪**：agent 第一次把主方案写在 `###` 之外、只给备选加 `###`，页面把主方案当成引言，删不掉，只能删备选；要我点明才改成两份草稿。
- **Prompt 起初写成 diff**：新建文件也是一整块 `+` 行，看着累；改成正文后才像在审 Prompt。
- **删除、批注、确认都很顺**：撤销就在原地，页面随文件改动自己刷新，确认后的横幅说清楚删了几份、写了几条、文件在哪。
- **原型留白太多**：每张原型按设备高度画，表单下面大片空白，三张叠起来要滚很久。
- **表格首列被挤窄**：竞品对比的第一列只有一个字宽，「读哪些改动」竖着排。
- **agent 的引导有误**：两次回复都让我「把状态改为确认」，其实点「确认」就行。
- **首次审阅现在走不通**：包没发布，装好的 skill 第一次起服务会去拉 npm 并失败，这次靠替身 `npx` 才跑起来。
- **没有跑到的**：第二份草稿 `diff-truncation` 的审阅；英文界面；agent 写的代码没有真正调用 Claude（本机无 API 凭据）；Codex 等其他 agent。
