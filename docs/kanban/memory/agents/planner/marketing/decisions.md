# Decisions

Settled answers to cards' open questions, grouped by topic. Keep only **user-facing**
calls that guide future planning — what a user can see, do, or would care about.
Internal detail stays on the card.

## How the work runs

- **Content work runs on the ordinary board**: a piece of writing is planned, delivered and
  reviewed like any other card, on the default workflow. There is no second board and no
  second set of flows to keep in step; the old marketing board's data was deleted, not
  migrated.
- **The board never picks a cheaper runtime for you**: every run goes on the runtime its agent
  is pointed at, and on **Global default** when it names none.
- **A format change takes the cards already open with it**: the board never carries two card
  formats at once.
- **自定义工作流的自动选择**：靠工作流名称和负责 agent 的描述让看板建卡时自动选中，不为此加产品规则。
- **面向英文社区的公开仓库只维护英文一份文档**：读者和贡献者以英文为主，产品 UI 的中英双语惯例不延伸
  过去。

## awesome-agent-kanban

- **The directory sorts by what the reader hands over, not by form factor** — never UI, CLI or
  MCP. A category is earned by a complete, independently usable workflow; a product may appear
  once per category it earns, and that is not a ranking.
- **AI4Kanban is listed there with no advantage**: same criteria, same entry shape, no pin,
  badge or marketing copy. The exposure is given up on purpose, for the directory to be worth
  citing.
- **Only tools where an agent really does the work**: general boards, and products whose only
  AI feature is summarizing or drafting text, stay out. Every claim needs official docs,
  source, or a reproducible flow.
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
  verified. A list that outgrows the free tier is a decision to revisit, not a limit to design
  around now.
- **周报的配图放 CDN，不进仓库**：图片传到 `cdn.ai4kanban.dev`，邮件里写完整地址；CDN 上的文件不可
  覆盖，改一张图就换一个文件名。
- **周报配图不重复推广同一功能**：像素办公室只用一张图；其他亮点按需配图。
- **每期发送前站点要先部署过一次**：logo 与退订链接都走站点，`NEWSLETTER_ADMIN_TOKEN` 还得同时在
  本机和站点的 Pages Secret 里，否则正式发送读不回退订，直接停下。

## Email

- **Email agents stay project agents**: `email-planner` → `email-builder` live in this board's
  `agents/`, not shipped built-in.
- **邮件资产位置**：定稿邮件放在看板资产目录的 `assets/email/`，只存本机，任何清理都不能删它。
- **邮件格式**：用 React Email 写成可直接经 Resend 发送的 TSX，卡片里显示渲染后的 HTML。
- **邮件 build 后**：默认发一封预览邮件到固定评审邮箱，不发给其他人。

## The demo video

- **产品演示视频只做一支**：英文旁白配中文字幕，官网首页和 Product Hunt 共用；中文渠道也用这一支，
  不另录中文版。
- **演示视频的字幕语言**：同一工程渲染英文字幕版和中文字幕版两份。
- **演示视频的共享素材**：下载到本地 `assets/video/` 审阅，定稿存到 `cdn.ai4kanban.dev`，二进制
  不进 git。
