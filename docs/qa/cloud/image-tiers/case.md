# 按档次生成图片

## Setup

- Pro 账号，本月 5000 AI 积分未用。
- 未部署前用本地云端栈取证（见 `docs/qa/README.md`「如何运行取证」的 web 一条），Worker 带真实的
  OpenRouter key，生图是真调用；积分用 `GET /v1/billing` 看。

## Steps

1. `POST /v1/image`，`tier: "economy"`。
   预期：200，返回 PNG，`x-tier: economy`；积分扣 230。
   证据：[01-economy.log](01-economy.log)、[01-economy.png](01-economy.png)
2. 同一提示词，不带 `tier`。
   预期：按标准档生成，`x-tier: standard`；扣 320，与改动前相同。
   证据：[02-default-standard.log](02-default-standard.log)、[02-standard.png](02-standard.png)
3. 同一提示词，`tier: "premium"`。
   预期：`x-tier: premium`；扣 769。
   证据：[03-premium.log](03-premium.log)、[03-premium.png](03-premium.png)
4. `tier: "best"`。
   预期：400 `bad_request`，列出三个可选档次；积分不变。
   证据：[04-unknown-tier.log](04-unknown-tier.log)

## Feedback

三档画风一致，同一篇帖子混用不突兀；不带档次的旧调用照旧可用。但这张简单插图上三档几乎看不出差别，
高质档却贵了一倍多，经济档也只省约四分之一——用户很难凭眼睛判断该花哪档。命令行
`akb cloud image --tier` 和智能体选档属于 skill 模块，本用例未覆盖；线上 Cloud 还没部署这次改动。
