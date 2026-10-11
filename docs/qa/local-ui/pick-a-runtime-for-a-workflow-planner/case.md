# 给工作流的规划者单独选一个运行时

## Setup

- **看板**：用本目录的 `seed.sh` 建一个一次性 git 项目：新装看板，运行时除了「全局默认」（Claude Code）外还有一个 `Codex`。
- **界面**：浏览器打开看板 UI（`kanban-ui`），窗口 1440×900，界面语言中文。
- **命令行**：在项目里用 `akb agent` 对照每一步之后存下的选择。

## Steps

1. 点右上角的「配置」，再点左栏「工作流」，选「软件规划师」。
   右侧「运行时」是一个下拉框，写着「跟随规划助手 · Claude Code」；没有只读的一行，也没有「在「规划助手」里更改」的链接。`akb agent` 里 `software-planner` 标着 `follows discussion-helper`。
   ![默认跟随规划助手](01-follows-by-default.png)
   [akb agent 的输出](01-03-05-what-akb-agent-says.log)

2. 点开「运行时」下拉框。
   第一项「跟随规划助手」，右侧灰字「Claude Code」，带勾；下面是「全局默认 · 看板默认」和「Codex」，最底下是「管理运行时」。
   ![运行时列表](02-the-list.png)
   [列表里的选项](02-04-what-the-page-says.log)

3. 选「Codex」。
   下拉框换成 Codex 图标和「Codex」；`akb agent` 里 `software-planner` 变成 `Codex  codex`，不再写 follows，`blog-planner` 仍在跟随。
   ![软件规划师用 Codex](03-own-runtime.png)
   [akb agent 的输出](01-03-05-what-akb-agent-says.log)

4. 关掉「配置」，刷新页面再打开，回到「软件规划师」看一眼；然后点左栏「看板」，选「规划助手」。
   软件规划师仍是「Codex」。规划助手自己仍是「全局默认 · Claude Code」，「运行时」下面一行小字「各工作流的规划默认也用这个运行时。」
   ![规划助手的说明](04-planning-helper-note.png)
   [页面上的文字](02-04-what-the-page-says.log)

5. 回到「工作流 → 软件规划师」，在下拉框里选「跟随规划助手」。
   下拉框回到「跟随规划助手 · Claude Code」；`akb agent` 里 `software-planner` 重新标着 `follows discussion-helper`。
   ![恢复跟随](05-follows-again.png)
   [akb agent 的输出](01-03-05-what-akb-agent-says.log)

## Feedback

- **改在原地**：以前要跳到「规划助手」改、而且一改所有规划者都变；现在在规划者自己的页面就能选，首项「跟随规划助手」把默认讲清楚了。
- **「跟随规划助手」和「全局默认」难分**：两项此刻都是 Claude Code，列表里看不出区别；选「全局默认」其实也算单独设置，之后改规划助手它不会跟着变，界面上没有提示。
- **规划助手的说明只说一半**：「默认也用这个运行时」没说哪些规划者已经单独选了别的，要逐个点进去看。
- **选完就存，没有确认**：下拉一选即生效，没有「已保存」提示；刷新后仍在，说明确实存下了。
- **没有跑到的**：规划者换成 Codex 后真正跑一次规划（新开会话、不接续讨论）；英文界面；手机宽度；`akb agent bind <规划者> -` 这条命令行路径。
