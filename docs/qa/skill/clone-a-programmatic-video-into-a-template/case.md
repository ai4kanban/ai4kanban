# 用「视频克隆」把一条程序化短片复刻成可复用的模板

## Setup

- **项目**：一次性 git 项目，`media/launch.mp4` 是一条用 ffmpeg 画的 5.2 秒短片（1280×720、30 fps、无声）：深蓝底白块 → 橙色从右推入 → 淡变到白底深色横条；`akb install` 新装，删掉 `setup-checklist.md`、自带的 #1 和索引里它那一行后提交。
- **账号**：已登录 Cloud，套餐先是免费版，第 3 步起是 Pro（本地假 Cloud 应答 `/v1/billing`）。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`），界面语言中文。
- **界面**：看板 UI（`kanban-ui`）指向这个项目，浏览器窗口 1440×900。

## Steps

1. 执行 `akb workflow list`。
   最后一项是 `video-clone  Video clone  (built-in)  (Pro · locked)  (no worktree)`，说明是「Get a rendered clone of a reference video and a reusable template that renders it, and archive it when you are happy.」，规划由 `video-cloner` 领头，执行无人。
   [01-workflows.log](01-workflows.log)

2. 免费账号下用它建卡：`akb raw create --title "复刻发布短片" --workflow video-clone --body-file body.md`（正文：复刻 `media/launch.mp4`，做成以后能换文字和配色复用的模板），再执行 `akb card refine 2`。
   卡片建成；`refine` 被拒：`Video clone needs Pro.`，退出码 1，没有起运行。
   [02-free-refused.log](02-free-refused.log)

3. 账号升到 Pro 后再执行 `akb card refine 2`。
   返回一次 `refine` 运行，领头的是 `video-cloner`。
   [03-pro-refine.log](03-pro-refine.log)

4. 运行结束后（约 39 分钟，$1.84）看回话和卡片。
   一轮就交付，没有先审配方：卡片 **ready**，三条待办都打勾，没有问题。``## By `video-cloner` agent`` 一节只有一个「复刻成片」`<Asset>`、一个「源片 vs 复刻」`<Compare>`（带 `shots`，S1 深色标题、S2 橙色推入、S3 白底收尾）、渲染与换变量的命令，和按镜头写的剩余差异；逐镜头拆解只在素材目录的 `recipe.md` 里。`akb raw validate` 通过。「整屏匀速推入」被存进 `memory/agents/video-cloner/motions/linear-push/`。
   [04-clone.log](04-clone.log)

5. 在看板 UI 打开 `/2`，展开「视频克隆」一节。
   先是「复刻成片」视频，带浏览器自己的播放控件。
   ![复刻成片](05-clone.png)

6. 往下看「源片 vs 复刻」。
   横版片上下并列，左上角标「源片」「复刻」；下面一个共用播放条，进度条分成三段，显示「S1 / 3 · 深色标题」和 `0:00 / 0:05`。
   ![对比](06-compare.png)

7. 点「下一镜」，再点播放，一秒多后暂停。
   两段都跳到 1.60 秒、显示「S2 / 3 · 橙色推入」；播放中两段时间差 0.02 秒，暂停后都停在 2.93 秒，前两段进度变橙。
   ![S2](07-compare-s2.png)

8. 再点「下一镜」。
   两段都跳到 3.20 秒，显示「S3 / 3 · 白底收尾」。
   ![S3](08-compare-s3.png)

9. 在模板目录照卡片上的示例换文字、配色和时长渲染：`npx --yes hyperframes@0.8.164 render --fps 30 --variables '{"title":"Launch Day","tagline":"Available now","accent":"#2563EB","s2Hold":0.6}' --output out.mp4`。
   约 9 秒渲出 4.6 秒的 `out.mp4`，退出码 0；白块位置变成「Launch Day」，中段变蓝，结尾横条位置变成「Available now」。
   [09-custom-render.log](09-custom-render.log)
   ![换了文字和配色的三帧](10-custom-frames.png)

10. 执行 `akb card archive 2`。
    起一次 `archive` 运行，41 秒（$0.30）后卡片进了 `docs/kanban/.archive/2-launch-sting-clone.md`，`memory/readme.md` 记了一行渲染方法；模板、成片和 `shots.json` 仍在 `.assets/2/`。
    [11-archive.log](11-archive.log)

## Feedback

- **直接看成品**：不用先审一张看不懂的拆解表，打开卡片就是成片和对比，像不像一眼就能判断。
- **对比好用**：两段同步播放、按镜头分段、逐镜跳转，说「S2 不对」就能对上号。
- **颜色看着不一样**：对比里「源片」的橙色明显比「复刻」亮，但两个文件解码出的像素只差约 3/255——源片没有色彩空间标记，浏览器按另一种方式显示；agent 写的「无可见差异」和用户在卡片上看到的不一致，容易让人以为复刻偏色。
- **太慢**：一张 5 秒的短片规划跑了近 40 分钟、$1.84，中途长时间没有可看的东西。
- **模板真的能换**：照卡片上的命令改文字、颜色和时长，几秒就出新片。
- **免费账号挡得干脆**：`workflow list` 先标出「Pro · locked」，`refine` 只回一句 `Video clone needs Pro.`；不过 `raw create --workflow video-clone` 照样能建卡，到运行时才被拦。
- **模板放在资产目录里**：渲染命令要进 `.akb/boards/docs/kanban/assets/2/template/` 才能跑，这个路径被 git 忽略，对用户不直观。
- **归档留了一个无关的问题**：模块表为空，agent 问成果那一行放在哪个标题下，和这张卡已无关。
- **没有跑到的**：带声音、带字幕或有实拍素材的原片；对比在竖版片上的左右排列；镜头偏差大时 agent 修模板重渲的那一轮。
