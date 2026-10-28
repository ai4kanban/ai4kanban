# Cloud service endpoints

The routes the Worker at `api.ai4kanban.dev` answers, and the refusals a client must tell apart.
Routing is in `src/index.ts`. Unless a route says otherwise it needs `Authorization: Bearer
<token>` from an **admitted** account. The Local board's publishing routes (`/v1/boards`,
`/v1/servers`, `/v1/requests`, `/v1/events`, `/v1/watch-summary`) are listed only there.

## Service

- `GET /health` — liveness. Reaches nothing, so it stays honest while the database is read-only.
  `commit` names the commit `npm run deploy` shipped; absent on a build deployed any other way.
- `GET /v1/session` — the caller's verified identity. Answers `200` either way with
  `session.admitted`; when false it carries `refusal`, the refusal every other route would give.
- `POST /v1/invite-request` — ask for an invite. Open to a verified sign-in that is **not**
  admitted; pressing again returns the open request.
- `POST /v1/self-check` — one budgeted write through the path every mutation uses. Run it after
  a deploy.

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

One redirect, with no lookup, so the answer reveals nothing about what exists.

- `GET /card/<board>/<task>` — a Local board's card; the http half of `ai4kanban://card/…`.

## Narration

- `POST /v1/speech` — `{ "voice": "Kore", "text": "…" }`: wav of the text in that voice, from
  `google/gemini-3.8-flash-tts` through OpenRouter. Voices are `VOICES` in `src/speech.ts`; text
  is at most 4000 characters. Needs the `OPENROUTER_API_KEY` secret. Any Pro sign-in, admitted or
  not, spending 1 AI credit per second of generated audio. Each call is recorded in
  `cloud.ai_calls` with its seconds and upstream cost.

## Covers

- `POST /v1/image` — `{ "prompt": "…", "aspect": "16:9", "references": ["data:image/png;base64,…"] }`:
  one image from `openai/gpt-image-2.5-sunburst` through OpenRouter at medium quality, with its
  model in `x-model`. `aspect` is one of `ASPECTS` in `src/image.ts`; prompt at most 4000
  characters; at most 3 PNG, JPEG or WebP references of 8 MB each. Same key and sign-in as
  narration, spending 320 AI credits per image, only once it is generated. Each call is recorded
  in `cloud.ai_calls` with its upstream cost.

## Music

- `POST /v1/music` — `{ "prompt": "…", "seconds": 30 }`: one instrumental track from
  `google/lyria-3-pro-preview` through OpenRouter, asked to end at `seconds` (5–180); the
  answer (MP3 today, WAV if the model sends one) is cut there, or at its last sound if earlier,
  and faded out. The call goes out from a `MusicCall` Durable Object's alarm, since one made
  while serving the request carries the user's country and the model refuses some, mainland
  China among them. Prompt at most 4000 characters. No header or refusal names the provider or
  model. Same key and sign-in as narration, spending 160 AI credits per track, only once it is
  generated. Each call is recorded in `cloud.ai_calls` with its seconds and upstream cost.

## Triage

- `POST /v1/judge` — `{ "state": {…}, "questions": { "<name>": { "type": "choice", "instructions": "…", "criteria": { "<option>": "…" } } } }`:
  forwarded to `typesafe/jev-1.13` through OpenRouter's Decisions API; answers
  `{ "answers": { "<name>": { "choice", "probabilities", "confidence" } }, "model" }`. Choice
  questions only, any number of them with 2–500 options each, 200,000 characters in all. Same key
  as narration. Any Pro sign-in; free — it spends no credits. Each call is recorded in
  `cloud.ai_calls` with its input tokens and upstream cost.

## Templates

The shared template catalog (#1708). Any verified sign-in, admitted or not. Metadata lives in
`cloud.templates`, files in the private `TEMPLATES` R2 bucket; every route refuses with
`templates_unavailable` when the build has none.

- `GET /v1/templates/tags?category=ui` — `{ "tags": [{ "tag", "count" }] }`, the category's tags.
- `GET /v1/templates?category=ui&tags=hero[,…]&q=<words>&limit=N` — templates carrying any of the
  tags, those matching more topic words first. Default 5, at most 10. Metadata only:
  `name`, `category`, `title`, `summary`, `description`, `tags`, `access`, `previews`
  (`{ path, size }`), `publishedAt`.
- `GET /v1/templates/<name>/previews` — `{ name, previews }`, its catalog previews;
  `…/previews/<path>` reads one image.
- `GET /v1/templates/<name>/source` — `{ name, source, evidence }`: where it came from, and the
  captured evidence's files. `GET /v1/templates/<name>/evidence/<path>` reads one.
- `GET /v1/templates/<name>` — the manifest: metadata, `source`, `files` and `evidence`, each
  file `{ path, size, sha256 }`. `pro_required` for an `access: pro` template without Pro.
- `GET /v1/templates/<name>/files/<path>` — one template file, on the same terms.
- `POST /v1/templates` — publish, as multipart: `meta` (JSON: `name`, `category`, `tags`,
  `title`, `summary`, `description`, `source`, `access`, `replace`) and one part per file named
  `files:<path>`, `previews:<path>` or `evidence:<path>`. `template.md` is required; files at
  most 50 MB, previews 3 images and 6 MB, evidence 10 files and 20 MB. `source` is
  `{ "original": true }` or `{ site, references, captured, archives?, note }` with at least one
  evidence file; `captured` carries its time zone. A taken name is `template_exists` unless
  `replace` is true. Handles in `TEMPLATE_PUBLISHERS` (`src/config.ts`) only, else `owner_only`.
- `DELETE /v1/templates/<name>` — take it out of the catalog, files included. Publishers only.
- `PUT /v1/templates/<name>/showcase` — register what the site shows, replacing any earlier
  one, as multipart: `meta` (JSON: `cover?`, `original?`, `recreation?`, each side
  `{ image, video? | youtube?, keyframe?, duration? }`) and one `media:<file>` part per file it
  names. At most 12 files and 80 MB. Kept through a replacement. Publishers only.

### Public catalog

No sign-in, `access-control-allow-origin: *` (#1711). Answers published metadata, the public
part of `source` and the registered showcase — never files, evidence or who published.

- `GET /v1/catalog` — `{ categories: [{ category, templates: [{ name, category, title, summary,
  tags, access, cover, duration }] }] }`, every template, newest first.
- `GET /v1/catalog/<name>` — `{ template }`: the above plus `description`, `publishedAt`,
  `source` (`{ original: true }` or `{ site, references, captured }`), `original` and
  `recreation` (`{ image, video, youtube, keyframe, duration }`, URLs or null).
- `GET /v1/catalog/<name>/media/<version>/<file>` — one cover or showcase file; ranges work.
  Cached for good: a new showcase or revision is a new URL.

## Billing

Free and Pro (#2017), Pro sold through Creem (#1037). The limits are `src/quota.ts`'s. Open to any verified sign-in, admitted or not: a subscription
belongs to the Supabase user. Every route refuses with `billing_unavailable` when this build
carries no `CREEM_API_KEY` / `CREEM_WEBHOOK_SECRET`.

- `GET /v1/billing` — `{ "billing": { "plan": "free" | "pro", "state": "free" | "active" |
  "canceled" | "pastDue" | "expired", "period": "monthly" | "yearly" | null, "periodEnd",
  "grantEnd", "resumable", "trialEnd", "mayTrial", "storagePacks" } }`. `periodEnd` is the renewal date while `active` or `pastDue`, the end date
  otherwise. Judged on read: `active`, `trialing`, `past_due` are Pro; `scheduled_cancel`,
  `canceled` until `periodEnd`; the best of several subscriptions wins. A seed partner's grant
  (#1039) also makes `plan` Pro and sets `grantEnd` while it runs; `state`, `period` and
  `periodEnd` stay the subscription's. `resumable` is true only when the subscription shown is
  Creem's `scheduled_cancel`. The 7-day trial (#1932) also makes `plan` Pro and sets `trialEnd`
  while it runs; `mayTrial` is true for whoever never had a trial, a subscription or a grant.
  Also `"credits": { "total", "left", "resetsAt" }` for Pro, `null` otherwise: Pro's AI credits
  this UTC month (#1113), spent by every hosted capability at the rates in `src/credits.ts`
  (`cloud.credit_spends`). On the trial alone, its fixed pool instead, with `resetsAt` null.
  Also `"quota": { "limits": { "tasks", "storage", "file", "retentionDays" }, "used": { "tasks",
  "storage" }, "storagePacks", "storagePack" }`: the plan's limits (bytes for sizes), with each
  paid storage pack adding `storagePack` to Pro's storage, and what the account uses — nothing
  for a sign-in not admitted.
- `POST /v1/billing/trial` — starts the trial and answers `billing`; `trial_used` unless
  `mayTrial`.
- `POST /v1/billing/checkout` — `{ "item": "pro" | "storage", "period"?, "source"? }`, `item`
  defaulting to `pro`: `{ "url" }`. Pro takes `"period": "monthly" | "yearly"` and is a Creem
  checkout returning to `/settings?checkout=done`, or `/settings?checkout=subscribed` for
  somebody already subscribed (`active`, `canceled` or `pastDue`), or `/settings` before the
  trial and while it runs. A grant alone may buy. `storage` is one monthly 100 GB pack
  (`CREEM_PRODUCT_STORAGE`), sold only to a Pro not on the trial alone (`pro_required`).
  `"source": "pricing"` returns to `/pricing?checkout=done`.
- `POST /v1/billing/confirm` — `{ "subscriptionId" }` from that return: reads it from Creem,
  writes it when it is the caller's, and answers `billing`.
- `POST /v1/billing/resume` — resumes the caller's `scheduled_cancel` subscription through
  Creem and answers the new `billing`; 404 when there is none to resume.
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

## Public API (v1)

Workspaces and their members, and the projects, workflows, tasks and their reviews, artifacts,
decisions and events in them. Every
route, body and response is in [`openapi.json`](openapi.json) (OpenAPI 3.1), also served at
`GET /v1/openapi.json`; routing is `src/v1/index.ts`. WildCrane's own surfaces call nothing else.

- **Authentication**: `Authorization: Bearer` takes a sign-in token or an API key (`wck_…`). A
  key acts for its account, is shown once on creation and stops working the moment it is
  revoked. Creating and revoking keys needs a sign-in. Any browser origin may call (CORS `*`).
- **Workspaces**: projects, workflows and tasks belong to a workspace; access is being
  one of its members. A resource in a workspace the caller is not in answers `not_found`, as a
  missing one does, from the request after they leave. Every account has a personal workspace
  (`personal: true`) holding what it had before: it takes no other members, cannot be left or
  deleted. Lists take `?workspace=` and creates `workspace`, the
  personal one when left out; a `project` names its own.
  - `GET /v1/workspaces` — the caller's, each with their `role`. `POST` `{ name }` makes one;
    the caller is its owner. `GET`, `PATCH { name }`, `DELETE /v1/workspaces/{id}` — renaming
    and deleting are owners' (`owner_only`); deleting takes its projects, tasks and files at
    once.
  - `GET /v1/workspaces/{id}/members`; `POST` `{ email }` adds the account signing in with
    that address as a `member` (none: `conflict`). `PATCH …/members/{account}` `{ role:
    "owner" | "member" }`; `DELETE` removes one, or the caller themself, which is leaving.
    Owners manage members; the creator stays an owner and cannot leave (`last_owner`).
  - `GET /v1/workspaces/{id}/runners` — `{ runners: [{ machine, name, connected, last_active }] }`:
    every member's computer holding a folder of one of its projects. `DELETE …/runners/{machine}`
    (`owner_only`) removes the workspace's folders there, and that computer claims none of its
    jobs until its owner places one of its projects there again.
  - `GET /v1/workspaces/{id}/stats?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=<IANA>` — per day, in `tz`
    (UTC by default), tasks `created`, `completed` (`done`) and `rejected` (`cancelled`), and
    the `usage` tokens and `costUsd` of runs finished that day. Days with nothing are left out;
    the range is at most a year.
  - **Roles**: a member reads and edits every project, task and card of the workspace,
    starts tasks and chats with the agent; owners also rename and delete it, manage its
    members, invite guests and change share links.
  - **Usage**: every member's counts against the plan of the workspace's creator. A task runs on
    the Runner of whoever started it (`created_by`), and its alerts go to them alone.
- **Ids**: prefixed by type — `ws_`, `prj_`, `wf_`, `task_`, `cp_`, `art_`, `dec_`, `key_`,
  `upl_`, `alr_`, `cmt_`, `shr_`, `evt_`, `rt_`, `tri_`. Built-in workflows are `wf_builtin_…` and read-only.
- **Task keys**: a task is also `key`, its project's `prefix` and its number there (`WC-12`);
  every `/v1/tasks/{id}` route and `?task=` take either. A move (`PATCH` with `project`) or a
  new prefix gives a new key, and the old one still finds the task. Prefixes are unique per
  workspace; a key in two of the caller's workspaces finds the personal one's. A task filed
  without a project is in its workspace's `general` (`TASK`, `general: true`), made on first
  need; a `project` must be in the same workspace.
- **Pagination**: `limit` (1–100, default 20) and `after`; a list answers `{ "data", "next" }`,
  and `next` is the `after` of the following page, `null` on the last.
- **Errors**: the shape in [Refusals](#refusals). A broken state rule — a decision with nothing
  submitted, a write to a finished task — is `conflict`.
- **Idempotency**: every create but an API key or a share link takes `Idempotency-Key`. A retry with the same
  key and body answers the first response with `Idempotent-Replayed: true`; a failed attempt
  keeps nothing. Keys are kept a day.
- **Workflows**: a workflow is its files, as on a board: `WORKFLOW.md` and each agent's folder
  (`agents/<name>/AGENT.md` and the files beside it), text only, each up to 256 KB and 2 MB
  together. `POST /v1/workflows` and `PATCH /v1/workflows/{id}` take `{ files }`, checked as akb
  reads them — a broken file is `bad_request` naming it; `expertise`, `checkpoints` and `memory`
  are refused. A `PATCH` replaces every file as a new `version`; `name` and `description` come
  from `WORKFLOW.md`. `GET /v1/workflows/{id}` adds the current `files`. Built-ins are packed from
  `cli/src/workflows` with the agents they run, plus the skills (`skills/<name>/`) and MCP
  servers (`mcp.json`, `{ mcpServers: { <name>: { command, args? } } }`) their folder declares,
  and carry `names: { en, zh }`. `GET /v1/workflows` lists only the built-ins the workspace has
  installed, then its own.
- **Workflow marketplace**: the built-ins are the official workflows, installed per workspace.
  A new workspace has every listed one installed. `GET /v1/marketplace/workflows?workspace=`
  lists them all with `installed`; `POST /v1/marketplace/workflows/{id}/install` and
  `/uninstall` (`{ workspace? }`) are owners' (`owner_only`). A task made on one not installed
  is `not_found`; an uninstall or a new version never reaches a task already made.
- **Workflow builder** (#2004): `wf_builtin_workflow_builder` writes a workflow from the
  request. `POST /v1/tasks` with it and `run: true` makes a new one; `context: { workflow }`
  names one of the workspace's own to change instead — a built-in is `read_only`, any other id
  `not_found`, and another workflow taking `context` is `conflict`. Every job of the task sends
  the workflow's files back checked, and a check that fails fails the task; a change to them
  asks for a new review. Approving the plan saves them in the same write — a new workflow, or a
  new version of the one named — with `workflow.created` or `workflow.updated`, and the task's
  `context.workflow` names it (`context.created` when it is new). A task already running stays on its version.
- **Task workflow**: a task runs on the workflow version current when it was created; later
  changes reach only new tasks. `GET /v1/tasks/{id}/workflow` reads it: `{ workflow, builtin,
  version, name, description, round, rounds, stages, lands, files }` — the approval its card is on,
  how many its card makes (`metadata.stages`, 1 by default), the agents of each (`stages`, from the
  previews the card chose and each one's `after`), and whether approving the last one builds.
- **Reviews**: a task carries its own `review { status, phase, revision, question,
  options, card_question }`. A finished `plan` job submits its draft: the card's current approval
  (`metadata.phase`, 1 by default, within its `metadata.stages`) goes up `ready`, and the
  task waits for review. Approving one moves the card to the next; approving the last queues
  the build when the workflow has `land` agents, and ends the task otherwise. Comments, decisions,
  artifacts and alerts each record their `phase`. A version on an artifact submitted for the
  phase under review puts a review sent back up again. The latest decision sets it `approved` or
  `changes_requested`. `done` needs the open review approved.
- **Run tasks**: `POST /v1/tasks` with `run: true` hands the task to its creator's Runner, which
  works it with akb one step at a time; a Runner not connected leaves the step waiting. The
  request opens the creator's chat on the task. Each step that ends done submits the card's
  stage for review — asking the card's open question when it has one (`card_question`, no
  approving option), else whether to approve — and the agent's summary answers the chat that
  started it. Requesting changes answers the question or revises the card; approving moves to
  the next approval, then builds, or ends a task whose workflow has nothing to land. A build held
  on the card's question asks it the same way, and the answer carries the build on. A decision
  while a step is waiting or running is `conflict`. A task reads `run: { state: "queued" |
  "running", runner_connected, machine, stopping, runner_removed, job } | null`, `result` once done, `failure` once failed, and
  `last_job`, whose log `GET /v1/runner/jobs/{id}/stream` streams and `GET /v1/runner/jobs/{id}` reads once ended. Nothing is retried; a step whose
  Runner went away fails the task. A running task cannot be cancelled (`task_running`).
- **Stop and resume** (#2128): `POST /v1/tasks/{id}/stop` stops a running step, keeping its work:
  `run.stopping` until its Runner has stopped, a Runner not connected stopping once it connects,
  then the task is `stopped`. A stopped or failed task reads `resume: { machine } | null`;
  `POST /v1/tasks/{id}/resume` runs its last step again on that computer, carrying on its work,
  and waits while it is offline. Either one refused is `conflict`.
- **Runtimes** (#2074, #2135): the caller's own list of what their tasks run on, whatever the
  workspace — `{ name, runner, connector: "claude-code" | "codex" | "cursor" | "opencode" | "kimi" | "dsh" | "zcode" | "grok",
  model | null, settings, secretsSet }`. `runner` is the Runner's machine id: the runtime's jobs go to that computer
  only and wait while it is offline. `settings` are the connector's own (`{ key: value }`, by the keys its harness
  declares); `secretsSet` the keys that Runner holds. A key is sent as `secrets: { apiKey }` (`null` clears it),
  handed to the runtime's Runner in a job and kept there only; the request waits for it, and is `runner_offline`
  when the Runner is not connected and `runner_outdated` when it is too old to keep one. `GET /v1/runtimes`
  lists Global default first (`default: true`, made on first read by the old pick: Claude Code
  installed and signed in, else Codex), with `connectors` as the Runner last reported them,
  `models` (`{ "<connector>": [{ id, name }] }`, what each offers there), `connector_settings`
  (`{ "<connector>": [{ key, label, kind, help?, placeholder?, choices?, providers?, defaultProvider? }] }`),
  `runners` (`[{ id, name, online }]`) and `runner_connected`. `POST` adds one (`runner` required), `PATCH …/{id}` changes it (`model: null` clears it),
  `DELETE` removes it; Global default is never renamed or deleted (`conflict`), and a taken
  name is `bad_request`. `POST …/{id}/test` sends one short prompt through the Runner and
  answers `result: passed | not_installed | signed_out | timeout | failed` with `elapsed_ms`
  (30 s at most; `runner_offline` while it is not connected). `POST /v1/tasks` takes
  `runtime`; every step runs on it, or on Global default when it is left out or deleted.
- **Artifacts**: inline JSON up to 256 KB per version, or a file within the plan's limit: `POST
  /v1/artifacts/{id}/uploads` with its `size`, `PUT` up to 50 MB to its `url` within an hour —
  or, larger, each 50 MB part to `parts.url` within a day and then `POST` its `url` — then
  submit a version naming the upload. Versions and decisions never change.
- **Plans**: a task past the plan's tasks at once, or a file past its file size or storage, is
  `quota_exceeded`. Open tasks are counted per plan, across every Runner and every workspace it
  pays for; a task made without `run` is neither checked nor counted while it waits. A finished task,
  its history and its previews are deleted together once the plan's keep (`retentionDays`
  since it finished) runs out, by the hourly run.
- **Deleting a project** deletes its board files; in a personal workspace its tasks move to
  `general`, numbered anew, and elsewhere a project still holding tasks is `conflict`.
  `general` cannot be deleted.
- **Events**: each change writes one, kept 30 days, read across every workspace the caller is in
  while they are in it, in order; an `alert.*` reaches only its account: `workspace.created`,
  `.updated`; `member.added`, `.updated`, `.removed`; `project.created`,
  `.updated`, `.deleted`; `workflow.created`, `.updated`, `.deleted`, `.installed`, `.uninstalled`; `task.created`,
  `.updated`, `.cancelled`; `triage.created`, `.updated`; `card.updated`; `chat.updated` and `discussion.updated` (its member alone); `review.updated`, `.ready`, `.approved`,
  `.changes_requested` (`{ object: review, task, ...review }`); `comment.created`; `share_link.created`, `.updated`, `.revoked`; `guest.added`, `.removed`;
  `artifact.created`, `artifact.version_created`; `decision.created`; `alert.created`, `.read`. `data` is the resource after the change. Page them with `GET /v1/events?after=`,
  or hold `GET /v1/events/stream` (SSE) and resume with `Last-Event-ID`. A sign-in reading the
  page passes `after` (empty starts at the oldest); without it the request is the v0.11 feed
  above.
- **Alerts**: a review turning `ready` raises a `review` alert, a task ending `done` or
  `failed` raises one of that kind, and a reviewer's comment a `comment` alert carrying
  `comment: { id, author, body }` (`null` on the others) — to whoever started the task, once, on one channel: `desktop` when their
  connected Runner shows notifications and the project's bell is on there, `web` otherwise.
  Reading one (`POST /v1/alerts/{id}/read`) reads the task's others of that kind and
  phase; deciding the review or ending the task reads its review alerts. A guest's or
  another member's comment raises a `comment` alert; the task's starter's own reads them.
- **Cards**: a task has one full card. `PUT /v1/tasks/{id}/card` `{ body, metadata?, assets?,
  base_version }` saves over it; `base_version` is the `version` it was written against (`0` for
  the first), else `conflict`. The body is kept as written, fences closed and at most one
  `<!-- agent -->`. `metadata` holds only `modules`, `priority`, `roi`, `parent`, `source`,
  `related`, `blocked_by` and `schedule`. `assets` maps a path the body names to `{ artifact, version? }` on the same task; no
  `version` follows the latest. `GET /v1/tasks/{id}/card` reads it; a task's `card_version` is its
  file's `seq`, `null` before the first. Earlier cards are not kept.
- **Landing** (#2109): a build that landed reads `landing: { commit, branch, machine }`, `null`
  otherwise; nothing is pushed. `GET /v1/tasks/{id}/diff` asks that computer for the commit's
  diff each time: `503 machine_offline` when it is not connected or does not answer within 15 s,
  `404 commit_gone` when it no longer has the commit.
- **Dependencies and groups** (#2064): the card's frontmatter holds them, as on a local board.
  `metadata.blocked_by` (keys, ids or numbers of tasks in the same project) and `metadata.schedule`
  (`{ action: implement | refine | revise, notes? }`, `null` to clear) are written into it, the
  blockers as the tasks' numbers; the card read back names them by key. `metadata.parent` names
  the group root, whose `## Todo` lists each subtask as a line ending in `#<number>`; a card under a
  group folder (`todo/<number>-<slug>/`) has that folder's task as its parent. A card file is named
  by its task's number: `todo/<number>-<slug>.md`, or a group's `todo/<number>-<slug>/root.md`.
  `POST /v1/tasks` takes `metadata` (`priority`, `roi`, `modules`, `related`, `blocked_by`, as
  `PUT /v1/tasks/{id}/card` takes them) for the card its first step writes, and `images` (#2182,
  as a chat message's) that step puts on the card. A step for a
  task with a blocker not yet `done` or `cancelled` waits on it (`queued`, no job), planning too. When a task
  becomes `done` or `cancelled`, its project's cards change as `akb raw archive` / `reject`
  change a local board's: cards it blocked get a revise queued in their `schedule`, every
  `blocked_by` / `related` naming it drops it, its group root's line is ticked (`done`) or struck
  (`cancelled`), and a root whose lines are all resolved — one ticked, no open question or
  unticked todo of its own — becomes `done`. A task left with no blocker then starts the step it
  waited with, else its `schedule`, which comes off the card. Each card changed is a new version
  with `task.updated`.
- **Board files** (#2081, #2114): one board per workspace. A project's cards (`todo/`, `.archive/`,
  named `<n>-<task id with ->.md`), memory (`memory/`), the workflow versions its tasks run on
  (`workflows/<id>/`), `triage/`, each task's assets list (`assets/<task>.json`) and its settings
  (`modules.md`, `config.md`, `rules/<agent>.md`, `rules/workflows/<workflow>.md`, #2106) sit under
  `projects/<project id>/`; the workspace's shared memory under `memory/`. Memory is these files
  alone. Each is at most 256 KB; `todo/README.md` and `.sync/` are never kept. Every write gives
  the files it changes the workspace's next `seq`; a deleted file stays as `content: null`.
  `GET /v1/projects/{id}/board?since=<seq>` answers `{ head_seq, files: [{ path, content, seq }] }`
  for what of the project's and the shared memory changed after `since`, every file without it.
  `POST /v1/projects/{id}/board/commits` `{ job, machine, files: [{ path, content | null, base_seq }] }`
  writes what a Runner job changed there, all or nothing, while that computer holds the job
  (`conflict` otherwise); a file whose `base_seq` is behind refuses the write as
  `version_conflict`, answering `files` as they are now. A file already holding what is written
  is no conflict. Each card written updates its task's index, by the path under the project:
  `title`, `card_version`, the previews it chose (`previews`), how many approvals they make
  (`stages`), the one it is on (`phase`) and `assets`.
- **Import** (#2123): `POST /v1/projects/{id}/import` `{ board, cards?: [{ ref, number, title,
  workflow, path, body, review? }], files?: [{ path, content }] }`, owners and members, answers
  `{ cards: [{ ref, task, number }], kept, next }`, `next` the project's next number. Each card, in order, becomes a task that does not run,
  its old number kept as `source_context.import`; the project must hold no task or only ones
  imported from the same `board`, a card imported before answers its task, and a `number` that is
  not the project's next refuses the call (`conflict`). At most 50 cards a call. The cards of new
  tasks and `files` are written and indexed; a shared memory file the workspace already has is
  kept and named in `kept`. `review: true` puts the card on review asking to approve the plan,
  `{ question, options, position }` asks the card's own question.
- **Agents** (#2106): `GET /v1/projects/{id}/agents` answers `{ workflows, board, data }`: each
  workflow the project's board holds (built-ins first, a Workflow builder draft never) with its
  preview agents (`previews`), the approvals they make when a card chooses them all (`stages`, a
  list of agent lists), what lands it (`land`) and its scheduled agents, the board's own scheduled agents, and each
  agent as `{ agent, title, description, workflows, rule, schedule: { on, cadence, default,
  last_success } | null, last_run: { at, status } | null }`. `PUT /v1/projects/{id}/agents/{agent}`
  `{ rule?, schedule?: { on, cadence } }`, owners and members, writes `rules/<agent>.md` (an empty
  rule deletes it) on the board, where each Runner reads it at its next pull, and keeps the
  schedule in Cloud (#2138), in every workflow listing the agent. The periodic agents a Runner is
  handed take it over their defaults; one switched off is never due, a finished task queues no
  reflect or describe-project while that one is off, and switching one off drops its jobs still
  waiting. `POST /v1/projects/{id}/agents/{agent}/run`
  queues a scheduled agent's job, on or off, `{ agent, queued }`, `queued: false` while one waits
  or runs.
  Each workflow carries `rule`, the user's rule for every card on it (#2166); `PUT
  /v1/projects/{id}/workflows/{workflow}/rule` `{ rule }`, owners and members, writes it as
  `rules/workflows/<name>.md` (`coding` for `wf_builtin_coding`, the folder for an own one; an
  empty rule deletes it) and answers the workflow.
- **Review**: a task's review is of its current card. `PATCH /v1/tasks/{id}/review`
  `{ question?, options? }` sets the choice put to the reviewer — `options` `[{ label, approve?
  }]`, exactly one `approve: true`. That, a new version of an artifact under review, or a saved
  card while the review is open, moves its `revision` on; it never goes back. `GET`/`POST
  /v1/tasks/{id}/decisions` lists every phase's decisions and decides the phase under review; a
  decision on a task with a card names the `review_revision` it was made on, else
  `review_outdated`.
- **Comments**: `GET`/`POST /v1/tasks/{id}/comments` `{ body }`, every phase's, a sign-in only
  (`session_required` for a key). `comment.created` reaches sign-ins only, never a key's feed.
- **Share links**: `POST /v1/tasks/{id}/share-links` `{ access?, expires_in_days? }`
  answers `{ id, url, access, expires_at }`; the `url` is shown only here. `access` is
  `invited` (default: the workspace's members and the task's guests) or `link` (anyone holding
  it, read only, made by owners only); 7 days by default, 30 at most. `PATCH
  /v1/share-links/{id}` `{ access }` and `DELETE /v1/share-links/{id}`, which revokes, are
  owners'; `GET /v1/tasks/{id}/share-links` lists them. A link opens whichever phase is under
  review then.
- **Guests**: `GET /v1/tasks/{id}/guests`, `PUT`/`DELETE /v1/tasks/{id}/guests/{email}`. A guest
  opens every `invited` link of the task to comment, and nothing else;
  50 a task at most. Owners invite and remove them; it takes effect on the next request. `PUT`
  takes `{ share_token?, lang? }`: an email new to the task is mailed that link (an open link of
  the task, else `400`), in `zh` or `en` (default), and the answer's `mail` is `"sent"`,
  `"failed"` (not retried) or `null` when nothing was due.
- **Shared review**: `/v1/shared/{token}` is the link's task, and only it. An `invited`
  link needs a sign-in (email code or GitHub): a member's of the task's workspace, or a guest's
  email. A `link` link needs none. Admission and API keys play no part. `GET` answers `{ role:
  "owner" | "member" | "guest" | null, me, link, owner, workspace, task, review, card,
  artifacts }` — `owner` is who started the task, `task` has its `status`, `workspace` `{ id, name }` for members —
  plus `decisions`, `comments` and `revisions` for any role, and `guests` for owners; without a
  role there is no review `status` either. `artifacts` are those submitted for the phase under
  review and those
  the card's `assets` name; `GET …/artifacts/{id}/versions/{version}/file` reads a file of one. `POST …/comments` `{ body }` needs a role
  (`view_only`); `POST …/decisions` `{ picked?, text?, review_revision }` a member's
  (`owner_only` for a guest or a visitor): `picked`
  is an option's index, the approving one approves and any other requests changes, with `text`
  added to it; no `picked` is "other" and needs `text`. With no options set, the one option is to approve. Authors are
  `{ kind: "reviewer", email, handle? }` for a guest, or `{ kind: "user", handle }` for a member.
- **Chat**: each workspace member's own conversation with an agent on a task: `GET`, `POST`,
  `DELETE /v1/tasks/{id}/chat`, or `/v1/shared/{token}/chat` on the review page (`owner_only`
  for a guest or a visitor). Nobody reads another's. `GET /v1/chats?workspace=` lists the
  caller's, newest message first: `{ task, key, title, project, last_message_at, state:
  "replying" | "waiting_you" | "idle" }`; a change raises `chat.updated` `{ task, state }` to the
  member alone. `GET` answers `{ messages: [{ id, role: "user" | "agent",
  body, image_names, stopped, usage, cost_usd, duration_ms }], status, runtime, runtimes, runner: { connected }, context: { used, limit } | null }`:
  `status` is `idle`, `queued` behind the task's other Runner jobs, `replying`, or how the last
  reply failed (`failed`, `conflict` when the card was updated elsewhere); `runtimes` the options
  `[{ id, name, default, connector, model, status: "ready" | "not_installed" | "signed_out" }]` —
  first the task's runtime as `id: "task"` (`name` null unless you started the task), then your
  other runtimes — with `status` read off the task creator's Runner; `runtime` the pick, `"task"`
  when following the task, which a deleted runtime falls back to. `POST` `{ body, runtime?,
  images? }` (one of your runtime ids or `"task"`; left out, the last pick) sends one message as a job of the
  task on the Runner of whoever started it, on the runtime's connector and model, carrying the
  last 30 messages; the reply lands as a message and a card change as a saved card when it ends.
  One reply at a time (`chat_busy`), only with the Runner connected (`runner_offline`), and only
  with the connector ready there (`runtime_unavailable`; the message is not kept). Each chat keeps
  one agent session; another connector or model starts a new one. `DELETE` clears the messages
  and the session (`chat_busy` while replying). A message is kept 30 days (#2065).
  `images` (#2133): up to 4 `{ name, type: "image/png" | "image/jpeg" | "image/gif" | "image/webp",
  content }` in base64, about 4 MB together, given to the agent as files and dropped once the job
  ends; the message keeps `image_names`. `POST …/chat/stop` stops the reply: a waiting one is
  dropped, a running one's Runner stops and what it wrote lands `stopped: true`. A reply reads
  its job's `usage`, `cost_usd` and `duration_ms`, null for an older one.
- **Discussions** (#2073): the caller's own conversation drafting up to 10 ideas, never on a board
  and never an open task; anyone else reads `not_found`. `POST /v1/discussions` `{ workspace?,
  project?, body, runtime?, images? }` makes one with its first message (201; nothing is made when that is
  refused); `GET`, `DELETE /v1/discussions/{id}` (unstarted ideas go; started tasks stay with
  `discussion: null`); `POST`, `DELETE …/chat`, `POST …/chat/stop` as a task chat's (`{ body, runtime?, images? }`, one of your
  runtime ids), run on your Runner, in the project's folder when placed there. It reads `{ id,
  workspace, project, title, messages, status: "idle" | "replying" | "failed", runtime, runtimes,
  runner, context, ideas: [{ id, title, outcome, acceptance: [], workflow, task: { id, key } |
  null }] }`. `PATCH …/ideas/{idea}` `{ workflow }` (installed or the workspace's own, else
  `not_found`), `DELETE …/ideas/{idea}` discards one; `POST …/ideas/{idea}/start` `{ project? }`
  answers 201 the task `POST /v1/tasks` with `run: true` makes of it — request the outcome and
  a `## Done when` list — and a task reads `discussion`. A started idea is `conflict` to all
  three. `GET /v1/chats` lists it as `{ discussion, title, project, last_message_at, state }`
  (`waiting_you` when the agent spoke last and an idea waits) until it had ideas and none waits.
- **Claude Code and Codex discussions** (#2161): `POST /v1/discussions/external` `{ workspace?, project?,
  requestId, host? }` opens the caller's discussion for one host session (`host`: `claude-code`,
  the default, or `codex`, #2160), the same one again for the same `requestId`; it keeps no
  messages (`…/chat` is `conflict`) and sends nothing to a Runner. `GET /v1/chats?external=1`
  also lists one with an idea waiting, at its last change, reading `host`. A discussion reads
  `version`, moved by every change to its ideas, `external` and `host`. `PUT …/draft`
  `{ expectedVersion, ideas }` replaces its open ideas — an open one left out is discarded, a
  started one stays, nothing starts — and a moved version is `version_conflict` (409) with the
  discussion as it stands. Its `…/start` needs `expectedVersion`, and a retry
  answers the task already made.
- **Rejections and triage** (#2067): `POST /v1/tasks/{id}/cancel` takes `{ reason? }` (at most
  2000); a task reads `cancel_reason` and `cancelled_by`. A triage item is a follow-up waiting to
  be sorted, in a project (`general` without one), kept as a board file (#2107) — `triage/<name>.md`
  open, `triage/dismissed/` or `triage/archived/` once sorted, synced to Runners with the board:
  `{ id: "tri_<project>_<name>", project, title, text, source_task, workflow, state: "open" |
  "dismissed" | "carded", dismissed_reason, dismissed_by, dismissed_at, task }`; a move never
  renames the file, so the id stays. `GET /v1/triage?project=&state=&order=` lists them by when each
  last moved — `state` takes several, comma-separated, and `order=desc` pages newest first
  (#2112); `POST /v1/triage` `{ title, text?, project?, workspace?, source_task?, workflow }` adds
  one — `workflow` installed in or owned by the workspace, else `bad_request` (#2139) — and the
  same title and text in the same project answer the one kept. `POST …/{id}/dismiss` `{ reason }`,
  `POST …/{id}/restore` (a dismissed one only); `POST /v1/tasks` `{ triage }` makes a task of an
  open one, in its project, and moves it to `archived/`; with `{ run: true, skip_plan: true }` its
  first step writes the card and builds it unplanned (`skip_plan` without `run` is
  `bad_request`) — a carded one is `conflict` to all three. `triage.created` and `triage.updated`
  carry the item, a Runner's write included. `GET /v1/rejections?workspace=` answers what the
  planner has not learned — `tasks` cancelled with a reason, `triage` the user dismissed or a
  learned dismissal restored since — and `POST /v1/rejections/reviewed` `{ tasks, triage }` marks
  them learned; a Runner does both around its rejection review before planning a task. When the
  workspace's owner has Pro, Cloud judges each new item once (#2124), off the response, the
  Runner's write or the hourly run: it makes a task of it, dismisses it with `dismissed_by: agent` —
  never learned from — or leaves it open; an item's own `workflow` is the one its task runs on.
  Sorted items leave the board on the plan's keep (#2017); a dismissal not learned yet waits for it.
- **Components**: an account's own preview for its own artifact types (#2006). `POST
  /v1/components` `{ name, version, manifest }` — `manifest` is `wildcrane.component.json`'s
  `{ title: { en, zh }, types, schema? }`, each type `@<handle>/<name>` — answers the version and
  `upload`; `PUT` the bundle there (a tar, gzipped or not, `index.html` at its top, 10 MB
  unpacked). A version is published once and never changes; `name` is no built-in type. `GET
  /v1/components`, `GET /v1/components/{name}`; `DELETE /v1/components/{name}/versions/{version}`
  removes one for good. An artifact version pins the newest uploaded version drawing its type
  on a task the publisher started (`component`, `null` for none). The review page reads it with
  `GET /v1/shared/{token}/components/{name}/{version}` — only a version an artifact under review
  uses, a removed one `not_found` — and frames its `url`, `https://<hash>.wildcraneusercontent.com/`,
  served with no network (`connect-src 'none'`) and framed only by the review page and WildCrane
  Web (`APP_URL`). A member reads the one an artifact version pinned with `GET
  /v1/artifacts/{id}/versions/{version}/component` (#2082), `not_found` for none. A save from
  the component is `POST /v1/artifacts/{id}/versions` `{ content, pin: true }`, an owner's only
  (`owner_only`): the card's assets pinned to the artifact move to the new version with it.
- **Compatibility**: within `v1` fields and endpoints are only added, never changed or removed.
  A breaking change ships as `v2`; an endpoint on its way out answers `Deprecation` and `Sunset`
  at least six months before it is removed.

## Local Runner

The account's one Runner (`runner/`). Every job route takes `machineId`, the computer asking.

- `GET /v1/runner/version?machine=<id>` — the version a launcher starts. **No sign-in.**
  `version` is null until `npm run runner-release` sets one.
- `POST /v1/runner` — register or renew: `{ machineId, machineName, protocol (5 or later), version, runtimes:
  [{ name: <one of the eight connectors>, installed, loggedIn?, models?: [{ id, name }], settings?: [<as connector_settings>] }],
  secrets?: { "<runtime id>": ["apiKey"] }, notify? }`. `secrets` says which keys it holds; `notify` says this
  computer shows notifications (the desktop app, switched on and allowed). Renew inside 15 minutes or the
  computer stops counting as connected. `GET` reads it, with `name`, this computer's name.
- `POST /v1/runner/release` — free the account for another computer at once.
- `GET /v1/runner/presence?machine=<id>` — a WebSocket the Runner pings (`ping` → `pong`), token as the
  `bearer` subprotocol. Silent for about 90 seconds, the machine's lease ends then, not at its expiry (#2163).
- `POST /v1/runner/jobs` — dispatch: `{ runtime, project?, task?, stage?, prompt, attachments?: [{ name,
  content (base64) }] }`. A project placed on a computer runs in its folder there, and only
  that computer sees the job; otherwise it runs in the Runner's own folder. With `task` (id or
  key), which must be one the caller started and whose workspace they are still in, it runs in
  that task's folder, in the task's project, and after the task's earlier
  jobs: one of a task's jobs runs at a time, in the order sent. A task's job may name its
  `stage`, `plan` or `execute`; a `plan` job ending done submits the card's draft for review.
- `GET /v1/runner/jobs?machine=<id>` — waiting jobs whose turn it is and the ones this computer
  holds. A job reads `task`, `stage`, `attempt` and `resume`, the agent session a chat's job
  continues, and `flow`: a run task's step `{ verb: "create" | "resolve" | "revise" | "approve"
  | "implement", workflow, card?, text?, title? }`, null on any other job. `card` is the akb
  card the Runner reported; `text` the request, the answer or the change asked. `model` is the
  runtime's model, null for the connector's own; `runtimeId` and `settings` the runtime's own; `secret: true`
  hands over the runtime's keys, which its claim carries once as `secrets`; `test: true` is a runtime's connection test,
  whose finish reports `ms` and, failed, `not_installed`, `signed_out` or `timeout` as `reason`.
  `discussion: { id, workspace, ideas: [{ id, title, outcome, acceptance, workflow, task }] }` is
  a discussion's reply job (#2073), null on any other. `chat: { message, body }` is the user's
  message a chat's job answers; `review: { tasks }` a review of those tasks' chats (#2065).
- `GET /v1/runner/chats?machine=<id>` — `{ chats: [{ task, project }] }`: the archived tasks whose
  chat this computer answered last, within the 30 days chats are kept.
- `POST /v1/runner/reviews` — `{ machineId, project, tasks, runtime, model? }`: a review job of
  those tasks' chats, run by this computer alone; one still going on the project is answered instead.
- `GET /v1/runner/jobs/<id>?after=<seq>` — a job and, once it has ended, its events after `seq`,
  each `{ seq, kind, text, data, at }`; a running job reads `events: []`. A run task's step is
  readable by every member of its workspace. A finished job also reads `reply`, `usage` and
  `costUsd`, null when the Runner sent none. Logs are kept as long as their job.
- `GET /v1/runner/jobs/<id>/stream` — a WebSocket carrying a running job's log. The access token
  goes as the subprotocols `bearer, <token>`. With `?machine=<id>` it is the holding Runner's: the
  service sends `{ type: "hello", after, watched }`, the Runner sends `{ type: "events", events }`
  with every event after `after` (`{ seq, kind?, text?, data? }`, at most 500 a message) and
  `{ type: "end" }` before `/finish`; `{ type: "watched", on }` says whether a page is watching,
  and `{ type: "ended" }` closes it. Without `machine`, whoever may read the job watches it:
  `?after=<seq>` sends what is stored after `seq`, then each `{ type: "events", events }` as it
  arrives, then `{ type: "ended" }`. A log not ended 15 minutes after its last events ends itself.
- `POST /v1/runner/diffs/<request>` — `{ machineId, files: [{ path, status, added, removed, binary?,
  patch? }], truncated }` or `{ machineId, gone: true }`: the answer to a `diff` hint
  (`{ diff: <request>, project, commit }`), handed to the page waiting on it and never stored.
- `POST /v1/runner/jobs/<id>/claim` — answers `{ claimed, job }` or `{ claimed: false, reason }`.
  Only a waiting job is claimed; an interrupted one never runs again.
- `POST /v1/runner/jobs/<id>/renew` · `/finish` (`{ outcome: "done" | "failed" | "conflict" | "stopped", reason?, report?: { reply?, session?,
  context?: { used, limit }, usage?: { input, cacheCreation, cacheRead, output }, costUsd?, card?,
  review?: { question, options, position }, landing?: { commit, branch }, ideas?: [{ id, title, outcome, acceptance, workflow,
  start?, dropped? }] } }`) — a discussion's job reports its ideas' whole state: a new id adds one,
  a known open one is updated or `dropped`, a started one is left alone, and each `start: true`
  is then started as `POST …/ideas/{idea}/start` would (a refusal leaves it unstarted); a step
  reports its akb `card`, and the card's first open `[user]` question with its 1–8 options and
  its 1-based place in `questions:`; a failed step's `reason` is shown as the task's failure.
  An event's `kind` is `message`, `tool_call`, `tool_call_update`, `plan`, `error` or `log`
  (the default), with `log` in `text` and the rest in `data`, ACP's session-update fields.
  `report.stopped: true` marks a chat reply stopped part way (#2133). `renew` answers `stop: true`
  once its chat asked to stop, also sent over the log as `{ type: "stop" }`; a Runner before
  protocol 8 gets `renewed: false` instead and the job ends there.
  `renewed` or `finished` is false once the lease has run out. `conflict` is a task's job whose board write
  was refused: it is sent again first in the task's line (`attempt: 2`, answered as
  `retry`); a second conflict fails it, "The card was updated elsewhere." A task's job whose
  lease ran out is sent again the same way, on the same one retry.
- **The Runner's task folder**: `<project>/.akb/kanban` for a project placed on the
  computer (kept out of git), otherwise its own board `~/.wildcrane/cache/<project>/.akb/kanban`
  (the folder a git repository), kept across jobs: a working copy of the project's board files,
  `projects/<id>/` as its root and each shared `memory/` file, the ones its agents declare the
  workspace's, at `memory/<name>`. The project folder's `.akb/base.json` holds what it last
  read, each file with its `seq`. Before a job it reads what changed since in one call and
  resets the board files to Cloud's;
  copies the task's workflow agents to `agents/<name>/` (a built-in's are akb's own) and its
  skills into the project's `.claude/skills/` and `.agents/skills/` (out of git, never over a
  skill the project holds); and writes the card's assets where the body names them. After a job that ended done it
  uploads changed or new assets as artifact versions, then writes every changed board file in
  one commit; refused, it merges each file both sides changed line by line against what it read
  (a delete against an edit does not merge) and writes once more, else ends as `conflict`.
  Offline it claims nothing; a job already running finishes and is written back once it is
  online again within the lease, else dropped. The workflow's MCP servers reach that job's runs
  alone, as runtime arguments.
- `GET /v1/runner/folders?machine=<id>` — the projects placed on this computer: `{ project, name,
  path, notify }`. With `elsewhere=1`, `{ projects }`: those of the caller's workspaces not on it,
  `{ project, name, workspace, workspace_name, personal }`. `POST` places a folder
  (`{ machineId, name, path, project? }`) as a new project, or as `project` when given — any
  member of its workspace may — from the connected Runner only; the same folder again answers
  its project, and one held by another project is `folder_taken`.
  `POST /v1/runner/folders/<project>/remove` takes it off this computer and keeps the project;
  `/notify` (`{ on }`) switches its bell here.
- `GET /v1/runner/inbox` — `{ review, running }`, newest first: `{ task, title, project,
  project_name, phase, detail, at, alert }`. `detail` is the phase's name (`null` without
  phases); `alert` is the unread alert, if any.
- `GET /v1/runner/alerts?machine=<id>&comments=1` — this computer's alerts not yet shown;
  `comment` alerts only with `comments=1`;
  `POST /v1/runner/alerts/<id>/shown` (`{ machineId }`) marks one shown.

## Refusals

Always `{ "error": { "code": ..., "message": ... } }`; `message` is shown to a user as is.

| Code | Means |
| --- | --- |
| `unauthenticated` | No sign-in, or an expired or unreadable one. Signing in again fixes it. |
| `not_admitted` | A good sign-in from an account not admitted. Never answer it with "sign in again". |
| `not_yours` | The request named another account's row. |
| `owner_only` | The caller is a member without the owner role. They can still work in the workspace. |
| `last_owner` | The change would leave the workspace with no owner, or take its creator's. |
| `operation_reused` | One `opId`, two different changes. A same-payload retry gets the first result instead. |
| `slack_unavailable` / `slack_not_connected` | This build carries no Slack app, or the account connected none. |
| `lark_unavailable` / `lark_not_connected` | This build carries no app for that cloud, or no destination is connected. |
| `no_verified_address` | GitHub attests no address for this account. |
| `training_slot_taken` | That hour is booked or no longer offered. The page keeps the form. |
| `training_too_many_attempts` | Too many booking submits from one caller. Carries `retry-after`. |
| `contact_too_many_attempts` | Too many contact submits per address or email. Carries `retry-after`. |
| `speech_unavailable` / `speech_failed` | This build carries no narration key, or the provider failed. Retry later. |
| `image_unavailable` / `image_failed` | This build carries no image key, or the provider failed. Retry later. |
| `music_unavailable` / `music_failed` | This build carries no music key, or the provider failed. Retry later. |
| `judge_unavailable` / `judge_failed` | This build carries no key for judging, or the provider failed. Retry later. |
| `pro_required` | Hosted voices, images, music, judging triage items and Pro templates' files need Pro. |
| `runner_elsewhere` | The account's Runner is connected on another computer, named in the message. |
| `runner_outdated` | The Runner's protocol is too old. Restarting it updates it. |
| `folder_taken` | The folder belongs to another project on this computer, named in `project`. |
| `template_exists` | Publishing under a name already taken, without `replace`. |
| `templates_unavailable` | This build carries no template bucket. |
| `credits_used_up` | This month's AI credits are used up. Carries `retry-after` to the next UTC month; on the trial, none. |
| `trial_used` | This account has had a trial, a subscription or a seed grant. |
| `billing_unavailable` / `billing_failed` | This build carries no Creem store, or Creem did not answer. Retry later. |
| `conflict` | A public API state rule: nothing to decide on, an approved review, a finished task, a name already taken. |
| `version_conflict` | The card or a board file changed since it was read. Read it again and redo the change. |
| `review_outdated` | The task changed since it was opened. Reload and review again. |
| `card_missing` | The task has no full card to review yet. |
| `task_running` | A run task's step is running; the Runner cannot stop it midway. |
| `link_invalid` / `link_expired` / `link_revoked` | A share link that never existed, ran out, or was revoked. |
| `sign_in_required` / `not_invited` | An `invited` link with no sign-in, or one whose email is not a guest of the task. |
| `view_only` / `owner_only` | A write through a `link` link without a role, or what only the workspace's members may do. |
| `chat_busy` / `runner_offline` | A chat message while a reply is on its way, or with the task's Runner not connected. |
| `runner_removed` | Running, resuming or chatting on a runtime whose Runner an owner removed from the workspace; nothing is kept. A step already queued waits instead, with `run.runner_removed`. |
| `runtime_unavailable` | A chat message on a connector not installed or signed in on the task's Runner: `connector`, and `reason` `not_installed` or `signed_out`. |
| `read_only` | A built-in workflow cannot be changed or deleted. |
| `payload_too_large` | A field, inline artifact (256 KB), board file (256 KB), single PUT (50 MB) or part over its limit. |
| `quota_exceeded` | A plan limit is reached. Carries `quota` (`tasks`, `storage`, `file_size`) and its `limit`. |
| `idempotency_key_reused` | One `Idempotency-Key`, two different requests. |
| `idempotency_in_progress` | The first request under this key is still running. Carries `retry-after`. |
| `session_required` | API keys are created and revoked with a sign-in, not with a key. |
| `artifacts_unavailable` | This build carries no artifact bucket. |
| `daily_write_budget_reached` | The service's daily write budget is spent. |
| `storage_limit_reached` | The database turned read-only at its size limit. |
