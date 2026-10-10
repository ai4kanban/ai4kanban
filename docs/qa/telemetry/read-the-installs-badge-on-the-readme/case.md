# 在 README 上看安装数徽章

## Setup

- **网络**：能访问 `img.shields.io` 和 `t.ai4kanban.dev`。
- **本次取证**：徽章行是把 `README.md` 第 9 行的四个徽章放进本地 HTML，用无头 Chrome 截的图，没有截 GitHub 页面本身。

## Steps

1. 打开 README，看标题下的徽章行。
   release、license、downloads 之后是「installs」徽章，显示一个数字。
   ![README 徽章行](01-readme-badges.png)

2. 直接请求徽章读的地址 `https://t.ai4kanban.dev/v1/installs`。
   返回 shields.io 的 endpoint JSON：`label` 是 installs，`message` 是同一个数字；响应头带 `x-installs-through`（数字算到哪一天）和一小时缓存。
   [02-installs-endpoint.log](02-installs-endpoint.log)

3. 给这个地址加上别的参数，或换成别的路径。
   参数被忽略，返回同一个总数；`/v1/runs` 这样的路径是 404，拿不到别的数字。
   [03-no-other-number.log](03-no-other-number.log)

## Feedback

- **一眼就懂**：「installs 63」不用解释，和 downloads 并排放，能看出下载了多少、真正跑起来多少。
- **数字是隔天的**：总数由每日任务更新，徽章再缓存一小时；只有响应头的 `x-installs-through` 说明截止日期，徽章上看不出来。
- **只给一个总数**：无论怎么请求都只有这一个数，公开出去也不担心泄露别的用量。
- **点徽章去下载页**：链接指向官网下载页而不是数字的来源，「installs」怎么算（上报过首次运行的安装）在 README 和隐私页都没写，只有 `telemetry/README.md` 说了。
