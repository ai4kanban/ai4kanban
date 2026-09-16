# Decisions

Settled answers to cards' open questions, grouped by topic. Keep only **user-facing**
calls that guide future planning — what a user can see, do, or would care about.
Internal detail stays on the card.

## How the work runs

- **The board never picks a cheaper runtime for you**: every run goes on the runtime its agent
  is pointed at, and on **Global default** when it names none.
- **A format change takes the cards already open with it**: the board never carries two card
  formats at once.
- **面向英文社区的公开仓库只维护英文一份文档**：awesome list 这类仓库的读者和贡献者以英文为主，产品 UI 的中英双语惯例不延伸过去，中文读者自己读英文。

## Retiring the marketing pack

- **Content work runs on the ordinary board**: the marketing-only implementation is gone, and a
  piece of writing is planned, delivered and reviewed through the content workflow like any
  other card. There is no second board and no second set of flows to keep in step.
- **The marketing board's data was deleted, not migrated**: `marketing/kanban/` went with its
  published record and its feedback, because the board's owner was its only user. Only the
  writing taste was kept, and it lives in the content agents' own memory.

## awesome-agent-kanban

- **The directory sorts by what the reader hands over, not by form factor** — never UI, CLI or
  MCP. A category is earned by a complete, independently usable workflow; a product may appear
  once per category it earns, and that is not a ranking.
- **AI4Kanban is listed there with no advantage**: same criteria, same entry shape, no pin,
  badge or marketing copy. The exposure is given up on purpose, for the directory to be worth
  citing.
- **Only tools where an agent really does the work**: general boards, and products whose only
  AI feature is summarizing or drafting text, stay out — even though that keeps the list short.
  Every claim needs official docs, source, or a reproducible flow.
- **English only, hand-maintained**: one README, no automated updates, CI checks, badge wall or
  star ranking.

## The newsletter

- **Which domain do issues go out from?**: the verified root domain `ai4kanban.dev`, using
  `newsletter@ai4kanban.dev` with SPF, DKIM and DMARC. The unsubscribe link points at the
  `ai4kanban.dev` site too.
- **The subscriber list lives in one local file on the user's machine**, kept outside the repo
  with an encrypted backup, never in git and not on any hosted service, so issues go out only
  from that machine.
- **Which service sends the issues?**: Resend, on its free tier, with the sending domain
  verified and the API key in the environment. A list that outgrows the free tier is a decision
  to revisit, not a limit to design around now.
- **周报的配图放 CDN，不进仓库**：图片传到 `cdn.ai4kanban.dev`，邮件里写完整地址；CDN 上的文件不可覆盖，改一张图就换一个文件名。
- **周报配图不重复推广同一功能**：像素办公室只用一张图；其他亮点按需配图，衬底与圆角在导出时合成进图片。
- **每期发送前站点要先部署过一次**：logo 与退订链接都走站点，`NEWSLETTER_ADMIN_TOKEN` 还得同时在本机和 `kanban-skill` 这个 Pages 项目的 Secret 里，否则正式发送读不回退订，直接停下。

## 演示视频

- **产品演示视频只做一支**：英文旁白配中文字幕，官网首页和 Product Hunt 共用；中文渠道也用这一支，不另录中文版。
