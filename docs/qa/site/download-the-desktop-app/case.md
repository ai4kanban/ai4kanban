# 在官网下载桌面应用

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本机（地址给 `SITE`），无头 Chrome 开远程调试（`CDP_PORT`），窗口 1280×1000；脚本是 [download.mjs](download.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器）。
- **读者**：想装桌面应用的人，用 Mac 或 Windows 打开下载页。

## Steps

1. 用 Mac 打开 `/download`。
   左边是「AI4Kanban Desktop」，右边橙色块「Download macOS」，按钮「Apple Silicon · v0.10.1」直接给本机的包；下方「All downloads」按 macOS（Apple Silicon、Intel）、Windows（Installer）、Linux（64-bit、ARM64）列出全部五个包。
   ![Mac 访客看到的下载页](01-mac.png)

2. 在下方「First open」里点「Windows」。
   说明换成 Windows 首次打开要做的一步：SmartScreen 里点「More info」，再点「Run anyway」。
   ![First open 切到 Windows](02-first-open-windows.png)

3. 换成 Windows 浏览器（改 User-Agent）再打开 `/download`。
   橙色块变成「Download Windows」，按钮「Installer · v0.10.1」指向 `AI4Kanban-Setup-0.10.1.exe`。
   ![Windows 访客看到的下载页](03-windows-visitor.png)

4. 逐个请求页面上的五个下载链接（`curl -sIL`，只取响应头）。
   五个都指向 GitHub Releases 的 v0.10.1，跳转后都是 `200 application/octet-stream`。
   [04-links.log](04-links.log)

5. 看把 `/download` 和 `/zh/download` 分享出去时的说明，再读站点给 AI 的摘要 `/llms.txt` 和 `/index.md`。
   英文描述「AI4Kanban prepares key drafts for tasks on your board. You review what matters, agents handle the details. Get the desktop app for macOS, Windows and Linux.」，分享说明「See the draft. Let agents do the rest. On macOS, Windows and Linux.」；中文描述「AI4Kanban 为看板上的任务准备关键草稿。你把关重点，agent 完成细节。获取 macOS、Windows 和 Linux 桌面应用。」，分享说明「先看草稿，再往下做。支持 macOS、Windows 和 Linux。」；页面标题和分享标题「Download AI4Kanban」「下载 AI4Kanban」不变。`llms.txt` 开头讲关键草稿和 8 种工具，首页条目是「Home — See the draft. Let agents do the rest.」；`index.md` 是新首页的纯文本镜像，从「Review the key drafts. Get the direction right.」开始，不再有「AI 项目经理」。
   [05-meta.log](05-meta.log)

## Feedback

下载页做对了最要紧的事：认出系统，把对的包放在最大的按钮上，一点就下。Mac 的「首次打开」步骤写得很实在，提前告诉你会被拦、该去哪里放行；Windows 只有一句 SmartScreen 说明，够用但单薄。分享出去的说明已经和首页一个口径，读者从链接预览到首页不会看到两套说法，代价是下载页描述和首页几乎一样，看不出这是下载页。大按钮上的架构是页面猜的，这次只在 Apple Silicon 的 Mac 上跑过，Intel Mac 和 Safari 会拿到哪个包没有验证；猜错时按钮上也没有「不是这个？」的提示，只能往下找。
