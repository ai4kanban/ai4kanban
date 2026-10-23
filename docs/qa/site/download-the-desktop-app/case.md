# 在官网下载桌面应用

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本机（地址给 `SITE`），无头 Chrome 开远程调试（`CDP_PORT`），窗口 1280×1000；脚本是 [download.mjs](download.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器）。
- **读者**：想装桌面应用的人，用 Mac 或 Windows 打开下载页。

## Steps

1. 用 Mac 打开 `/download`。
   左边是「WildCrane Desktop」，右边橙色块「Download macOS」，按钮「Apple Silicon · v<当前版本>」（这次构建是 v0.11.2）直接给本机的包 `WildCrane-0.11.2-arm64.dmg`；下方「All downloads」按 macOS（Apple Silicon、Intel）、Windows（Installer）、Linux（64-bit、ARM64）列出全部五个包，文件名都以 `WildCrane-` 开头。「First open」第一步是「Open the `.dmg` and drag **WildCrane** into Applications.」。
   ![Mac 访客看到的下载页](01-mac.png) · [02b-linux.log](02b-linux.log)

2. 在下方「First open」里点「Windows」。
   说明换成 Windows 首次打开要做的一步：SmartScreen 里点「More info」，再点「Run anyway」。
   ![First open 切到 Windows](02-first-open-windows.png)

3. 再点「Linux」。
   说明给出一条命令，`chmod +x` 的文件名和页面上 Linux 包的文件名（`WildCrane-0.11.2.AppImage`）对得上，复制就能用。
   实测失败：说明写的是「`chmod +x AI4Kanban-*.AppImage`, then run it.」，而页面给的包叫 `WildCrane-0.11.2.AppImage`；照抄这条命令会报找不到文件。五种语言都一样。已报待筛选。
   ![First open 切到 Linux](02b-first-open-linux.png) · [02b-linux.log](02b-linux.log)

4. 展开「Use `akb` in a terminal」。
   一句「Only Linux needs a step: npm install -g wildcrane.」，装的是新包名 `wildcrane`；中文页同一处也是 `npm install -g wildcrane`。
   ![命令行一节](02c-terminal.png) · [02b-linux.log](02b-linux.log)

5. 换成 Windows 浏览器（改 User-Agent）再打开 `/download`。
   橙色块变成「Download Windows」，按钮「Installer · v<当前版本>」指向 `WildCrane-Setup-<当前版本>.exe`（这次是 0.11.2）。
   ![Windows 访客看到的下载页](03-windows-visitor.png)

6. 逐个请求页面上的五个下载链接（只取响应头）。
   五个都指向 GitHub Releases 的 `v0.11.2/WildCrane-…`。
   未能证明：取证时 GitHub 上还没有这些 `WildCrane-*` 文件，五个都回 404；包随发版上传，本地构建证明不了它们能下载。
   [04-links.log](04-links.log)

7. 看把 `/download`、`/zh/download` 和西、日、法三种语言的下载页分享出去时的说明，再读安装清单 `/site.webmanifest`、站点给 AI 的摘要 `/llms.txt` 和 `/index.md`。
   英文页面标题「Download WildCrane for macOS, Windows and Linux」，描述「Download WildCrane, an agent workspace for indie hackers. Available for macOS, Windows and Linux.」，分享标题「Download WildCrane」；中文页面标题「下载 WildCrane —— macOS、Windows 与 Linux 桌面应用」，描述「下载 WildCrane，独立开发者的 Agent 工作台。支持 macOS、Windows 和 Linux。」；西、日、法三页的标题和描述都写 WildCrane（如「Descargar WildCrane para macOS, Windows y Linux」「WildCrane をダウンロード — macOS、Windows、Linux 対応」）。安装清单的描述是「An agent workspace for indie hackers. Specialist agents handle coding and marketing, drafting the key parts for you to review before finishing the work.」；`llms.txt` 标题是「# WildCrane」，链接都指向 `https://wildcrane.ai/…`；`index.md` 以「# WildCrane — You don’t have to manage every detail.」开头，下载地址是 `https://wildcrane.ai/download`。
   [05-meta.log](05-meta.log)

## Feedback

- **认系统、给对包**：大按钮直接给本机的包，一点就下；Mac 的首次打开步骤写得实在，提前告诉你会被拦、该去哪里放行。
- **改名在这页基本到位**：标题、按钮、文件名、分享卡片、`llms.txt` 和命令行安装都换成了 WildCrane，五种语言一致。
- **Linux 那条命令是旧名字**：唯一需要用户照抄的命令还写着 `AI4Kanban-*.AppImage`，和刚下载的文件对不上，Linux 用户第一步就卡住。
- **改名没有交代**：页面没有一句「原来的 AI4Kanban」，从旧链接或旧文章来的人要自己猜这是同一个产品。
- **猜错架构没有兜底**：大按钮上的架构是页面猜的，猜错时没有「不是这个？」提示，只能往下找。
