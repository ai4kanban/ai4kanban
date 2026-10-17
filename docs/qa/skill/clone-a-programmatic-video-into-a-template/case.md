# 用「视频克隆」把一条程序化短片复刻成模板，再换上自己的内容

## Setup

- **项目**：一次性 git 项目，`media/launch.mp4` 是一条用 ffmpeg 画的 6 秒短片（1280×720、30 fps、无声）：藏青底白块 → 橙色从右擦入、一扇 macOS 浏览器窗口从底部升起（里面是示意仪表盘） → 叠化到白底藏青横条；`akb install` 新装，删掉 `setup-checklist.md`、自带的 #1 和索引里它那一行后提交。产品截图（`inbox.png`、`report.png`，一个叫 Tasko 的待办应用）先不放进项目。
- **账号**：已登录 Cloud，套餐先是免费版，第 3 步起是 Pro（本地假 Cloud 应答 `/v1/billing`）。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`），界面语言中文。
- **界面**：看板 UI（`kanban-ui`）指向这个项目，浏览器窗口 1440 宽。

## Steps

1. 执行 `akb workflow list`。
   最后一项是 `video-clone  Video clone  (built-in)  (Pro · locked)  (no worktree)`，规划由 `video-cloner` 领头，执行无人。
   [01-workflows.log](01-workflows.log)

2. 免费账号下用它建卡：`akb raw create --title '复刻发布短片' --workflow video-clone --body-file body.md`（正文：复刻 `media/launch.mp4` 的节奏和动效，做成以后能放我们自己产品画面的模板），再执行 `akb card refine 2`。
   卡片建成；`refine` 被拒：`Video clone needs Pro.`，退出码 1，没有起运行。
   [02-free-refused.log](02-free-refused.log)

3. 账号升到 Pro 后再执行 `akb card refine 2`。
   返回一次运行，领头的是 `video-cloner`。
   [03-pro-refine.log](03-pro-refine.log)

4. 运行结束后（9 分 34 秒，$2.80）看回话、卡片和模板。
   没有问用户要内容：卡片 **todo**、没有问题，Todo 只有一条已勾选的「模板 `<绝对路径>/template`，渲染命令 `npx --yes hyperframes@0.8.169 render -f 30 -o ../clone.mp4`」；``## By `video-cloner` agent`` 一节是复刻成片、源片对比和按 S1–S3 写的差异。成片里 Logo、品牌色、产品界面和标语都是标好的占位。模板 `template.md` 开头写明只复刻拍法（节拍、擦入、窗口缓出升起、叠化、布局、各颜色的角色），不带源片的任何内容，`content.js` 里全是要换成自己的占位，`index.html` 只放拍法和道具。浏览器窗口作为道具存进了 `memory/agents/video-cloner/props/`。回话最后一句是「你看过没问题的话，请把 #2 归档」；`akb card implement 2 --print` 被拒。
   [04-planned.log](04-planned.log)

5. 把两张截图放进 `media/product/` 并提交，执行 `akb card revise 2 '换成我们自己的内容：产品画面用 media/product/inbox.png 和 media/product/report.png 两张截图；没有 Logo 图片，Logo 位写 Tasko；标语：Plan less. Ship more.'`。
   返回一次 `edit` 运行。
   [05-revise.log](05-revise.log)

6. 运行结束后（3 分 1 秒，$0.97）看卡片和模板。
   卡片仍 **todo**、没有问题，Todo 两条都已勾选（多了一条「换上 Tasko 内容后重新渲染」）。`content.js` 填上了 Tasko：S1 是 `Tasko` 字标，S2 的窗口里是按截图重画的侧栏、收件箱列表、「14 tasks」统计和周报柱状图，S3 是标语；颜色取自截图。`Worth noting` 多了一条：截图是重画进一屏的，不是原图，产品里没有这样一页。回话同样以「满意的话请把 #2 归档」结束。`akb raw validate` 通过。
   [06-revised.log](06-revised.log)

7. 在看板 UI 打开 `/2`，展开「视频克隆」一节，把「复刻成片」拖到 0:03。
   视频带浏览器自己的播放控件；青绿底上的浏览器窗口里是 Tasko 的收件箱、统计和周报。
   ![复刻成片](07-clone.png)

8. 往下看「源片 vs 复刻」。
   两段横版片上下并列，左上角标「源片」「复刻」；下面一个共用播放条，进度条分三段，显示「S1 / 3 · Logo 静置」和 `0:00 / 0:06`：源片是藏青底白块，复刻是深绿底白色 `Tasko`。
   ![对比](08-compare.png)

9. 点「下一镜」，再点播放，约 1.5 秒后暂停。
   两段先都跳到 1.60 秒、显示「S2 / 3 · 色块推入 + 浏览器窗口升起」；播放中两段时间差约 0.04 秒，暂停在 3.12 / 3.10 秒：窗口位置、大小一致，源片里是示意仪表盘，复刻里是 Tasko。
   ![S2](09-compare-s2.png)

10. 再点「下一镜」，播放约 1.8 秒后暂停。
    两段都跳到 3.50 秒、显示「S3 / 3 · 叠化到标语」，暂停在 5.3 秒：源片是白底藏青横条，复刻是白底「Plan less. Ship more.」。
    ![S3](10-compare-s3.png)

11. 在模板的一份拷贝里只改 `content.js`：删掉 S1 那一拍，S2 改成硬切开场、时长 3 秒，标语改成 `Try Tasko free`；执行 `npx --yes hyperframes@0.8.169 render -f 30 -o out.mp4`。
    8 秒渲出 5.5 秒的 `out.mp4`，退出码 0；片子直接从青绿底的窗口开场，最后叠化到白底「Try Tasko free」，`index.html` 没动。
    [11-drop-a-beat.log](11-drop-a-beat.log)
    ![删掉一拍后的五帧](12-drop-a-beat-frames.png)

12. 执行 `akb card archive 2`。
    起一次 `archive` 运行，31 秒（$0.32）：待办都已勾选，直接把卡片移进 `docs/kanban/.archive/2-clone-launch-video.md`，`memory/readme.md` 记一行换内容出片的方法；模板留在卡片的素材目录，没有复制到项目里。
    [13-archive.log](13-archive.log)

## Feedback

- **规划完就是成品，按钮不再打架**：两次运行都只留已勾选的待办，回话都说「满意就归档」，归档 31 秒、什么都不用补做；不再出现「说可以 build、`implement` 却拒绝」。
- **拍法和内容分得清**：`template.md` 一段话讲明复刻了什么、不带什么，`content.js` 每项都标着要换；拿到模板的人不看指南也知道改哪里。删一拍、换标语只动 `content.js`，8 秒出片。
- **不先问内容，直接给占位版**：第一次规划没停下来要产品画面，交出的是全占位的成片；想看自己的产品得再 `revise` 一次。省了一问一答，但第一版成片只能看节奏。
- **截图被重画了**：给的是两张截图，复刻里却是按截图重画的一屏合成界面，第 5 条任务被挤掉；写在了 `Worth noting` 里，但第一次看会以为截图没用上。
- **模板默认不进 git**：模板在 `.akb/` 下，回话和交付记录都提醒了要自己复制进仓库；忘了这一步，换台电脑就没了。
- **还是慢，也不便宜**：一张 6 秒短片从建卡到归档 3 次运行、约 13 分钟、$4.09；第一次规划 9 分半钟没有可看的东西。
- **免费账号挡得干脆**：`refine` 只回一句 `Video clone needs Pro.`；不过 `raw create --workflow video-clone` 照样能建卡，到运行时才被拦。
- **没有跑到的**：不是产品视频的源片（数据可视化、片头）；带声音、带字幕的原片；产品画面给的是录屏视频；竖版片的对比。
