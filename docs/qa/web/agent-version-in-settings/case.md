# 在设置里看连接的 Agent 版本

## Setup

- 本地云端栈（见 README「如何运行取证」），alice 的假 Runner 报告 `claude-code` 版本 `2.1.92`，`codex` 不带版本。
  真 Runner 读版本这一段不在本用例内。

## Steps

1. 点右上角齿轮打开「设置」，选「运行时」，点开「全局默认」。
   预期：「连接器」一行是「Claude Code 2.1.92」。
   证据：[01-version.png](01-version.png)
2. 点「连接器」。
   预期：弹出连接器菜单。
   证据：[02-connector-menu.png](02-connector-menu.png)
3. 选 Codex。
   预期：这一行只写「Codex」，没有空位或占位符。
   证据：[03-no-version.png](03-no-version.png)
4. 换回 Claude Code，Runner 报告新版本 `2.1.93` 后重新打开「运行时」。
   预期：显示 `2.1.93`。
   证据：[04-updated.png](04-updated.png)

## Feedback

版本紧跟连接器名字，一眼能看到，不占地方。摩擦点：版本只是一个数字，看不出这是哪一份、是否最新；读不到版本时什么也
不写，分不清是没读到还是 Runner 太旧；一个账号有两台电脑、版本不同时只显示其中一台的（#131 卡片已说明，这里没取证）。
