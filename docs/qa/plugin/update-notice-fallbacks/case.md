# 查不到新版本或插件已过旧时看面板

## Setup

- 同 [在 Claude Code 面板里看到新版本并升级](../update-from-panel/case.md) 装好 0.1.0，Claude Code
  语言设为 `中文`，并在 `permissions.allow` 里放行 `wildcrane_panel`。
- 第 2 步让 Claude Code 走一个本地 CONNECT 代理，只对 `raw.githubusercontent.com` 回 403，相当于
  GitHub 被墙。
- 第 3 步用假 Cloud：`POST /v1/runner` 回 426 `runner_outdated`，写一份假的 `session.json` 表示已登录。

## Steps

1. 运行 `/wildcrane`。
   预期：标题和新版本提示都是中文：`插件有新版本 0.1.4`，升级命令不变。
   证据：[01-notice-in-chinese.png](01-notice-in-chinese.png)
2. 在 GitHub 不可达时启动 Claude Code，运行 `/wildcrane`。
   预期：标题行仍显示 `v0.1.0`，没有提示框，也没有报错，面板照常可用。
   证据：[02-no-network.png](02-no-network.png)
3. 登录状态下 Cloud 拒绝这个插件的 Runner，打开面板。
   预期：只有一个黄色的过旧警示框，说任务暂停在这台电脑上运行，没有灰色的新版本提示。
   证据：[03-outdated-only.png](03-outdated-only.png)。截图下方的「网络已断开」来自假 Cloud 不答想法
   数据，与本步无关。

## Feedback

三种情况都干净：查不到时什么都不说，不打扰；过旧时只有一个黄框，不会两个框叠在一起。代价是网络被墙
的用户完全不知道有新版本，也不知道检查失败了，只能等到黄框出现。
