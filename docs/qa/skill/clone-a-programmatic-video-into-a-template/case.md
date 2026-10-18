# 用「视频克隆」复刻一条程序化短片：先审原片拆解和复刻脚本，再拿到模板和对比

## Setup

- **项目**：一次性 git 项目，`media/launch.mp4` 是一条用 ffmpeg 画的 6 秒短片（1280×720、30 fps、无声）：藏青底白块 → 橙色从右擦入、一扇浏览器窗口从底部升起 → 叠化到白底藏青横条；`akb install` 新装，删掉 `setup-checklist.md`、自带的 #1 和索引里它那一行后提交。
- **账号**：已登录 Cloud，套餐先是免费版，第 3 步起是 Pro（本地假 Cloud 应答 `/v1/billing`）。
- **Agent**：用本目录的 [stand-in.mjs](stand-in.mjs) 顶替 Claude Code（不花钱）——在 `<project>/.akb/boards/docs/kanban/ui.config.json` 写 `{"harness":"claude-code","harnessSettings":{"claude-code":{"command":"node <路径>/stand-in.mjs <路径>/cli/bin/ai4kanban.mjs"}}}`。它照 `video-cloner` 的 `AGENT.md` 在各节点该做的事动手：规划时写两份草稿并提问；收到确认就勾掉确认项；再规划时换成对比、写模板待办。复刻成片是事先准备好的文件，模板目录里只有 `template.md`。
- **界面**：看板 UI（`kanban-ui`）指向这个项目，浏览器窗口 1440 宽，看板语言中文。

## Steps

1. 执行 `akb workflow list`。
   最后一项是 `video-clone  Video clone  (built-in)  (Pro · locked)  (no worktree)`，简介 `Approve a breakdown and a clone script, get a rendered clone of a reference video and a reusable template, and archive it when you are happy.`；规划由 `video-cloner` 领头，执行无人。
   [01-workflows.log](01-workflows.log)

2. 免费账号下用它建卡：`akb raw create --title '复刻发布短片' --workflow video-clone --body-file body.md`（正文：复刻 `media/launch.mp4` 的节奏和动效，做成以后能放我们自己产品画面的模板），再执行 `akb card refine 2`。
   卡片建成；`refine` 被拒：`Video clone needs Pro.`，退出码 1，没有起运行。
   [02-free-refused.log](02-free-refused.log)

3. 账号升到 Pro 后再执行 `akb card refine 2`。
   返回一次 `refine` 运行。
   [03-pro-refine.log](03-pro-refine.log)

4. 运行结束后看 `akb run log`、卡片和素材目录。
   Agent 读到的 `AGENT.md` 以 `Stage 1 — drafts` 开头；`breakdown.json` 和 `clone.json` 都过了 scriptwriter 的校验（`valid`）。卡片 **todo**、1 个问题：`[user] 原片拆解和复刻脚本可以照这样做模板吗？`（`agent: video-cloner`，推荐「可以，按这两份稿做模板」）。``## By `video-cloner` agent`` 一节只有两个 `<Storyboard>`：「原片拆解」和「复刻脚本」；Todo 一条未勾选的「原片拆解和复刻脚本已确认」。素材目录里还没有成片和模板。`akb raw validate 2` 通过；`akb card implement 2 --print` 被拒：`#2 is finished during planning, so it is archived rather than built.`
   [04-drafts.log](04-drafts.log)

5. 在看板 UI 打开 `/2`。
   顶部「待你决定」列出这个问题和两个选项；「视频克隆」一节展开着，「原片拆解」三镜各带一张源片画面，右侧写动作、旁白和制作说明（标出骨架镜、运动、道具、内容位、转场、声音）；「复刻脚本」三镜写 Tasko 的内容，没有画面。待办 0/1，按钮只有「修订」「移除」。
   ![两份草稿](05-drafts-on-card.png)

6. 执行 `akb card resolve 2 '可以，按这两份稿做模板'`，等它跑完。
   起一次 `resolve` 运行，结束后看板自己接着起一次 `clarify`，两次都完成。
   [06-approve.log](06-approve.log)

7. 看 `akb run log`、卡片和素材目录。
   卡片没有问题，Todo 两条都已勾选（多了「模板 `<绝对路径>/template`，渲染命令 `…`」）；两个 `<Storyboard>` 换成一个 `<Compare>`（源片 vs 复刻，`shots` 取自 `breakdown.json` 的三镜）和一条按镜号写的差异；`clone.json` 删了，`breakdown.json` 留着。`akb raw validate 2` 通过。回话以「满意的话请把 #2 归档。」结束。
   **未通过**：回话后面多了一句看板自己的 `#2 is still in To do after planning, and the board won't plan it again on its own — refine it again, or mark it ready yourself.`，卡片已是 ready、交付已齐，这句话是错的。
   [07-template.log](07-template.log)

8. 在看板 UI 打开 `/2`，展开「视频克隆」一节。
   只有「源片 vs 复刻」：两段片上下并列，左上角标「源片」「复刻」，下面一个共用播放条分三段，显示「S1 / 3 · Logo 静置」和 `0:00 / 0:06`；下面一行差异「S2：窗口里的产品界面是按截图重画的，不是原图。」卡片上没有单独的复刻成片。
   ![对比](08-compare.png)

9. 看卡片页顶部的按钮。
   应该出现「归档」。**未通过**：只有「细化」「修订」「移除」，标题旁是「可以开始执行」。按看板 UI 自己的规则（`planDeliveryGap`）算，这张卡缺 `deliverable`——它只认 `<Asset>` 里的视频，不认 `<Compare>`；在 `<Compare>` 前补一个复刻成片的 `<Asset>`，「归档」就出现、「细化」消失。
   ![按钮](09-buttons.png)
   [09-buttons.log](09-buttons.log)（[buttons.mjs](buttons.mjs)）

## Feedback

- **先审稿再出片，方向对了**：第一次规划就停在两份草稿上，原片拆解带源片画面、每镜写清骨架和内容位，复刻脚本只讲自己的内容；在花时间做模板前就能指出哪一镜不对。
- **卡片做完却归档不了**：按 `AGENT.md` 卡上只留 `<Compare>`，看板却仍把它当成没交付——卡片页没有「归档」，反而给「细化」，徽标还写「可以开始执行」；最后一轮回话也说卡片「still in To do」。用户只能自己 `akb card archive 2`，或去看懂为什么没按钮。
- **选项里夹着英文**：中文看板上问题的第三个选项是「Something else — I'll type it」。
- **证据的局限**：Agent 是替身，草稿、对比和差异都由脚本写成；这里验证的是看板对两阶段流程的处理（提问、确认、再规划、按钮），不是真实 `video-cloner` 拆片和做模板的质量。
- **没有跑到的**：真实 Agent 的两轮规划和渲染；回答「要改」让草稿就地改；换内容后重出片；模板删一拍、改标语后重渲染；归档。
