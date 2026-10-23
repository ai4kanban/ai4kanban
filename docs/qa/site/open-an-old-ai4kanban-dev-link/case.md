# 打开旧的 ai4kanban.dev 链接，落到 wildcrane.ai 的同一页

## Setup

- **站点**：线上站点，`ai4kanban.dev` 和 `www.ai4kanban.dev` 由 Cloudflare 跳转规则转到 `wildcrane.ai`。脚本是 [old-domain.mjs](old-domain.mjs)（用 [cdp.mjs](cdp.mjs) 驱动无头 Chrome，`CDP_PORT`，带 `--proxy-server`），跑时带 `NODE_USE_ENV_PROXY=1`。
- **读者**：从旧书签、搜索结果、别人贴的链接或旧邮件点进来的访客。

## Steps

1. 请求 `https://ai4kanban.dev/`、`/zh/docs/agents?ref=qa`、`https://www.ai4kanban.dev/blog`、`/llms.txt`。
   每个都回 301，跳到 `https://wildcrane.ai` 的同一路径，查询参数原样保留。
   [old-domain.log](old-domain.log)

2. 在浏览器里打开 `https://ai4kanban.dev/zh`。
   落在 `https://wildcrane.ai/zh`，标签页标题「独立开发者的 Agent 工作台 | WildCrane」，canonical 是 `https://wildcrane.ai/zh`；页头是墨色飞鹤加「WildCrane」字标，导语写「从开发到营销，WildCrane 把需要你判断的部分做成草稿」。
   ![落在 wildcrane.ai 的中文首页](01-zh-home.png) · [old-domain.log](old-domain.log)

3. 打开旧邮件里的退订地址 `https://ai4kanban.dev/unsubscribe`（不带有效令牌）。
   不跳到新域名，由旧域名上的退订处理回 303 到 `/unsubscribe-failed`；那一页同样留在旧域名，回 200，标题「Unsubscribe — WildCrane」。
   [old-domain.log](old-domain.log)

## Feedback

- **旧链接不丢**：路径和查询参数都保住，书签、外链和 `llms.txt` 的抓取都直接落到新站对应页，没有中间页。
- **改名没有任何交代**：从 ai4kanban.dev 点进来的人看到的是一个叫 WildCrane 的网站，页面上没有一句「AI4Kanban 现在叫 WildCrane」；只认旧名字的访客第一眼会怀疑自己点错了。
- **退订页停在旧域名**：退订流程不跳转是对的，但结果页地址仍是 ai4kanban.dev、标题却写 WildCrane，两个名字同屏出现。
