# 用「视频克隆」把一条程序化短片复刻成可复用的模板

## Setup

- **项目**：一次性 git 项目，`media/launch.mp4` 是一条用 ffmpeg 画的 5.2 秒短片（1280×720、30 fps、无声）：深蓝底白块 → 橙色从右推入 → 淡变到白底深色横条；`akb install` 新装，删掉 `setup-checklist.md`、自带的 #1 和索引里它那一行后提交。
- **账号**：已登录 Cloud，套餐先是免费版，第 3 步起是 Pro（本地假 Cloud 应答 `/v1/billing`）。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`），界面语言中文。
- **界面**：看板 UI（`kanban-ui`）指向这个项目，浏览器窗口 1440×900。

## Steps

1. 执行 `akb workflow list`。
   最后一项是 `video-clone  Video clone  (built-in)  (Pro · locked)  (no worktree)`，说明是「Approve a shot-by-shot recipe, get a reusable template that renders it, and archive it when you are happy.」，规划由 `video-cloner` 领头，执行无人。
   [01-workflows.log](01-workflows.log)

2. 免费账号下用它建卡：`akb raw create --title "复刻发布短片" --workflow video-clone --body-file body.md`（正文：复刻 `media/launch.mp4`，做成以后能换文字和配色复用的模板），再执行 `akb card refine 2`。
   卡片建成；`refine` 被拒：`Video clone needs Pro.`，退出码 1，没有起运行。
   [02-free-refused.log](02-free-refused.log)

3. 账号升到 Pro 后再执行 `akb card refine 2`。
   返回一次 `refine` 运行，领头的是 `video-cloner`。（第一次这样跑时代理断线 `ECONNRESET`，运行什么都没做就结束了；这里是重跑的那次。）
   [03-pro-refine.log](03-pro-refine.log)

4. 运行结束后（约 3 分钟，$0.74）看回话和卡片。
   视频被复制成 `.assets/2/source.mp4`；``## By `video-cloner` agent`` 一节是「阶段 1 — 配方（待确认）」：格式（1280×720、30 fps、5.2 秒、无音轨）、配色，三个镜头各写时间段、版式、动效、进下一镜的转场和选用的库（GSAP）及理由，每镜一张关键帧、每个转场一张逐帧拼图；工程选 HyperFrames + GSAP，并说明不用 Remotion 是因为要付费许可。切点、颜色和尺寸都与原片一致。问题只有一个：配方能否开始做模板。
   [04-recipe.log](04-recipe.log)
   ![配方](05-recipe.png)

5. 执行 `akb card resolve 2 "确认配方"`。
   约 4 分钟后（$1.21）卡片 **ready**，两条待办都打勾。新增「阶段 2 — 模板（已渲染并对比）」：模板在 `.assets/2/template/`（`index.html` + 本地 GSAP），可改的颜色、文字、尺寸、时长都在 `index.html` 顶部；给出渲染命令和换文字配色的示例；嵌入模板渲染、左右并排对比视频和逐镜头对比图，并列出剩下的差异（颜色差 ≤ 4/255、推入边缘差 ≤ 1 px）。「整屏匀速向左推入」被存进 `memory/agents/video-cloner/motions/push-left-linear/`。
   [06-approve.log](06-approve.log)

6. 在看板 UI 打开 `/2`，看阶段 2。
   变量清单、渲染命令代码块和「模板渲染」视频依次排开。
   ![模板](07-template.png)

7. 往下看对比。
   「并排对比」视频左边原片、右边模板，同步播放；「逐镜头对比」图五行，每行左右几乎看不出差别。
   ![并排对比](08-compare.png)
   ![逐镜头对比](09-compare-frames.png)

8. 在模板目录照卡片上的示例换文字和配色渲染：`npx hyperframes@0.8.161 render . -o ../custom.mp4 --variables '{"title":"新品发布","tagline":"10 月 20 日上线","orange":"#2563eb"}'`。
   约 9 秒渲出 5.2 秒的 `custom.mp4`，退出码 0；白块位置变成「新品发布」，中段变蓝，结尾横条位置变成「10 月 20 日上线」。
   [10-custom-render.log](10-custom-render.log)
   ![换了文字和配色的三帧](11-custom-frames.png)

9. 执行 `akb card archive 2`。
   起一次 `archive` 运行，约 4 分钟（$0.23）后卡片进了 `docs/kanban/.archive/`；第一次归档被拦下，因为缺一条写明交付位置和重建命令的已勾选待办，Agent 补上后通过，并在 `memory/readme.md` 记了一行渲染方法。归档刚完成时模板和视频仍在 `.assets/2/`，动效库的索引 `motions.md` 留着。
   [12-archive.log](12-archive.log)

## Feedback

- **配方读得懂、也对**：每个镜头的时间、版式、动效、转场都列清楚了，还附关键帧和逐帧拼图，切点和颜色与原片一致，确认起来很放心。
- **对比给得实在**：并排视频加逐镜头图，一眼就能判断像不像；「剩下的差异」写到像素和色阶，不用自己去量。
- **模板真的能换**：照卡片上的命令改两处文字和一个颜色，几秒就出新片。
- **免费账号挡得干脆**：`workflow list` 先标出「Pro · locked」，`refine` 只回一句 `Video clone needs Pro.`；不过 `raw create --workflow video-clone` 照样能建卡，到运行时才被拦。
- **归档多走了一轮**：第一次归档因为缺「交付」待办被拒，Agent 自己补上再归档，花了近 4 分钟；回话最后还抛出一个关于模块归类的问题，和这张卡已无关。
- **模板放在资产目录里**：渲染命令要进 `.akb/boards/docs/kanban/assets/2/template/` 才能跑，这个路径对用户不直观，也不在项目代码里。
- **没有跑到的**：带声音、带字幕或有实拍素材的原片；「需要修改」时只改一个镜头；第二条视频复用动效库；归档较久之后模板目录是否还在。
