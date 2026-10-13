# Decisions

Settled user-facing answers that guide future Cloud planning. Read before re-asking.

## What Cloud is

- **Toolchain**: turning Cloud on asks nothing new of `akb` — it stays Node 18+ with no dependencies.
- **暂不做线上兼容**：Cloud 目前没有外部用户，接口和迁移直接换新，不为旧客户端保留过渡期。

## The invite-only preview

- **alpha 定位**：礼貌说明仍在开发、目前对受邀用户免费、不承诺永久免费；申请人邮件只发英文。
- **No waitlist**: no invite page, public thread or promised reply time; open signup ships with pricing.
- **Paid features**: a feature planned for paying users opens to admitted accounts first; its gate becomes payment when pricing lands.

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
