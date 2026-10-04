# 在官网下载桌面应用

## Setup

- **站点**：官网（`web/`）在本地跑起来（`next dev`），无头 Chrome 打开 `/download`，窗口 1280×1000；脚本是 [download.mjs](download.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器）。
- **读者**：想装桌面应用的人，用 Mac 或 Windows 打开下载页。

## Steps

1. 用 Mac 打开 `/download`。
   左边是「AI4Kanban Desktop」，右边橙色大按钮直接给本机的包：「Download macOS · Apple Silicon · v0.9.8」；下方「All downloads」按 macOS（Apple Silicon、Intel）、Windows（Installer）、Linux（64-bit、ARM64）列出全部五个包。
   ![Mac 访客看到的下载页](01-mac.png)

2. 在下方「First open」里点「Windows」。
   说明换成 Windows 首次打开要做的一步：SmartScreen 里点「More info」，再点「Run anyway」。
   ![First open 切到 Windows](02-first-open-windows.png)

3. 换成 Windows 浏览器（改 User-Agent）再打开 `/download`。
   大按钮变成「Download Windows · Installer · v0.9.8」，指向 `AI4Kanban-Setup-0.9.8.exe`。
   ![Windows 访客看到的下载页](03-windows-visitor.png)

4. 逐个请求页面上的五个下载链接（`curl -sIL`，只取响应头）。
   五个都指向 GitHub Releases 的 v0.9.8，跳转后都是 `200 application/octet-stream`。
   [04-links.log](04-links.log)

## Feedback

下载页做对了最要紧的事：认出系统，把对的包放在最大的按钮上，一点就下。Mac 的「首次打开」四步写得很实在，提前告诉你会被拦、该去哪里放行，省掉一次困惑。Windows 只有一句 SmartScreen 说明，够用但显得单薄。大按钮上的架构是页面猜的（Chrome 会报芯片，Safari 不报），这次只在 Apple Silicon 的 Mac 上跑过，Intel Mac 和 Safari 会拿到哪个包没有验证；万一猜错，按钮上也没有「不是这个？」的提示，只能自己往下找。
