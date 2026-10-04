# 在浏览器里登录 Cloud 看板

## Setup

- **账号**：一个已有 Cloud workspace 的账号，用 GitHub 登录；浏览器之前没在 Cloud 看板上登录过。
- **本次证据的来源**：这台机器没有 Cloud 凭据。看板网站（`cloud-ui`）在卡片工作区用 `next dev -p 3790` 实跑，`AI4KANBAN_SUPABASE_URL`、`AI4KANBAN_CLOUD_URL` 指向 [stand-in.mjs](stand-in.mjs)（`node stand-in.mjs 8790 http://localhost:3790`，用 `127.0.0.1` 与网站保持跨站）。它顶替 Supabase Auth、GitHub 授权页（一律立即同意）和 `api.ai4kanban.dev`，账号「Demo Reader」和两个 workspace 都是虚构的。浏览器是无头 Chrome，界面语言中文，窗口 1000×700。

## Steps

1. 未登录时打开看板网站的首页。
   不出现登录页，浏览器直接被送去 GitHub 授权（经 Supabase），同意后回到首页。
   [01-open-the-site.log](01-open-the-site.log)

2. 看回到的首页。
   已登录：标题「你的工作区」下列出账号能打开的两个 workspace，右上角是账号头像（无头像时显示姓名缩写）。
   ![](02-signed-in.png)

3. 点右上角的头像。
   菜单里有姓名、邮箱、「设置」和「退出登录」。
   ![](03-account-menu.png)

4. 在 GitHub 授权页拒绝。
   回到首页，显示「登录未完成，请重试。」，右上角是「登录」按钮，不会自己再跳去授权。
   [04-declined.log](04-declined.log)
   ![](04-declined.png)

## Feedback

- **一步到位**：打开网址就走完登录回到看板，没有多余的登录页；GitHub 已授权过时用户几乎察觉不到登录发生过。
- **首次登录看不到在登录谁**：整个过程只有 GitHub 的授权页，网站本身不说「你将用 GitHub 登录 AI4Kanban Cloud」，第一次来的人可能不知道为什么跳到了 GitHub。
- **拒绝后的提示很干净**：一句话加一个「登录」按钮，不会陷入反复跳转。
- **未在真实 Cloud 上验证**：授权页和接口都是替身，GitHub 真实的授权画面和 Supabase 的错误参数没有核对过。
