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

5. 看把 `/download`、`/zh/download` 和西、日、法三种语言的下载页分享出去时的说明，再读安装清单 `/site.webmanifest`、站点给 AI 的摘要 `/llms.txt` 和 `/index.md`。
   英文描述「Download AI4Kanban, an agent workspace for indie hackers. Available for macOS, Windows and Linux.」，分享说明「AI4Kanban: an agent workspace for indie hackers. Download for macOS, Windows and Linux.」；中文描述「下载 AI4Kanban，独立创业者的 Agent 工作台。支持 macOS、Windows 和 Linux。」，分享说明「AI4Kanban，独立创业者的 Agent 工作台。下载 macOS、Windows 和 Linux 桌面应用。」；西、日、法三页是同一意思的译文（如西语「Descarga AI4Kanban, un espacio de trabajo con agentes para emprendedores independientes. …」、日语「個人開発者のためのエージェントワークスペース、AI4Kanban をダウンロード。…」、法语「Téléchargez AI4Kanban, un espace de travail avec agents pour les indie hackers. …」），都不再复述草稿分工。页面标题和分享标题「Download AI4Kanban」「下载 AI4Kanban」不变。安装清单的描述仍是首页那句「AI4Kanban prepares key drafts for tasks on your board. You review what matters, agents handle the details.」；`llms.txt` 开头讲关键草稿和 8 种工具，首页条目是「Home — See the draft. Let agents do the rest.」；`index.md` 是首页的纯文本镜像，从「Review the key drafts. Get the direction right.」开始。
   [05-meta.log](05-meta.log)

## Feedback

下载页做对了最要紧的事：认出系统，把对的包放在最大的按钮上，一点就下。Mac 的「首次打开」步骤写得很实在，提前告诉你会被拦、该去哪里放行；Windows 只有一句 SmartScreen 说明，够用但单薄。分享出去的说明现在一眼就是下载页：产品是什么、给谁用、支持哪三个平台，不再和首页一字不差。代价是两种称呼并存——下载页叫「Agent 工作台」，安装清单和 `llms.txt` 仍在讲「关键草稿」，从搜索结果和装好的应用里看到的口径不一。大按钮上的架构是页面猜的，这次只在 Apple Silicon 的 Mac 上跑过，Intel Mac 和 Safari 会拿到哪个包没有验证；猜错时按钮上也没有「不是这个？」的提示，只能往下找。
