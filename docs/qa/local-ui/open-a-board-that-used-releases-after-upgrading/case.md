# 升级后打开一个用过版本的旧看板

## Setup

- **看板**：用本目录的 `seed.sh` 建一个一次性 git 项目，模拟旧版留下的看板：`releases.md` 列着 v1.2；#2「导出 CSV」、#3「深色模式」写着 `release: v1.2`；已归档的 #4「卡片搜索」写着 `release: v1.1`；`.release-summaries/v1.1.md` 是已关闭版本的总结。
- **界面**：浏览器打开看板 UI（`kanban-ui`，本仓库构建的版本），窗口 1440×900，界面语言中文。

## Steps

1. 还没升级，打开 `/`。
   看板照常显示 #1、#2、#3；顶栏只有项目名、图标按钮和「新想法」，没有版本选择器；卡片上没有版本徽章，页面上找不到 v1.2、v1.1 或「版本」字样。
   ![看板](01-board.png)
   [顶栏与卡片](01-board.log)

2. 打开 `/2`。
   卡片页的信息栏只有工作流、优先级、ROI、待办项，没有版本一项；残留的 `release: v1.2` 不影响显示。
   ![卡片页](02-card.png)
   [页面文字检查](02-card.log)

3. 在项目里运行 `akb update`。
   输出一行「releases are retired: deleted docs/kanban/releases.md, cleared the release on 3 cards」；`releases.md` 被删掉，三张卡（含归档的 #4）的 `release:` 行被去掉，`.release-summaries/v1.1.md` 原样保留。
   [命令输出与文件变化](03-update.log)

4. 刷新后打开 `/archive`。
   #4「卡片搜索」照常在归档里，没有任何版本信息。
   ![归档](04-archive.png)
   [归档行](04-archive.log)

## Feedback

- **升不升级都不碍事**：旧看板不升级也能直接打开，版本相关的东西在界面上干净地消失了，没有报错或空白占位。
- **升级的说法自相矛盾**：输出先说清掉了 3 张卡的 release，结尾又是「Your cards, config, and memory were left alone」，第一次看会犹豫卡片到底动没动。
- **没说剩下的总结文件怎么办**：`.release-summaries/` 留着，但升级输出和界面都不再提它，用户不知道它还有没有用、能不能删。
- **没有跑到的**：已登录 Cloud 时通知面板的「通知已关闭」空状态和设置页里只剩开关的通知设置（需要 Cloud 账号）；英文界面；桌面应用。
