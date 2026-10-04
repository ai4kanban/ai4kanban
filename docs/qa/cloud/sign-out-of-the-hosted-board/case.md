# 在浏览器里退出 Cloud 看板

## Setup

- **账号**：已在 Cloud 看板网站登录（见 [登录](../sign-in-to-the-hosted-board/case.md)），正在看「Demo Shop」的看板；GitHub 那边仍是登录状态、已授权过这个应用。
- **本次证据的来源**：同登录用例，网站在本地实跑，替身 [stand-in.mjs](../sign-in-to-the-hosted-board/stand-in.mjs) 的授权页一律立即同意，就像已授权过的 GitHub。

## Steps

1. 点头像 → 「退出登录」。
   落到「已退出此浏览器的登录。」页，右上角是「登录」，不会自己再登录回去。
   [01-sign-out.log](01-sign-out.log)
   ![](01-signed-out.png)

2. 再打开一张卡片的地址（`/ws-demo-shop/21`）。
   应当被送去登录。**实际**：卡片直接打开了——「已退出」页加载时，浏览器照例请求 `/favicon.ico`，网站把它当成一个 workspace 地址，于是开始一次登录；授权页立即同意，浏览器就又登录上了（`01-sign-out.log` 末尾也记下退出后浏览器里仍有 `akb_session`）。线上 `cloud.ai4kanban.dev/favicon.ico` 同样被转去 `/signin`；真实 GitHub 在这种后台请求里是否也会直接同意，这里没能验证。
   [02-open-a-card-again.log](02-open-a-card-again.log)
   [02-favicon-signs-back-in.log](02-favicon-signs-back-in.log)

3. 在「已退出」页按「登录」。
   走一遍授权后回到「你的工作区」。
   [03-sign-in-again.log](03-sign-in-again.log)

## Feedback

- **退出的反馈清楚**：一句话、一个「登录」按钮，只退出这个浏览器，应用里的登录不受影响。
- **退出可能没生效**：在本次环境里，退出页自己的图标请求就把浏览器登录回去了；用户以为已退出，借来的电脑上其实还登录着——这正是网页版要服务的场景。已记入待筛选。
- **每个页面都多读一次看板**：同一个 `/favicon.ico` 请求在登录状态下会去读名为 `favicon.ico` 的 workspace（替身日志里每页一次 `GET /v1/workspaces/favicon.ico/read`）。
- **未在真实 Cloud 上验证**：授权页是替身，真实 GitHub 的行为没有核对过。
