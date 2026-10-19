# 在官网下载桌面应用

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本机（地址给 `SITE`），无头 Chrome 开远程调试（`CDP_PORT`），窗口 1280×1000；脚本是 [download.mjs](download.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器）。
- **读者**：想装桌面应用的人，用 Mac 或 Windows 打开下载页。

## Steps

1. 用 Mac 打开 `/download`。
   左边是「AI4Kanban Desktop」，右边橙色块「Download macOS」，按钮「Apple Silicon · v<当前版本>」（这次构建是 v0.10.2）直接给本机的包；下方「All downloads」按 macOS（Apple Silicon、Intel）、Windows（Installer）、Linux（64-bit、ARM64）列出全部五个包。
   ![Mac 访客看到的下载页](01-mac.png)

2. 在下方「First open」里点「Windows」。
   说明换成 Windows 首次打开要做的一步：SmartScreen 里点「More info」，再点「Run anyway」。
   ![First open 切到 Windows](02-first-open-windows.png)

3. 换成 Windows 浏览器（改 User-Agent）再打开 `/download`。
   橙色块变成「Download Windows」，按钮「Installer · v<当前版本>」指向 `AI4Kanban-Setup-<当前版本>.exe`（这次是 0.10.2）。
   ![Windows 访客看到的下载页](03-windows-visitor.png)

4. 逐个请求页面上的五个下载链接（`curl -sIL`，只取响应头）。
   五个都指向 GitHub Releases 的当前版本，跳转后都是 `200 application/octet-stream`。
   [04-links.log](04-links.log)
   实测失败：本机构建的版本号是 0.10.2，五个链接都指向 `releases/download/v0.10.2/…`，全部返回 404——GitHub 上还没有 v0.10.2 这个 release（最新的是 v0.10.1）。线上站点仍链到 v0.10.1，下次从 main 部署官网就会带上这五个坏链接；已提交 triage。

5. 看把 `/download`、`/zh/download` 和西、日、法三种语言的下载页分享出去时的说明，再读安装清单 `/site.webmanifest`、站点给 AI 的摘要 `/llms.txt` 和 `/index.md`。
   英文页面标题「Download AI4Kanban for macOS, Windows and Linux」，描述「Download AI4Kanban, an agent workspace for indie hackers. Available for macOS, Windows and Linux.」，分享说明「AI4Kanban: an agent workspace for indie hackers. Download for macOS, Windows and Linux.」；中文页面标题「下载 AI4Kanban —— macOS、Windows 与 Linux 桌面应用」，描述「下载 AI4Kanban，独立开发者的 Agent 工作台。支持 macOS、Windows 和 Linux。」，分享说明「AI4Kanban，独立开发者的 Agent 工作台。下载 macOS、Windows 和 Linux 桌面应用。」——和首页一样叫「独立开发者」，不再是「独立创业者」；西、日、法三页是同一意思的译文（如西语「Descarga AI4Kanban, un espacio de trabajo con agentes para emprendedores independientes. …」、日语「個人開発者のためのエージェントワークスペース、AI4Kanban をダウンロード。…」）。分享标题仍是「Download AI4Kanban」「下载 AI4Kanban」。安装清单的描述换成「An agent workspace for indie hackers. Specialist agents handle coding and marketing, drafting the key parts for you to review before finishing the work.」；`llms.txt` 开头讲独立开发者的 Agent 工作台、6 个内置工作流和只为关键部分出草稿，首页条目是「Home — See the draft. Let agents do the rest.」；`index.md` 是首页的纯文本镜像，从定位行「An agent workspace for indie hackers」和首屏导语开始，接着是「Build the product. Keep marketing moving.」和六个工作流。
   [05-meta.log](05-meta.log)

## Feedback

下载页做对了最要紧的事：认出系统，把对的包放在最大的按钮上，一点就下。Mac 的「首次打开」步骤写得很实在，提前告诉你会被拦、该去哪里放行；Windows 只有一句 SmartScreen 说明，够用但单薄。这次最大的问题不在页面：从 main 构建出来的五个下载链接全指向还没发布的 v0.10.2，点了只会得到 GitHub 的 404 页，读者会以为产品下架了——页面本身没有任何兜底（比如退回上一个版本或链到 Releases 列表）。口径这回统一了：中文下载页、首页和 `llms.txt`、安装清单都说「独立开发者的 Agent 工作台」，从搜索结果、分享卡片到装好的应用说的是同一件事；西语仍是「emprendedores independientes」（独立创业者），和中文的改法不完全对应。大按钮上的架构是页面猜的，这次只在 Apple Silicon 的 Mac 上跑过，Intel Mac 和 Safari 会拿到哪个包没有验证；猜错时按钮上也没有「不是这个？」的提示，只能往下找。
