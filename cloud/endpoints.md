# Cloud service endpoints

The routes the Worker at `api.ai4kanban.dev` answers, and the refusals a client must tell apart.
Routing is in `src/index.ts`. Unless a route says otherwise it needs `Authorization: Bearer
<token>` from an **admitted** account. The Local board's publishing routes (`/v1/boards`,
`/v1/servers`, `/v1/requests`, `/v1/events`, `/v1/watch-summary`) are listed only there.

## Service

- `GET /health` — liveness. Reaches nothing, so it stays honest while the database is read-only.
- `GET /v1/session` — the caller's verified identity. Answers `200` either way with
  `session.admitted`; when false it carries `refusal`, the refusal every other route would give.
- `POST /v1/invite-request` — ask for an invite. Open to a verified sign-in that is **not**
  admitted; pressing again returns the open request.
- `POST /v1/self-check` — one budgeted write through the path every mutation uses. Run it after
  a deploy.

## Workspaces

A deduplicated mutation carries `opId`, the attempt it is, and may carry `nodeId`, the machine
it came from; a card write also carries `expect`, the revision it read. Making a workspace,
deleting it, and registering or renewing a node repeat safely and carry no `opId`.

- `POST /v1/workspaces` — make one: `{ "name": "…", "opId": "…" }`, `opId` optional.
- `GET /v1/workspaces` — the ones the caller is a member of.
- `GET /v1/workspaces/<id>` — one, and the revision the board reads at now.
- `POST /v1/workspaces/<id>/rename` — `{ "opId": "…", "expect": "…", "name": "…" }`.
- `POST /v1/workspaces/<id>/delete` — the workspace and everything in it, at once. Owner only;
  confirming is the client's job.
- `GET /v1/workspaces/<id>/members` — the members, and the caller's own `role`, which is what
  a screen draws owner-only controls from.
- `POST /v1/workspaces/<id>/members` — `{ "opId": "…", "handle": "…", "role": "owner" |
  "member" }`. Owner only. The handle must resolve to exactly one admitted account.
- `POST /v1/workspaces/<id>/members/<account>/role` — `{ "opId": "…", "role": "…" }`. Owner
  only. Leaving no owner is refused.
- `POST /v1/workspaces/<id>/members/<account>/remove` — `{ "opId": "…" }`. Owner only. Their
  next write and delivery confirmation are refused, and their watch goes with the membership.
- `GET|POST /v1/workspaces/<id>/watch` — the caller's own `{ "notify": true, "watching": "1.0"
  }`; `watching` is `*` for every release, one release, or `""` once the watched one closed.
  The read also carries `releases` (the open ones) and `carried`.
- `POST /v1/workspaces/<id>/watch/carry` — a machine handing over its own watch the first time
  it opens the workspace. Taken **once**; later calls answer the current watch and write nothing.
- `GET /v1/workspaces/<id>/cards` — every card, each with its own revision.
- `POST /v1/workspaces/<id>/cards` — one or many cards in one transaction:
  `{ "opId": "…", "nodeId": "…", "cards": [{ "id": 7, "expect": "3", "data": { … } }] }`. No
  `id` takes the next free number; an unknown `id` keeps its number, so an import keeps the
  board's numbering. `expect: ""` is a card that does not exist yet.
- `GET /v1/workspaces/<id>/cards/<card>` — one card; what a `revision_conflict` is re-read
  through.
- `GET /v1/workspaces/<id>/audit?limit=N` — the trail, newest first.
- `GET|POST /v1/workspaces/<id>/nodes` — the registered machines, and registering the caller's:
  `{ "machineId": "…", "machineName": "…", "runtimes": [ … ] }`. Idempotent on the machine id;
  any member registers their own.
- `POST /v1/workspaces/<id>/nodes/<node>/rename` — `{ "opId": "…", "name": "…" }`. Owner only.
- `POST /v1/workspaces/<id>/nodes/<node>/remove` — owner only. Its next renewal, write and
  delivery confirmation are refused.
- `POST /v1/workspaces/<id>/nodes/<node>/renew` — the node saying it is still there.
- `GET /v1/workspaces/<id>/snapshot` — the live board under one cursor: the workspace, live
  cards and working documents. Leaves out the archive, the trail and delivery records.
- `GET /v1/workspaces/<id>/read` — what the hosted pages (`../cloud-ui/`) draw: the name, live
  cards, and `config.md`, `modules.md`, `releases.md`, `todo/README.md`. Nothing more is served
  to a browser; the limit is in the migration, not the Worker.
- `GET /v1/workspaces/<id>/events` — one live event per card waiting on somebody.
- `GET /v1/workspaces/<id>/archive` — the cards that have left the board.
- `GET|POST /v1/workspaces/<id>/documents` — every board file that is not a card, under the path
  it is written back to. Write: `{ "opId": "…", "lease": "…", "documents": [{ "path":
  "rules/revise.md", "kind": "rule", "expect": "3", "body": "…" }] }`; a `""` body deletes it.
  `?kind=` is one of `config`, `memory`, `rule`, `summary`, `history`.
- `GET|POST /v1/workspaces/<id>/locks` — the writer locks out, and taking one: `{ "cardId": 7,
  "nodeId": "…", "lease": "…" }`; no `cardId` is the board's own lock. Answers the lease, the
  resource's revision and `holder` (GitHub handle, `""` when unattributable). Presenting the
  lease again extends it.
- `POST /v1/workspaces/<id>/locks/release` — `{ "cardId": 7, "lease": "…" }`. Silent about a
  lock the caller does not hold.
- `POST /v1/workspaces/<id>/deliveries` — open a delivery: `{ "opId": "…", "nodeId": "…",
  "cardId": 7 }`.
- `GET /v1/workspaces/<id>/deliveries?card=N` — every delivery, or one card's.
- `POST /v1/workspaces/<id>/deliveries/<delivery>/confirm` — `{ "opId": "…", "nodeId": "…",
  "outcome": "completed" | "failed" | "cancelled" }`.
- `POST /v1/workspaces/<id>/deliveries/<delivery>/record` — `{ "opId": "…", "record": { … },
  "approved": "…", "finalBody": "…" }`. The record's repository half is stripped **by the
  database**.

## Import and export

A board arrives through the card, document and delivery writers above; these add the claim and
the history. Neither direction keeps two boards in step. From a terminal: `akb cloud import
<workspace>` and `akb cloud export <workspace> --to <folder>`.

- `POST /v1/workspaces/<id>/import/begin` — `{ "opId": "…", "fingerprint": "…" }`. A workspace
  holding another board is refused with `board_not_empty`; one holding **this** board answers
  `resuming: true` and what it holds.
- `POST /v1/workspaces/<id>/import/events` — up to 500 history rows a pass: `{ "opId": "…",
  "events": [{ "key": "17", "at": "2026-04-02", "action": "card-archived", "cardId": 3,
  "detail": { … } }] }`. `key` makes a retried pass idempotent.
- `POST /v1/workspaces/<id>/import/deliveries` — finished deliveries, whole. Idempotent on
  `sourceId`.
- `POST /v1/workspaces/<id>/import/finish` — `{ "opId": "…", "nextCardId": 400 }`.
- `GET /v1/workspaces/<id>/export` — numbering, every card live and archived, every document
  and every delivery.
- `GET /v1/workspaces/<id>/export/events?after=N&limit=N` — the trail in order, paged.

## Slack

All but the last two need the bearer token.

- `POST /v1/slack/install` — the consent screen to open, with the nonce binding it to the caller.
- `GET /v1/slack/connection` — what the Configuration pane draws. Never the bot token.
- `GET /v1/slack/conversations` — reachable channels, and the DM with whoever connected.
- `POST /v1/slack/destination` — `{ "channelId": "…", "channelName": "…" }`.
- `POST /v1/slack/disconnect` — end it and revoke the token.
- `GET /v1/slack/installed` — Slack's redirect. No sign-in; the nonce identifies the install.
  Ends at `ai4kanban://cloud/slack-connected`.
- `POST /v1/slack/actions` — Slack's interactivity callback. No sign-in; trusted on Slack's
  signature over the raw body and a timestamp within five minutes. Answers `200` for any valid
  request; a refused press is told to the person ephemerally.

## Lark

`<cloud>` is `feishu` or `lark`, named in the path because an encrypted callback is unreadable
until the right Encrypt Key is chosen. All but the last two need the bearer token.

- `POST /v1/lark/<cloud>/connect` — the consent screen to open, with its nonce.
- `GET /v1/lark/connection` — what the Configuration pane draws, and which clouds this build
  carries an app for. Never a token.
- `GET /v1/lark/chats` — the group chats the bot is in, and the DM with whoever connected.
- `POST /v1/lark/destination` — `{ "destinationId": "…", "destinationName": "…",
  "direct": false }`.
- `POST /v1/lark/disconnect` — end it. Nothing is revoked; an uninstall in Lark does that.
- `GET /v1/lark/<cloud>/connected` — Lark's redirect. No sign-in; the nonce identifies it. Ends
  at `ai4kanban://cloud/lark-connected`.
- `POST /v1/lark/<cloud>/callback` — the URL challenge, the `app_ticket` push and every press.
  No sign-in; encrypted under the Encrypt Key and signed within five minutes. Answers `200` for
  any valid request; a refused press is told in a toast.

## Card links

One redirect each, with no lookup, so the answer reveals nothing about what exists. Which one a
chat message carries depends on where the event lives.

- `GET /card/<board>/<task>` — a Local board's card; the http half of `ai4kanban://card/…`.
- `GET /card/w/<workspace>/<task>` — a workspace's card on `cloud.ai4kanban.dev`.

## Narration

- `POST /v1/speech` — `{ "voice": "Kore", "text": "…" }`: wav of the text in that voice, from
  `google/gemini-3.8-flash-tts` through OpenRouter. Voices are `VOICES` in `src/speech.ts`; text
  is at most 4000 characters. Needs the `OPENROUTER_API_KEY` secret. Any Pro sign-in, admitted or
  not, spending 1 AI credit per second of generated audio.

## Covers

- `POST /v1/image` — `{ "prompt": "…", "aspect": "16:9", "references": ["data:image/png;base64,…"] }`:
  one image from `openai/gpt-image-2.5-sunburst` through OpenRouter at medium quality, with its
  model in `x-model`. `aspect` is one of `ASPECTS` in `src/image.ts`; prompt at most 4000
  characters; at most 3 PNG, JPEG or WebP references of 8 MB each. Same key and sign-in as
  narration, spending 320 AI credits per image, only once it is generated.

## Triage

- `POST /v1/judge` — `{ "state": {…}, "questions": { "<name>": { "type": "choice", "instructions": "…", "criteria": { "<option>": "…" } } } }`:
  forwarded to `typesafe/jev-1.13` through OpenRouter's Decisions API; answers
  `{ "answers": { "<name>": { "choice", "probabilities", "confidence" } }, "model" }`. Choice
  questions only, at most 4 of them with 2–500 options each, 200,000 characters in all. Same key
  as narration. Any Pro sign-in; free — it spends no credits, and each answer's `usage.cost` is
  logged.

## Billing

Pro, sold through Creem (#1037). Open to any verified sign-in, admitted or not: a subscription
belongs to the Supabase user. Every route refuses with `billing_unavailable` when this build
carries no `CREEM_API_KEY` / `CREEM_WEBHOOK_SECRET`.

- `GET /v1/billing` — `{ "billing": { "plan": "free" | "pro", "state": "free" | "active" |
  "canceled" | "pastDue" | "expired", "period": "monthly" | "yearly" | null, "periodEnd",
  "grantEnd" } }`. `periodEnd` is the renewal date while `active` or `pastDue`, the end date
  otherwise. Judged on read: `active`, `trialing`, `past_due` are Pro; `scheduled_cancel`,
  `canceled` until `periodEnd`; the best of several subscriptions wins. A seed partner's grant
  (#1039) also makes `plan` Pro and sets `grantEnd` while it runs; `state`, `period` and
  `periodEnd` stay the subscription's. Also `"credits": { "total", "left",
  "resetsAt" }` for Pro, `null` otherwise: Pro's AI credits this UTC month (#1113), spent by every
  hosted capability at the rates in `src/credits.ts` (`cloud.credit_spends`).
- `POST /v1/billing/checkout` — `{ "period": "monthly" | "yearly" }`: `{ "url" }`, a Creem
  checkout returning to `/settings?checkout=done`, or `/settings` itself for somebody already
  subscribed (`active`, `canceled` or `pastDue`). A grant alone may buy.
- `POST /v1/billing/confirm` — `{ "subscriptionId" }` from that return: reads it from Creem,
  writes it when it is the caller's, and answers `billing`.
- `POST /v1/billing/portal` — `{ "url" }`, the caller's Creem customer portal.
- `POST /v1/billing/webhook` — Creem's notification, no sign-in. `creem-signature` must be the
  HMAC-SHA256 of the raw body under `CREEM_WEBHOOK_SECRET`. The subscription is re-read from
  Creem and written whole, so replays and out-of-order notifications converge; a failed read is
  a 5xx for Creem to retry.

## Training bookings and contact

The only routes a caller with **no account** reaches. Each answer echoes the site's own origin
back and no other.

- `GET /v1/training/availability?from=&to=` — each hour in a bounded window, `open` or `booked`.
- `POST /v1/training/bookings` — `{ "opId", "slotAt", "service", "name", "email", "timezone",
  "project" }`. The price comes from `src/training-schedule.ts`, never the body. A race for one
  hour is one booking and one `training_slot_taken`. Answers the booking and its manage token.
- `GET /v1/training/bookings/<reference>?token=` — that booking. A wrong reference and a wrong
  token answer identically.
- `POST /v1/training/bookings/<reference>/cancel` — `{ "token": "…" }`. Idempotent.
- `GET /v1/training/records?from=&to=` — every booking in a window. Needs an admitted account
  whose handle is in `TRAINING_OPERATORS` (`src/config.ts`).
- `POST /v1/contact` — `{ "opId", "reason": "support" | "customize" | "seed", "email",
  "message", "workflow", "github" }`; `workflow` is required for `customize`, `github` (a GitHub
  username) for `seed`, the site's seed partner application. Stored, then mailed to
  `support@ai4kanban.dev` with the sender as reply-to. Rate-limited per address and per email
  (`CONTACT_ATTEMPT_*` in `src/config.ts`).

The coach's hours are deployed configuration in `src/training-schedule.ts` (UTC+8 weekly hours
and dated exceptions): edit and deploy. The database holds only the hours taken.

## Refusals

Always `{ "error": { "code": ..., "message": ... } }`; `message` is shown to a user as is.

| Code | Means |
| --- | --- |
| `unauthenticated` | No sign-in, or an expired or unreadable one. Signing in again fixes it. |
| `not_admitted` | A good sign-in from an account not admitted. Never answer it with "sign in again". |
| `not_yours` | The request named another account's row (not a workspace: see `not_a_member`). |
| `not_a_member` | The caller is not in that workspace, or it was deleted — deliberately indistinguishable. |
| `owner_only` | The caller is a member without the owner role. They can still read the board. |
| `handle_not_admitted` | The handle does not resolve to exactly one admitted account. One message for every case. |
| `last_owner` | The change would leave the workspace with no owner. |
| `revision_conflict` | The revision moved. Carries `current`; re-read that one card and write again. |
| `operation_reused` | One `opId`, two different changes. A same-payload retry gets the first result instead. |
| `node_removed` | The call came from a machine the workspace no longer runs work on. |
| `card_locked` | Another writer holds the card or the board, named by handle when attributable. Carries `until`. |
| `board_not_empty` | An import into a workspace already holding a different board. Use a new workspace. |
| `slack_unavailable` / `slack_not_connected` | This build carries no Slack app, or the account connected none. |
| `lark_unavailable` / `lark_not_connected` | This build carries no app for that cloud, or no destination is connected. |
| `no_verified_address` | GitHub attests no address for this account. |
| `training_slot_taken` | That hour is booked or no longer offered. The page keeps the form. |
| `training_too_many_attempts` | Too many booking submits from one caller. Carries `retry-after`. |
| `contact_too_many_attempts` | Too many contact submits per address or email. Carries `retry-after`. |
| `speech_unavailable` / `speech_failed` | This build carries no narration key, or the provider failed. Retry later. |
| `image_unavailable` / `image_failed` | This build carries no image key, or the provider failed. Retry later. |
| `judge_unavailable` / `judge_failed` | This build carries no key for judging, or the provider failed. Retry later. |
| `pro_required` | Hosted voices, images and judging triage items need Pro. |
| `credits_used_up` | This month's AI credits are used up. Carries `retry-after` to the next UTC month. |
| `billing_unavailable` / `billing_failed` | This build carries no Creem store, or Creem did not answer. Retry later. |
| `daily_write_budget_reached` | The service's daily write budget is spent. |
| `storage_limit_reached` | The database turned read-only at its size limit. |
