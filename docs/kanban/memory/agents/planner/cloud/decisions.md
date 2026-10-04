# Decisions

Settled user-facing answers that guide future Cloud planning. Read before re-asking.

- **申请人邮件**：只发英文。
- **alpha 定位**：礼貌说明仍在开发、目前对受邀用户免费、不承诺永久免费。
- **托管看板暂不对外**：面向用户的 Cloud 说明只放桌面端 Cloud 设置页和 Cloud 邮件。
- **暂不做线上兼容**：Cloud 目前没有外部用户，接口和迁移直接换新，不为旧客户端保留旧签名或过渡期。
- **「将此看板存储到 Cloud」**：修完已知问题、团队用真实看板在正式环境往返一次且数据完整后，一次性对所有受邀用户开放，不分批。

## What Cloud is

- **Hosted pages**: they hold no setting a reader may write; Settings there is the account alone, and board and machine configuration stays in the app.
- **Toolchain**: turning Cloud on asks nothing new of `akb` — it stays Node 18+ with no dependencies.
- **Sign-in**: GitHub's consent screen asks for the email scope and nothing else.
- **Free tier**: a hit limit refuses writes rather than producing a bill.

## The invite-only preview

- **No waitlist**: a refused person asks with Request an invite in the refusal itself — no invite page, no public thread, no promised reply time. Open signup ships with pricing.
- **Approval admits**: approving a request admits the account at once and emails the person; it survives a GitHub rename, a hand-written handle does not.
- **Paid features**: a feature planned for paying users opens to admitted accounts first; its gate becomes payment when pricing lands.

## Answering a question away from the board

- **One answer form**: tick an option or type a sentence, never both. An answer in the app applies at once; elsewhere it waits for the board's server.
- **Who is told**: a question notifies the owners watching the release; a card never names a person. Routing decides who is told, not who may write.
- **Per-member settings**: the notification switch and watched release belong to the workspace, not a machine; moving the scope tells only that member.
- **Chat buttons**: pressing one records the decision in Cloud on the spot, from a phone, without the machine awake. A message shows the summary and both Worth noting sections.
- **Chat scope**: revising a card from a message is later work; the card link opens the app. A conversation answers one turn at a time and refuses, not queues, a message sent mid-turn.
- **Retiring notifications**: answering or implementing a card retires its ended notifications; Landed is never retired.

## Writing a Cloud board

- **Save**: a save finishes against the machine's copy before the command returns and reaches the workspace behind it.
- **Card lock**: a card is locked before it is written, on a renewable 30-minute lease; a second writer is refused as a conflict naming the current version, never silently overwritten.
- **Takeover**: a run whose card is taken over ends, and what it wrote is dropped.
- **Offline**: Cloud out of reach opens the board read-only from the machine's copy and refuses writes; only a call that never reached the service counts as offline.

## The machine that runs the work

- **Name**: it is called a server everywhere a person sees it.
- **One per board**: a second attachment is refused rather than routed; a board whose server is off waits.
- **Local actions**: an action on the server's own machine acts at once and records the Cloud action afterwards.
- **Teammate view**: Cloud shows the server's runtime binding by name only — never a key, argument string or path.

## The site's public forms

- **Spam protection**: server-side rate limits by IP and email only — no Turnstile or other human check, accepting that a scripted flood can reach the support inbox.
