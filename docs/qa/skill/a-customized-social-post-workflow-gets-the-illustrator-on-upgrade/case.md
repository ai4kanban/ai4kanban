# 升级后，改过社媒帖流程的看板自动加上「社媒帖配图」，关掉后不再加回

## Setup

- **项目**：一次性 git 项目，`akb install` 新装后提交。
- **旧版设置**：照升级前的样子，`.akb/boards/docs/kanban/ui.config.json` 里社媒帖（`carousel-post`）的规划帮手存成空列表（看板改过它），`shipped` 列着此前发布过的帮手，没有 `social-illustrator`。
- **终端**：zsh，`env -i` 只留 `PATH`、`HOME`（空目录）和 `AI4KANBAN_HOME`；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 升级后第一次执行 `akb workflow list`，再看 `ui.config.json`。
   Social post 的规划行是 `carousel-planner  → hooks: social-illustrator`，已开启；设置里它被写进社媒帖的帮手，`shipped` 记下了它。
   [01-upgrade.log](01-upgrade.log)

2. 执行 `akb workflow stage carousel-post --stage plan --off social-illustrator`，再连续两次 `akb workflow list`。
   回 `Social post · plan: social-illustrator off`；两次列表都是 `social-illustrator (off)`，没有被重新打开。
   [02-turn-off.log](02-turn-off.log)

3. 执行 `akb raw agent-file social-illustrator AGENT.md`。
   中文名「社媒帖配图」；文案确认前不动手，每张图都为这条帖子新做；图文轮播按各页图位出图，纯文字帖为最需要配图的一段出一张，卡片写明不要图就跳过；方法在截图、代码绘图、生成图里选。
   [03-what-it-does.log](03-what-it-does.log)

## Feedback

- **不用自己找**：改过社媒帖流程的老用户，升级后配图帮手直接在，不会因为「改过」而默默缺一个角色。
- **关掉就是关掉**：关掉后不再被升级逻辑加回，尊重用户的选择。
- **纯文字帖也会出图**：默认给纯文字帖配一张，想要真纯文字得在卡片上写明不要图；不知道这条规则的用户会多等一次出图、多花一次生图费用。
- **命令行只认 id**：要写 `carousel-post`、`social-illustrator`，和列表上显示的「Social post」对不上。
- **没有跑到的**：真实策划在文案确认后请配图出图、改文案只重做受影响的图——要一次付费运行，没有验证；看板 UI 上的开关和角色头像。
