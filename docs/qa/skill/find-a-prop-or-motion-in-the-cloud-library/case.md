# 在命令行从 Cloud 的道具库和动效库找到并取回一个

## Setup

- **账号**：已登录真实的 AI4Kanban Cloud（`api.ai4kanban.dev`），用 `AI4KANBAN_HOME` 指向只放了登录状态的临时目录；跑完删掉。
- **终端**：zsh，在一个空文件夹里执行；日志里的 `akb` 就是这次构建出的命令。复刻视频时 `video-cloner` 自己会执行的就是这些命令。

## Steps

1. 执行 `akb cloud template list-tags --category prop`，再换成 `--category motion`。
   道具列出 `macos (4)`、`light (3)`、`window (2)`、`browser (1)` 等 13 个标签；动效列出 `light (4)`、`kinetic-type (2)`、`title (2)`、`platforms (1)` 等 13 个。
   [01-tags.log](01-tags.log)

2. 执行 `akb cloud template search --category prop --tags browser window`，再执行 `search --category motion --tags opening`。
   各回一条：`chrome-window — Dark Chrome window [free]`、`card-widen — Narrow card widens into a line [free]`，带摘要、标签、关键帧预览名和说明；说明里写着要在视频模板引擎（`HF` 的 `el`、`tl`）里运行。
   [02-search.log](02-search.log)

3. 执行 `akb cloud template list-tags --category video`，再按其中的标签 `search --category video --tags light product-ui`。
   视频类别只有 `launch`、`light`、`product-ui`、`walkthrough` 四个标签，搜出来只有 `ui-walkthrough-launch`；道具和动效不会混进视频模板里。
   [03-video.log](03-video.log)

4. 执行 `akb cloud template get chrome-window --to chrome-window`。
   「已取回 chrome-window：4 个文件」：`template.md`（`category: prop`、`access: free`、来源是所属视频模板的原片）、`prop.md`、`chrome.js`、`keyframe.jpg`。
   [04-get.log](04-get.log)

5. 执行 `search --category motion --tags platforms`，再 `preview platform-orbit --to previews` 和 `get platform-orbit --to platform-orbit`。
   说明里写明可传的参数 `lead, rest, badges`；预览存成 `previews/platform-orbit-keyframe.jpg`；取回 4 个文件（`motion.md`、`platforms.js`、`keyframe.jpg`、`template.md`）。
   [05-motion.log](05-motion.log)

6. 换一个没登录的 `AI4KANBAN_HOME`，执行 `akb cloud template list-tags --category prop`。
   退出码 1：未登录，请在「配置 → Cloud」登录，再加一句「可以不用模板继续。」——`video-cloner` 这时只用本机记忆库。
   [06-signed-out.log](06-signed-out.log)

## Feedback

- **道具和动效能跨项目用了**：Chrome 窗口、mac 桌面、卡片展开这些原来只在一个看板的记忆库里，现在任何登录的项目都能搜到、免费取回。
- **类别分得干净**：搜视频模板不会冒出一堆零件；按标签两步就能定位到一个。
- **单独取回跑不起来**：每个条目都依赖视频模板引擎；说明里写了，但 `get` 不会顺带取引擎。
- **目录只有英文**：标题和说明都是英文，`prop.md`、`motion.md` 却是中文。
- **没有跑到的**：一次真实的视频复刻里 `video-cloner` 按「样式和节奏一致就复用」挑中库里的条目、写回记忆库与索引；维护者看板的发布代理随模板发布新道具和动效。
