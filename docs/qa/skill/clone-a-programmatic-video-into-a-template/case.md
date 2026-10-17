# 用「视频克隆」把一条程序化短片的节奏做成能放自己产品画面的模板

## Setup

- **项目**：一次性 git 项目，`media/launch.mp4` 是一条用 ffmpeg 画的 6 秒短片（1280×720、30 fps、无声）：藏青底白块 → 橙色从右擦入、一扇 macOS 浏览器窗口从底部升起（里面是示意仪表盘） → 叠化到白底藏青横条；`akb install` 新装，删掉 `setup-checklist.md`、自带的 #1 和索引里它那一行后提交。产品截图（`inbox.png`、`report.png`，一个叫 Tasko 的待办应用）先不放进项目。
- **账号**：已登录 Cloud，套餐先是免费版，第 3 步起是 Pro（本地假 Cloud 应答 `/v1/billing`）。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`），界面语言中文。
- **界面**：看板 UI（`kanban-ui`）指向这个项目，浏览器窗口 1440×900。

## Steps

1. 执行 `akb workflow list`。
   最后一项是 `video-clone  Video clone  (built-in)  (Pro · locked)  (no worktree)`，规划由 `video-cloner` 领头，执行无人。
   [01-workflows.log](01-workflows.log)

2. 免费账号下用它建卡：`akb raw create --title '复刻发布短片' --workflow video-clone --body-file body.md`（正文：复刻 `media/launch.mp4` 的节奏和动效，做成以后能放我们自己产品画面的模板），再执行 `akb card refine 2`。
   卡片建成；`refine` 被拒：`Video clone needs Pro.`，退出码 1，没有起运行。
   [02-free-refused.log](02-free-refused.log)

3. 账号升到 Pro 后再执行 `akb card refine 2`。
   返回一次 `refine` 运行，领头的是 `video-cloner`。
   [03-pro-refine.log](03-pro-refine.log)

4. 运行结束后（7 分 26 秒，$1.81）看回话和卡片。
   卡片仍是 **todo**，带一个 `[user]` 问题：「模板里的产品画面、Logo 和卖点文字用什么？」，推荐 A「提供产品录屏或截图、Logo 和一句卖点」，B 是先交付带占位的模板。卡片上已有一支占位版复刻（窗口里印着 `PRODUCT FOOTAGE 880×476`）和对比。浏览器窗口被当作系统界面照原样画出，并存进 `memory/agents/video-cloner/props/browser-window/`，`props.md` 登记了它。
   [04-asks-for-footage.log](04-asks-for-footage.log)

5. 把两张截图放进 `media/product/` 并提交，执行 `akb card resolve 2 '选 A。产品画面用 media/product/inbox.png 和 media/product/report.png 两张截图；没有 Logo 图片，Logo 位写 Tasko；卖点：Plan less. Ship more.'`。
   返回一次 `resolve` 运行。
   [05-answer.log](05-answer.log)

6. 运行结束后（resolve 1 分 48 秒 $0.60，随后自动再规划 30 秒 $0.18）看卡片和模板。
   卡片 **ready**、没有问题；成片用 Tasko 的两张截图重渲了一次，窗口停稳后 3.25 秒从收件箱硬切到周报，``## By `video-cloner` agent`` 一节只有复刻成片、源片对比、渲染命令和按 S1–S3 写的剩余差异；`Worth noting` 写了换图时机和地址栏留空两条自作主张。`template/config.js` 是唯一变量文件，节拍表 `beats` 每拍一行。`akb raw validate` 通过。Todo 里留着三条「复制到 `video/launch-clip/` 再渲染」的待办，回话说「可以开始 build」，但 `akb card implement 2 --print` 回 `#2 is finished during planning, so it is archived rather than built.`
   [06-clone.log](06-clone.log)

7. 在看板 UI 打开 `/2`，点开「视频克隆」一节，把「复刻成片」拖到 0:03。
   视频带浏览器自己的播放控件；橙底上的浏览器窗口里是 Tasko 的收件箱截图。
   ![复刻成片](07-clone.png)

8. 往下看「源片 vs 复刻」。
   两段横版片上下并列，左上角标「源片」「复刻」；下面一个共用播放条，进度条分成三段，显示「S1 / 3 · 藏青底 Logo」和 `0:00 / 0:06`。
   ![对比](08-compare.png)

9. 点「下一镜」，再点播放，约 1.5 秒后暂停。
   两段先都跳到 1.60 秒、显示「S2 / 3 · 橙色擦入，浏览器窗口升起」；播放中两段时间差 0.02 秒，暂停在 3.09 / 3.10 秒：窗口位置、大小一致，源片里是示意仪表盘，复刻里是 Tasko 收件箱。
   ![S2](09-compare-s2.png)

10. 再点「下一镜」。
    两段都跳到 4.00 秒，显示「S3 / 3 · 叠化到白底卖点」，复刻窗口里已换成周报截图。
    ![S3](10-compare-s3.png)

11. 在模板的一份拷贝里只改 `config.js`：删掉 S1 那一行，S2 改成硬切开场、时长 3 秒，卖点改成 `Try Tasko free`；执行 `npx --yes hyperframes@0.8.168 render -o out.mp4`。
    约 9 秒渲出 5.0 秒的 `out.mp4`，退出码 0；片子直接从橙底开场，窗口升起后依次是收件箱和周报，最后是白底「Try Tasko free」，`index.html` 没动。
    [11-drop-a-beat.log](11-drop-a-beat.log)
    ![删掉一拍后的五帧](12-drop-a-beat-frames.png)

12. 执行 `akb card archive 2`。
    起一次 `archive` 运行，1 分 32 秒（$0.48）：先补做那三条待办——模板复制到 `video/launch-clip/`（加了 `.gitignore`），重渲出的片子与卡片上的成片逐字节相同——再把卡片移进 `docs/kanban/.archive/2-launch-clip-clone.md`，`memory/readme.md` 记一行换素材出片的方法。
    [13-archive.log](13-archive.log)

## Feedback

- **先问产品画面，问得在点上**：卡片只给了源片，agent 先拿出占位版并问要什么画面；回答一句、放两张截图，两分钟后就是用自己产品画面的成片，比「先复刻原片内容再换」直接得多。
- **对比在比结构**：上下两段窗口位置、升起时机、切点逐帧对齐，内容不同也能一眼看出节奏一样；只是 S1 的标签仍叫「藏青底 Logo」，复刻里却是一行字标。
- **节拍表真能删能换**：删掉开头一拍、改开场转场只动 `config.js` 的几行，9 秒出片，正是这次改动承诺的。
- **系统界面画得像**：浏览器窗口的红黄绿按钮、地址栏、阴影都照原样画了，还存成可复用的道具。
- **说要 build，其实不能 build**：refine 和 resolve 都在 Todo 里留了复制到 `video/launch-clip/` 的待办，回话说「可以开始 build」，但这个工作流没有执行阶段，`implement` 直接拒绝；这些待办到归档时才被顺手做掉，用户在中间会困惑该按哪个按钮。
- **自作主张不少**：两张图在窗口里平分硬切、地址栏留空，都是 agent 定的，写在了 `Worth noting` 里，看得到也改得了。
- **记忆写错了地方**：resolve 把「产品叫 Tasko、截图在哪」记进了 `memory/agents/planner/decisions.md`，而不是 video-cloner 自己的目录。
- **还是慢，也不便宜**：一张 6 秒短片从建卡到归档 4 次运行、约 11 分钟、$3.07；第一次规划 7 分多钟没有可看的东西。
- **免费账号挡得干脆**：`refine` 只回一句 `Video clone needs Pro.`；不过 `raw create --workflow video-clone` 照样能建卡，到运行时才被拦。
- **没有跑到的**：带声音、带字幕的原片；产品画面给的是录屏视频；对比在竖版片上的左右排列。
