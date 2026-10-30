# 从官网下载桌面应用

## Setup

- 用 macOS（Apple Silicon）上的浏览器，英文界面，打开 `https://wildcrane.ai/`。

## Steps

1. 打开首页。
   预期：首屏标题「You don’t have to manage every detail.」，主按钮「Download」带苹果图标，旁边「View on GitHub ↗」。
   证据：[01-home.png](01-home.png)
2. 点顶栏右上角「Download」。
   预期：进入 `/download`，橙色区块「Download macOS」给出「Apple Silicon · v0.11.2」，下方「All downloads」列出 macOS、Windows、Linux 各个安装包。
   证据：[02-download-page.png](02-download-page.png)
3. 点「Apple Silicon · v0.11.2」（与首页主按钮同一个链接）。
   预期：开始下载 `.dmg`。
   实际：GitHub 返回 404。页面上五个安装包链接都指向 `WildCrane-0.11.2-*`，而 v0.11.2 发布里的文件名是 `AI4Kanban-0.11.2-*`。
   证据：[03-dmg-link.log](03-dmg-link.log)
4. 往下滚到「First open」。
   预期：按 macOS / Windows / Linux 分页给出首次打开的步骤，macOS 讲清楚「Open Anyway」的绕过办法。
   证据：[04-first-open.png](04-first-open.png)

## Feedback

下载页布局清楚，自动认出系统并把对应安装包放在最显眼处，首次打开的说明也预先化解了 macOS
的拦截提示。但核心动作是坏的：首页和下载页的每个下载按钮都 404，用户在官网的第一步就走不通。
另外官网卖的是 v0.11.2 桌面端，而当前产品已是 WildCrane Web 加 Runner，新用户看不到这条路。
