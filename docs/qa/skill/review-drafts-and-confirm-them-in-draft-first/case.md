# 让编码 agent 先出草稿，在浏览器里删、批注、导出后确认

## Setup

- **项目**：[把 draft-first 装进项目](../install-draft-first-and-add-your-own-helper/case.md) 之后的同一个仓库：skill 已装好，`.draft-first/helpers/` 里有覆盖的 `copywriting`（只管命令行文案）和新增的 `config-key`。
- **Agent**：真实的 Claude Code（`claude -p`），项目里没有看板。
- **审阅服务**：包未发布，替身 `npx` 把 `npx draft-first@0.1.0 serve` 转到本地包；端口由服务自选。浏览器为无头 Chrome，界面切到中文。

## Steps

1. 对 agent 说「给 mycli 加一个 commit 命令：读暂存区 diff，用 AI 生成 commit message，确认后提交；再加一个设置页（网页）选模型和语言。」
   agent 不写代码，只写 `.draft-first/ai-commit.md` 和三张设置页原型，回复审阅页地址并停下。草稿覆盖竞品对比、两项技术选型、Prompt、命令行文案（用了项目自己的 `copywriting`）、设置页和配置项（用了新增的 `config-key`）。
   [01-agent-drafts.log](01-agent-drafts.log)

2. 打开审阅页。
   顶栏是标题、「待确认」、中文/EN、「导出」和「确认」；正文是摘要和流程图。顶部提示「『生成提交信息的 Prompt』还留着 3 份草稿，删到只剩 1 份再确认」，确认按钮灰掉——三份其实是 Prompt 的示例输出，不是备选（已报 triage）。
   [02-open-review-page.png](02-open-review-page.png)

3. 滚到「设置页」。
   三张原型（默认、保存成功、保存失败）按桌面宽度缩放画在页面里，各带说明。
   [03-mockups.png](03-mockups.png)

4. 删掉「示例 2」和「示例 3」。
   两行变成删除线的「已删除『示例 2（简体中文）』」，各带「撤销」；提示条消失，确认按钮可点。
   [04-delete-two-examples.png](04-delete-two-examples.png)

5. 在「设置页」点「批注」，写「语言下拉框再加上日本語；保存成功的提示 3 秒后自动消失。」，点到别处。
   批注收起成草稿下方的一条灰底注释。
   [05-note-on-a-draft.png](05-note-on-a-draft.png)

6. 展开折叠的「agent 自己定的事 · 7 项」，在「每次只生成一条候选」那行批注「改成一次给 3 条候选，用数字键选。」
   批注挂在这一行下面。
   [06-note-in-agent-half.png](06-note-in-agent-half.png)

7. 点「导出」。
   菜单有「导出图片（整页存成一张长图）」和「导出 HTML 文件（单个文件，发给谁都能直接打开）」。
   [07-export-menu.png](07-export-menu.png)

8. 选「导出 HTML 文件」，把下载的 `ai-commit.html` 放到别的文件夹、断网后打开。
   页面完整显示：顶栏只剩「导出于 2026-10-12」，没有按钮；原型、两条批注都在，删掉的示例不在。
   [08-exported-html.png](08-exported-html.png)

9. 选「导出图片」。
   下载 `ai-commit.png`，一张长图包含整页内容和两条批注，不带「批注」「删除」按钮。
   [09-exported-image.png](09-exported-image.png)

10. 点「确认」。
    顶栏变成「已确认」，绿色横幅「已确认，agent 还没有开始构建」，写明删除了 2 份草稿、写入了 2 条批注，以及合约文件 `.draft-first/ai-commit.md`。
    [10-confirmed.png](10-confirmed.png)

11. 看合约文件的变化。
    `status: confirmed`；两个示例整段删除；两条批注以 `> Note:` 写在对应草稿和那一行下面。
    [11-contract-after-confirm.log](11-contract-after-confirm.log)

12. 对 agent 说「确认好了，继续。」
    agent 按合约写代码，两条批注都照做（`日本語`、提示 3 秒消失、3 条候选）；「数字键选」的终端文案是新冒出的关键部分，它另写了 `ai-commit-pick` 并给出新的审阅地址。
    [12-agent-builds.log](12-agent-builds.log)

## Feedback

- **比 plan mode 好读得多**：原型真的画出来、技术选型有表格和结论，扫一眼就知道要拍板什么。
- **自定义 helper 真的生效**：agent 按项目自己的 `copywriting` 只写了终端文案，并按 `config-key` 写了配置项。
- **示例被当成备选**：Prompt 的三个示例逼着我删掉两个才能确认，合约里的示例也跟着没了；这是这次最大的卡点（已报 triage）。
- **删除、批注、确认都很顺**：撤销就在原地，确认后的横幅说清楚删了几份、写了几条、文件在哪、下一步回 agent 说继续。
- **原型留白太多**：每张原型按设备高度画，表单下面大片空白，三张叠起来要滚很久。
- **agent 的引导有误**：首次回复让我「确认后把状态改掉」，其实点「确认」就行；构建时它在新草稿确认前就先用了草稿文案。
- **首次审阅现在走不通**：包没发布，装好的 skill 第一次起服务会失败，这次靠替身 `npx` 才跑起来。
