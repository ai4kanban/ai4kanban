# Decisions

Settled user-facing answers that guide future Cloud planning. Read before re-asking.

## What Cloud is

- **Toolchain**: turning Cloud on asks nothing new of `akb` — it stays Node 18+ with no dependencies.
- **托管能力的展示**：告诉用户有配乐、生图、配音等托管能力，但不透露厂商和模型；提示、定价和积分说明都按底层能力称呼（如「生成图像」），不写封面这类具体用途。
- **暂不做线上兼容**：Cloud 目前没有外部用户，接口和迁移直接换新，不为旧客户端保留过渡期。
- **开源版与 Cloud 分工**：开源版聚焦本地单人工作流；多人权限、通知和协作同步由 Cloud 提供。
- **Cloud 不代跑 agent**：执行在每个人自己的机器上、用自己的模型账号；Cloud 负责派发、协作和同步。
- **团队协作先解决四件事**：识别成员；把 agent 的问题送给能决策的人；避免多个 agent 同时处理同一张卡；团队决策进入同一份可追溯记忆。
- **图文轮播模板**：发布到云端模板库供用户使用；图文轮播规划不带模板指令，不从库里挑模板。
- **只发布可复用的动效**：换掉内容就能用在别的项目里才发布；和某个品牌或具体内容绑定的（如产品 logo 动效）只留在自己的模板里。
- **外部系统只是入口和镜像**：GitHub Issues、Linear 等导入需求、镜像进展；外部评论只作建议导入，不能直接覆盖看板。

## The invite-only preview

- **alpha 定位**：礼貌说明仍在开发、目前对受邀用户免费、不承诺永久免费；申请人邮件只发英文。
- **No waitlist**: no invite page, public thread or promised reply time; open signup ships with pricing.
- **Paid features**: a feature planned for paying users opens to admitted accounts first; its gate becomes payment when pricing lands.
- **Pro 试用**：先限时试用（约 7 天，含全部 Pro 模板和少量 credits），到期后才能购买。

## Answering a question away from the board

- **One answer form**: tick an option or type a sentence, never both. An answer in the app applies at once; elsewhere it waits for the board's server.
- **Who is told**: the owners watching the release, per member and per workspace, not per machine; a card never names a person, and routing decides who is told, not who may write.
- **Chat buttons**: pressing one records the decision in Cloud on the spot, without the machine awake.
- **Chat scope**: revising a card from a message is later work; the card link opens the app. A conversation answers one turn at a time and refuses, not queues, a message sent mid-turn.
- **Retiring notifications**: answering or implementing a card retires its ended notifications; Landed is never retired.

## Writing a Cloud board

- **Save**: a save finishes against the machine's copy before the command returns and reaches the workspace behind it.
- **Takeover**: a run whose card is taken over ends, and what it wrote is dropped.
- **Offline**: Cloud out of reach opens the board read-only from the machine's copy and refuses writes; only a call that never reached the service counts as offline.

## The machine that runs the work

- **Name**: it is called a server everywhere a person sees it.
- **One per board**: a second attachment is refused rather than routed; a board whose server is off waits.
- **Local actions**: an action on the server's own machine acts at once and records the Cloud action afterwards.
- **Teammate view**: Cloud shows the server's runtime binding by name only — never a key, argument string or path.

## The site's public forms

- **Spam protection**: rate limits only, no Turnstile or other human check — a scripted flood reaching the support inbox is accepted.

## Templates

- **模板复刻 feel，不复刻内容**：类别只表示产出形态（`ui`、`video`）或构件（`prop`、`motion`），feel 用标签表达；配乐只对得上自己那张 beat 表，随视频模板打包成可替换槽位，不设 `music` 类别。

## Testing against the live service

- **免费账号的线上验证**：直接在线上数据库建一个专用的测试免费账号，不开订阅；凭据公开也无妨。
