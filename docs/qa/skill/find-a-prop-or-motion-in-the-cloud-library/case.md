# 在命令行从 Cloud 的道具库和动效库找到并取回一个，取回的动效单独就能跑

## Setup

- **账号**：已登录真实的 AI4Kanban Cloud（`api.ai4kanban.dev`），用 `AI4KANBAN_HOME` 指向只放了登录状态的临时目录；跑完删掉。
- **终端**：zsh，在一个空文件夹里执行；日志里的 `akb` 就是这次构建出的命令。复刻视频时 `video-cloner`、按需找片段的 `hyperframes-editor` 自己会执行的就是这些命令。
- **浏览器**：第 6–9 步用无头 Chrome 打开本机 `http://127.0.0.1:<端口>/` 上的一个空白页面。

## Steps

1. 执行 `akb cloud template list-tags --category prop`，再换成 `--category motion`。
   道具列出 `macos (4)`、`light (3)`、`window (2)`、`browser (1)` 等 13 个标签；动效列出 `light (4)`、`kinetic-type (2)`、`title (2)`、`platforms (1)` 等 13 个。
   [01-tags.log](01-tags.log)

2. 执行 `akb cloud template search --category prop --tags browser window`，再执行 `search --category motion --tags opening`。
   各回一条：`chrome-window — Dark Chrome window [free]`、`card-widen — Narrow card widens into a line [free]`，带摘要、标签、关键帧预览名和说明；说明都以「Runs inside a HyperFrames video template's engine」结尾，不再提别的依赖。
   [02-search.log](02-search.log)

3. 执行 `akb cloud template list-tags --category video`，再按其中的标签 `search --category video --tags light product-ui`。
   视频类别只有 `launch`、`light`、`product-ui`、`walkthrough` 四个标签，搜出来只有 `ui-walkthrough-launch`；道具和动效不会混进视频模板里。
   [03-video.log](03-video.log)

4. 执行 `akb cloud template get chrome-window --to chrome-window`。
   「已取回 chrome-window：4 个文件」：`template.md`、`prop.md`、`chrome.js`、`keyframe.jpg`。
   [04-get.log](04-get.log)

5. 执行 `search --category motion --tags platforms`，再 `preview platform-orbit --to previews` 和 `get platform-orbit --to platform-orbit`。
   摘要是「types out to its end」，参数只有 `lead, rest, badges`，不再有 `mark`，也不再要 logo-build；预览存成 `previews/platform-orbit-keyframe.jpg`；取回 4 个文件（`motion.md`、`platforms.js`、`keyframe.jpg`、`template.md`）。
   [05-motion.log](05-motion.log)

6. 取回 `card-widen`、`gather-into-icon`、`platform-orbit`，照说明把三个文件夹放进一个只有 `ui-walkthrough-launch` 的 `index.html`（去掉它自带的道具和动效脚本）、`engine.js`、字体和 gsap 的空白页面，在引擎后加载三个脚本；`content.js` 只写颜色、字体和四个节拍，不写样式、不配道具；用 Chrome 打开。
   `gather.js`、`platforms.js` 首次运行时自己注入样式，`column.js` 在没有 dock 道具时用自带的 dock、`--wallpaper` 缺省时用渐变；页面加载和跳到三个节拍时都没有脚本错误。
   [06-bare-page.log](06-bare-page.log)

7. 跳到 `card-widen` 的第二拍。
   圆角卡片已拉宽成桌面比例，淡蓝到淡米的渐变底，中间一行「One board **for** everything」，底部一排白色槽位、当前槽为橙色。
   ![card-widen 单独渲染](07-card-widen.png)

8. 跳到 `gather-into-icon` 的中段。
   标题「Every task ★ in one place」中间让出图标，四张白底圆角小卡各带一条淡橙短线，散在四角。
   ![gather-into-icon 单独渲染](08-gather-into-icon.png)

9. 跳到 `platform-orbit` 的中段。
   三个 150px 白色圆角方块带淡蓝光晕沿椭圆转动，中间一行字逐字补全（「Post everyw」）。
   ![platform-orbit 单独渲染](09-platform-orbit.png)

10. 换一个没登录的 `AI4KANBAN_HOME`，执行 `akb cloud template list-tags --category prop`。
    退出码 1：未登录，请在「配置 → Cloud」登录，再加一句「可以不用模板继续。」——`video-cloner` 这时只用本机记忆库。
    [10-signed-out.log](10-signed-out.log)

## Feedback

- **取回就能用了**：三个动效复制进去、加载脚本就出画面，不用再去原视频模板里抠样式和 dock；以前 card-widen 这样会直接报错。
- **类别分得干净**：搜视频模板不会冒出一堆零件；按标签两步就能定位到一个。
- **仍离不开引擎**：每个条目都要视频模板的 `engine.js`（`HF`）；说明写了，但 `get` 不会顺带取，得先另取一个视频模板。
- **platform-orbit 少了收尾**：去掉 logo 收尾后只剩绕转和打字，结尾要自己接一拍。
- **目录只有英文**：标题和说明都是英文，`prop.md`、`motion.md` 却是中文。
- **没有跑到的**：一次真实的视频复刻或剪辑里 agent 按「样式和节奏一致就复用」挑中库里的条目；没用 `hyperframes` 渲染成视频，只在浏览器里逐拍定格看了画面。
