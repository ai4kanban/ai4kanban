# 用「视频克隆」复刻一条程序化短片：先审原片拆解和复刻脚本，批准后拿到模板和对比

## Setup

- **项目**：一次性 git 项目，`media/launch.mp4` 是一条用 ffmpeg 画的 6 秒短片（1280×720、30 fps、无声）：藏青底白块 → 橙色从右擦入、一扇浏览器窗口升起 → 叠化到白底藏青横条；`akb install` 新装，删掉 `setup-checklist.md`、自带的 #1 和索引里它那一行后提交（[setup.sh](setup.sh)）。
- **账号**：已登录 Cloud，套餐先是免费版，第 3 步起是 Pro（本地假 Cloud 应答 `/v1/billing`）。
- **Agent**：用本目录的 [stand-in.mjs](stand-in.mjs) 顶替 Claude Code（不花钱）——`<project>/.akb/boards/docs/kanban/ui.config.json` 写 `{"harness":"claude-code","harnessSettings":{"claude-code":{"command":"node <路径>/stand-in.mjs"}}}`，PATH 最前放一个只会报错的 `claude`。替身记下每次运行的参数和提示词，再照 `video-cloner` 的 `AGENT.md` 按卡片当前阶段动手：没有阶段时写两份草稿、把阶段设成「草稿,模板」；在第 2 阶段写模板、换成成片对比、勾掉待办。复刻成片是事先准备好的文件，模板目录里只有 `template.md` 和 `content.js`。
- **界面**：看板 UI（`kanban-ui`）指向这个项目，中文，浏览器窗口 1440 宽，用 [cdp.mjs](cdp.mjs) 驱动。

## Steps

1. 执行 `akb workflow list`。
   最后一项是 `video-clone  Video clone  (built-in)  (Pro · locked)  (no worktree)`，简介 `Use when a reference video should be recreated or turned into a reusable template. Breaks it down for approval, then renders the clone and publishes the template.`；规划由 `video-cloner` 领头，执行无人。
   未重跑：#1867 改了简介，旧日志已删；新简介见 [看工作流列表就知道一张卡该交给哪个工作流](../workflows-say-when-to-pick-them/case.md) 第 1 步。

2. 免费账号下建卡：`akb raw create --title '复刻发布短片' --workflow video-clone --body-file body.md`（正文：复刻 `media/launch.mp4` 的节奏和动效，做成能放 Tasko 画面的模板），再执行 `akb card refine 2`。
   卡片建成；`refine` 被拒：`Video clone needs Pro.`，退出码 1，没有起运行。
   [02-free-refused.log](02-free-refused.log)

3. 账号升到 Pro 后再执行 `akb card refine 2`。
   返回一次 `refine` 运行，随即以 `clarify #2` 跑完。
   [03-pro-refine.log](03-pro-refine.log)

4. 看 `akb run log`、Agent 收到的参数和提示词、卡片和素材目录。
   日志第一行是 `[board] new session — video-cloner starts each planning step in a new session`，Agent 收到的是 `--session-id <本次运行 id>` 而不是 `--resume`。提示词里的 `AGENT.md` 有 `## Stages`，列出 Drafts、Cached clips（每拍渲染成缓存片段再拼接）和 Music（读 `references/music.md`）；`akb raw agent-file video-cloner references/music.md` 读得出配乐指令全文。卡片 frontmatter 多了 `phases: [草稿, 模板]`、`phase: 1`，没有问题；``## By `video-cloner` agent`` 只有一个 `<Compare>`：`a` 是原片、`b` 是 `clone.json`、`shots` 是 `breakdown.json`。两份脚本都过了 scriptwriter 的校验，`akb raw validate 2` 通过；`akb card refine 2` 回 `a refine would not move #2`，`implement --print` 回 `finished during planning`。
   [04-drafts.log](04-drafts.log)

5. 在看板 UI 打开 `/2`。
   元数据栏下面一行是阶段条「**草稿** › 模板」，右边「草稿待你批准」和按钮「批准，开始模板」；没有待你决定的问题，按钮行只有「修订」「移除」，没有「细化」。
   ![草稿等待批准](05-drafts-on-card.png)

6. 展开「视频克隆」一节。
   「原片与复刻脚本」：上面是原片，播放条分三镜，显示 `S1 / 3`；下面两栏，左「原片拆解」写 S1 的动作和字幕「藏青底上一块白色 Logo 静置」“Launchly”，右「复刻脚本」写「Tasko 标志静置在藏青底上」“Tasko”；「制作说明」收起着。
   ![原片与复刻脚本](06-compare-script.png)

7. 点两次「下一镜」。
   原片跳到 0:04，进度条前两段填满，显示 `S3 / 3`；两栏一起换成 S3：「叠化到白底，藏青横条写行动号召」“Try it free”和「白底藏青横条写行动号召」“免费试用 Tasko”。
   ![换到 S3](07-compare-s3.png)

8. 点「批准，开始模板」，等运行结束，看 `akb run list` 和日志。
   起一次 `approve #2`，Agent 收到新的 `--session-id`，日志同样以 `new session` 开头；卡片 `phase` 变成 2。之后看板自己又起了一次 `clarify #2`（也是新会话）。
   **未通过**：`clarify` 结束时看板说 `#2 is still in To do after planning, and the board won't plan it again on its own — refine it again, or mark it ready yourself.`——模板已交付，这句话是错的。
   [08-approve.log](08-approve.log)

9. 看卡片和素材目录，再执行 `akb card approve 2`。
   ``## By `video-cloner` agent`` 换成「原片与复刻」的 `<Compare>`（`b` 是 `clone.mp4`，`shots` 仍是 `breakdown.json`）和一行「S2：窗口里的产品界面是按截图重画的，不是原图。」；待办已勾，写着模板的绝对路径和渲染命令；`akb raw validate 2` 通过。`approve` 被拒：`#2 is on its last stage — archive it once it is delivered.`
   [09-template.log](09-template.log)

10. 刷新卡片页，看顶部按钮。
    阶段条变成「✓ 草稿 › **模板**」，批准栏消失，待办 1/1。应该出现「归档」。**未通过**：只有「细化」「修订」「移除」。看板只把 `<Asset>` 里的视频算作交付物，不认 `<Compare>`；`akb card archive 2 --print` 可以照常归档。这一点已报过（#1795），被用户否决。
    ![做完后的按钮](10-buttons.png)
    [10-buttons.log](10-buttons.log)

11. 展开「视频克隆」一节。
    「原片与复刻」两段片上下并列，左上角标「原片」「复刻」，共用一条三段播放条；下面那行差异。卡片上没有单独的复刻成片。
    ![成片对比](11-compare-template.png)

## Feedback

- **阶段一眼看得懂**：阶段条直接写「草稿 › 模板」，按钮写「批准，开始模板」，知道自己在第几步、点了会发生什么；比原来在问题框里答「可以，按这两份稿做模板」直观得多。
- **草稿对照终于对得上镜**：原片在上、两栏脚本在下，点哪一镜两边一起换，能直接看出复刻在每一镜换掉了什么；拆解自带的画面不再重复显示。
- **会话不再越堆越长**：每次规划都新开会话，日志第一行就说明原因，排查时不会疑惑为什么它不记得上一轮。
- **做完却归档不了**：卡片只留 `<Compare>`，看板仍当没交付——没有「归档」，反而给「细化」，批准后的那轮还说卡片「still in To do」；用户得知道去命令行 `akb card archive 2`。批准后多跑的那次 `clarify` 也是白跑。
- **证据的局限**：Agent 是替身，草稿、模板和对比都由脚本写成；这里验证的是看板对阶段、批准、新会话和对照显示的处理，不是真实 `video-cloner` 拆片、配乐、按拍缓存渲染的质量。
- **没有跑到的**：真实 Agent 的两个阶段和渲染；托管配乐真的被调用；改一拍只重渲那一段；用聊天或「修订」改草稿；新版删镜时右栏的「新版没有这一镜」；归档。
