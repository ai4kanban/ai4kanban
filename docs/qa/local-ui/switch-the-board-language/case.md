# 切换看板界面的语言

## Setup

- **看板**：一次性 git 项目，用 `akb install` 建好，上面有两张卡（#1 安装自带，#3 来自 [在看板上把一个想法变成卡片](../turn-an-idea-into-a-card-on-the-board/case.md)）。
- **设置**：`AI4KANBAN_HOME/settings.json` 里 `"language": "zh"`，看板 UI（`kanban-ui`）就用这个目录。
- **界面**：浏览器窗口 1440×900，看板首页。

## Steps

1. 点右上角齿轮「配置」，在「通用」里往下滚到「语言」。
   一行说明「对这台电脑上打开的所有看板生效。akb 在终端中的输出，以及 Agent 写入卡片的内容仍为英文。」，右侧下拉框是「中文」。
   ![通用里的语言](01-general.png)

2. 点下拉框。
   菜单里是 English、中文（打勾），分隔线下的日本語、Español、Français 灰着，标「即将支持」。
   ![语言菜单](02-menu.png)

3. 选 English。
   不刷新页面，整个配置窗口立刻换成英文：标题「Configuration」，左栏「General」「Runtimes」…，语言一栏是「English」。
   ![配置窗口换成英文](03-english.png)

4. 关掉配置窗口。
   看板也已是英文：「New idea」「All cards」「READY TO BUILD」「NOT READY」，卡片上的优先级成了「HIGH」「MED」。
   ![看板换成英文](04-board.png)

5. 打开 `/3` 重新加载。
   卡片页仍是英文（「Build」「Revise」「Remove」「OPEN QUESTIONS」），`<html lang>` 是 `en`；`settings.json` 里 `language` 已写成 `en`。卡片正文「Worth noting」本来就是英文，不随界面变。
   ![重新加载后的卡片页](05-after-reload.png)
   [05-settings.log](05-settings.log)

## Feedback

- **一下就换完**：选完立刻生效、不用刷新，重载后还在，没有半中半英的中间态。
- **入口藏得深**：语言在「配置 → 通用」最底下，要滚过安装、交付、运行、隐私四段才看到；不知道它在哪的人第一反应会去找顶栏的地球图标。
- **说明预先打了预防针**：「akb 和卡片内容仍为英文」写在开关旁边，切到中文后看到英文卡片不会以为是坏了。
- **灰掉的语言只是占位**：三种「即将支持」的语言点不了，也没说什么时候来。
